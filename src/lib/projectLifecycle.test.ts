import { describe, it, expect } from 'vitest'
import {
  validateSessionPolicy,
  createSensitiveAuditEntry,
  duplicateProjectConfiguration,
  computeProjectOverallStatus,
  performSystemHealthCheck,
  evaluateDocumentRetention
} from './projectLifecycle'
import { Project, ProjectConfiguration, Batch, PropertyRecord, SourceDocument } from '../types'

describe('projectLifecycle (US-008, US-009, US-016, US-017, US-142, US-143, US-144)', () => {
  const mockConfig: ProjectConfiguration = {
    projectId: 'p1',
    sessionTimeoutMinutes: 60,
    mfaRequired: true,
    allowedWebOrigins: ['https://app.territorium.co', 'http://localhost:5173'],
    maxFilesPerBatch: 100,
    maxBatchSizeMb: 300,
    allowedMimeTypes: ['application/pdf'],
    retentionDaysRaw: 30,
    retentionDaysDerivatives: 15,
    retentionDaysExports: 10,
    autoPurgeEnabled: true,
    budgetCapUsd: 500,
    budgetAlertThresholdPercent: 80
  }

  it('US-008: valida sesión, expiración, MFA y orígenes web permitidos', () => {
    // Session expired
    const expired = validateSessionPolicy(mockConfig, 75, true, 'https://app.territorium.co')
    expect(expired.valid).toBe(false)
    expect(expired.reason).toContain('Sesión expirada')

    // MFA challenge required
    const noMfa = validateSessionPolicy(mockConfig, 10, false, 'https://app.territorium.co')
    expect(noMfa.valid).toBe(false)
    expect(noMfa.mfaChallengeRequired).toBe(true)

    // Forbidden origin
    const badOrigin = validateSessionPolicy(mockConfig, 10, true, 'https://malicious-site.com')
    expect(badOrigin.valid).toBe(false)
    expect(badOrigin.originAllowed).toBe(false)

    // Valid session
    const valid = validateSessionPolicy(mockConfig, 25, true, 'https://app.territorium.co')
    expect(valid.valid).toBe(true)
  })

  it('US-009: crea registros de auditoría de acceso a datos sensibles', () => {
    const entry = createSensitiveAuditEntry(
      'p1',
      'auditor@empresa.com',
      'property_record',
      'rec-101',
      'view',
      ['cedula_propietario', 'matricula_inmobiliaria'],
      'PREDIO-001'
    )
    expect(entry.actorEmail).toBe('auditor@empresa.com')
    expect(entry.sensitiveFields).toContain('cedula_propietario')
    expect(entry.action).toBe('view')
    expect(entry.propertyCode).toBe('PREDIO-001')
  })

  it('US-016: duplica configuración de proyecto sin copiar datos personales ni documentos', () => {
    const original: Project = {
      id: 'proj-origin',
      name: 'Proyecto Solar Cauca',
      clientName: 'ISA Intercolombia',
      municipality: 'Santander de Quilichao',
      department: 'Cauca',
      powerLine: 'Línea 230kV',
      createdAt: '2026-01-01T00:00:00Z',
      budgetCapUsd: 800
    }

    const { project, config } = duplicateProjectConfiguration(
      original,
      { newName: 'Proyecto Solar Cauca - Fase II' },
      mockConfig
    )

    expect(project.id).not.toBe(original.id)
    expect(project.name).toBe('Proyecto Solar Cauca - Fase II')
    expect(project.clientName).toBe('ISA Intercolombia')
    expect(project.statusOverall).toBe('sin_lotes')
    expect(config.projectId).toBe(project.id)
    expect(config.budgetCapUsd).toBe(mockConfig.budgetCapUsd)
  })

  it('US-017: calcula dinámicamente el estado general del proyecto', () => {
    const baseProj: Project = {
      id: 'p1',
      name: 'Test',
      municipality: 'M',
      department: 'D',
      createdAt: '2026-01-01'
    }

    // Sin lotes
    expect(computeProjectOverallStatus(baseProj, [], [])).toBe('sin_lotes')

    // Con lote en proceso -> en_carga
    const batchInProcess: Batch = {
      id: 'b1',
      projectId: 'p1',
      name: 'Lote 1',
      createdAt: '2026-01-01',
      jobState: 'en_proceso',
      progress: 40,
      runId: null,
      error: null
    }
    expect(computeProjectOverallStatus(baseProj, [batchInProcess], [])).toBe('en_carga')

    // Con registros pendientes -> en_revision
    const batchDone: Batch = { ...batchInProcess, jobState: 'requiere_revision' }
    const recPending: PropertyRecord = {
      id: 'r1',
      projectId: 'p1',
      sourceDocumentId: 'd1',
      name: 'Predio 1',
      folio: '001',
      municipality: 'M',
      reviewState: 'pendiente',
      confidence: 0.9,
      fields: {},
      updatedAt: '2026-01-01'
    }
    expect(computeProjectOverallStatus(baseProj, [batchDone], [recPending])).toBe('en_revision')

    // Todos aprobados sin export -> aprobado
    const recApproved: PropertyRecord = { ...recPending, reviewState: 'aprobado' }
    expect(computeProjectOverallStatus(baseProj, [batchDone], [recApproved], false)).toBe('aprobado')

    // Todos aprobados con export -> exportado
    expect(computeProjectOverallStatus(baseProj, [batchDone], [recApproved], true)).toBe('exportado')

    // Archivado
    expect(computeProjectOverallStatus({ ...baseProj, isArchived: true }, [batchDone], [recApproved])).toBe('archivado')
  })

  it('US-143: diagnostica estado de salud del sistema con degradación y fallback', () => {
    // Normal
    const healthy = performSystemHealthCheck(true, 50, true, 120, 15)
    expect(healthy.status).toBe('healthy')
    expect(healthy.checks.database.ok).toBe(true)

    // Degraded por worker lento
    const degraded = performSystemHealthCheck(true, 50, true, 120, 150)
    expect(degraded.status).toBe('degraded')

    // Unhealthy por caída de base de datos
    const unhealthy = performSystemHealthCheck(false, 0, true, 120, 10)
    expect(unhealthy.status).toBe('unhealthy')
  })

  it('US-144: evalúa retención documental y marca candidatos a purga segura', () => {
    const now = new Date('2026-06-01T00:00:00Z')
    const oldDoc: SourceDocument = {
      id: 'd1',
      projectId: 'p1',
      batchId: 'b1',
      name: 'estudio_antiguo.pdf',
      kind: 'estudio_titulos',
      size: 1500000,
      uploadedAt: '2026-04-01T00:00:00Z' // 61 días atrás (> 30 días)
    }
    const recentDoc: SourceDocument = {
      id: 'd2',
      projectId: 'p1',
      batchId: 'b1',
      name: 'estudio_reciente.pdf',
      kind: 'estudio_titulos',
      size: 2000000,
      uploadedAt: '2026-05-25T00:00:00Z' // 7 días atrás
    }

    const res = evaluateDocumentRetention([oldDoc, recentDoc], mockConfig, now)
    expect(res.purgeRawEligible.length).toBe(1)
    expect(res.purgeRawEligible[0].id).toBe('d1')
    expect(res.summary.totalRawPurgeBytes).toBe(1500000)
  })
})
