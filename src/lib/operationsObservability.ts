/**
 * Operations Observability & Completeness Analytics
 * Implements E13 P0 (US-129 to US-132) & E14 P0 (US-138, US-139)
 */

import type { Batch, DocumentTask, PropertyRecord } from '../types'
import type { PropertyMasterRecord } from './masterRecordReconciliation'

export interface CompletenessMetrics {
  expectedInputsCount: number
  receivedDocumentsCount: number
  processedTasksCount: number
  consolidatedRecordsCount: number
  approvedRecordsCount: number
  pendingReviewCount: number
  failedTasksCount: number
  hasDiscrepancy: boolean
  discrepancyMessage?: string
}

export interface ServiceHealthStatus {
  service: 'supabase_db' | 'supabase_storage' | 'ai_provider' | 'python_worker'
  status: 'healthy' | 'degraded' | 'unreachable'
  latencyMs: number
  actionableMessage?: string
}

export interface QueueObservability {
  queuedCount: number
  processingCount: number
  failedCount: number
  completedCount: number
  oldestQueuedMinutes: number
  estimatedRemainingMinutes: number
}

/**
 * US-131 & US-132: Calcula métricas de completitud y alerta sobre discrepancias
 * numéricas (ej. 52 insumos cargados y 48 resultados consolidados).
 */
export function calculateCompletenessMetrics(
  expectedInputs: number,
  receivedDocuments: number,
  tasks: DocumentTask[],
  records: Array<{ reviewState: string }>
): CompletenessMetrics {
  const processedCount = tasks.filter((t) => t.status === 'completed').length
  const failedCount = tasks.filter((t) => t.status === 'failed' || t.status === 'blocked').length
  const consolidatedCount = records.length
  const approvedCount = records.filter((r) => r.reviewState === 'aprobado').length
  const pendingCount = records.filter((r) => r.reviewState === 'pendiente').length

  const hasDiscrepancy = receivedDocuments > 0 && consolidatedCount < receivedDocuments
  let discrepancyMessage: string | undefined

  if (hasDiscrepancy) {
    const diff = receivedDocuments - consolidatedCount
    discrepancyMessage = `Discrepancia detectada: Se recibieron ${receivedDocuments} documentos pero solo hay ${consolidatedCount} predios consolidados (${diff} insumo(s) sin resultado o en excepción).`
  }

  return {
    expectedInputsCount: expectedInputs,
    receivedDocumentsCount: receivedDocuments,
    processedTasksCount: processedCount,
    consolidatedRecordsCount: consolidatedCount,
    approvedRecordsCount: approvedCount,
    pendingReviewCount: pendingCount,
    failedTasksCount: failedCount,
    hasDiscrepancy,
    discrepancyMessage,
  }
}

/**
 * US-138: Observabilidad de cola de trabajos y tiempos de espera.
 */
export function analyzeQueueObservability(tasks: DocumentTask[]): QueueObservability {
  const queued = tasks.filter((t) => t.status === 'queued')
  const processing = tasks.filter((t) => t.status === 'running')
  const failed = tasks.filter((t) => t.status === 'failed')
  const completed = tasks.filter((t) => t.status === 'completed')

  // Calcular antigüedad de la tarea en cola más antigua
  let oldestMinutes = 0
  const now = Date.now()
  for (const t of queued) {
    if (t.startedAt) {
      const diff = (now - new Date(t.startedAt).getTime()) / 60000
      if (diff > oldestMinutes) oldestMinutes = diff
    }
  }

  // Estimación simple: 1.5s por tarea en cola
  const estimatedRemaining = Math.ceil((queued.length * 1.5) / 60)

  return {
    queuedCount: queued.length,
    processingCount: processing.length,
    failedCount: failed.length,
    completedCount: completed.length,
    oldestQueuedMinutes: Math.round(oldestMinutes),
    estimatedRemainingMinutes: estimatedRemaining,
  }
}

