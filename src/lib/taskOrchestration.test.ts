import { describe, expect, it } from 'vitest'
import type { DocumentTask, SourceDocument } from '../types'
import {
  classifyTaskException,
  createDocumentTasksForBatch,
  createReprocessTask,
  evaluateTaskDependencies,
  executeTasksWithConcurrencyLimit,
} from './taskOrchestration'

describe('Orquestación y Gestión de Tareas de Extracción (Épica E05 P0)', () => {
  const sampleDocs: SourceDocument[] = [
    {
      id: 'doc-1',
      projectId: 'proj-1',
      batchId: 'batch-1',
      name: 'Estudio_Titulos_SAN-001.pdf',
      kind: 'estudio_titulos',
      size: 1024,
      uploadedAt: new Date().toISOString(),
      propertyCode: 'SAN-001',
    },
    {
      id: 'doc-2',
      projectId: 'proj-1',
      batchId: 'batch-1',
      name: 'Plano_Topografico_SAN-001.pdf',
      kind: 'plano',
      size: 2048,
      uploadedAt: new Date().toISOString(),
      propertyCode: 'SAN-001',
    },
    {
      id: 'doc-3',
      projectId: 'proj-1',
      batchId: 'batch-1',
      name: 'Plantilla_Negociacion_SAN-001.pdf',
      kind: 'negociacion',
      size: 512,
      uploadedAt: new Date().toISOString(),
      propertyCode: 'SAN-001',
    },
    {
      id: 'doc-enc',
      projectId: 'proj-1',
      batchId: 'batch-1',
      name: 'Documento_Protegido.pdf',
      kind: 'estudio_titulos',
      size: 1024,
      uploadedAt: new Date().toISOString(),
      propertyCode: 'SAN-002',
      isEncrypted: true,
      exceptionReason: 'Archivo protegido con contraseña',
    },
  ]

  it('US-044: Crea tareas independientes por documento y extractor', () => {
    const tasks = createDocumentTasksForBatch('batch-1', 'proj-1', sampleDocs)
    expect(tasks.length).toBe(4)

    const titleTask = tasks.find((t) => t.sourceDocumentId === 'doc-1')
    expect(titleTask).toBeDefined()
    expect(titleTask?.extractorKey).toBe('title_study')
    expect(titleTask?.status).toBe('queued')
    expect(titleTask?.dependencyStatus).toBe('ready')

    const planTask = tasks.find((t) => t.sourceDocumentId === 'doc-2')
    expect(planTask?.extractorKey).toBe('plan')
    expect(planTask?.status).toBe('queued')
    expect(planTask?.dependencyStatus).toBe('ready')

    // Documento encriptado nace directamente como excepción fallida sin tumbar el lote
    const encTask = tasks.find((t) => t.sourceDocumentId === 'doc-enc')
    expect(encTask?.status).toBe('failed')
    expect(encTask?.exceptionCategory).toBe('password_encrypted')
    expect(encTask?.suggestedAction).toContain('contraseña')
  })

  it('US-046: Bloquea o espera la tarea de negociación hasta que el estudio de títulos concluya', () => {
    const tasks = createDocumentTasksForBatch('batch-1', 'proj-1', sampleDocs)
    const negTask = tasks.find((t) => t.sourceDocumentId === 'doc-3')!
    expect(negTask.dependencyStatus).toBe('waiting')
    expect(negTask.dependsOnExtractors).toContain('title_study')

    // Si el estudio de títulos aún está 'queued', sigue 'waiting'
    const evaluatedWaiting = evaluateTaskDependencies(tasks)
    const negWaiting = evaluatedWaiting.find((t) => t.sourceDocumentId === 'doc-3')!
    expect(negWaiting.dependencyStatus).toBe('waiting')

    // Si el estudio de títulos se completa, la negociación pasa a 'ready'
    const tasksWithTitleCompleted = tasks.map((t) =>
      t.sourceDocumentId === 'doc-1' ? { ...t, status: 'completed' as const } : t
    )
    const evaluatedReady = evaluateTaskDependencies(tasksWithTitleCompleted)
    const negReady = evaluatedReady.find((t) => t.sourceDocumentId === 'doc-3')!
    expect(negReady.dependencyStatus).toBe('ready')
    expect(negReady.status).toBe('queued')

    // Si el estudio de títulos falló, la negociación queda 'blocked' con acción sugerida
    const tasksWithTitleFailed = tasks.map((t) =>
      t.sourceDocumentId === 'doc-1' ? { ...t, status: 'failed' as const } : t
    )
    const evaluatedBlocked = evaluateTaskDependencies(tasksWithTitleFailed)
    const negBlocked = evaluatedBlocked.find((t) => t.sourceDocumentId === 'doc-3')!
    expect(negBlocked.dependencyStatus).toBe('blocked')
    expect(negBlocked.status).toBe('blocked')
    expect(negBlocked.exceptionCategory).toBe('missing_dependency')
    expect(negBlocked.suggestedAction).toContain('estudio de títulos previo')
  })

  it('US-048: Permite el reproceso selectivo de una tarea específica sin alterar las demás', () => {
    const originalTask: DocumentTask = {
      id: 'task-neg',
      batchId: 'batch-1',
      projectId: 'proj-1',
      sourceDocumentId: 'doc-3',
      propertyCode: 'SAN-001',
      extractorKey: 'negotiation',
      status: 'failed',
      dependencyStatus: 'blocked',
      dependsOnExtractors: ['title_study'],
      attemptCount: 3,
      maxAttempts: 3,
      errorCode: 'DEPENDENCY_FAILED',
      errorMessage: 'Fallo previo',
      exceptionCategory: 'missing_dependency',
      suggestedAction: 'Reprocesar',
      tokensUsed: 1500,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const reprocessed = createReprocessTask(originalTask)
    expect(reprocessed.id).toBe('task-neg')
    expect(reprocessed.status).toBe('queued')
    expect(reprocessed.attemptCount).toBe(0)
    expect(reprocessed.errorCode).toBeNull()
    expect(reprocessed.errorMessage).toBeNull()
    expect(reprocessed.exceptionCategory).toBeNull()
  })

  it('US-051: Clasifica excepciones permanentes y agotadas con acciones sugeridas claras', () => {
    const quotaEx = classifyTaskException(new Error('Rate limit 429: quota exceeded'), 3, 3)
    expect(quotaEx.category).toBe('ai_quota_exceeded')
    expect(quotaEx.suggestedAction).toContain('cupo')
    expect(quotaEx.isExhausted).toBe(true)

    const passEx = classifyTaskException(new Error('The PDF has password encryption'), 1, 3)
    expect(passEx.category).toBe('password_encrypted')
    expect(passEx.suggestedAction).toContain('contraseña')

    const unreadableEx = classifyTaskException(new Error('Document is an unreadable scan'), 3, 3)
    expect(unreadableEx.category).toBe('permanent_unreadable')
    expect(unreadableEx.suggestedAction).toContain('OCR')
  })

  it('US-045 & US-052: Ejecuta tareas con límite de concurrencia y corte por presupuesto de tokens', async () => {
    const readyTasks: DocumentTask[] = [
      {
        id: 't-1',
        batchId: 'b-1',
        projectId: 'p-1',
        sourceDocumentId: 'd-1',
        extractorKey: 'title_study',
        status: 'queued',
        dependencyStatus: 'ready',
        dependsOnExtractors: [],
        attemptCount: 0,
        maxAttempts: 3,
        tokensUsed: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 't-2',
        batchId: 'b-1',
        projectId: 'p-1',
        sourceDocumentId: 'd-2',
        extractorKey: 'plan',
        status: 'queued',
        dependencyStatus: 'ready',
        dependsOnExtractors: [],
        attemptCount: 0,
        maxAttempts: 3,
        tokensUsed: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 't-3',
        batchId: 'b-1',
        projectId: 'p-1',
        sourceDocumentId: 'd-3',
        extractorKey: 'plan',
        status: 'queued',
        dependencyStatus: 'ready',
        dependsOnExtractors: [],
        attemptCount: 0,
        maxAttempts: 3,
        tokensUsed: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    let activeWorkers = 0
    let peakConcurrency = 0

    const executor = async (task: DocumentTask) => {
      activeWorkers += 1
      peakConcurrency = Math.max(peakConcurrency, activeWorkers)
      await new Promise((r) => setTimeout(r, 20))
      activeWorkers -= 1
      return { success: true, tokensUsed: 1000 }
    }

    const { results, totalTokens, budgetExceeded } = await executeTasksWithConcurrencyLimit(
      readyTasks,
      2, // Max 2 concurrente
      executor,
      undefined,
      1500 // Presupuesto bajo para probar corte
    )

    expect(peakConcurrency).toBeLessThanOrEqual(2)
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(totalTokens).toBeGreaterThanOrEqual(1000)
    expect(budgetExceeded).toBe(true)
  })
})
