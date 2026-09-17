import {
  Project,
  ProjectConfiguration,
  ProjectStatusOverall,
  SensitiveDataAuditLog,
  ProjectSnapshot,
  SourceDocument,
  Batch,
  PropertyRecord,
  DocumentTemplate,
  ExtractorConfig
} from '../types'

export interface SessionValidationResult {
  valid: boolean
  reason?: string
  mfaChallengeRequired?: boolean
  originAllowed?: boolean
}

export function validateSessionPolicy(
  config: ProjectConfiguration,
  sessionDurationMinutes: number,
  mfaVerified: boolean,
  currentOrigin: string
): SessionValidationResult {
  // Check session timeout
  if (sessionDurationMinutes > config.sessionTimeoutMinutes) {
    return {
      valid: false,
      reason: `Sesión expirada. Límite de ${config.sessionTimeoutMinutes} minutos excedido (duración: ${sessionDurationMinutes} min).`
    }
  }

  // Check MFA
  if (config.mfaRequired && !mfaVerified) {
    return {
      valid: false,
      mfaChallengeRequired: true,
      reason: 'Se requiere autenticación multifactor (MFA) para acceder a este expediente.'
    }
  }

  // Check Allowed Origins
  const isOriginAllowed = config.allowedWebOrigins.some(origin => {
    try {
      const allowedHost = new URL(origin).host
      const currentHost = new URL(currentOrigin).host
      return allowedHost === currentHost || origin === '*'
    } catch {
      return origin === currentOrigin
    }
  })

  if (!isOriginAllowed) {
    return {
      valid: false,
      originAllowed: false,
      reason: `Origen web no autorizado: ${currentOrigin}. Orígenes permitidos: ${config.allowedWebOrigins.join(', ')}`
    }
  }

  return { valid: true, originAllowed: true }
}

export function createSensitiveAuditEntry(
  projectId: string,
  actorEmail: string,
  resourceType: SensitiveDataAuditLog['resourceType'],
  resourceId: string,
  action: SensitiveDataAuditLog['action'],
  sensitiveFields: string[],
  propertyCode?: string,
  actorId?: string
): SensitiveDataAuditLog {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    projectId,
    actorId: actorId ?? null,
    actorEmail,
    resourceType,
    resourceId,
    propertyCode: propertyCode ?? null,
    action,
    sensitiveFields,
    createdAt: new Date().toISOString()
  }
}

export interface DuplicateProjectOptions {
  newName: string
  newMunicipality?: string
  newDepartment?: string
  copyMembers?: boolean
  copyTemplates?: boolean
  copyExtractorConfigs?: boolean
}

