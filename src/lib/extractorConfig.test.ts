import { describe, expect, it } from 'vitest'
import { DEFAULT_EXTRACTOR_CONFIGS, DEFAULT_PROMPT_VERSIONS, createAiExecutionLog, testPromptInSandbox } from './extractorConfig'

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
  })

  describe('US-059: Trazabilidad técnica de ejecuciones de IA', () => {

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
