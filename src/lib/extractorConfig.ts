import type {
  AiExecutionLog,
  ExtractorConfig,
  PromptTestRequest,
  PromptTestResult,
  PromptVersion,
} from '../types'

export const DEFAULT_EXTRACTOR_CONFIGS: ExtractorConfig[] = [
  {
    extractorKey: 'title_study',
    provider: 'openai',
    primaryModel: 'gpt-4o',
    fallbackModel: 'gpt-4o-mini',
    fallbackProvider: 'openai',
    temperature: 0.0,
    maxTokens: 4096,
    timeoutSeconds: 180,
    isEnabled: true,
  },
  {
    extractorKey: 'plan',
    provider: 'openai',
    primaryModel: 'gpt-4o',
    fallbackModel: 'gpt-4o-mini',
    fallbackProvider: 'openai',
    temperature: 0.0,
    maxTokens: 4096,
    timeoutSeconds: 120,
    isEnabled: true,
  },
  {
    extractorKey: 'negotiation',
    provider: 'openai',
    primaryModel: 'gpt-4o',
    fallbackModel: 'gpt-4o-mini',
    fallbackProvider: 'openai',
    temperature: 0.0,
    maxTokens: 4096,
    timeoutSeconds: 120,
    isEnabled: true,
  },
]

export const DEFAULT_PROMPT_VERSIONS: PromptVersion[] = [
  {
    id: 'prompt-title-v1',
    extractorKey: 'title_study',
    version: 1,
    name: 'Estudios de títulos — Extracción base estricta',
    prompt:
      'Eres un perito jurídico experto en derecho de tierras y estudio de títulos colombiano. Extrae folio de matrícula, cédula catastral, titulares vigentes con documento de identidad y porcentaje, descripción de cabida y linderos exactos, gravámenes o medidas cautelares, y modo de adquisición en orden cronológico.',
    schema: {
      type: 'object',
      required: ['records'],
      properties: {
        records: {
          type: 'array',
          items: {
            type: 'object',
            required: ['canonical_name', 'folio', 'municipality', 'confidence', 'attributes'],
          },
        },
      },
    },
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prompt-plan-v1',
    extractorKey: 'plan',
    version: 1,
    name: 'Planos técnicos y topográficos — Extracción métrica',
    prompt:
      'Eres un ingeniero topográfico. Extrae área total, área de afectación, escala, cuadro de coordenadas, colindantes y fecha de levantamiento.',
    schema: {
      type: 'object',
      required: ['records'],
      properties: {
        records: { type: 'array', items: { type: 'object', required: ['canonical_name', 'attributes'] } },
      },
    },
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prompt-neg-v1',
    extractorKey: 'negotiation',
    version: 1,
    name: 'Negociación y avalúos — Ofertas y condiciones',
    prompt:
      'Eres un negociador predial. Extrae ofertas formales, valores en números y letras, estado de aceptación, observaciones y condiciones suspensivas.',
    schema: {
      type: 'object',
      required: ['records'],
      properties: {
        records: { type: 'array', items: { type: 'object', required: ['canonical_name', 'attributes'] } },
      },
    },
    active: true,
    createdAt: new Date().toISOString(),
  },
]

/**
 * US-060: Detecta si un error de IA es transitorio y califica para fallback automático.
 * Errores transitorios: 429 (Rate Limit), 500, 502, 503, 504, Timeout, ECONNRESET.
 * Errores no transitorios: 400 (Bad Request), 401 (Auth), 404, Schema validation error.
 */
export function isTransientError(error: unknown): boolean {
  if (!error) return false
  const message = typeof error === 'string' ? error : error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()

  if (
    lower.includes('429') ||
    lower.includes('rate_limit') ||
    lower.includes('rate limit') ||
    lower.includes('quota') ||
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('overloaded') ||
    lower.includes('service_unavailable')
  ) {
    return true
  }

  return false
}

export interface ExecutionDecision {
  modelToUse: string
  providerToUse: string
  isFallback: boolean
  fallbackReason?: string | null
  canAttempt: boolean
  skipReason?: string | null
}

/**
 * US-056 & US-060: Determina si ejecutar el modelo principal o activar el fallback configurado.
 */
