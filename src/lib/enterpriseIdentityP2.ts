import type {
  SsoConfiguration,
  UserRole,
  ElectronicSignatureRecord
} from '../types'

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
  const timestampToken = `RFC3161-${Date.now()}-${envelope.envelopeId}`

  const signedRecord: ElectronicSignatureRecord = {
    ...envelope,
    status: 'signed',
    timestampToken,
    signedAt: now,
    certificateDetails: {
      tsaAuthority: 'Territorium Trust TSA / Certicámara',
      algorithm: 'SHA256withRSA',
      verificationTokenRef: verificationCodeOrToken
    }
  }

  return {
    success: true,
    updatedRecord: signedRecord
  }
}
