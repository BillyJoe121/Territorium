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

export function createReprocessTask(task: any, reason?: string): any {
  const now = new Date().toISOString()
  const depends = task.dependsOnExtractors || task.dependsOnTaskIds || []
  return {
    ...task,
    status: task.status === 'failed' && task.retryCount !== undefined ? 'pending' : 'queued',
    dependencyStatus: depends.length > 0 ? 'waiting' : 'ready',
    attemptCount: 0,
    retryCount: 0,
    assignedTo: undefined,
    leaseExpiresAt: undefined,
    lastError: undefined,
    errorCode: null,
    errorMessage: null,
    exceptionCategory: null,
    suggestedAction: reason ?? null,
    startedAt: null,
    completedAt: null,
    updatedAt: now,
  }
}

/**
 * US-050: Reintentos transitorios con espera incremental exponencial y variación aleatoria (jitter).
 */
export function calculateExponentialRetryDelay(attempt: number, baseSeconds: number = 5, maxSeconds: number = 300): number {
  const exponential = baseSeconds * Math.pow(2, Math.min(attempt, 6))
  const jitter = Math.random() * (baseSeconds / 2)
  return Math.min(Math.round(exponential + jitter), maxSeconds)
}

/**
 * US-055: Recuperación de trabajos huérfanos o zombis con lease de ejecución expirado.
 */
export function recoverExpiredLeaseTasks(tasks: any[], currentDate: Date = new Date()): {
  recoveredTasks: any[]
  recoveredCount: number
} {
  const nowMs = currentDate.getTime()
  let recoveredCount = 0

  const recoveredTasks = tasks.map((task) => {
    if (task.status === 'running' && task.leaseExpiresAt) {
      const leaseMs = new Date(task.leaseExpiresAt).getTime()
      if (nowMs > leaseMs) {
        recoveredCount++
        const isPendingType = task.retryCount !== undefined && task.taskType !== undefined
        return {
          ...task,
          status: isPendingType ? 'pending' : 'queued',
          assignedTo: undefined,
          leaseExpiresAt: undefined,
          lastError: 'Lease expirado del trabajador. Tarea recuperada automáticamente.',
          errorCode: 'LEASE_EXPIRED_RECOVERED',
          errorMessage: 'El lease del trabajador expiró. Tarea recuperada automáticamente para reintento.',
          updatedAt: currentDate.toISOString(),
        }
      }
    }
    return task
  })

  return { recoveredTasks, recoveredCount }
}

/**
 * US-064: Controlador de Pausa / Reanudación interactivo para la ejecución de procesamiento.
 */
export class JobExecutionController {
  private _isPaused: boolean = false
  private _isCancelled: boolean = false
  private _pauseReason: string = ''

  pause(reason?: string): void {
    this._isPaused = true
    if (reason) this._pauseReason = reason
  }

  resume(): void {
    this._isPaused = false
    this._pauseReason = ''
  }

  cancel(): void {
    this._isCancelled = true
  }

  isPaused(): boolean {
    return this._isPaused
  }

  isCancelled(): boolean {
    return this._isCancelled
  }

  async executeOrWait<T>(action: () => Promise<T>): Promise<T> {
    while (this._isPaused) {
      await new Promise((r) => setTimeout(r, 20))
    }
    return await action()
  }
}

export interface TaskExecutionResult {
  taskId: string
  success: boolean
  tokensUsed: number
  costUsd?: number
  error?: string
}

export async function executeTasksWithConcurrencyLimit(
  tasks: any[],
  maxConcurrency: number,
  taskExecutor: (task: any) => Promise<{ success?: boolean; tokensUsed?: number; costUsd?: number; error?: string } | any>,
  arg4?: any,
  tokenBudget: number = 250000,
  costBudgetUsd?: number,
  controller?: JobExecutionController
): Promise<{ results: TaskExecutionResult[]; totalTokens: number; totalCostUsd: number; budgetExceeded: boolean; isPaused: boolean }> {
  let onProgress: ((completed: number, total: number, activeTasks: string[]) => void) | undefined
  let effectiveBudgetCap = costBudgetUsd
  let accumulatedCost = 0

  if (typeof arg4 === 'function') {
    onProgress = arg4
  } else if (arg4 && typeof arg4 === 'object') {
    if (arg4.budgetCapUsd !== undefined) effectiveBudgetCap = arg4.budgetCapUsd
    if (arg4.currentAccumulatedCostUsd !== undefined) accumulatedCost = arg4.currentAccumulatedCostUsd
  }

  function isControllerCancelled(ctrl?: any): boolean {
    if (!ctrl) return false
    return typeof ctrl.isCancelled === 'function' ? ctrl.isCancelled() : Boolean(ctrl.isCancelled)
  }

  function isControllerPaused(ctrl?: any): boolean {
    if (!ctrl) return false
    return typeof ctrl.isPaused === 'function' ? ctrl.isPaused() : Boolean(ctrl.isPaused)
  }

  if (effectiveBudgetCap !== undefined && accumulatedCost >= effectiveBudgetCap) {
    return {
      results: [],
      totalTokens: 0,
      totalCostUsd: 0,
      budgetExceeded: true,
      isPaused: false
    }
  }

  // Filtrar estrictamente tareas listas: excluir dependencias pendientes ('waiting') o fallidas ('blocked')
  const readyTasks = tasks.filter((t) => {
    if (t.dependencyStatus === 'waiting' || t.dependencyStatus === 'blocked') {
      return false
    }
    return t.status === 'queued' || t.status === 'pending' || t.dependencyStatus === 'ready'
  })

  const results: TaskExecutionResult[] = []
  let totalTokens = 0
  let totalCostUsd = 0
  let budgetExceeded = false

  const queue = [...readyTasks]
  const running = new Set<string>()
  let completedCount = 0

  async function runNext(): Promise<void> {
    if (queue.length === 0 || budgetExceeded || isControllerCancelled(controller)) return

    // Pausa cooperativa si el controlador la solicita (US-064)
    if (isControllerPaused(controller)) {
      return
    }

    const task = queue.shift()!
    running.add(task.id)
    onProgress?.(completedCount, readyTasks.length, Array.from(running))

    try {
      const result = await taskExecutor(task)
      const cost = result.costUsd || 0
      results.push({ taskId: task.id, ...result })
      totalTokens += result.tokensUsed
      totalCostUsd += cost

      // US-052: Verificación de tope de presupuesto en servidor durante ejecución concurrente
      const currentTotalCost = accumulatedCost + totalCostUsd
      if (
        totalTokens >= tokenBudget ||
        (costBudgetUsd !== undefined && totalCostUsd >= costBudgetUsd) ||
        (effectiveBudgetCap !== undefined && currentTotalCost >= effectiveBudgetCap)
      ) {
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

    if (queue.length > 0 && !budgetExceeded && !isControllerPaused(controller) && !isControllerCancelled(controller)) {
      await runNext()
    }
  }

  const initialWorkers = Math.min(maxConcurrency, readyTasks.length)
  const workers = Array.from({ length: initialWorkers }, () => runNext())
  await Promise.all(workers)

  return {
    results,
    totalTokens,
    totalCostUsd,
    budgetExceeded,
    isPaused: isControllerPaused(controller)
  }
}
