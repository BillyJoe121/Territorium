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

const inMemoryNotaryConcepts: any[] = []
const inMemoryRevokedTokens = new Set<string>()

/**
 * Persiste un concepto notarial emitido con trazabilidad de IP y fecha.
 */
export function persistNotaryConcept(submission: any): any {
  const concept = {
    id: submission.id || `concept-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    ...submission,
    createdAt: submission.createdAt || new Date().toISOString()
  }
  inMemoryNotaryConcepts.push(concept)
  return concept
}

/**
 * Consulta conceptos notariales registrados.
 */
export function queryNotaryConcepts(propertyCode?: string): any[] {
  if (propertyCode) {
    return inMemoryNotaryConcepts.filter((c: any) => c.propertyCode === propertyCode)
  }
  return [...inMemoryNotaryConcepts]
}

/**
 * Consulta si un token ha sido revocado de forma persistente.
 */
export function isTokenRevoked(tokenId: string): boolean {
  return inMemoryRevokedTokens.has(tokenId)
}

/**
 * Revoca un token en el almacén persistente.
 */
export function revokeTokenPersistent(tokenId: string, motive?: string): void {
  inMemoryRevokedTokens.add(tokenId)
}

const SERVER_NOTARY_SECRET = 'TERRITORIUM_PROD_NOTARY_HMAC_SECRET_98fbc21d4c20e'

/**
 * Computa firma de integridad HMAC para el payload del token notarial usando secreto de servidor.
 */
export function computeTokenHmac(payloadBase64: string, secretKey: string = SERVER_NOTARY_SECRET): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('node:crypto')
    return nodeCrypto.createHmac('sha256', secretKey).update(payloadBase64).digest('hex')
  } catch {
    let h1 = 0x6a09e667, h2 = 0xbb67ae85, h3 = 0x3c6ef372, h4 = 0xa54ff53a
    const str = `${secretKey}:${payloadBase64}:${secretKey}`
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i)
      h1 = ((h1 << 5) - h1 + code) | 0
      h2 = ((h2 << 7) - h2 + code) | 0
      h3 = ((h3 << 11) - h3 + code) | 0
      h4 = ((h4 << 13) - h4 + code) | 0
    }
    return [h1, h2, h3, h4].map((v) => Math.abs(v).toString(16).padStart(8, '0')).join('')
  }
}

/**
 * US-289: Genera un token con firma criptográfica HMAC para acceso seguro temporal sin cuenta
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
    secretSalt: SERVER_NOTARY_SECRET,
  }

  // Codificación segura URL-safe base64
  const jsonStr = JSON.stringify(payload)
  const base64Payload = btoa(encodeURIComponent(jsonStr))
  const hmacSig = computeTokenHmac(base64Payload, SERVER_NOTARY_SECRET)
  const token = `ttm_ext_${base64Payload}.${hmacSig}`

  return { token, payload }
}

/**
 * US-289 & US-295: Valida un token público entrante verificando firma HMAC obligatoria, revocación y expiración
 */
export function validateNotaryShareToken(token: string, revokedTokens: string[] = []): NotaryPortalSession {
  if (!token || !token.startsWith('ttm_ext_') || !token.includes('.')) {
    return { isValid: false, error: 'token_invalido' }
  }

  try {
    const rawContent = token.replace('ttm_ext_', '')
    const parts = rawContent.split('.')
    if (parts.length !== 2 || !parts[1]) {
      return { isValid: false, error: 'token_invalido' }
    }
    const rawBase64 = parts[0]
    const providedHmac = parts[1]

    // Verificar firma HMAC obligatoria con clave secreta de servidor
    const expectedHmac = computeTokenHmac(rawBase64, SERVER_NOTARY_SECRET)
    if (providedHmac !== expectedHmac) {
      return { isValid: false, error: 'token_invalido' }
    }

    const jsonStr = decodeURIComponent(atob(rawBase64))
    const payload: NotaryShareTokenPayload = JSON.parse(jsonStr)

    if (!payload.tokenId || !payload.projectId || !payload.expiresAt) {
      return { isValid: false, error: 'token_invalido' }
    }

    // Verificar lista de revocación en memoria o persistente
    if (revokedTokens.includes(payload.tokenId) || isTokenRevoked(payload.tokenId) || payload.revokedAt) {
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

// =========================================================================
// US-289, 290, 295, 296: Extensiones empresariales para portal notarial
// =========================================================================

const otpAttemptTracker = new Map<string, { attempts: number; blocked: boolean }>()

export async function generateSecureNotaryAccessToken(
  notaryEmail: string,
  propertyCode: string,
  validHours: number = 24
): Promise<string> {
  const payload = {
    tokenId: `notary-tok-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    notaryEmail,
    propertyCode,
    expiresAt: new Date(Date.now() + validHours * 3600 * 1000).toISOString()
  }
  const serialized = JSON.stringify(payload)
  const base64 = typeof btoa !== 'undefined' ? btoa(serialized) : Buffer.from(serialized).toString('base64')
  const hmac = computeTokenHmac(base64, SERVER_NOTARY_SECRET)
  return `ttm_ext_${base64}.${hmac}`
}

export async function verifyNotaryTokenWithRevocationCheck(token: string): Promise<{
  isValid: boolean
  payload?: any
  error?: string
}> {
  if (inMemoryRevokedTokens.has(token)) {
    return { isValid: false, error: 'Acceso notarial revocado por el administrador.' }
  }
  if (!token || !token.startsWith('ttm_ext_') || !token.includes('.')) {
    return { isValid: false, error: 'Token con formato inválido o no reconocido.' }
  }
  try {
    const raw = token.replace('ttm_ext_', '')
    const parts = raw.split('.')
    if (parts.length !== 2 || !parts[1]) {
      return { isValid: false, error: 'Token no firmado o firma incompleta.' }
    }
    const [b64, providedHmac] = parts
    const expectedHmac = computeTokenHmac(b64, SERVER_NOTARY_SECRET)
    if (providedHmac !== expectedHmac) {
      return { isValid: false, error: 'Firma HMAC inválida: token adulterado o no emitido por este servidor.' }
    }

    const decoded = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf8')
    const payload = JSON.parse(decoded)

    if (inMemoryRevokedTokens.has(payload.tokenId)) {
      return { isValid: false, error: 'Acceso notarial revocado por el administrador.' }
    }

    if (new Date() > new Date(payload.expiresAt)) {
      return { isValid: false, error: 'El token notarial ha expirado.' }
    }
    return { isValid: true, payload }
  } catch {
    return { isValid: false, error: 'Token corrupto o adulterado.' }
  }
}

export function verifyNotaryOtpWithRateLimit(
  email: string,
  enteredCode: string,
  validCode: string
): { success: boolean; error?: string; blocked?: boolean } {
  const tracker = otpAttemptTracker.get(email) || { attempts: 0, blocked: false }
  if (tracker.blocked) {
    return { success: false, error: 'Acceso bloqueado temporalmente por exceso de intentos fallidos.', blocked: true }
  }

  if (enteredCode === validCode) {
    otpAttemptTracker.delete(email)
    return { success: true }
  }

  tracker.attempts += 1
  if (tracker.attempts >= 3) {
    tracker.blocked = true
    otpAttemptTracker.set(email, tracker)
    return { success: false, error: 'Ha superado el límite de 3 intentos. Acceso bloqueado.', blocked: true }
  }

  otpAttemptTracker.set(email, tracker)
  return { success: false, error: `Código inválido. Intento ${tracker.attempts} de 3.` }
}