export function resolveExecutionPlan(
  config: ExtractorConfig,
  previousError?: unknown
): ExecutionDecision {
  if (!config.isEnabled) {
    return {
      modelToUse: config.primaryModel,
      providerToUse: config.provider,
      isFallback: false,
      canAttempt: false,
      skipReason: `El extractor ${config.extractorKey} está deshabilitado en configuración.`,
    }
  }

  // Intento primario
  if (!previousError) {
    return {
      modelToUse: config.primaryModel,
      providerToUse: config.provider,
      isFallback: false,
      canAttempt: true,
    }
  }

  // Fallo en intento primario: evaluar si procede fallback
  const isTransient = isTransientError(previousError)
  const errMessage = previousError instanceof Error ? previousError.message : String(previousError)

  if (!isTransient) {
    return {
      modelToUse: config.primaryModel,
      providerToUse: config.provider,
      isFallback: false,
      canAttempt: false,
      skipReason: `Fallo no transitorio (${errMessage}); no se activa fallback para evitar desperdicio de cuota.`,
    }
  }

  if (!config.fallbackModel) {
    return {
      modelToUse: config.primaryModel,
      providerToUse: config.provider,
      isFallback: false,
      canAttempt: false,
      skipReason: `Fallo transitorio detectado (${errMessage}), pero no hay modelo alterno/fallback configurado.`,
    }
  }

  return {
    modelToUse: config.fallbackModel,
    providerToUse: config.fallbackProvider ?? config.provider,
    isFallback: true,
    fallbackReason: `Fallo transitorio en modelo principal: ${errMessage}`,
    canAttempt: true,
  }
}

/**
 * US-057: Versionado inmutable de prompts.
 * Crea una nueva versión con version = MAX(version) + 1 sin alterar las versiones históricas ya registradas.
 */
export function createNextPromptVersion(
  existingVersions: PromptVersion[],
  params: {
    extractorKey: 'title_study' | 'plan' | 'negotiation'
    name: string
    prompt: string
    schema: Record<string, unknown>
    setActive?: boolean
  }
): { newVersion: PromptVersion; updatedList: PromptVersion[] } {
  const versionsForExtractor = existingVersions.filter(
    (v) => v.extractorKey === params.extractorKey
  )
  const highestVersion = versionsForExtractor.reduce((max, v) => Math.max(max, v.version), 0)
  const nextVersionNumber = highestVersion + 1

  const newVersion: PromptVersion = {
    id: `prompt-${params.extractorKey}-v${nextVersionNumber}-${crypto.randomUUID().slice(0, 8)}`,
    extractorKey: params.extractorKey,
    version: nextVersionNumber,
    name: params.name.trim(),
    prompt: params.prompt.trim(),
    schema: params.schema,
    active: params.setActive ?? true,
    createdAt: new Date().toISOString(),
  }

  const updatedList = existingVersions.map((v) => {
    if (v.extractorKey === params.extractorKey && (params.setActive ?? true)) {
      return { ...v, active: false }
    }
    return v
  })

  return {
    newVersion,
    updatedList: [newVersion, ...updatedList],
  }
}

/**
 * US-057: Activar una versión específica garantizando que las demás versiones del mismo extractor queden inactivas.
 */
export function activatePromptVersion(
  versions: PromptVersion[],
  targetVersionId: string
): PromptVersion[] {
  const target = versions.find((v) => v.id === targetVersionId)
  if (!target) return versions

  return versions.map((v) => {
    if (v.extractorKey === target.extractorKey) {
      return { ...v, active: v.id === targetVersionId }
    }
    return v
  })
}

/**
 * US-059: Estima costo de tokens según modelo.
 */
export function calculateEstimatedCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const lower = model.toLowerCase()
  let promptRatePerMillion = 2.5
  let completionRatePerMillion = 10.0

  if (lower.includes('gpt-4o-mini')) {
    promptRatePerMillion = 0.15
    completionRatePerMillion = 0.6
  } else if (lower.includes('gpt-4o')) {
    promptRatePerMillion = 2.5
    completionRatePerMillion = 10.0
  } else if (lower.includes('o3') || lower.includes('o1')) {
    promptRatePerMillion = 15.0
    completionRatePerMillion = 60.0
  } else if (lower.includes('claude-3-5-sonnet')) {
    promptRatePerMillion = 3.0
    completionRatePerMillion = 15.0
  }

  const cost =
    (promptTokens / 1_000_000) * promptRatePerMillion +
    (completionTokens / 1_000_000) * completionRatePerMillion

  return Number(cost.toFixed(6))
}

/**
 * US-059: Construye un registro de auditoría técnica / telemetría de IA.
 */
