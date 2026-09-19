import { describe, expect, it } from 'vitest'
import {
  allGroupsApproved,
  canTransitionGroupStatus,
  deriveConsolidationStatus,
  invalidateForInputChange,
  type WorkflowState,
} from './expedienteWorkflow'

const state = (): WorkflowState => ({
  groups: {
    titles: { key: 'titles', status: 'approved', inputVersion: 3, approvedResultVersionId: 'title-v3' },
    plans: { key: 'plans', status: 'approved', inputVersion: 2, approvedResultVersionId: 'plan-v2' },
    negotiation: { key: 'negotiation', status: 'approved', inputVersion: 1, approvedResultVersionId: 'negotiation-v1' },
  },
  consolidation: { status: 'approved', approvedResultVersionId: 'consolidated-v1' },
  finalDocument: { status: 'final' },
})

describe('máquina de estados del expediente v2', () => {
  it('solo permite las transiciones declaradas para cada subconjunto', () => {
    expect(canTransitionGroupStatus('ready', 'queued')).toBe(true)
    expect(canTransitionGroupStatus('review_ready', 'approved')).toBe(true)
    expect(canTransitionGroupStatus('approved', 'ready')).toBe(false)
  })

  it('invalida solo la fuente cambiada y todos sus descendientes', () => {
    const next = invalidateForInputChange(state(), 'plans', true)

    expect(next.groups.plans).toMatchObject({ status: 'stale', inputVersion: 3, approvedResultVersionId: null })
    expect(next.groups.titles).toMatchObject({ status: 'approved', inputVersion: 3, approvedResultVersionId: 'title-v3' })
    expect(next.groups.negotiation).toMatchObject({ status: 'approved', inputVersion: 1, approvedResultVersionId: 'negotiation-v1' })
    expect(next.consolidation).toEqual({ status: 'stale', approvedResultVersionId: null })
    expect(next.finalDocument.status).toBe('stale')
  })

  it('solo habilita el consolidado con las tres fuentes aprobadas', () => {
    const approved = state().groups
    expect(allGroupsApproved(approved)).toBe(true)
    expect(deriveConsolidationStatus(approved, 'blocked')).toBe('available')

    const pending = { ...approved, negotiation: { ...approved.negotiation, status: 'review_ready' as const } }
    expect(allGroupsApproved(pending)).toBe(false)
    expect(deriveConsolidationStatus(pending, 'approved')).toBe('stale')
  })
})
