export const expedienteGroupKeys = ['titles', 'plans', 'negotiation'] as const

export type ExpedienteGroupKey = (typeof expedienteGroupKeys)[number]
export type ExpedienteGroupStatus = 'empty' | 'ready' | 'queued' | 'processing' | 'review_ready' | 'approved' | 'stale' | 'error'
export type ExpedienteConsolidationStatus = 'blocked' | 'available' | 'processing' | 'review_ready' | 'approved' | 'stale'
export type ExpedienteFinalDocumentStatus = 'blocked' | 'generating' | 'editable' | 'reprocessing' | 'final' | 'stale'

export interface GroupWorkflowState {
  key: ExpedienteGroupKey
  status: ExpedienteGroupStatus
  inputVersion: number
  approvedResultVersionId?: string | null
}

export interface WorkflowState {
  groups: Record<ExpedienteGroupKey, GroupWorkflowState>
  consolidation: { status: ExpedienteConsolidationStatus; approvedResultVersionId?: string | null }
  finalDocument: { status: ExpedienteFinalDocumentStatus }
}

const allowedTransitions: Record<ExpedienteGroupStatus, readonly ExpedienteGroupStatus[]> = {
  empty: ['ready', 'stale'],
  ready: ['empty', 'queued', 'stale', 'error'],
  queued: ['ready', 'processing', 'error', 'stale'],
  processing: ['review_ready', 'error', 'stale'],
  review_ready: ['approved', 'queued', 'stale', 'error'],
  approved: ['stale'],
  stale: ['empty', 'ready', 'queued'],
  error: ['ready', 'queued', 'stale'],
}

export function canTransitionGroupStatus(from: ExpedienteGroupStatus, to: ExpedienteGroupStatus): boolean {
  return from === to || allowedTransitions[from].includes(to)
}

export function transitionGroupStatus(
  group: GroupWorkflowState,
  status: ExpedienteGroupStatus,
): GroupWorkflowState {
  if (!canTransitionGroupStatus(group.status, status)) {
    throw new Error(`Transición inválida del grupo ${group.key}: ${group.status} → ${status}.`)
  }
  return { ...group, status }
}

export function allGroupsApproved(groups: Record<ExpedienteGroupKey, GroupWorkflowState>): boolean {
  return expedienteGroupKeys.every((key) => groups[key].status === 'approved')
}

export function deriveConsolidationStatus(
  groups: Record<ExpedienteGroupKey, GroupWorkflowState>,
  previous: ExpedienteConsolidationStatus,
): ExpedienteConsolidationStatus {
  if (allGroupsApproved(groups)) return previous === 'blocked' || previous === 'stale' ? 'available' : previous
  return ['available', 'processing', 'review_ready', 'approved'].includes(previous) ? 'stale' : 'blocked'
}

/**
 * Cambiar un archivo nunca borra resultados. Revoca solo el grupo tocado y
 * marca como no vigentes los productos aguas abajo.
 */
export function invalidateForInputChange(state: WorkflowState, key: ExpedienteGroupKey, hasActiveFiles: boolean): WorkflowState {
  const group = state.groups[key]
  const nextStatus: ExpedienteGroupStatus = ['queued', 'processing', 'review_ready', 'approved', 'stale'].includes(group.status)
    ? 'stale'
    : hasActiveFiles ? 'ready' : 'empty'

  return {
    groups: {
      ...state.groups,
      [key]: {
        ...group,
        inputVersion: group.inputVersion + 1,
        status: nextStatus,
        approvedResultVersionId: null,
      },
    },
    consolidation: {
      status: ['available', 'processing', 'review_ready', 'approved'].includes(state.consolidation.status) ? 'stale' : 'blocked',
      approvedResultVersionId: null,
    },
    finalDocument: {
      status: ['generating', 'editable', 'reprocessing', 'final'].includes(state.finalDocument.status) ? 'stale' : 'blocked',
    },
  }
}
