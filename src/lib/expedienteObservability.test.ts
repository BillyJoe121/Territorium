import { describe, expect, it } from 'vitest'
import {
  calculateLlmCost,
  evaluateObservabilityAlerts,
  sanitizeTelemetryPayload,
  type StageExecutionMetric,
} from './expedienteObservability'

describe('HU-V2-056: Observability, LLM Cost Calculation & Data Privacy', () => {
  describe('calculateLlmCost', () => {
    it('calculates deterministic cost for prompt and completion tokens', () => {
      // 10,000 prompt tokens * 0.0025 / 1k = 0.025
      // 2,000 completion tokens * 0.01 / 1k = 0.020
      // Total = 0.045
      const cost = calculateLlmCost(10_000, 2_000)
      expect(cost).toBe(0.045)
    })

    it('handles zero tokens gracefully', () => {
      expect(calculateLlmCost(0, 0)).toBe(0)
    })

    it('formats small amounts with standard precision', () => {
      const cost = calculateLlmCost(500, 100)
      expect(cost).toBeGreaterThan(0)
      expect(typeof cost).toBe('number')
    })
  })

  describe('sanitizeTelemetryPayload', () => {
    it('replaces sensitive legal and PII fields with secure redacted placeholders', () => {
      const payload = {
        stage: 'titles',
        durationMs: 1420,
        folioMatricula: '50N-20491823',
        cedulaPropietario: '1029384756',
        ownerName: 'Juan Carlos Restrepo',
        valorOferta: 450000000,
        linderoNorte: 'Con predio La Esperanza en 120 metros lineales',
        narrativeLegal: 'El estudio concluye que no existen gravámenes vigentes',
      }

      const sanitized = sanitizeTelemetryPayload(payload)

      expect(sanitized.stage).toBe('titles')
      expect(sanitized.durationMs).toBe(1420)

      // Verify redaction of all sensitive keys
      expect(sanitized.folioMatricula).toMatch(/\[REDACTED_SECURE_TOKEN_\d+_CHARS\]/)
      expect(sanitized.cedulaPropietario).toMatch(/\[REDACTED_SECURE_TOKEN_\d+_CHARS\]/)
      expect(sanitized.ownerName).toMatch(/\[REDACTED_SECURE_TOKEN_\d+_CHARS\]/)
      expect(sanitized.valorOferta).toBe('[REDACTED]')
      expect(sanitized.linderoNorte).toMatch(/\[REDACTED_SECURE_TOKEN_\d+_CHARS\]/)
      expect(sanitized.narrativeLegal).toMatch(/\[REDACTED_SECURE_TOKEN_\d+_CHARS\]/)
    })

    it('recursively sanitizes nested objects without modifying non-sensitive nested data', () => {
      const complexData = {
        expedienteId: 'exp-123',
        meta: {
          clientName: 'Consorcio Vial',
          details: {
            propietarioActual: 'María Gómez',
            superficieM2: 1540.5,
          },
        },
      }

      const sanitized = sanitizeTelemetryPayload(complexData)

      expect(sanitized.expedienteId).toBe('exp-123')
      const meta = sanitized.meta as Record<string, unknown>
      expect(meta.clientName).toMatch(/\[REDACTED_SECURE_TOKEN_\d+_CHARS\]/)

      const details = meta.details as Record<string, unknown>
      expect(details.propietarioActual).toMatch(/\[REDACTED_SECURE_TOKEN_\d+_CHARS\]/)
      expect(details.superficieM2).toBe(1540.5)
    })
  })

  describe('evaluateObservabilityAlerts', () => {
    it('returns no alerts for executions within normal parameters', () => {
      const normalMetric: StageExecutionMetric = {
        stage: 'plans',
        expedienteId: 'exp-normal',
        durationMs: 45_000,
        queueLatencyMs: 250,
        retryCount: 0,
        status: 'success',
        tokenUsage: {
          promptTokens: 4000,
          completionTokens: 800,
          totalTokens: 4800,
          estimatedCostUsd: 0.018,
        },
        recordedAt: new Date().toISOString(),
      }

      const alerts = evaluateObservabilityAlerts(normalMetric)
      expect(alerts).toHaveLength(0)
    })

    it('triggers critical alert when stage duration exceeds 10 minutes', () => {
      const stuckMetric: StageExecutionMetric = {
        stage: 'consolidation',
        expedienteId: 'exp-stuck',
        durationMs: 650_000, // > 600,000ms
        queueLatencyMs: 300,
        retryCount: 1,
        status: 'success',
        recordedAt: new Date().toISOString(),
      }

      const alerts = evaluateObservabilityAlerts(stuckMetric)
      expect(alerts.some((a) => a.metric === 'STAGE_DURATION_EXCEEDED' && a.severity === 'critical')).toBe(true)
    })

    it('triggers warning alert when retry count reaches or exceeds 3', () => {
      const retryingMetric: StageExecutionMetric = {
        stage: 'negotiation',
        expedienteId: 'exp-retry',
        durationMs: 20_000,
        queueLatencyMs: 120,
        retryCount: 3,
        status: 'retrying',
        recordedAt: new Date().toISOString(),
      }

      const alerts = evaluateObservabilityAlerts(retryingMetric)
      expect(alerts.some((a) => a.metric === 'HIGH_RETRY_COUNT' && a.severity === 'warning')).toBe(true)
    })

    it('triggers warning alert on excessive token consumption (>50k tokens)', () => {
      const highTokenMetric: StageExecutionMetric = {
        stage: 'document',
        expedienteId: 'exp-tokens',
        durationMs: 90_000,
        queueLatencyMs: 400,
        retryCount: 0,
        status: 'success',
        tokenUsage: {
          promptTokens: 45_000,
          completionTokens: 10_000,
          totalTokens: 55_000,
          estimatedCostUsd: 0.2125,
        },
        recordedAt: new Date().toISOString(),
      }

      const alerts = evaluateObservabilityAlerts(highTokenMetric)
      expect(alerts.some((a) => a.metric === 'HIGH_TOKEN_CONSUMPTION' && a.severity === 'warning')).toBe(true)
    })
  })
})