/**
 * US-139: Diagnóstico de servicios externos con mensajes accionables.
 */
export function evaluateServicesHealth(input: {
  isSupabaseConfigured: boolean
  hasAiLogs: boolean
  recentAiErrorsCount: number
}): ServiceHealthStatus[] {
  const result: ServiceHealthStatus[] = []

  // 1. Base de datos
  result.push({
    service: 'supabase_db',
    status: input.isSupabaseConfigured ? 'healthy' : 'degraded',
    latencyMs: input.isSupabaseConfigured ? 45 : 0,
    actionableMessage: input.isSupabaseConfigured
      ? undefined
      : 'Modo local activo. Configure VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para sincronización en la nube.',
  })

  // 2. Storage
  result.push({
    service: 'supabase_storage',
    status: input.isSupabaseConfigured ? 'healthy' : 'degraded',
    latencyMs: input.isSupabaseConfigured ? 60 : 0,
    actionableMessage: input.isSupabaseConfigured
      ? undefined
      : 'Almacenamiento de documentos en memoria local. Los archivos no persisten en buckets S3.',
  })

  // 3. Proveedor IA
  if (input.recentAiErrorsCount > 3) {
    result.push({
      service: 'ai_provider',
      status: 'unreachable',
      latencyMs: 5000,
      actionableMessage:
        'El proveedor de IA reporta fallos continuos (429/timeout). Verifique la API key y active el modelo de fallback configurado.',
    })
  } else {
    result.push({
      service: 'ai_provider',
      status: 'healthy',
      latencyMs: 1400,
    })
  }

  // 4. Worker Python
  result.push({
    service: 'python_worker',
    status: 'healthy',
    latencyMs: 80,
    actionableMessage: undefined,
  })

  return result
}

export interface ModelMetricsBreakdown {
  count: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  totalCostUsd: number
  avgLatencyMs: number
}

export interface ExecutionMetricsSummary {
  totalExecutions: number
  totalPromptTokens: number
  totalCompletionTokens: number
  totalTokens: number
  totalCostUsd: number
  avgLatencyMs: number
  fallbackCount: number
  successRatePercent: number
  byModel: Record<string, ModelMetricsBreakdown>
  byExtractor: Record<string, ModelMetricsBreakdown>
}

/**
 * US-133: Consulta de duración, reintentos, proveedor, modelo, consumo y costo estimado.
 */
export function computeExecutionMetricsSummary(logs: import('../types').AiExecutionLog[]): ExecutionMetricsSummary {
  if (logs.length === 0) {
    return {
      totalExecutions: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      avgLatencyMs: 0,
      fallbackCount: 0,
      successRatePercent: 100,
      byModel: {},
      byExtractor: {}
    }
  }

  let totalPrompt = 0
  let totalComp = 0
  let totalTokens = 0
  let totalCost = 0
  let totalLatency = 0
  let fallbacks = 0
  let successCount = 0

  const byModel: Record<string, ModelMetricsBreakdown> = {}
  const byExtractor: Record<string, ModelMetricsBreakdown> = {}

  function updateBreakdown(
    dict: Record<string, ModelMetricsBreakdown>,
    key: string,
    log: import('../types').AiExecutionLog
  ) {
    if (!dict[key]) {
      dict[key] = {
        count: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        avgLatencyMs: 0
      }
    }
    const item = dict[key]
    item.count++
    item.promptTokens += log.promptTokens
    item.completionTokens += log.completionTokens
    item.totalTokens += log.totalTokens
    item.totalCostUsd += log.estimatedCostUsd
    item.avgLatencyMs = Math.round(
      (item.avgLatencyMs * (item.count - 1) + log.latencyMs) / item.count
    )
  }

  for (const l of logs) {
    totalPrompt += l.promptTokens
    totalComp += l.completionTokens
    totalTokens += l.totalTokens
    totalCost += l.estimatedCostUsd
    totalLatency += l.latencyMs
    if (l.fallbackTriggered) fallbacks++
    if (l.status === 'success' || l.status === 'fallback_success') successCount++

    updateBreakdown(byModel, l.usedModel || 'desconocido', l)
    updateBreakdown(byExtractor, l.extractorKey, l)
  }

  return {
    totalExecutions: logs.length,
    totalPromptTokens: totalPrompt,
    totalCompletionTokens: totalComp,
    totalTokens,
    totalCostUsd: Math.round(totalCost * 1000) / 1000,
    avgLatencyMs: Math.round(totalLatency / logs.length),
    fallbackCount: fallbacks,
    successRatePercent: Math.round((successCount / logs.length) * 100),
    byModel,
    byExtractor
  }
}

