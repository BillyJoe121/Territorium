import { describe, it, expect } from 'vitest'
import {
  evaluateBudgetCap,
  recoverStalledTasks,
  resolveTaskExceptionManually
} from '../lib/batchOrchestrationP1'
import {
  scanFileForThreats,
  validateBatchUploadLimits
} from '../lib/storageSecurity'
import {
  extractNegotiationOffers,
  compareBoundariesVisualDiff
} from '../lib/negotiationExtraction'
import {
  performSystemHealthCheck,
  evaluateDocumentRetention
} from '../lib/projectLifecycle'
import type {
  Project,
  ProjectConfiguration,
  DocumentTask,
  SourceDocument
} from '../types'

describe('US-155: Resiliencia e Inyección de Fallos P1', () => {
  const mockConfig: ProjectConfiguration = {
    projectId: 'p1',
    sessionTimeoutMinutes: 60,
    mfaRequired: true,
    allowedWebOrigins: ['*'],
    maxFilesPerBatch: 5,
    maxBatchSizeMb: 10,
    allowedMimeTypes: ['application/pdf'],
    retentionDaysRaw: 365,
    retentionDaysDerivatives: 180,
    retentionDaysExports: 90,
    autoPurgeEnabled: true,
    budgetCapUsd: 100,
    budgetAlertThresholdPercent: 80
  }

  describe('Inyección de Fallo: Exceder Presupuesto Máximo (US-064)', () => {
    it('bloquea inmediatamente la ejecución de nuevas tareas al sobrepasar el 100% del presupuesto', () => {
      const projectNearCap: Project = {
        id: 'p1',
        name: 'Proyecto Solar',
        clientName: 'Enel',
        department: 'Cesar',
        municipality: 'Valledupar',
        createdAt: '2026-01-01',
        budgetCapUsd: 100,
        totalSpentUsd: 99.5
      }

      const budgetStatus = evaluateBudgetCap(projectNearCap, mockConfig, 2.0)
      expect(budgetStatus.allowed).toBe(false)
      expect(budgetStatus.message).toContain('Presupuesto excedido')
    })

    it('emite advertencia preventiva al alcanzar el 80% sin bloquear (US-064)', () => {
      const projectAtWarning: Project = {
        id: 'p1',
        name: 'Proyecto Solar',
        clientName: 'Enel',
        department: 'Cesar',
        municipality: 'Valledupar',
        createdAt: '2026-01-01',
        budgetCapUsd: 100,
        totalSpentUsd: 82.0
      }

      const budgetStatus = evaluateBudgetCap(projectAtWarning, mockConfig, 1.0)
      expect(budgetStatus.allowed).toBe(true)
      expect(budgetStatus.isNearCap).toBe(true)
      expect(budgetStatus.message).toContain('Alerta: el proyecto ha alcanzado')
    })
  })

  describe('Inyección de Fallo: Caída de Worker y Tareas Colgadas (US-055)', () => {
    it('detecta leases expirados y recupera las tareas poniéndolas en pending para reintento', () => {
      const now = new Date('2026-01-01T12:30:00Z')
      const tasks: DocumentTask[] = [
        {
          id: 't-crashed-1',
          batchId: 'b1',
          projectId: 'p1',
          sourceDocumentId: 'd1',
          extractorKey: 'title_study',
          status: 'running',
          dependencyStatus: 'ready',
          dependsOnExtractors: [],
          attemptCount: 1,
          maxAttempts: 3,
          tokensUsed: 100,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
          assignedTo: 'worker-dead-alpha',
          startedAt: '2026-01-01T12:00:00Z',
          leaseExpiresAt: '2026-01-01T12:10:00Z'
        },
        {
          id: 't-healthy-2',
          batchId: 'b1',
          projectId: 'p1',
          sourceDocumentId: 'd2',
          extractorKey: 'title_study',
          status: 'running',
          dependencyStatus: 'ready',
          dependsOnExtractors: [],
          attemptCount: 1,
          maxAttempts: 3,
          tokensUsed: 150,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
          assignedTo: 'worker-alive-beta',
          startedAt: '2026-01-01T12:25:00Z',
          leaseExpiresAt: '2026-01-01T12:35:00Z'
        }
      ]

      const result = recoverStalledTasks(tasks, now, 10)
      expect(result.recoveredCount).toBe(1)
      expect(result.updatedTasks[0].id).toBe('t-crashed-1')
      expect(result.updatedTasks[0].status).toBe('queued')
      expect(result.updatedTasks[0].attemptCount).toBe(2)
    })
  })

  describe('Inyección de Fallo: Amenazas y Archivos Maliciosos (US-041)', () => {
    it('detecta archivos con ejecutables camuflados y scripts sospechosos', () => {
      const scriptBuffer = new TextEncoder().encode('<html><script>alert("xss")</script></html>')
      const scanScript = scanFileForThreats('test.pdf', scriptBuffer)
      expect(scanScript.scanStatus).toBe('quarantined')
      expect(scanScript.threatDetails).toContain('script malicioso')

      const exeBuffer = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00])
      const scanExe = scanFileForThreats('test.pdf', exeBuffer)
      expect(scanExe.scanStatus).toBe('infected')
      expect(scanExe.threatDetails).toContain('Cabecera ejecutable')
    })

    it('bloquea lotes que superan el límite de tamaño total o archivos (US-031)', () => {
      const oversizedBatch = [
        { name: '1.pdf', size: 15 * 1024 * 1024 }
      ]
      const check = validateBatchUploadLimits(oversizedBatch, mockConfig)
      expect(check.valid).toBe(false)
      expect(check.errors[0]).toContain('Tamaño total del lote excedido')
    })
  })

  describe('Inyección de Fallo: Discrepancias Financieras y de Linderos (US-076, US-089)', () => {
    it('detecta discrepancia grave cuando las ofertas en letras y números no coinciden en la matriz', () => {
      const record = extractNegotiationOffers(
        {
          propertyCode: 'PREDIO-FAULT-01',
          initialOfferNum: 50000000,
          initialOfferText: 'ochenta millones de pesos', // Discrepancia intencional
          finalOfferNum: 50000000,
          finalOfferText: 'cincuenta millones de pesos',
          rowIndex: 2
        },
        'p1',
        'b1'
      )
      expect(record.offersMatchStatus).toBe('discrepancia')
    })

    it('detecta discordancia en linderos cuando el polígono técnico no concuerda con la escritura', () => {
      const diff = compareBoundariesVisualDiff(
        'Norte con Quebrada La Honda; Sur con Finca El Bosque',
        'Norte con Camino Real; Sur con Rio Claro'
      )
      expect(diff.similarityRatio).toBeLessThan(0.6)
      expect(diff.isCloseMatch).toBe(false)
    })
  })

  describe('Gestión de Excepciones y Diagnóstico de Salud (US-054, US-143, US-144)', () => {
    it('permite reintentar o descartar manualmente tareas fallidas con justificación', () => {
      const failedTask: DocumentTask = {
        id: 'task-failed-1',
        batchId: 'b1',
        projectId: 'p1',
        sourceDocumentId: 'doc-1',
        extractorKey: 'title_study',
        status: 'failed',
        dependencyStatus: 'ready',
        dependsOnExtractors: [],
        attemptCount: 3,
        maxAttempts: 3,
        tokensUsed: 1200,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01'
      }

      const retried = resolveTaskExceptionManually(failedTask, 'retry_with_params', 'Reintento con extractor secundario')
      expect(retried.status).toBe('queued')
      expect(retried.attemptCount).toBe(0)

      const discarded = resolveTaskExceptionManually(failedTask, 'dismiss_exception', 'Documento corrupto e ilegible')
      expect(discarded.status).toBe('cancelled')
    })

    it('evalúa la salud del sistema y detecta necesidad de degradación preventiva', () => {
      const health = performSystemHealthCheck(true, 50, true, 120, 150)
      expect(health.status).toBe('degraded')
      expect(health.checks.worker.ok).toBe(false)
    })

    it('identifica correctamente documentos listos para purga tras expirar retención', () => {
      const oldDoc: SourceDocument = {
        id: 'doc-old',
        projectId: 'p1',
        batchId: 'b1',
        name: 'expediente_antiguo.pdf',
        kind: 'estudio_titulos',
        size: 1024,
        uploadedAt: '2025-01-01T00:00:00Z'
      }

      const purgeResult = evaluateDocumentRetention([oldDoc], mockConfig, new Date('2026-06-01T00:00:00Z'))
      expect(purgeResult.purgeRawEligible.length).toBe(1)
      expect(purgeResult.purgeRawEligible[0].id).toBe('doc-old')
    })
  })
})
