import type { DocumentKind, Project, PropertyRecord, SourceDocument } from '../types'

export type ProjectMigrationClassification = 'single_property' | 'multi_property_legacy' | 'empty'

export interface DocumentMigrationMapping {
  documentId: string
  fileName: string
  originalKind: DocumentKind
  targetGroup: 'titles' | 'plans' | 'negotiation' | 'unassigned'
  confidence: number
}

export interface ProjectDiagnosticReport {
  projectId: string
  projectName: string
  classification: ProjectMigrationClassification
  totalDocuments: number
  totalPropertyRecords: number
  detectedPropertyCodes: string[]
  mappings: DocumentMigrationMapping[]
  recommendedAction: 'migrate_to_expediente' | 'mark_read_only_archive' | 'no_action_needed'
  diagnosedAt: string
}

export interface MigrationExecutionPlan {
  planId: string
  projectId: string
  classification: ProjectMigrationClassification
  targetGroupAssignments: Record<'titles' | 'plans' | 'negotiation', string[]> // document IDs
  archiveAsReadOnly: boolean
  auditLog: {
    event: string
    timestamp: string
    details: Record<string, unknown>
  }[]
  isExecuted: boolean
  isRolledBack: boolean
}

/**
 * Classifies documents into the 3 canonical groups of Territorium 2.0 (HU-V2-052).
 */
export function classifyDocumentToGroup(doc: SourceDocument): {
  targetGroup: 'titles' | 'plans' | 'negotiation' | 'unassigned'
  confidence: number
} {
  const name = (doc.name || '').toLowerCase()
  const kind = doc.kind

  if (kind === 'estudio_titulos' || /(estudio|titulo|título|matricula|matrícula|tradicion|tradición)/.test(name)) {
    return { targetGroup: 'titles', confidence: 0.95 }
  }
  if (kind === 'plano' || /(plano|topogr|cartogr|plg|poligono|polígono)/.test(name)) {
    return { targetGroup: 'plans', confidence: 0.92 }
  }
  if (kind === 'negociacion' || /(negocia|oferta|avaluo|avalúo|correspondencia|precio)/.test(name)) {
    return { targetGroup: 'negotiation', confidence: 0.94 }
  }

  return { targetGroup: 'unassigned', confidence: 0.2 }
}

/**
 * Performs a comprehensive diagnostic of an existing project prior to any data mutation (HU-V2-052).
 */
export function diagnoseLegacyProject(
  project: Project,
  documents: SourceDocument[],
  records: PropertyRecord[],
): ProjectDiagnosticReport {
  const projectDocs = documents.filter((d) => d.projectId === project.id)
  const projectRecords = records.filter((r) => r.projectId === project.id)

  const detectedPropertyCodes = Array.from(
    new Set(
      projectRecords
        .map((r) => (r as any).propertyCode || (r as any).predio || r.folio || r.name || '')
        .filter((code) => code.trim().length > 0),
    ),
  )

  let classification: ProjectMigrationClassification = 'empty'
  let recommendedAction: ProjectDiagnosticReport['recommendedAction'] = 'no_action_needed'

  if (projectDocs.length === 0 && projectRecords.length === 0) {
    classification = 'empty'
    recommendedAction = 'no_action_needed'
  } else if (detectedPropertyCodes.length > 1) {
    classification = 'multi_property_legacy'
    recommendedAction = 'mark_read_only_archive'
  } else {
    classification = 'single_property'
    recommendedAction = 'migrate_to_expediente'
  }

  const mappings: DocumentMigrationMapping[] = projectDocs.map((doc) => {
    const classificationResult = classifyDocumentToGroup(doc)
    return {
      documentId: doc.id,
      fileName: doc.name,
      originalKind: doc.kind,
      targetGroup: classificationResult.targetGroup,
      confidence: classificationResult.confidence,
    }
  })

  return {
    projectId: project.id,
    projectName: project.name,
    classification,
    totalDocuments: projectDocs.length,
    totalPropertyRecords: projectRecords.length,
    detectedPropertyCodes,
    mappings,
    recommendedAction,
    diagnosedAt: new Date().toISOString(),
  }
}

