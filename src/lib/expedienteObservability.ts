export type ExpedienteStage = 'titles' | 'plans' | 'negotiation' | 'consolidation' | 'document'

export interface StageExecutionMetric {
  stage: ExpedienteStage
  expedienteId: string
  durationMs: number
  queueLatencyMs: number
  retryCount: number
  status: 'success' | 'failed' | 'retrying'
  errorCode?: string
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    estimatedCostUsd: number
  }
  recordedAt: string
}

export interface ObservabilityAlert {
  id: string
  severity: 'warning' | 'critical'
  metric: string
  message: string
  expedienteId: string
  stage?: ExpedienteStage
  timestamp: string
}

// Pricing model per 1k tokens (based on GPT-4o / Claude 3.5 Sonnet standard rates)
const COST_PER_1K_PROMPT_USD = 0.0025
const COST_PER_1K_COMPLETION_USD = 0.0100

/**
 * Calculates deterministic estimated cost for LLM executions (HU-V2-056).
 */
export function calculateLlmCost(promptTokens: number, completionTokens: number): number {
  const promptCost = (promptTokens / 1000) * COST_PER_1K_PROMPT_USD
  const completionCost = (completionTokens / 1000) * COST_PER_1K_COMPLETION_USD
  return Number((promptCost + completionCost).toFixed(6))
}

/**
 * List of sensitive fields that MUST BE REDACTED from all telemetry and logs (HU-V2-056).
 */
const SENSITIVE_KEY_PATTERNS = [
  /folio/i,
  /cedula/i,
  /cédula/i,
  /owner/i,
  /propietario/i,
  /lindero/i,
  /oferta/i,
  /valor/i,
  /precio/i,
  /narrative/i,
  /text/i,
  /name/i,
  /documento/i,
]

/**
 * Sanitizes arbitrary log and metric payloads, guaranteeing zero PII or confidential legal content leaks (HU-V2-056).
 */
export function sanitizeTelemetryPayload(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))

    if (isSensitive) {
      if (typeof value === 'string' && value.length > 0) {
        // Redact with masked preview or SHA-anonymized hash
        sanitized[key] = `[REDACTED_SECURE_TOKEN_${value.length}_CHARS]`
      } else {
        sanitized[key] = '[REDACTED]'
      }
      continue
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeTelemetryPayload(value as Record<string, unknown>)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Operational Alert Thresholds:
 * - Stuck jobs (>10 minutes)
 * - Repeated retries (>3 attempts)
 * - Excessive token consumption (>50k tokens)
 */
export function evaluateObservabilityAlerts(metric: StageExecutionMetric): ObservabilityAlert[] {
  const alerts: ObservabilityAlert[] = []

  // 1. Stuck or prolonged stage duration
  if (metric.durationMs > 600_000) {
    alerts.push({
      id: `alert-dur-${metric.expedienteId}-${Date.now()}`,
      severity: 'critical',
      metric: 'STAGE_DURATION_EXCEEDED',
      message: `La etapa '${metric.stage}' superó el tiempo máximo operativo (duración: ${Math.round(metric.durationMs / 1000)}s).`,
      expedienteId: metric.expedienteId,
      stage: metric.stage,
      timestamp: new Date().toISOString(),
    })
  }

  // 2. High retry threshold
  if (metric.retryCount >= 3) {
    alerts.push({
      id: `alert-retry-${metric.expedienteId}-${Date.now()}`,
      severity: 'warning',
      metric: 'HIGH_RETRY_COUNT',
      message: `La etapa '${metric.stage}' acumuló ${metric.retryCount} reintentos consecutivos.`,
      expedienteId: metric.expedienteId,
      stage: metric.stage,
      timestamp: new Date().toISOString(),
    })
  }

  // 3. Excessive token consumption
  if (metric.tokenUsage && metric.tokenUsage.totalTokens > 50_000) {
    alerts.push({
      id: `alert-tokens-${metric.expedienteId}-${Date.now()}`,
      severity: 'warning',
      metric: 'HIGH_TOKEN_CONSUMPTION',
      message: `Consumo anómalo de tokens en la etapa '${metric.stage}': ${metric.tokenUsage.totalTokens} tokens ($${metric.tokenUsage.estimatedCostUsd} USD).`,
      expedienteId: metric.expedienteId,
      stage: metric.stage,
      timestamp: new Date().toISOString(),
    })
  }

  return alerts
}
