import type { DocumentKind, DocumentTask, ExceptionCategory, SourceDocument, TaskStatus } from '../types'

export function resolveExtractorKey(kind: DocumentKind, fileName: string): 'title_study' | 'plan' | 'negotiation' | null {
  if (kind === 'estudio_titulos') return 'title_study'
  if (kind === 'plano') return 'plan'
  if (kind === 'linderos') return 'title_study'
  if (kind === 'negociacion') return 'negotiation'

  const lower = fileName.toLowerCase()
  if (/(estudio|titulo|título|matricula|matrícula|lindero)/.test(lower)) return 'title_study'
  if (/(plano|topogr|cartogr|levantamiento)/.test(lower)) return 'plan'
  if (/(oferta|negocia|avalúo|avaluo|servidumbre)/.test(lower)) return 'negotiation'
  return null
}

export function createDocumentTasksForBatch(
  batchId: string,
  projectId: string,
  documents: SourceDocument[],
  makeId: () => string = () => crypto.randomUUID()
): DocumentTask[] {
  const tasks: DocumentTask[] = []
  const now = new Date().toISOString()

  for (const doc of documents) {
    const extractor = resolveExtractorKey(doc.kind, doc.name)
    if (!extractor) continue

    // US-046: Negociación depende de que exista estudio de títulos para el mismo predio
    const isNegotiation = extractor === 'negotiation'
    const dependsOn = isNegotiation ? ['title_study'] : []
    const dependencyStatus = isNegotiation ? 'waiting' : 'ready'

    // Si el documento está encriptado o es corrupto (US-040), nace como excepción inmediata
    const isException = doc.isEncrypted || doc.preprocessingStatus === 'exception' || doc.preprocessingStatus === 'corrupt'
    const status: TaskStatus = isException ? 'failed' : 'queued'
    const exceptionCategory: ExceptionCategory | null = doc.isEncrypted
      ? 'password_encrypted'
      : doc.preprocessingStatus === 'corrupt'
      ? 'unsupported_format'
      : null
    const suggestedAction = doc.isEncrypted
      ? 'Eliminar la protección por contraseña del archivo y volver a cargar.'
      : doc.preprocessingStatus === 'corrupt'
      ? 'Cargar un archivo íntegro y no vacío (> 0 bytes).'
      : null

    tasks.push({
      id: makeId(),
      batchId,
      projectId,
      sourceDocumentId: doc.id,
      propertyCode: doc.propertyCode || null,
      extractorKey: extractor,
      status,
      dependencyStatus: isException ? 'blocked' : dependencyStatus,
      dependsOnExtractors: dependsOn,
      attemptCount: isException ? 1 : 0,
      maxAttempts: 3,
      errorCode: isException ? 'DOCUMENT_EXCEPTION' : null,
      errorMessage: doc.exceptionReason || null,
      exceptionCategory,
      suggestedAction,
      tokensUsed: 0,
      createdAt: now,
      updatedAt: now,
    })
  }

  return tasks
}

export function evaluateTaskDependencies(tasks: DocumentTask[]): DocumentTask[] {
  const now = new Date().toISOString()
  return tasks.map((task) => {
    if (task.status !== 'queued' && task.dependencyStatus !== 'waiting') return task
    if (task.dependsOnExtractors.length === 0) {
      return { ...task, dependencyStatus: 'ready' }
    }

    // Buscar tareas prerequisito para el mismo predio o lote
    const prerequisites = tasks.filter(
      (other) =>
        other.id !== task.id &&
        other.propertyCode === task.propertyCode &&
        task.dependsOnExtractors.includes(other.extractorKey)
    )

    if (prerequisites.length === 0) {
      // No hay prerequisitos cargados para este predio
      return {
        ...task,
        status: 'blocked',
        dependencyStatus: 'blocked',
        errorCode: 'DEPENDENCY_MISSING',
        errorMessage: 'Faltan insumos de estudio de títulos para este predio.',
        exceptionCategory: 'missing_dependency',
        suggestedAction: 'Cargar el estudio de títulos correspondiente para procesar la negociación.',
        updatedAt: now,
      }
    }

    const anyFailed = prerequisites.some((other) => other.status === 'failed' || other.status === 'blocked')
    if (anyFailed) {
      return {
        ...task,
        status: 'blocked',
        dependencyStatus: 'blocked',
        errorCode: 'DEPENDENCY_FAILED',
        errorMessage: 'El estudio de títulos previo falló o fue bloqueado.',
        exceptionCategory: 'missing_dependency',
        suggestedAction: 'Reprocesar o corregir el estudio de títulos previo antes de ejecutar negociación.',
        updatedAt: now,
      }
    }

    const allCompleted = prerequisites.every((other) => other.status === 'completed')
    if (allCompleted) {
      return {
        ...task,
        dependencyStatus: 'ready',
        status: 'queued',
        updatedAt: now,
      }
    }

    return task // Aún esperando
  })
}

