import { describe, expect, it } from 'vitest'
import {
  analyzeQueueObservability,
  calculateCompletenessMetrics,
  evaluateServicesHealth,
} from './operationsObservability'
import type { DocumentTask } from '../types'

describe('Operations Observability & Completeness Analytics (E13 & E14 P0)', () => {
  describe('US-131 & US-132: calculateCompletenessMetrics', () => {
    it('detects discrepancy when inputs count exceeds consolidated records count', () => {
      const tasks = [
        { id: '1', batchId: 'b1', projectId: 'p1', sourceDocumentId: 'd1', extractorKey: 'title_study', status: 'completed' },
        { id: '2', batchId: 'b1', projectId: 'p1', sourceDocumentId: 'd2', extractorKey: 'plan', status: 'failed' },
      ] as unknown as DocumentTask[]
      const records = [{ reviewState: 'pendiente' }] // only 1 consolidated

      const metrics = calculateCompletenessMetrics(52, 52, tasks, records)
      expect(metrics.hasDiscrepancy).toBe(true)
      expect(metrics.discrepancyMessage).toContain('52 documentos')
      expect(metrics.discrepancyMessage).toContain('1 predios consolidados')
      expect(metrics.failedTasksCount).toBe(1)
    })

    it('reports no discrepancy when all received inputs are consolidated', () => {
      const tasks = [
        { id: '1', batchId: 'b1', projectId: 'p1', sourceDocumentId: 'd1', extractorKey: 'title_study', status: 'completed' },
      ] as unknown as DocumentTask[]
      const records = [{ reviewState: 'aprobado' }]

      const metrics = calculateCompletenessMetrics(1, 1, tasks, records)
      expect(metrics.hasDiscrepancy).toBe(false)
      expect(metrics.approvedRecordsCount).toBe(1)
    })
  })

  describe('US-138: analyzeQueueObservability', () => {
    it('analyzes queue count and estimates remaining processing time', () => {
      const tasks = [
        { id: '1', batchId: 'b', projectId: 'p', sourceDocumentId: 'd1', extractorKey: 'title_study', status: 'queued', startedAt: new Date(Date.now() - 300000).toISOString() },
        { id: '2', batchId: 'b', projectId: 'p', sourceDocumentId: 'd2', extractorKey: 'plan', status: 'running' },
        { id: '3', batchId: 'b', projectId: 'p', sourceDocumentId: 'd3', extractorKey: 'negotiation', status: 'completed' },
      ] as unknown as DocumentTask[]

      const q = analyzeQueueObservability(tasks)
      expect(q.queuedCount).toBe(1)
      expect(q.processingCount).toBe(1)
      expect(q.completedCount).toBe(1)
      expect(q.oldestQueuedMinutes).toBeGreaterThanOrEqual(4)
    })
  })

  describe('US-139: evaluateServicesHealth', () => {
    it('reports actionable diagnostic message when AI provider experiences high failure rate', () => {
      const health = evaluateServicesHealth({
        isSupabaseConfigured: true,
        hasAiLogs: true,
        recentAiErrorsCount: 5,
      })

      const ai = health.find((s) => s.service === 'ai_provider')
      expect(ai?.status).toBe('unreachable')
      expect(ai?.actionableMessage).toContain('proveedor de IA reporta fallos')
    })
  })

  describe('US-133: computeExecutionMetricsSummary', () => {
    it('calculates total tokens, latency, cost and breakdowns by model and extractor', () => {
      const logs = [
        {
          id: 'l1',
          extractorKey: 'title_study' as const,
          requestedModel: 'gpt-4o',
          usedModel: 'gpt-4o',
          fallbackTriggered: false,
          status: 'success' as const,
          latencyMs: 1500,
          promptTokens: 1000,
          completionTokens: 200,
          totalTokens: 1200,
          estimatedCostUsd: 0.007,
          isTestRun: false,
          createdAt: '2026-01-01'
        },
        {
          id: 'l2',
          extractorKey: 'plan' as const,
          requestedModel: 'gpt-4o',
          usedModel: 'gpt-4o-mini',
          fallbackTriggered: true,
          status: 'fallback_success' as const,
          latencyMs: 800,
          promptTokens: 500,
          completionTokens: 100,
          totalTokens: 600,
          estimatedCostUsd: 0.001,
          isTestRun: false,
          createdAt: '2026-01-01'
        }
      ]

      const summary = import('./operationsObservability').then(m => {
        const s = m.computeExecutionMetricsSummary(logs)
        expect(s.totalExecutions).toBe(2)
        expect(s.totalTokens).toBe(1800)
        expect(s.fallbackCount).toBe(1)
        expect(s.successRatePercent).toBe(100)
        expect(s.byModel['gpt-4o'].count).toBe(1)
        expect(s.byModel['gpt-4o-mini'].count).toBe(1)
      })
    })
  })

  describe('US-134 & US-135: traceability and CSV export', () => {
    it('generates chronological traceability report per property and exports operational metrics CSV', async () => {
      const { generatePropertyTraceabilityReport, exportOperationalMetricsToCsv } = await import('./operationsObservability')
      const tasks = [
        { id: 't1', propertyCode: 'PREDIO-99', extractorKey: 'title_study', status: 'completed', attemptCount: 1, tokensUsed: 500, createdAt: '2026-01-01T10:00:00Z' }
      ] as unknown as DocumentTask[]
      const records = [
        { name: 'PREDIO-99', reviewState: 'aprobado', updatedAt: '2026-01-01', fields: { folio: '123' } }
      ] as unknown as import('../types').PropertyRecord[]
      const history = [
        { id: 'h1', propertyCode: 'PREDIO-99', attributeKey: 'folio', previousValue: null, newValue: '123', authorName: 'Revisor', reason: 'Aprobación', changeType: 'manual_edit' as const, createdAt: '2026-01-01T11:00:00Z' }
      ] as unknown as import('../types').AttributeChangeHistoryItem[]

      const report = generatePropertyTraceabilityReport('PREDIO-99', records, tasks, history)
      expect(report.propertyCode).toBe('PREDIO-99')
      expect(report.auditTimeline.length).toBe(2)
      expect(report.auditTimeline[0].actor).toContain('Extractor title_study')

      const csv = exportOperationalMetricsToCsv([
        {
          id: 'log-1',
          createdAt: '2026-01-01',
          projectId: 'p1',
          batchId: 'b1',
          extractorKey: 'title_study',
          requestedModel: 'gpt-4o',
          usedModel: 'gpt-4o',
          fallbackTriggered: false,
          status: 'success',
          latencyMs: 1200,
          promptTokens: 800,
          completionTokens: 200,
          totalTokens: 1000,
          estimatedCostUsd: 0.005,
          isTestRun: false
        }
      ])
      expect(csv).toContain('log-1')
      expect(csv).toContain('title_study')
      expect(csv).toContain('gpt-4o')
    })
  })
})