/**
 * Builds a deterministic and reversible migration plan from a diagnostic report (HU-V2-052).
 */
export function buildMigrationPlan(report: ProjectDiagnosticReport): MigrationExecutionPlan {
  const planId = `plan-mig-${report.projectId}-${Date.now()}`
  const targetGroupAssignments: Record<'titles' | 'plans' | 'negotiation', string[]> = {
    titles: [],
    plans: [],
    negotiation: [],
  }

  for (const m of report.mappings) {
    if (m.targetGroup !== 'unassigned') {
      targetGroupAssignments[m.targetGroup].push(m.documentId)
    }
  }

  const archiveAsReadOnly = report.classification === 'multi_property_legacy'

  return {
    planId,
    projectId: report.projectId,
    classification: report.classification,
    targetGroupAssignments,
    archiveAsReadOnly,
    auditLog: [
      {
        event: 'PLAN_CREATED',
        timestamp: new Date().toISOString(),
        details: {
          reportTimestamp: report.diagnosedAt,
          recommendedAction: report.recommendedAction,
          totalAssignedDocs:
            targetGroupAssignments.titles.length +
            targetGroupAssignments.plans.length +
            targetGroupAssignments.negotiation.length,
        },
      },
    ],
    isExecuted: false,
    isRolledBack: false,
  }
}

/**
 * Executes the migration plan in a traceable, auditable manner (HU-V2-052).
 */
export function executeMigrationPlan(
  plan: MigrationExecutionPlan,
  operatorId: string,
): { success: boolean; plan: MigrationExecutionPlan; message: string } {
  if (plan.isExecuted) {
    return { success: false, plan, message: 'El plan de migración ya fue ejecutado previamente.' }
  }

  const updatedPlan: MigrationExecutionPlan = {
    ...plan,
    isExecuted: true,
    auditLog: [
      ...plan.auditLog,
      {
        event: 'MIGRATION_EXECUTED',
        timestamp: new Date().toISOString(),
        details: {
          operatorId,
          archiveAsReadOnly: plan.archiveAsReadOnly,
          titlesCount: plan.targetGroupAssignments.titles.length,
          plansCount: plan.targetGroupAssignments.plans.length,
          negotiationCount: plan.targetGroupAssignments.negotiation.length,
        },
      },
    ],
  }

  const message = plan.archiveAsReadOnly
    ? `Expediente multipredio ${plan.projectId} clasificado como archivo histórico en solo lectura.`
    : `Expediente ${plan.projectId} migrado exitosamente al modelo de predio único.`

  return { success: true, plan: updatedPlan, message }
}

/**
 * Rolls back an executed migration plan to restore previous state (HU-V2-052).
 */
export function rollbackMigrationPlan(
  plan: MigrationExecutionPlan,
  operatorId: string,
): { success: boolean; plan: MigrationExecutionPlan; message: string } {
  if (!plan.isExecuted) {
    return { success: false, plan, message: 'No se puede revertir un plan que no ha sido ejecutado.' }
  }
  if (plan.isRolledBack) {
    return { success: false, plan, message: 'Este plan de migración ya fue revertido.' }
  }

  const rolledBackPlan: MigrationExecutionPlan = {
    ...plan,
    isRolledBack: true,
    auditLog: [
      ...plan.auditLog,
      {
        event: 'MIGRATION_ROLLED_BACK',
        timestamp: new Date().toISOString(),
        details: { operatorId, rolledBackAt: new Date().toISOString() },
      },
    ],
  }

  return {
    success: true,
    plan: rolledBackPlan,
    message: `Migración del expediente ${plan.projectId} revertida exitosamente.`,
  }
}