export function createAiExecutionLog(params: {
  projectId?: string | null
  batchId?: string | null
  taskId?: string | null
  documentId?: string | null
  extractorKey: 'title_study' | 'plan' | 'negotiation'
  promptVersionId?: string | null
  promptVersionNumber?: number | null
  requestedModel: string
  usedModel: string
  fallbackTriggered: boolean
  fallbackReason?: string | null
  status: 'success' | 'failed' | 'fallback_success'
  latencyMs: number
  promptTokens: number
  completionTokens: number
  errorMessage?: string | null
  isTestRun?: boolean
}): AiExecutionLog {
  const totalTokens = params.promptTokens + params.completionTokens
  const estimatedCostUsd = calculateEstimatedCost(
    params.usedModel,
    params.promptTokens,
    params.completionTokens
  )

  return {
    id: `ailog-${crypto.randomUUID()}`,
    projectId: params.projectId ?? null,
    batchId: params.batchId ?? null,
    taskId: params.taskId ?? null,
    documentId: params.documentId ?? null,
    extractorKey: params.extractorKey,
    promptVersionId: params.promptVersionId ?? null,
    promptVersionNumber: params.promptVersionNumber ?? null,
    requestedModel: params.requestedModel,
    usedModel: params.usedModel,
    fallbackTriggered: params.fallbackTriggered,
    fallbackReason: params.fallbackReason ?? null,
    status: params.status,
    latencyMs: params.latencyMs,
    promptTokens: params.promptTokens,
    completionTokens: params.completionTokens,
    totalTokens,
    estimatedCostUsd,
    errorMessage: params.errorMessage ?? null,
    isTestRun: params.isTestRun ?? false,
    createdAt: new Date().toISOString(),
  }
}

/**
 * US-062: Entorno de prueba de prompts (Sandbox)
 * Ejecuta una prueba sobre insumo simulado o muestra SIN escribir en property_records,
 * extracted_attributes ni review_tasks de producción.
 */
export function testPromptInSandbox(
  request: PromptTestRequest,
  config?: ExtractorConfig
): PromptTestResult {
  const startTime = Date.now()
  const modelUsed = request.modelOverride || config?.primaryModel || 'gpt-4o'
  const validationErrors: string[] = []

  // Validar insumo mínimo
  if (!request.sampleInput.trim()) {
    return {
      success: false,
      output: null,
      validationErrors: ['El insumo de prueba no puede estar vacío.'],
      tokens: { prompt: 0, completion: 0, total: 0 },
      latencyMs: 0,
      modelUsed,
      isTestRun: true,
    }
  }

  // Simulación de extracción estructurada basada en el insumo
  const text = request.sampleInput
  const folioMatch = text.match(/\b(?:\d{2,3}[A-Z]?|[A-Z]{1,3})-\d{4,8}\b/i)
  const folio = folioMatch ? folioMatch[0] : '50N-DEMO-TEST'
  const areaMatch = text.match(/(\d+[\d.,]*\s*(?:ha|hect[aá]reas|m[²2]|metros\s*cuadrados))/i)

  const simulatedOutput: Record<string, unknown> = {
    records: [
      {
        canonical_name: `Predio de prueba sandbox (${request.extractorKey})`,
        folio,
        municipality: 'Bogotá D.C. (Prueba)',
        confidence: 0.94,
        attributes: [
          {
            key: 'Matrícula inmobiliaria',
            value: folio,
            confidence: 0.98,
            evidence: [{ source: 'Insumo de prueba', page: '1', quote: folio }],
          },
          {
            key: 'Área identificada',
            value: areaMatch ? areaMatch[0] : '10.500 m²',
            confidence: 0.91,
            evidence: [{ source: 'Insumo de prueba', page: '1', quote: areaMatch ? areaMatch[0] : '10.500 m²' }],
          },
          {
            key: 'Condición jurídica',
            value: 'Sin gravámenes vigentes detectados',
            confidence: 0.88,
            evidence: [{ source: 'Insumo de prueba', page: '1', quote: 'Limpio de gravamen' }],
          },
        ],
        review_reasons: [],
      },
    ],
  }

  // Validar contrato del esquema esperado
  if (request.schema && typeof request.schema === 'object') {
    const requiredKeys = (request.schema as { required?: string[] }).required
    if (requiredKeys && Array.isArray(requiredKeys)) {
      for (const req of requiredKeys) {
        if (!(req in simulatedOutput)) {
          validationErrors.push(`Falta campo requerido por contrato: "${req}"`)
        }
      }
    }
  }

  const latencyMs = Math.max(120, Date.now() - startTime + 150)
  const promptTokens = Math.max(50, Math.floor((request.promptText.length + request.sampleInput.length) / 4))
  const completionTokens = Math.max(40, Math.floor(JSON.stringify(simulatedOutput).length / 4))

  return {
    success: validationErrors.length === 0,
    output: simulatedOutput,
    validationErrors,
    tokens: {
      prompt: promptTokens,
      completion: completionTokens,
      total: promptTokens + completionTokens,
    },
    latencyMs,
    modelUsed,
    isTestRun: true,
  }
}
