import { describe, it, expect } from 'vitest'
import {
  pauseBatch,
  resumeBatch,
  resolveTaskExceptionManually,
  recoverStalledTasks,
  comparePromptVersions,
  evaluateBudgetCap,
  setExtractorActiveState,
  assignTaskToUser
} from './batchOrchestrationP1'
import { Batch, DocumentTask, ExtractorConfig, Project, ProjectConfiguration, PromptVersion } from '../types'

describe('batchOrchestrationP1 (US-053, US-054, US-055, US-063, US-064, US-065, US-112)', () => {
  const mockBatch: Batch = {
    id: 'b1',
    projectId: 'p1',
    name: 'Lote 1',
    createdAt: '2026-01-01',
    jobState: 'en_proceso',
    progress: 50,
    runId: null,
    error: null,
    isPaused: false
  }

  const mockTasks: DocumentTask[] = [
    {
      id: 't1',
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
      updatedAt: '2026-01-01'
    },
    {
      id: 't2',
      batchId: 'b1',
      projectId: 'p1',
      sourceDocumentId: 'd2',
      extractorKey: 'plan',
      status: 'queued',
      dependencyStatus: 'ready',
      dependsOnExtractors: [],
      attemptCount: 0,
      maxAttempts: 3,
      tokensUsed: 0,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    }
  ]

  it('US-053: pausa y reanuda lotes preservando los trabajos en ejecución', () => {
    const pauseRes = pauseBatch(mockBatch, mockTasks)
    expect(pauseRes.batch.isPaused).toBe(true)
    expect(pauseRes.activeTasksPreserved.length).toBe(1)
    expect(pauseRes.activeTasksPreserved[0].id).toBe('t1')

    const resumeRes = resumeBatch(pauseRes.batch, pauseRes.queuedTasksPaused)
    expect(resumeRes.batch.isPaused).toBe(false)
    const t2Resumed = resumeRes.tasks.find(t => t.id === 't2')
    expect(t2Resumed?.dependencyStatus).toBe('ready')
  })

  it('US-054: gestiona excepciones manualmente (reintento o descarte)', () => {
    const failedTask: DocumentTask = {
      ...mockTasks[0],
      status: 'failed',
      errorCode: 'API_TIMEOUT',
      errorMessage: 'Timeout de API',
      attemptCount: 3
    }

    // Reintento manual
    const retried = resolveTaskExceptionManually(failedTask, 'retry_with_params', 'Incrementado timeout', 'usr-revisor')
    expect(retried.status).toBe('queued')
    expect(retried.attemptCount).toBe(0)
    expect(retried.suggestedAction).toContain('Reintento manual')
    expect(retried.assignedTo).toBe('usr-revisor')

    // Descarte manual
    const dismissed = resolveTaskExceptionManually(failedTask, 'dismiss_exception', 'Documento no aplicable')
    expect(dismissed.status).toBe('cancelled')
    expect(dismissed.suggestedAction).toContain('descartada')
  })

  it('US-055: recupera automáticamente tareas interrumpidas con lease expirado', () => {
    const now = new Date('2026-01-01T12:30:00Z')
    const stalledTask: DocumentTask = {
      ...mockTasks[0],
      status: 'running',
      startedAt: '2026-01-01T12:00:00Z', // 30 min atrás (> 10 min)
      leaseExpiresAt: '2026-01-01T12:10:00Z' // ya expiró
    }

    const { recoveredCount, updatedTasks } = recoverStalledTasks([stalledTask], now, 10)
    expect(recoveredCount).toBe(1)
    expect(updatedTasks[0].status).toBe('queued')
    expect(updatedTasks[0].attemptCount).toBe(2)
    expect(updatedTasks[0].errorMessage).toContain('Recuperado automáticamente')
  })

  it('US-063: compara dos versiones de prompt y calcula diferencias de esquema y tokens', () => {
    const v1: PromptVersion = {
      id: 'pv1',
      extractorKey: 'title_study',
      version: 1,
      name: 'v1 base',
      prompt: 'Extrae la informacion del estudio de titulos de forma completa.',
      schema: { matricula: 'string', propietarios: 'array' },
      active: false,
      createdAt: '2026-01-01'
    }
    const v2: PromptVersion = {
      id: 'pv2',
      extractorKey: 'title_study',
      version: 2,
      name: 'v2 optimizado',
      prompt: 'Extrae con precision juridica.',
      schema: { matricula: 'string', propietarios: 'array', linderos: 'string' },
      active: true,
      createdAt: '2026-01-02'
    }

    const diff = comparePromptVersions(v1, v2)
    expect(diff.versionA).toBe(1)
    expect(diff.versionB).toBe(2)
    expect(diff.schemaKeysDiff.onlyInB).toContain('linderos')
    expect(diff.tokenSavingsEstimate).toBeGreaterThan(0)
  })

  it('US-064: evalúa límites y topes de presupuesto por proyecto', () => {
    const project: Project = {
      id: 'p1',
      name: 'Proyecto ISA',
      municipality: 'Cali',
      department: 'Valle',
      createdAt: '2026-01-01',
      budgetCapUsd: 100,
      totalSpentUsd: 75
    }
    const config: ProjectConfiguration = {
      projectId: 'p1',
      sessionTimeoutMinutes: 60,
      mfaRequired: false,
      allowedWebOrigins: ['*'],
      maxFilesPerBatch: 100,
      maxBatchSizeMb: 500,
      allowedMimeTypes: [],
      retentionDaysRaw: 365,
      retentionDaysDerivatives: 180,
      retentionDaysExports: 90,
      autoPurgeEnabled: false,
      budgetCapUsd: 100,
      budgetAlertThresholdPercent: 80
    }

    // Gasto adicional de $10 -> total $85 (>= 80% threshold -> alerta)
    const alertRes = evaluateBudgetCap(project, config, 10)
    expect(alertRes.allowed).toBe(true)
    expect(alertRes.isNearCap).toBe(true)
    expect(alertRes.message).toContain('Alerta: el proyecto ha alcanzado')

    // Gasto adicional de $30 -> total $105 (> $100 cap -> bloqueado)
    const blockRes = evaluateBudgetCap(project, config, 30)
    expect(blockRes.allowed).toBe(false)
    expect(blockRes.message).toContain('Presupuesto excedido')
  })

  it('US-065 & US-112: habilita/deshabilita extractores y asigna tareas a usuarios', () => {
    const configs: ExtractorConfig[] = [
      {
        extractorKey: 'plan',
        provider: 'openai',
        primaryModel: 'gpt-4o',
        temperature: 0,
        maxTokens: 2000,
        timeoutSeconds: 60,
        isEnabled: true
      }
    ]

    const updated = setExtractorActiveState(configs, 'plan', false)
    expect(updated[0].isEnabled).toBe(false)

    const assigned = assignTaskToUser(mockTasks[0], 'user-reviewer-99')
    expect(assigned.assignedTo).toBe('user-reviewer-99')
  })
})
