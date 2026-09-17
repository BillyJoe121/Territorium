import {
  Batch,
  DocumentTask,
  ExtractorConfig,
  Project,
  ProjectConfiguration,
  PromptVersion
} from '../types'

export interface BatchPauseResult {
  batch: Batch
  activeTasksPreserved: DocumentTask[]
  queuedTasksPaused: DocumentTask[]
}

export function pauseBatch(batch: Batch, tasks: DocumentTask[]): BatchPauseResult {
  const updatedBatch: Batch = {
    ...batch,
    isPaused: true
  }

  const activeTasksPreserved = tasks.filter(
    t => t.batchId === batch.id && t.status === 'running'
  )
  const queuedTasksPaused = tasks.map(t => {
    if (t.batchId === batch.id && t.status === 'queued') {
      return { ...t, dependencyStatus: 'waiting' as const }
    }
    return t
  })

  return {
    batch: updatedBatch,
    activeTasksPreserved,
    queuedTasksPaused
  }
}

export function resumeBatch(batch: Batch, tasks: DocumentTask[]): { batch: Batch; tasks: DocumentTask[] } {
  const updatedBatch: Batch = {
    ...batch,
    isPaused: false
  }

  const updatedTasks = tasks.map(t => {
    if (t.batchId === batch.id && t.status === 'queued' && t.dependencyStatus === 'waiting') {
      return { ...t, dependencyStatus: 'ready' as const }
    }
    return t
  })

  return {
    batch: updatedBatch,
    tasks: updatedTasks
  }
}

export type ExceptionManualAction = 'retry_with_params' | 'dismiss_exception'

export function resolveTaskExceptionManually(
  task: DocumentTask,
  action: ExceptionManualAction,
  notes: string,
  reviewerUserId?: string
): DocumentTask {
  const now = new Date().toISOString()

  if (action === 'retry_with_params') {
    return {
      ...task,
      status: 'queued',
      dependencyStatus: 'ready',
      attemptCount: 0,
      errorCode: null,
      errorMessage: null,
      exceptionCategory: null,
      suggestedAction: `Reintento manual autorizado por revisor: ${notes}`,
      assignedTo: reviewerUserId ?? task.assignedTo,
      updatedAt: now
    }
  }

  // Dismiss exception
  return {
    ...task,
    status: 'cancelled',
    suggestedAction: `Excepción descartada manualmente: ${notes}`,
    assignedTo: reviewerUserId ?? task.assignedTo,
    updatedAt: now
  }
}

export function recoverStalledTasks(
  tasks: DocumentTask[],
  currentDate: Date = new Date(),
  leaseTimeoutMinutes: number = 10
): { recoveredCount: number; updatedTasks: DocumentTask[] } {
  let recoveredCount = 0
  const cutoffTime = new Date(currentDate.getTime() - leaseTimeoutMinutes * 60 * 1000)

  const updatedTasks = tasks.map(t => {
    if (t.status === 'running') {
      const leaseExpired = t.leaseExpiresAt ? new Date(t.leaseExpiresAt) < currentDate : false
      const startedStalled = t.startedAt ? new Date(t.startedAt) < cutoffTime : true

      if (leaseExpired || startedStalled) {
        recoveredCount++
        return {
          ...t,
          status: 'queued' as const,
          dependencyStatus: 'ready' as const,
          attemptCount: t.attemptCount + 1,
          leaseExpiresAt: null,
          errorMessage: 'Recuperado automáticamente tras fallo/interrupción de worker (lease expirado).',
          updatedAt: currentDate.toISOString()
        }
      }
    }
    return t
  })

  return {
    recoveredCount,
    updatedTasks
  }
}

export interface PromptComparisonResult {
  versionA: number
  versionB: number
  promptDiffLength: number
  schemaKeysDiff: {
    onlyInA: string[]
    onlyInB: string[]
    common: string[]
  }
  tokenSavingsEstimate: number
}

export function comparePromptVersions(vA: PromptVersion, vB: PromptVersion): PromptComparisonResult {
  const keysA = Object.keys(vA.schema || {})
  const keysB = Object.keys(vB.schema || {})

  const onlyInA = keysA.filter(k => !keysB.includes(k))
  const onlyInB = keysB.filter(k => !keysA.includes(k))
  const common = keysA.filter(k => keysB.includes(k))

  const promptDiffLength = vB.prompt.length - vA.prompt.length
  // Estimado: 4 chars por token aprox
  const tokenSavingsEstimate = Math.round((vA.prompt.length - vB.prompt.length) / 4)

  return {
    versionA: vA.version,
    versionB: vB.version,
    promptDiffLength,
    schemaKeysDiff: {
      onlyInA,
      onlyInB,
      common
    },
    tokenSavingsEstimate
  }
}

export interface BudgetCheckResult {
  allowed: boolean
  isNearCap: boolean
  currentSpentUsd: number
  capUsd: number
  message?: string
}

export function evaluateBudgetCap(
  project: Project,
  config: ProjectConfiguration,
  additionalCostUsd: number = 0
): BudgetCheckResult {
  const cap = project.budgetCapUsd ?? config.budgetCapUsd ?? 250.0
  const currentSpent = project.totalSpentUsd ?? 0.0
  const projectedSpent = currentSpent + additionalCostUsd

  const thresholdPercent = config.budgetAlertThresholdPercent ?? 80
  const thresholdAmount = (cap * thresholdPercent) / 100

  if (projectedSpent > cap) {
    return {
      allowed: false,
      isNearCap: true,
      currentSpentUsd: currentSpent,
      capUsd: cap,
      message: `Presupuesto excedido: gasto acumulado ($${projectedSpent.toFixed(2)}) supera el tope de $${cap.toFixed(2)} USD.`
    }
  }

  const isNearCap = projectedSpent >= thresholdAmount

  return {
    allowed: true,
    isNearCap,
    currentSpentUsd: currentSpent,
    capUsd: cap,
    message: isNearCap
      ? `Alerta: el proyecto ha alcanzado el ${Math.round((projectedSpent / cap) * 100)}% de su presupuesto máximo ($${cap.toFixed(2)} USD).`
      : undefined
  }
}

export function setExtractorActiveState(
  configs: ExtractorConfig[],
  extractorKey: ExtractorConfig['extractorKey'],
  isEnabled: boolean
): ExtractorConfig[] {
  const now = new Date().toISOString()
  return configs.map(c => {
    if (c.extractorKey === extractorKey) {
      return {
        ...c,
        isEnabled,
        updatedAt: now
      }
    }
    return c
  })
}

export function assignTaskToUser(
  task: DocumentTask,
  assigneeUserId: string
): DocumentTask {
  return {
    ...task,
    assignedTo: assigneeUserId,
    updatedAt: new Date().toISOString()
  }
}
