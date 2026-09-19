import { describe, expect, it } from 'vitest'
import {
  canPerformExpedienteAction,
  enforceExpedienteAction,
  ExpedienteAuthorizationError,
  type ExpedienteAction,
} from './expedienteAuthorizations'

describe('HU-V2-054: Expediente Role-Based Access Control (RBAC)', () => {
  const allActions: ExpedienteAction[] = [
    'load_files',
    'start_processing',
    'edit_draft',
    'approve_group',
    'approve_consolidation',
    'edit_document',
    'request_ai_revision',
    'finalize_document',
    'download_artifacts',
    'view_audit_events',
  ]

  describe('Administrador', () => {
    it('allows all actions for administrador', () => {
      for (const action of allActions) {
        expect(canPerformExpedienteAction('administrador', action)).toBe(true)
        expect(() => enforceExpedienteAction('administrador', action)).not.toThrow()
      }
    })

    it('handles admin aliases correctly', () => {
      expect(canPerformExpedienteAction('admin', 'approve_consolidation')).toBe(true)
    })
  })

  describe('Aprobador', () => {
    it('allows all standard approvals and document finalization', () => {
      for (const action of allActions) {
        expect(canPerformExpedienteAction('aprobador', action)).toBe(true)
        expect(() => enforceExpedienteAction('aprobador', action)).not.toThrow()
      }
    })
  })

  describe('Revisor Jurídico', () => {
    it('allows group approvals and drafting but denies consolidation and finalization', () => {
      expect(canPerformExpedienteAction('revisor_juridico', 'approve_group')).toBe(true)
      expect(canPerformExpedienteAction('revisor_juridico', 'edit_document')).toBe(true)
      expect(canPerformExpedienteAction('revisor_juridico', 'request_ai_revision')).toBe(true)

      // Forbidden:
      expect(canPerformExpedienteAction('revisor_juridico', 'approve_consolidation')).toBe(false)
      expect(canPerformExpedienteAction('revisor_juridico', 'finalize_document')).toBe(false)

      expect(() => enforceExpedienteAction('revisor_juridico', 'approve_consolidation')).toThrow(
        ExpedienteAuthorizationError,
      )
      expect(() => enforceExpedienteAction('revisor_juridico', 'finalize_document')).toThrow(
        ExpedienteAuthorizationError,
      )
    })
  })

  describe('Analista Predial', () => {
    it('allows ingestion and editing but denies all approvals and finalization', () => {
      expect(canPerformExpedienteAction('analista_predial', 'load_files')).toBe(true)
      expect(canPerformExpedienteAction('analista_predial', 'edit_draft')).toBe(true)
      expect(canPerformExpedienteAction('analista_predial', 'edit_document')).toBe(true)

      // Forbidden:
      expect(canPerformExpedienteAction('analista_predial', 'approve_group')).toBe(false)
      expect(canPerformExpedienteAction('analista_predial', 'approve_consolidation')).toBe(false)
      expect(canPerformExpedienteAction('analista_predial', 'finalize_document')).toBe(false)

      expect(() => enforceExpedienteAction('analista_predial', 'approve_group')).toThrow(
        ExpedienteAuthorizationError,
      )
      expect(() => enforceExpedienteAction('analista_predial', 'approve_consolidation')).toThrow(
        ExpedienteAuthorizationError,
      )
    })
  })

  describe('Operador', () => {
    it('strictly forbids document approval, consolidation, and official document finalization', () => {
      expect(canPerformExpedienteAction('operador', 'load_files')).toBe(true)
      expect(canPerformExpedienteAction('operador', 'start_processing')).toBe(true)
      expect(canPerformExpedienteAction('operador', 'edit_draft')).toBe(true)

      // Forbidden:
      expect(canPerformExpedienteAction('operador', 'approve_group')).toBe(false)
      expect(canPerformExpedienteAction('operador', 'approve_consolidation')).toBe(false)
      expect(canPerformExpedienteAction('operador', 'edit_document')).toBe(false)
      expect(canPerformExpedienteAction('operador', 'request_ai_revision')).toBe(false)
      expect(canPerformExpedienteAction('operador', 'finalize_document')).toBe(false)

      expect(() => enforceExpedienteAction('operador', 'approve_group')).toThrow(
        ExpedienteAuthorizationError,
      )
      expect(() => enforceExpedienteAction('operador', 'finalize_document')).toThrow(
        ExpedienteAuthorizationError,
      )
    })
  })

  describe('Auditor', () => {
    it('is strictly read-only: permits download and audit log inspection only', () => {
      expect(canPerformExpedienteAction('auditor', 'download_artifacts')).toBe(true)
      expect(canPerformExpedienteAction('auditor', 'view_audit_events')).toBe(true)

      // Every mutating action is denied:
      const mutatingActions: ExpedienteAction[] = [
        'load_files',
        'start_processing',
        'edit_draft',
        'approve_group',
        'approve_consolidation',
        'edit_document',
        'request_ai_revision',
        'finalize_document',
      ]

      for (const action of mutatingActions) {
        expect(canPerformExpedienteAction('auditor', action)).toBe(false)
        expect(() => enforceExpedienteAction('auditor', action)).toThrow(
          ExpedienteAuthorizationError,
        )
      }
    })
  })

  describe('Authorization error details and context', () => {
    it('provides structured action, role, and custom context in error', () => {
      try {
        enforceExpedienteAction('operador', 'approve_group', 'Intento de aprobación subconjunto títulos')
        expect.unreachable('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ExpedienteAuthorizationError)
        const authErr = err as ExpedienteAuthorizationError
        expect(authErr.action).toBe('approve_group')
        expect(authErr.role).toBe('operador')
        expect(authErr.message).toContain('Intento de aprobación subconjunto títulos')
      }
    })

    it('defaults unknown or undefined roles to operador privileges safely', () => {
      expect(canPerformExpedienteAction(undefined, 'approve_group')).toBe(false)
      expect(canPerformExpedienteAction(null, 'finalize_document')).toBe(false)
    })
  })
})
