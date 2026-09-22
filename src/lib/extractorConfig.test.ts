import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EXTRACTOR_CONFIGS,
  DEFAULT_PROMPT_VERSIONS,
  activatePromptVersion,
  calculateEstimatedCost,
  createAiExecutionLog,
  createNextPromptVersion,
  isTransientError,
  resolveExecutionPlan,
  testPromptInSandbox,
} from './extractorConfig'
import type { ExtractorConfig, PromptVersion } from '../types'

describe('Épica E06: Configuración de extractores, prompts y modelos (P0)', () => {
  describe('US-056: Configuración de proveedor, modelo y parámetros permitidos', () => {
    it('proporciona configuración por defecto para los tres extractores del sistema', () => {
      expect(DEFAULT_EXTRACTOR_CONFIGS).toHaveLength(3)
      const keys = DEFAULT_EXTRACTOR_CONFIGS.map((c) => c.extractorKey)
      expect(keys).toContain('title_study')
      expect(keys).toContain('plan')
      expect(keys).toContain('negotiation')

      const titleConfig = DEFAULT_EXTRACTOR_CONFIGS.find((c) => c.extractorKey === 'title_study')!
      expect(titleConfig.provider).toBe('openai')
      expect(titleConfig.primaryModel).toBe('gpt-4o')
      expect(titleConfig.fallbackModel).toBe('gpt-4o-mini')
      expect(titleConfig.temperature).toBe(0.0)
      expect(titleConfig.timeoutSeconds).toBeGreaterThanOrEqual(120)
      expect(titleConfig.isEnabled).toBe(true)
    })

    it('respeta la deshabilitación del extractor sin intentar llamada de IA', () => {
      const disabledConfig: ExtractorConfig = {
        extractorKey: 'plan',
        provider: 'openai',
        primaryModel: 'gpt-4o',
        fallbackModel: 'gpt-4o-mini',
        temperature: 0.0,
        maxTokens: 2048,
        timeoutSeconds: 60,
        isEnabled: false,
      }

      const plan = resolveExecutionPlan(disabledConfig)
      expect(plan.canAttempt).toBe(false)
      expect(plan.skipReason).toContain('deshabilitado')
    })
  })

  describe('US-057: Versionado administrable de prompts sin alterar ejecuciones aprobadas', () => {
    it('crea una nueva versión incrementando el número sin mutar las versiones previas', () => {
      const initialVersions: PromptVersion[] = [...DEFAULT_PROMPT_VERSIONS]
      const currentTitleV1 = initialVersions.find((v) => v.extractorKey === 'title_study')!
      expect(currentTitleV1.version).toBe(1)
      expect(currentTitleV1.active).toBe(true)

      const result = createNextPromptVersion(initialVersions, {
        extractorKey: 'title_study',
        name: 'Estudio de títulos — v2 mejorada con linderos ampliados',
        prompt: 'Nuevo prompt con instrucciones reforzadas sobre modo de adquisición.',
        schema: currentTitleV1.schema,
        setActive: true,
      })

      // Nueva versión es v2
      expect(result.newVersion.version).toBe(2)
      expect(result.newVersion.active).toBe(true)
      expect(result.newVersion.name).toContain('v2')

      // La versión original v1 sigue existiendo inalterada (salvo que ya no es la activa por defecto)
      const historicalV1 = result.updatedList.find((v) => v.id === currentTitleV1.id)!
      expect(historicalV1.version).toBe(1)
      expect(historicalV1.active).toBe(false)
      expect(historicalV1.prompt).toBe(currentTitleV1.prompt) // El texto original no muta
    })

    it('permite alternar la versión activa de manera unívoca por extractor', () => {
      const versions: PromptVersion[] = [
        {
          id: 'v1',
          extractorKey: 'title_study',
          version: 1,
          name: 'v1',
          prompt: 'p1',
          schema: {},
          active: true,
          createdAt: '2026-01-01',
        },
        {
          id: 'v2',
          extractorKey: 'title_study',
          version: 2,
          name: 'v2',
          prompt: 'p2',
          schema: {},
          active: false,
          createdAt: '2026-01-02',
        },
      ]

      const updated = activatePromptVersion(versions, 'v2')
      const v1 = updated.find((v) => v.id === 'v1')!
      const v2 = updated.find((v) => v.id === 'v2')!

      expect(v1.active).toBe(false)
      expect(v2.active).toBe(true)
    })
  })

  describe('US-060: Fallback configurado de proveedor o modelo solo para fallos transitorios', () => {
    const config: ExtractorConfig = {
      extractorKey: 'title_study',
      provider: 'openai',
      primaryModel: 'gpt-4o',
      fallbackModel: 'gpt-4o-mini',
      temperature: 0.0,
      maxTokens: 4096,
      timeoutSeconds: 120,
      isEnabled: true,
    }

    it('identifica correctamente errores transitorios (429, 503, timeout)', () => {
      expect(isTransientError('HTTP 429 Too Many Requests: rate_limit_exceeded')).toBe(true)
      expect(isTransientError(new Error('Connection timed out after 120s'))).toBe(true)
      expect(isTransientError('503 Service Unavailable: server overloaded')).toBe(true)
      expect(isTransientError('ECONNRESET')).toBe(true)
    })

    it('identifica como NO transitorios errores de cliente o esquema (400, 401, validation)', () => {
      expect(isTransientError('HTTP 400 Bad Request: Invalid payload')).toBe(false)
      expect(isTransientError(new Error('401 Unauthorized: Invalid API key'))).toBe(false)
      expect(isTransientError('Schema validation error: missing required key')).toBe(false)
    })

    it('activa el modelo de fallback cuando ocurre un fallo transitorio', () => {
      const transientErr = new Error('HTTP 429 Rate limit reached for gpt-4o')
      const plan = resolveExecutionPlan(config, transientErr)

      expect(plan.canAttempt).toBe(true)
      expect(plan.isFallback).toBe(true)
      expect(plan.modelToUse).toBe('gpt-4o-mini')
      expect(plan.fallbackReason).toContain('Fallo transitorio en modelo principal')
    })

    it('NO activa fallback cuando el error es permanente/no transitorio', () => {
      const nonTransientErr = new Error('HTTP 401 Invalid Authentication')
      const plan = resolveExecutionPlan(config, nonTransientErr)

      expect(plan.canAttempt).toBe(false)
      expect(plan.isFallback).toBe(false)
      expect(plan.skipReason).toContain('Fallo no transitorio')
    })
  })

  describe('US-059: Trazabilidad técnica de ejecuciones de IA', () => {
    it('calcula costos estimados de acuerdo a las tarifas de cada modelo', () => {
      const cost4o = calculateEstimatedCost('gpt-4o', 1000, 500)
      // 1000 * 2.5/1M = 0.0025; 500 * 10/1M = 0.005 => 0.0075
      expect(cost4o).toBeCloseTo(0.0075, 4)

      const costMini = calculateEstimatedCost('gpt-4o-mini', 1000, 500)
      // 1000 * 0.15/1M = 0.00015; 500 * 0.6/1M = 0.0003 => 0.00045
      expect(costMini).toBeCloseTo(0.00045, 5)

      // Gemini 3.8 Flash (hasta 31 dic 2026: 0.75 in / 3.75 out por 1M)
      const date2026 = new Date('2026-09-22T00:00:00Z')
      const costGemini2026 = calculateEstimatedCost('gemini-3.8-flash', 1000, 500, date2026)
      // 1000 * 0.75/1M = 0.00075; 500 * 3.75/1M = 0.001875 => 0.002625
      expect(costGemini2026).toBeCloseTo(0.002625, 6)

      // Gemini 3.8 Flash (a partir de 2027: 1.50 in / 7.50 out por 1M)
      const date2027 = new Date('2027-01-15T00:00:00Z')
      const costGemini2027 = calculateEstimatedCost('gemini-3.8-flash', 1000, 500, date2027)
      // 1000 * 1.50/1M = 0.0015; 500 * 7.50/1M = 0.00375 => 0.00525
      expect(costGemini2027).toBeCloseTo(0.00525, 6)
    })

    it('construye un log de ejecución estructurado con modelo solicitado vs usado y tokens', () => {
      const log = createAiExecutionLog({
        projectId: 'proj-123',
        batchId: 'batch-456',
        taskId: 'task-789',
        extractorKey: 'title_study',
        promptVersionId: 'prompt-title-v1',
        promptVersionNumber: 1,
        requestedModel: 'gpt-4o',
        usedModel: 'gpt-4o-mini',
        fallbackTriggered: true,
        fallbackReason: 'HTTP 429 en gpt-4o',
        status: 'fallback_success',
        latencyMs: 1450,
        promptTokens: 1200,
        completionTokens: 350,
      })

      expect(log.requestedModel).toBe('gpt-4o')
      expect(log.usedModel).toBe('gpt-4o-mini')
      expect(log.fallbackTriggered).toBe(true)
      expect(log.status).toBe('fallback_success')
      expect(log.totalTokens).toBe(1550)
      expect(log.estimatedCostUsd).toBeGreaterThan(0)
      expect(log.isTestRun).toBe(false)
    })
  })

  describe('US-062: Entorno de prueba de prompts (Sandbox sin datos productivos)', () => {
    it('ejecuta la prueba en sandbox marcando isTestRun=true y sin tocar tablas de producción', () => {
      const sampleText = `
        OFICINA DE REGISTRO DE INSTRUMENTOS PÚBLICOS DE BOGOTÁ
        MATRÍCULA INMOBILIARIA: 50N-2099881
        PREDIO: LOTE EL RECUERDO
        ÁREA TOTAL: 15 ha + 2.000 m²
        Limpio de gravamen y sin limitaciones vigentes.
      `

      const testResult = testPromptInSandbox({
        extractorKey: 'title_study',
        promptText: DEFAULT_PROMPT_VERSIONS[0].prompt,
        schema: DEFAULT_PROMPT_VERSIONS[0].schema,
        sampleInput: sampleText,
      })

      expect(testResult.isTestRun).toBe(true)
      expect(testResult.success).toBe(true)
      expect(testResult.output).toBeDefined()
      expect(testResult.output?.records).toBeInstanceOf(Array)
      expect(testResult.tokens.total).toBeGreaterThan(0)
      expect(testResult.validationErrors).toHaveLength(0)

      // Comprueba extracción simulada
      const record = (testResult.output?.records as any[])[0]
      expect(record.folio).toBe('50N-2099881')
    })

    it('rechaza y reporta error si el insumo de prueba está vacío', () => {
      const testResult = testPromptInSandbox({
        extractorKey: 'title_study',
        promptText: 'prompt',
        schema: {},
        sampleInput: '   ',
      })

      expect(testResult.success).toBe(false)
      expect(testResult.validationErrors[0]).toContain('insumo de prueba no puede estar vacío')
    })
  })
})
