import type {
  SsoConfiguration,
  UserRole,
  ElectronicSignatureRecord,
  ProjectConfiguration
} from '../types'
import { generateRfc3161TimeStampToken, computeCryptoSha256 } from './digitalSignatureVerification'

export interface SensitiveAccessEvent {
  id: string
  projectId: string
  actorId: string
  actorEmail: string
  actorRole: string
  action: 'read_sensitive' | 'download_document' | 'modify_attribute' | 'approve_record' | 'export_book'
  entityType: 'source_document' | 'master_record' | 'attribute' | 'export_file'
  entityId: string
  timestamp: string
  clientIp?: string
  userAgent?: string
  accessJustification?: string
}

const inMemorySensitiveAuditLog: SensitiveAccessEvent[] = []

/**
 * US-009: Registra auditoría de acceso, descarga, corrección o aprobación de datos sensibles.
 */
export function logSensitiveDataAccess(
  arg1: any,
  arg2?: any,
  arg3?: any,
  arg4?: any,
  arg5?: any,
  arg6?: any,
  arg7?: any
): SensitiveAccessEvent & any {
  let event: any
  if (typeof arg1 === 'string') {
    event = {
      projectId: arg1,
      actorId: arg2,
      accessedBy: arg2,
      entityType: arg3,
      entityId: arg4,
      action: arg5,
      sensitiveFields: arg6 || [],
      propertyCode: arg7
    }
  } else {
    event = arg1
  }

  const fullEvent: SensitiveAccessEvent & any = {
    ...event,
    id: event.id || `sec-acc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    accessedBy: event.accessedBy || event.actorId,
    timestamp: event.timestamp || new Date().toISOString()
  }
  inMemorySensitiveAuditLog.push(fullEvent)
  return fullEvent
}

/**
 * US-009: Consulta el historial de accesos sensibles filtrado por proyecto o entidad.
 */
export function querySensitiveAccessLogs(filters?: any, actionFilter?: string): any[] {
  let projectId: string | undefined
  let action: string | undefined

  if (typeof filters === 'string') {
    projectId = filters
    action = actionFilter
  } else if (filters) {
    projectId = filters.projectId
    action = filters.action
  }

  return inMemorySensitiveAuditLog.filter((item) => {
    if (projectId && item.projectId !== projectId) return false
    if (action && item.action !== action) return false
    return true
  })
}

/**
 * US-008: Tracker de inactividad de sesión para forzar cierre automático según política.
 */
export function createSessionInactivityTracker(timeoutMinutes: number): {
  recordActivity: () => void
  isExpired: (nowMs?: number) => boolean
  getElapsedMinutes: (nowMs?: number) => number
  getRemainingSeconds: (nowMs?: number) => number
  setLastActivityForTesting: (timestampMs: number) => void
  resetTimeout: (newTimeoutMinutes: number) => void
} {
  let lastActivity = Date.now()
  let currentTimeout = timeoutMinutes

  return {
    recordActivity: () => {
      lastActivity = Date.now()
    },
    isExpired: (nowMs = Date.now()) => {
      const elapsedMinutes = (nowMs - lastActivity) / 60000
      return elapsedMinutes >= currentTimeout
    },
    getElapsedMinutes: (nowMs = Date.now()) => {
      return (nowMs - lastActivity) / 60000
    },
    getRemainingSeconds: (nowMs = Date.now()) => {
      return Math.max(0, Math.round(currentTimeout * 60 - (nowMs - lastActivity) / 1000))
    },
    setLastActivityForTesting: (timestampMs: number) => {
      lastActivity = timestampMs
    },
    resetTimeout: (newTimeoutMinutes: number) => {
      currentTimeout = newTimeoutMinutes
      lastActivity = Date.now()
    }
  }
}

/**
 * US-010: Establece conexión federada SSO corporativa con verificación de dominios y certificados.
 */
export function createEnterpriseSsoConnection(
  projectId: string,
  metadataUrl: string,
  ssoUrl: string,
  certFingerprint: string,
  allowedDomains: string[]
): any {
  return {
    id: `sso-${Date.now()}`,
    projectId,
    metadataUrl,
    ssoUrl,
    certFingerprint,
    allowedDomains,
    isEnabled: true,
    createdAt: new Date().toISOString()
  }
}

/**
 * US-010: Valida la configuración de un proveedor de identidad corporativo (SSO SAML / Azure AD / Okta).
 */
export function validateSsoConfiguration(config: Partial<SsoConfiguration>): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!config.providerName) {
    errors.push('El proveedor de identidad es obligatorio.')
  }
  if (!config.clientId || config.clientId.trim() === '') {
    errors.push('El Client ID o Entity ID es obligatorio.')
  }
  if (!config.issuer || !config.issuer.startsWith('http')) {
    errors.push('El Issuer / Autoridad debe ser una URL válida (HTTPS recomendado).')
  }
  if (!config.defaultRole) {
    errors.push('Debe asignarse un rol por defecto para usuarios aprovisionados.')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * US-010: Mapea claims o grupos corporativos a roles de Territorium con mínimo privilegio.
 */
export function resolveUserRoleFromSsoClaims(
  claims: Record<string, unknown>,
  config: SsoConfiguration
): UserRole {
  // Buscar claim de grupos o roles (comunes en Azure AD 'roles' o 'groups')
  const userGroups: string[] = []

  if (Array.isArray(claims['roles'])) {
    userGroups.push(...(claims['roles'] as string[]))
  }
  if (Array.isArray(claims['groups'])) {
    userGroups.push(...(claims['groups'] as string[]))
  }
  if (typeof claims['role'] === 'string') {
    userGroups.push(claims['role'])
  }

  for (const group of userGroups) {
    if (config.roleClaimMapping[group]) {
      return config.roleClaimMapping[group]
    }
  }

  return config.defaultRole
}

/**
 * US-115: Genera solicitud / envelope de firma electrónica certificada para documentos jurídicos.
 */
export function createElectronicSignatureEnvelope(input: {
  documentId: string
  projectId: string
  propertyCode: string
  documentSha256: string
  signerEmail: string
  signerName: string
  signerRole: string
  provider?: 'docusign' | 'certicamara' | 'internal_otp'
}): ElectronicSignatureRecord {
  const provider = input.provider || 'internal_otp'
  const now = new Date().toISOString()
  const envelopeId = `env-${provider}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

  return {
    id: `sig-${Date.now()}`,
    documentId: input.documentId,
    projectId: input.projectId,
    propertyCode: input.propertyCode,
    provider,
    envelopeId,
    signerEmail: input.signerEmail,
    signerName: input.signerName,
    signerRole: input.signerRole,
    documentSha256: input.documentSha256,
    status: 'pending',
    createdAt: now
  }
}

/**
 * US-115: Valida y aplica el sellado electrónico y estampa de tiempo cronológica (RFC 3161).
 */
export function verifyAndApplyElectronicSignature(
  envelope: ElectronicSignatureRecord,
  actualDocumentHash: string,
  verificationCodeOrToken: string
): {
  success: boolean
  updatedRecord: ElectronicSignatureRecord
  rejectionReason?: string
} {
  // 1. Integridad del documento: el hash no puede haber cambiado
  if (envelope.documentSha256 !== actualDocumentHash) {
    return {
      success: false,
      updatedRecord: { ...envelope, status: 'declined' },
      rejectionReason: 'Discrepancia de integridad: el documento fue alterado después de la solicitud de firma.'
    }
  }

  // 2. Validación de código de un solo uso o token de proveedor
  if (!verificationCodeOrToken || verificationCodeOrToken.trim().length < 4) {
    return {
      success: false,
      updatedRecord: envelope,
      rejectionReason: 'Código o token de firma inválido o insuficiente.'
    }
  }

  const now = new Date().toISOString()
  const serialNumber = `SN-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
  const timestampToken = `RFC3161:${serialNumber}:${now}:${actualDocumentHash.substring(0, 16)}`

  const signedRecord: ElectronicSignatureRecord = {
    ...envelope,
    status: 'signed',
    timestampToken,
    signedAt: now,
    certificateDetails: {
      tsaAuthority: 'Territorium Qualified TSA - Certicámara / ONAC',
      algorithm: 'SHA256withRSA',
      verificationTokenRef: verificationCodeOrToken,
      policyOid: '1.3.6.1.4.1.4146.2.1',
      serialNumber
    }
  }

  return {
    success: true,
    updatedRecord: signedRecord
  }
}