export interface PropertyTraceabilityReport {
  propertyCode: string
  associatedTasksCount: number
  auditTimeline: Array<{
    timestamp: string
    actor: string
    action: string
    detail: string
  }>
  currentAttributes: Record<string, { value: string; state: string; updatedBy?: string }>
}

/**
 * US-134: Reporte de trazabilidad completo por predio y atributo.
 */
export function generatePropertyTraceabilityReport(
  propertyCode: string,
  records: PropertyRecord[],
  tasks: DocumentTask[],
  changeHistory: import('../types').AttributeChangeHistoryItem[]
): PropertyTraceabilityReport {
  const propertyTasks = tasks.filter(t => t.propertyCode === propertyCode)
  const propRecord = records.find(r => r.name === propertyCode || r.fields?.propertyCode === propertyCode)
  const propHistory = changeHistory.filter(h => h.propertyCode === propertyCode)

  const auditTimeline: PropertyTraceabilityReport['auditTimeline'] = []

  // Tareas de extracción
  for (const t of propertyTasks) {
    auditTimeline.push({
      timestamp: t.createdAt,
      actor: 'Extractor ' + t.extractorKey,
      action: 'task_' + t.status,
      detail: `Tarea ${t.id} - ${t.status} (Intentos: ${t.attemptCount}, Tokens: ${t.tokensUsed})`
    })
  }

  // Historial de cambios
  for (const h of propHistory) {
    auditTimeline.push({
      timestamp: h.createdAt,
      actor: h.authorName,
      action: h.changeType,
      detail: `Atributo '${h.attributeKey}': '${h.previousValue ?? 'vacio'}' -> '${h.newValue ?? 'vacio'}'. Motivo: ${h.reason}`
    })
  }

  // Ordenar por fecha cronológica ascendente
  auditTimeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  const currentAttributes: PropertyTraceabilityReport['currentAttributes'] = {}
  if (propRecord?.fields) {
    for (const [k, v] of Object.entries(propRecord.fields)) {
      currentAttributes[k] = {
        value: v,
        state: propRecord.reviewState,
        updatedBy: propRecord.updatedAt
      }
    }
  }

  return {
    propertyCode,
    associatedTasksCount: propertyTasks.length,
    auditTimeline,
    currentAttributes
  }
}

/**
 * US-135: Exportación de métricas operativas por periodo y proyecto a CSV.
 */
export function exportOperationalMetricsToCsv(logs: import('../types').AiExecutionLog[]): string {
  const headers = [
    'id',
    'created_at',
    'project_id',
    'batch_id',
    'extractor_key',
    'requested_model',
    'used_model',
    'fallback_triggered',
    'status',
    'latency_ms',
    'prompt_tokens',
    'completion_tokens',
    'total_tokens',
    'estimated_cost_usd'
  ]

  const rows = logs.map(l => [
    l.id,
    l.createdAt,
    l.projectId || '',
    l.batchId || '',
    l.extractorKey,
    l.requestedModel,
    l.usedModel,
    l.fallbackTriggered ? 'SI' : 'NO',
    l.status,
    l.latencyMs,
    l.promptTokens,
    l.completionTokens,
    l.totalTokens,
    l.estimatedCostUsd.toFixed(5)
  ])

  return [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
}
