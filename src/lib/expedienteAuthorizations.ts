import { normalizeRole, type CanonicalRole, type ProjectRole, type UserRole } from '../types'

export type ExpedienteAction =
  | 'load_files'
  | 'start_processing'
  | 'edit_draft'
  | 'approve_group'
  | 'approve_consolidation'
  | 'edit_document'
  | 'request_ai_revision'
  | 'finalize_document'
  | 'download_artifacts'
  | 'view_audit_events'

export class ExpedienteAuthorizationError extends Error {
  public readonly action: ExpedienteAction
  public readonly role: CanonicalRole

  constructor(action: ExpedienteAction, role: CanonicalRole, message?: string) {
    super(
      message ||
        `Acción no autorizada: el rol '${role}' no tiene permiso para ejecutar '${action}' en el expediente.`,
    )
    this.name = 'ExpedienteAuthorizationError'
    this.action = action
    this.role = role
  }
}

/**
 * Strict role-action permission matrix for Territorium 2.0 (HU-V2-054).
 *
 * Rules:
 * - Operador: carga y edición preliminar; no puede aprobar ningún subconjunto ni consolidado.
 * - Analista Predial: carga, edición y preparación documental; no puede aprobar consolidado ni finalizar.
 * - Revisor Jurídico: aprueba subconjuntos documentales y edita el documento.
 * - Aprobador: aprueba subconjuntos, consolidado y finaliza el documento oficial.
 * - Administrador: control total del flujo.
 * - Auditor: solo lectura, trazabilidad y descargas oficiales; no puede modificar nada.
 */
const ROLE_ACTION_PERMISSIONS: Record<CanonicalRole, Record<ExpedienteAction, boolean>> = {
  administrador: {
    load_files: true,
    start_processing: true,
    edit_draft: true,
    approve_group: true,
    approve_consolidation: true,
    edit_document: true,
    request_ai_revision: true,
    finalize_document: true,
    download_artifacts: true,
    view_audit_events: true,
  },
  aprobador: {
    load_files: true,
    start_processing: true,
    edit_draft: true,
    approve_group: true,
    approve_consolidation: true,
    edit_document: true,
    request_ai_revision: true,
    finalize_document: true,
    download_artifacts: true,
    view_audit_events: true,
  },
  revisor_juridico: {
    load_files: true,
    start_processing: true,
    edit_draft: true,
    approve_group: true,
    approve_consolidation: false, // Consolidation requires final approval
    edit_document: true,
    request_ai_revision: true,
    finalize_document: false,
    download_artifacts: true,
    view_audit_events: true,
  },
  analista_predial: {
    load_files: true,
    start_processing: true,
    edit_draft: true,
    approve_group: false, // Cannot approve
    approve_consolidation: false,
    edit_document: true,
    request_ai_revision: true,
    finalize_document: false,
    download_artifacts: true,
    view_audit_events: true,
  },
  operador: {
    load_files: true,
    start_processing: true,
    edit_draft: true,
    approve_group: false, // Cannot approve
    approve_consolidation: false,
    edit_document: false,
    request_ai_revision: false,
    finalize_document: false,
    download_artifacts: true,
    view_audit_events: true,
  },
  auditor: {
    load_files: false, // Read-only
    start_processing: false,
    edit_draft: false,
    approve_group: false,
    approve_consolidation: false,
    edit_document: false,
    request_ai_revision: false,
    finalize_document: false,
    download_artifacts: true,
    view_audit_events: true,
  },
}

/**
 * Checks whether a given role can perform an action in the dossier (HU-V2-054).
 */
export function canPerformExpedienteAction(
  role: ProjectRole | UserRole | string | null | undefined,
  action: ExpedienteAction,
): boolean {
  const canonical = normalizeRole(role)
  return ROLE_ACTION_PERMISSIONS[canonical]?.[action] ?? false
}

/**
 * Enforces action permissions and throws ExpedienteAuthorizationError if denied.
 * Never relies on UI hiding alone: guarantees server-level and logic-level rejection (HU-V2-054).
 */
export function enforceExpedienteAction(
  role: ProjectRole | UserRole | string | null | undefined,
  action: ExpedienteAction,
  customContext?: string,
): void {
  const canonical = normalizeRole(role)
  const allowed = canPerformExpedienteAction(role, action)

  if (!allowed) {
    const detail = customContext ? ` Contexto: ${customContext}` : ''
    throw new ExpedienteAuthorizationError(
      action,
      canonical,
      `Acceso denegado: el rol '${canonical}' no tiene privilegios para '${action}'.${detail}`,
    )
  }
}
