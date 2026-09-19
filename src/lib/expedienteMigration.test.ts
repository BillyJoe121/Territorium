import { describe, expect, it } from 'vitest'
import type { Project, PropertyRecord, SourceDocument } from '../types'
import {
  buildMigrationPlan,
  diagnoseLegacyProject,
  executeMigrationPlan,
  rollbackMigrationPlan,
} from './expedienteMigration'

describe('HU-V2-052: Controlled Migration of Existing Projects', () => {
  const baseProject: Project = {
    id: 'prj-legacy-01',
    name: 'Proyecto Interconexión Eléctrica 230kV',
    municipality: 'Medellín',
    department: 'Antioquia',
    createdAt: '2025-06-01T00:00:00Z',
  }

  it('correctly diagnoses a single-property project and recommends migration', () => {
    const documents: SourceDocument[] = [
      { id: 'doc-1', projectId: 'prj-legacy-01', batchId: 'batch-01', name: 'Estudio_Titulos_Predio_LaEsperanza.pdf', kind: 'estudio_titulos', size: 1024, mimeType: 'application/pdf', uploadedAt: '2025-06-01T00:00:00Z' },
      { id: 'doc-2', projectId: 'prj-legacy-01', batchId: 'batch-01', name: 'Plano_Topografico_Servidumbre.pdf', kind: 'plano', size: 2048, mimeType: 'application/pdf', uploadedAt: '2025-06-01T00:00:00Z' },
      { id: 'doc-3', projectId: 'prj-legacy-01', batchId: 'batch-01', name: 'Oferta_Negociacion_Valores.xlsx', kind: 'negociacion', size: 4096, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', uploadedAt: '2025-06-01T00:00:00Z' },
    ]

    const records: PropertyRecord[] = [
      {
        id: 'rec-1',
        projectId: 'prj-legacy-01',
        sourceDocumentId: 'doc-1',
        name: 'La Esperanza',
        folio: '050N-123456',
        municipality: 'Medellín',
        fields: {},
        confidence: 0.95,
        reviewState: 'aprobado',
        updatedAt: '2025-06-01T00:00:00Z',
      },
    ]

    const report = diagnoseLegacyProject(baseProject, documents, records)
    expect(report.classification).toBe('single_property')
    expect(report.recommendedAction).toBe('migrate_to_expediente')
    expect(report.totalDocuments).toBe(3)
    expect(report.mappings).toHaveLength(3)

    const titlesMapping = report.mappings.find((m) => m.documentId === 'doc-1')
    expect(titlesMapping?.targetGroup).toBe('titles')

    const plansMapping = report.mappings.find((m) => m.documentId === 'doc-2')
    expect(plansMapping?.targetGroup).toBe('plans')

    const negMapping = report.mappings.find((m) => m.documentId === 'doc-3')
    expect(negMapping?.targetGroup).toBe('negotiation')
  })

  it('detects a multi-property project and recommends read-only archive classification', () => {
    const records: PropertyRecord[] = [
      { id: 'rec-1', projectId: 'prj-legacy-01', sourceDocumentId: 'doc-1', name: 'Finca La Palma', folio: '050N-111111', municipality: 'Medellín', fields: {}, confidence: 0.9, reviewState: 'pendiente', updatedAt: '' },
      { id: 'rec-2', projectId: 'prj-legacy-01', sourceDocumentId: 'doc-2', name: 'Hacienda El Roble', folio: '050N-222222', municipality: 'Medellín', fields: {}, confidence: 0.9, reviewState: 'pendiente', updatedAt: '' },
    ]

    const report = diagnoseLegacyProject(baseProject, [], records)
    expect(report.classification).toBe('multi_property_legacy')
    expect(report.recommendedAction).toBe('mark_read_only_archive')
    expect(report.detectedPropertyCodes).toContain('050N-111111')
    expect(report.detectedPropertyCodes).toContain('050N-222222')
  })

  it('builds, executes, and rolls back a migration plan in an auditable and reversible manner', () => {
    const documents: SourceDocument[] = [
      { id: 'doc-1', projectId: 'prj-legacy-01', batchId: 'batch-01', name: 'Estudio_Titulos.pdf', kind: 'estudio_titulos', size: 1024, mimeType: 'application/pdf', uploadedAt: '' },
    ]
    const report = diagnoseLegacyProject(baseProject, documents, [])
    const plan = buildMigrationPlan(report)

    expect(plan.isExecuted).toBe(false)
    expect(plan.targetGroupAssignments.titles).toContain('doc-1')

    // Execute plan
    const execResult = executeMigrationPlan(plan, 'admin-operator-01')
    expect(execResult.success).toBe(true)
    expect(execResult.plan.isExecuted).toBe(true)
    expect(execResult.plan.auditLog.some((e) => e.event === 'MIGRATION_EXECUTED')).toBe(true)

    // Cannot execute twice
    const reExecResult = executeMigrationPlan(execResult.plan, 'admin-operator-01')
    expect(reExecResult.success).toBe(false)

    // Rollback plan
    const rollbackResult = rollbackMigrationPlan(execResult.plan, 'admin-operator-01')
    expect(rollbackResult.success).toBe(true)
    expect(rollbackResult.plan.isRolledBack).toBe(true)
    expect(rollbackResult.plan.auditLog.some((e) => e.event === 'MIGRATION_ROLLED_BACK')).toBe(true)
  })
})
