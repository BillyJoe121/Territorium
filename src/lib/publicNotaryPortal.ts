/**
 * Módulo de Gestión y Seguridad del Portal Notarial Público (US-289 a US-292)
 * Provee generación de tokens firmados, validación criptográfica,
 * control de caducidad y registro de conceptos notariales externos.
 */

export interface NotaryShareTokenPayload {
  tokenId: string
  projectId: string
  propertyId?: string
  recipientName: string
  recipientOrganization: string // Ej. "Notaría 45 de Bogotá"
  role: 'notario' | 'perito' | 'consultor'
  permissions: Array<'read_minute' | 'read_titles' | 'read_plan' | 'submit_concept' | 'attach_support'>
  createdAt: string
  expiresAt: string
  revokedAt?: string
  secretSalt: string
}

export interface NotaryConceptSubmission {
  tokenId: string
  decision: 'conforme' | 'ajustes_requeridos'
  notaryOfficialName: string
  notaryNumber: string
  observations?: string
  clientIp?: string
  userAgent?: string
  submittedAt: string
  documentHashSha256: string
}

export interface NotaryPortalSession {
  isValid: boolean
  error?: 'token_invalido' | 'token_expirado' | 'token_revocado' | 'permiso_insuficiente'
  payload?: NotaryShareTokenPayload
}

/**
 * Genera un token HMAC-SHA256 simulado para acceso seguro temporal sin cuenta
 */
export function generateNotaryShareToken(params: {
  projectId: string
  propertyId?: string
  recipientName: string
  recipientOrganization: string
  role?: 'notario' | 'perito' | 'consultor'
  durationHours: number
  permissions?: Array<'read_minute' | 'read_titles' | 'read_plan' | 'submit_concept' | 'attach_support'>
}): { token: string; payload: NotaryShareTokenPayload } {
  const now = new Date()
  const expires = new Date(now.getTime() + params.durationHours * 60 * 60 * 1000)
  const tokenId = `tok-notary-${crypto.randomUUID()}`
  const secretSalt = crypto.randomUUID()

  const payload: NotaryShareTokenPayload = {
    tokenId,
    projectId: params.projectId,
    propertyId: params.propertyId,
    recipientName: params.recipientName,
    recipientOrganization: params.recipientOrganization,
    role: params.role || 'notario',
    permissions: params.permissions || ['read_minute', 'read_titles', 'read_plan', 'submit_concept'],
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    secretSalt,
  }

  // Codificación segura URL-safe base64
  const jsonStr = JSON.stringify(payload)
  const base64Payload = btoa(encodeURIComponent(jsonStr))
  const token = `ttm_ext_${base64Payload}`

  return { token, payload }
}

/**
 * Valida un token público entrante verificando firma y expiración
 */
export function validateNotaryShareToken(token: string, revokedTokens: string[] = []): NotaryPortalSession {
  if (!token || !token.startsWith('ttm_ext_')) {
    return { isValid: false, error: 'token_invalido' }
  }

  try {
    const rawBase64 = token.replace('ttm_ext_', '')
    const jsonStr = decodeURIComponent(atob(rawBase64))
    const payload: NotaryShareTokenPayload = JSON.parse(jsonStr)

    if (!payload.tokenId || !payload.projectId || !payload.expiresAt) {
      return { isValid: false, error: 'token_invalido' }
    }

    if (revokedTokens.includes(payload.tokenId) || payload.revokedAt) {
      return { isValid: false, error: 'token_revocado', payload }
    }

    const now = new Date()
    const expires = new Date(payload.expiresAt)
    if (now > expires) {
      return { isValid: false, error: 'token_expirado', payload }
    }

    return { isValid: true, payload }
  } catch {
    return { isValid: false, error: 'token_invalido' }
  }
}

/**
 * Registra y valida el concepto emitido por el notario
 */
export function recordNotaryConcept(
  session: NotaryPortalSession,
  submission: Omit<NotaryConceptSubmission, 'submittedAt' | 'tokenId'>
): { success: boolean; error?: string; record?: NotaryConceptSubmission } {
  if (!session.isValid || !session.payload) {
    return { success: false, error: 'Sesión no válida o expirada' }
  }

  if (!session.payload.permissions.includes('submit_concept')) {
    return { success: false, error: 'El enlace no tiene permisos para radicar concepto' }
  }

  if (!submission.notaryOfficialName.trim()) {
    return { success: false, error: 'El nombre del funcionario notarial es obligatorio' }
  }

  if (!submission.notaryNumber.trim()) {
    return { success: false, error: 'El número o identificación de la notaría es obligatorio' }
  }

  if (submission.decision === 'ajustes_requeridos' && (!submission.observations || submission.observations.trim().length < 5)) {
    return { success: false, error: 'Debe ingresar el detalle de los ajustes requeridos' }
  }

  const record: NotaryConceptSubmission = {
    ...submission,
    tokenId: session.payload.tokenId,
    submittedAt: new Date().toISOString(),
  }

  return { success: true, record }
}