export function classifyTaskException(error: unknown, attemptCount: number, maxAttempts: number): {
  category: ExceptionCategory
  suggestedAction: string
  isExhausted: boolean
} {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  const isExhausted = attemptCount >= maxAttempts

  if (/password|cifrad|encrypt|protegid/.test(message)) {
    return {
      category: 'password_encrypted',
      suggestedAction: 'Eliminar la clave o contraseña de protección del documento y volver a cargarlo.',
      isExhausted: true,
    }
  }

  if (/unreadable|ilegible|escanead|ocr/.test(message)) {
    return {
      category: 'permanent_unreadable',
      suggestedAction: 'Digitalizar con mayor resolución o aplicar OCR de texto seleccionable antes de procesar.',
      isExhausted: true,
    }
  }

  if (/rate limit|quota|cupo|429|insufficient_quota|tasa/.test(message)) {
    return {
      category: 'ai_quota_exceeded',
      suggestedAction: 'Verificar el saldo o cupo en el proveedor de IA y reintentar.',
      isExhausted,
    }
  }

  if (/schema|validation|contrato|formato json/.test(message)) {
    return {
      category: 'schema_validation_exhausted',
      suggestedAction: 'Verificar si el documento cumple con la estructura jurídica requerida o ajustar el prompt.',
      isExhausted,
    }
  }

  if (/dependencia|dependency|bloquead|falta insumo/.test(message)) {
    return {
      category: 'missing_dependency',
      suggestedAction: 'Cargar y procesar el insumo base faltante (ej. Estudio de Títulos).',
      isExhausted: true,
    }
  }

  if (/formato|no soportado|0 bytes|corrupt/.test(message)) {
    return {
      category: 'unsupported_format',
      suggestedAction: 'Convertir el archivo a formato PDF o Word (.docx) válido y no vacío.',
      isExhausted: true,
    }
  }

  return {
    category: 'other',
    suggestedAction: isExhausted
      ? 'Revisar el registro de auditoría técnica y reprocesar puntualmente el documento.'
      : 'Reintento automático programado según política de espera incremental.',
    isExhausted,
  }
}

export function createReprocessTask(task: DocumentTask): DocumentTask {
  const now = new Date().toISOString()
  return {
    ...task,
    status: 'queued',
    dependencyStatus: task.dependsOnExtractors.length > 0 ? 'waiting' : 'ready',
    attemptCount: 0,
    errorCode: null,
    errorMessage: null,
    exceptionCategory: null,
    suggestedAction: null,
    startedAt: null,
    completedAt: null,
    updatedAt: now,
  }
}

export interface TaskExecutionResult {
  taskId: string
  success: boolean
  tokensUsed: number
  error?: string
}

export async function executeTasksWithConcurrencyLimit(
  tasks: DocumentTask[],
  maxConcurrency: number,
  taskExecutor: (task: DocumentTask) => Promise<{ success: boolean; tokensUsed: number; error?: string }>,
  onProgress?: (completed: number, total: number, activeTasks: string[]) => void,
  tokenBudget: number = 250000
): Promise<{ results: TaskExecutionResult[]; totalTokens: number; budgetExceeded: boolean }> {
  const readyTasks = tasks.filter((t) => t.status === 'queued' && t.dependencyStatus === 'ready')
  const results: TaskExecutionResult[] = []
  let totalTokens = 0
  let budgetExceeded = false

  const queue = [...readyTasks]
  const running = new Set<string>()
  let completedCount = 0

  async function runNext(): Promise<void> {
    if (queue.length === 0 || budgetExceeded) return

    const task = queue.shift()!
    running.add(task.id)
    onProgress?.(completedCount, readyTasks.length, Array.from(running))

    try {
      const result = await taskExecutor(task)
      results.push({ taskId: task.id, ...result })
      totalTokens += result.tokensUsed

      if (totalTokens >= tokenBudget) {
        budgetExceeded = true
      }
    } catch (err) {
      results.push({
        taskId: task.id,
        success: false,
        tokensUsed: 0,
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      running.delete(task.id)
      completedCount += 1
      onProgress?.(completedCount, readyTasks.length, Array.from(running))
    }

    if (queue.length > 0 && !budgetExceeded) {
      await runNext()
    }
  }

  const initialWorkers = Math.min(maxConcurrency, readyTasks.length)
  const workers = Array.from({ length: initialWorkers }, () => runNext())
  await Promise.all(workers)

  return { results, totalTokens, budgetExceeded }
}