export function duplicateProjectConfiguration(
  sourceProject: Project,
  options: DuplicateProjectOptions,
  sourceConfig?: ProjectConfiguration,
  templates: DocumentTemplate[] = [],
  extractorConfigs: ExtractorConfig[] = []
): {
  project: Project
  config: ProjectConfiguration
  templates: DocumentTemplate[]
  extractorConfigs: ExtractorConfig[]
} {
  const newProjectId = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  const now = new Date().toISOString()

  const duplicatedProject: Project = {
    id: newProjectId,
    name: options.newName,
    clientName: sourceProject.clientName,
    municipality: options.newMunicipality || sourceProject.municipality,
    department: options.newDepartment || sourceProject.department,
    powerLine: sourceProject.powerLine,
    createdAt: now,
    updatedAt: now,
    isArchived: false,
    budgetCapUsd: sourceProject.budgetCapUsd ?? 250.0,
    totalSpentUsd: 0.0,
    statusOverall: 'sin_lotes'
  }

  const duplicatedConfig: ProjectConfiguration = {
    projectId: newProjectId,
    sessionTimeoutMinutes: sourceConfig?.sessionTimeoutMinutes ?? 60,
    mfaRequired: sourceConfig?.mfaRequired ?? false,
    allowedWebOrigins: sourceConfig?.allowedWebOrigins ? [...sourceConfig.allowedWebOrigins] : ['https://territorium.local'],
    maxFilesPerBatch: sourceConfig?.maxFilesPerBatch ?? 200,
    maxBatchSizeMb: sourceConfig?.maxBatchSizeMb ?? 500,
    allowedMimeTypes: sourceConfig?.allowedMimeTypes ? [...sourceConfig.allowedMimeTypes] : ['application/pdf'],
    retentionDaysRaw: sourceConfig?.retentionDaysRaw ?? 365,
    retentionDaysDerivatives: sourceConfig?.retentionDaysDerivatives ?? 180,
    retentionDaysExports: sourceConfig?.retentionDaysExports ?? 90,
    autoPurgeEnabled: sourceConfig?.autoPurgeEnabled ?? false,
    budgetCapUsd: sourceConfig?.budgetCapUsd ?? 250.0,
    budgetAlertThresholdPercent: sourceConfig?.budgetAlertThresholdPercent ?? 80,
    createdAt: now,
    updatedAt: now
  }

  const duplicatedTemplates = options.copyTemplates
    ? templates
        .filter(t => t.projectId === sourceProject.id)
        .map(t => ({
          ...t,
          id: `tmpl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          projectId: newProjectId,
          createdAt: now
        }))
    : []

  const duplicatedExtractorConfigs = options.copyExtractorConfigs
    ? extractorConfigs.map(c => ({
        ...c,
        updatedAt: now
      }))
    : []

  return {
    project: duplicatedProject,
    config: duplicatedConfig,
    templates: duplicatedTemplates,
    extractorConfigs: duplicatedExtractorConfigs
  }
}

export function computeProjectOverallStatus(
  project: Project,
  batches: Batch[],
  records: PropertyRecord[],
  hasExports: boolean = false
): ProjectStatusOverall {
  if (project.isArchived) {
    return 'archivado'
  }

  const projectBatches = batches.filter(b => b.projectId === project.id)
  if (projectBatches.length === 0) {
    return 'sin_lotes'
  }

  const anyProcessing = projectBatches.some(b => b.jobState === 'en_proceso' || b.jobState === 'pendiente')
  if (anyProcessing) {
    return 'en_carga'
  }

  const projectRecords = records.filter(r => r.projectId === project.id)
  if (projectRecords.length === 0) {
    return 'en_carga'
  }

  const allApproved = projectRecords.length > 0 && projectRecords.every(r => r.reviewState === 'aprobado')

  if (allApproved) {
    return hasExports ? 'exportado' : 'aprobado'
  }

  return 'en_revision'
}

export function createProjectBackupSnapshot(
  project: Project,
  config: ProjectConfiguration,
  templates: DocumentTemplate[] = [],
  extractorConfigs: ExtractorConfig[] = [],
  label: string = 'Respaldo manual'
): ProjectSnapshot {
  return {
    id: `snap-${Date.now()}`,
    projectId: project.id,
    snapshotType: 'backup',
    label,
    payload: {
      project: { ...project },
      config: { ...config },
      templates: templates.map(t => ({ ...t })),
      extractorConfigs: extractorConfigs.map(c => ({ ...c })),
      exportedAt: new Date().toISOString(),
      version: '1.0'
    },
    createdAt: new Date().toISOString()
  }
}

export interface HealthCheckReport {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: {
    database: { ok: boolean; latencyMs: number }
    storage: { ok: boolean; latencyMs: number }
    worker: { ok: boolean; lastHeartbeatSecAgo: number }
  }
  canRollback: boolean
  timestamp: string
}

export function performSystemHealthCheck(
  dbConnected: boolean,
  dbLatencyMs: number,
  storageConnected: boolean,
  storageLatencyMs: number,
  workerHeartbeatSecAgo: number
): HealthCheckReport {
  const workerOk = workerHeartbeatSecAgo >= 0 && workerHeartbeatSecAgo < 120
  const allOk = dbConnected && storageConnected && workerOk

  let status: HealthCheckReport['status'] = 'healthy'
  if (!dbConnected || !storageConnected) {
    status = 'unhealthy'
  } else if (!workerOk || dbLatencyMs > 800 || storageLatencyMs > 1200) {
    status = 'degraded'
  }

  return {
    status,
    checks: {
      database: { ok: dbConnected, latencyMs: dbLatencyMs },
      storage: { ok: storageConnected, latencyMs: storageLatencyMs },
      worker: { ok: workerOk, lastHeartbeatSecAgo: workerHeartbeatSecAgo }
    },
    canRollback: true,
    timestamp: new Date().toISOString()
  }
}

export interface RetentionEvaluationResult {
  purgeRawEligible: SourceDocument[]
  purgeDerivativesEligible: SourceDocument[]
  summary: {
    totalRawPurgeBytes: number
    totalRawCount: number
    totalDerivativesCount: number
  }
}

export function evaluateDocumentRetention(
  documents: SourceDocument[],
  config: ProjectConfiguration,
  currentDate: Date = new Date()
): RetentionEvaluationResult {
  const rawCutoff = new Date(currentDate.getTime() - config.retentionDaysRaw * 24 * 60 * 60 * 1000)
  const derivCutoff = new Date(currentDate.getTime() - config.retentionDaysDerivatives * 24 * 60 * 60 * 1000)

  const purgeRawEligible: SourceDocument[] = []
  const purgeDerivativesEligible: SourceDocument[] = []

  let totalRawPurgeBytes = 0

  for (const doc of documents) {
    const uploadTime = new Date(doc.uploadedAt)
    if (uploadTime < rawCutoff) {
      purgeRawEligible.push(doc)
      totalRawPurgeBytes += doc.size
    } else if (uploadTime < derivCutoff && (doc.workingText || doc.ocrApplied)) {
      purgeDerivativesEligible.push(doc)
    }
  }

  return {
    purgeRawEligible,
    purgeDerivativesEligible,
    summary: {
      totalRawPurgeBytes,
      totalRawCount: purgeRawEligible.length,
      totalDerivativesCount: purgeDerivativesEligible.length
    }
  }
}