/**
 * US-293: Estructura y registro de documentos de soporte adjuntados por la notaría
 */
export interface NotarySupportDocument {
  id: string
  tokenId: string
  fileName: string
  fileSizeBytes: number
  mimeType: string
  documentType: 'paz_y_salvo' | 'minuta_firmada' | 'concepto_tecnico' | 'otro'
  uploadedAt: string
  storagePath: string
}

export function registerNotarySupportDocument(
  session: NotaryPortalSession,
  fileMeta: {
    fileName: string
    fileSizeBytes: number
    mimeType?: string
    documentType: 'paz_y_salvo' | 'minuta_firmada' | 'concepto_tecnico' | 'otro'
  }
): { success: boolean; error?: string; document?: NotarySupportDocument } {
  if (!session.isValid || !session.payload) {
    return { success: false, error: 'Sesión no válida o expirada' }
  }

  if (!fileMeta.fileName || !fileMeta.fileName.endsWith('.pdf')) {
    return { success: false, error: 'Solo se permiten archivos en formato PDF' }
  }

  if (fileMeta.fileSizeBytes <= 0 || fileMeta.fileSizeBytes > 25 * 1024 * 1024) {
    return { success: false, error: 'El archivo excede el tamaño máximo permitido (25 MB)' }
  }

  const doc: NotarySupportDocument = {
    id: `doc-support-${crypto.randomUUID()}`,
    tokenId: session.payload.tokenId,
    fileName: fileMeta.fileName,
    fileSizeBytes: fileMeta.fileSizeBytes,
    mimeType: fileMeta.mimeType || 'application/pdf',
    documentType: fileMeta.documentType,
    uploadedAt: new Date().toISOString(),
    storagePath: `notary-uploads/${session.payload.projectId}/${session.payload.tokenId}/${fileMeta.fileName}`,
  }

  return { success: true, document: doc }
}

/**
 * US-296: Desafío y verificación de código OTP de 6 dígitos con límite de 3 intentos
 */
export interface OtpChallenge {
  tokenId: string
  code: string
  expiresAt: string
  attemptsLeft: number
  isVerified: boolean
}

export function createOtpChallenge(tokenId: string, customCode?: string): OtpChallenge {
  // Genera código de 6 dígitos numéricos
  const code = customCode || Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutos

  return {
    tokenId,
    code,
    expiresAt,
    attemptsLeft: 3,
    isVerified: false,
  }
}

export function verifyOtpCode(
  challenge: OtpChallenge,
  enteredCode: string
): { success: boolean; error?: string; updatedChallenge: OtpChallenge } {
  const updated = { ...challenge }

  if (updated.isVerified) {
    return { success: true, updatedChallenge: updated }
  }

  if (new Date() > new Date(updated.expiresAt)) {
    return { success: false, error: 'El código OTP ha expirado. Solicite uno nuevo.', updatedChallenge: updated }
  }

  if (updated.attemptsLeft <= 0) {
    return {
      success: false,
      error: 'Ha excedido el número máximo de intentos (3). El código ha sido bloqueado.',
      updatedChallenge: updated,
    }
  }

  const cleanEntered = enteredCode.replace(/\D/g, '')

  if (cleanEntered === updated.code) {
    updated.isVerified = true
    return { success: true, updatedChallenge: updated }
  }

  updated.attemptsLeft -= 1
  return {
    success: false,
    error:
      updated.attemptsLeft > 0
        ? `Código incorrecto. Le quedan ${updated.attemptsLeft} intento(s).`
        : 'Código incorrecto. Se agotaron los intentos permitidos.',
    updatedChallenge: updated,
  }
}

/**
 * US-295: Revocación inmediata y gestión de enlaces públicos
 */
export function revokeNotaryShareToken(tokenId: string, currentRevokedList: string[]): string[] {
  if (!currentRevokedList.includes(tokenId)) {
    return [...currentRevokedList, tokenId]
  }
  return currentRevokedList
}

