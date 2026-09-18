import { DocumentVersion, FileScanLog, ProjectConfiguration, SourceDocument } from '../types'

export interface BatchLimitsCheckResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  stats: {
    fileCount: number
    totalSizeMb: number
    unsupportedCount: number
  }
}

export function validateBatchUploadLimits(
  files: Array<{ name: string; size: number; mimeType?: string }>,
  config: ProjectConfiguration
): BatchLimitsCheckResult {
  const errors: string[] = []
  const warnings: string[] = []

  const fileCount = files.length
  const totalSizeBytes = files.reduce((acc, f) => acc + f.size, 0)
  const totalSizeMb = Math.round((totalSizeBytes / (1024 * 1024)) * 100) / 100

  // 1. Check max files
  if (fileCount > config.maxFilesPerBatch) {
    errors.push(
      `Límite de archivos excedido: el lote contiene ${fileCount} archivos (máximo permitido: ${config.maxFilesPerBatch}).`
    )
  }

  // 2. Check max batch size
  if (totalSizeMb > config.maxBatchSizeMb) {
    errors.push(
      `Tamaño total del lote excedido: ${totalSizeMb} MB (máximo permitido: ${config.maxBatchSizeMb} MB).`
    )
  }

  // 3. Check allowed mime types or extensions
  let unsupportedCount = 0
  const allowedExtensions = ['.pdf', '.docx', '.xlsx', '.xls', '.dwg']

  for (const f of files) {
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'))
    const isMimeAllowed = f.mimeType ? config.allowedMimeTypes.includes(f.mimeType) : false
    const isExtAllowed = allowedExtensions.includes(ext)

    if (!isMimeAllowed && !isExtAllowed) {
      unsupportedCount++
      errors.push(`Archivo '${f.name}' tiene un formato no permitido (${f.mimeType || ext}).`)
    }
  }

  // Warning when reaching 80% of limit
  if (fileCount >= config.maxFilesPerBatch * 0.8 && fileCount <= config.maxFilesPerBatch) {
    warnings.push(`Advertencia: el lote está al ${Math.round((fileCount / config.maxFilesPerBatch) * 100)}% de la capacidad de archivos.`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      fileCount,
      totalSizeMb,
      unsupportedCount
    }
  }
}

export function scanFileForThreats(
  fileName: string,
  buffer: Uint8Array,
  documentId?: string
): FileScanLog {
  const scannedAt = new Date().toISOString()
  const logId = `scan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`

  // Heurística de seguridad antivirus
  // 1. Detección de ejecutables camuflados (MZ header de PE/EXE en Windows o ELF en Linux)
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return {
      id: logId,
      documentId,
      fileName,
      scanStatus: 'infected',
      threatDetails: 'Cabecera ejecutable Win32/DOS (MZ) detectada en archivo no ejecutable.',
      engineName: 'Territorium Security Scanner Core',
      engineVersion: '2.4.0',
      scannedAt
    }
  }

  // 2. Detección de scripts maliciosos embebidos / macros sospechosas / exploits PDF
  const textSample = new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0, 8192))
  if (
    textSample.includes('<script') ||
    textSample.includes('AutoExec') ||
    textSample.includes('WScript.Shell') ||
    textSample.includes('powershell -e') ||
    textSample.includes('/JavaScript') ||
    textSample.includes('/Launch')
  ) {
    return {
      id: logId,
      documentId,
      fileName,
      scanStatus: 'quarantined',
      threatDetails: 'Contenido activo o script malicioso (macro o exploit embebido) detectado en el documento.',
      engineName: 'Territorium Security Scanner Core',
      engineVersion: '2.5.0',
      scannedAt
    }
  }

  // 3. Detección heurística de ZIP bombs / Decompression Bombs
  const ext = fileName.toLowerCase().split('.').pop() || ''
  if (['zip', 'docx', 'xlsx'].includes(ext) && buffer.length > 30) {
    // Si la cabecera es ZIP (PK\x03\x04)
    if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
      // Detección de anomalías en cabeceras de compresión desproporcionada
      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      const compressedSize = view.getUint32(18, true)
      const uncompressedSize = view.getUint32(22, true)
      if (compressedSize > 0 && uncompressedSize / compressedSize > 100 && uncompressedSize > 50 * 1024 * 1024) {
        return {
          id: logId,
          documentId,
          fileName,
          scanStatus: 'infected',
          threatDetails: 'Bomba de descompresión detectada (ratio de expansión superior a 100:1).',
          engineName: 'Territorium Security Scanner Core',
          engineVersion: '2.5.0',
          scannedAt
        }
      }
    }
  }

  // Archivo limpio
  return {
    id: logId,
    documentId,
    fileName,
    scanStatus: 'clean',
    threatDetails: null,
    engineName: 'Territorium Security Scanner Core',
    engineVersion: '2.5.0',
    scannedAt
  }
}

/**
 * US-041: Escaneo de seguridad avanzado con detección de ZIP bombs y exploits embebidos.
 */
export async function scanUploadedFileSecurity(
  fileName: string,
  buffer: Uint8Array,
  mimeType: string = 'application/octet-stream',
  options: { uncompressedSizeBytes?: number } = {}
): Promise<{
  isSafe: boolean
  quarantined: boolean
  threatDetected?: string
  details?: string
}> {
  if (options.uncompressedSizeBytes && buffer.length > 0) {
    const ratio = options.uncompressedSizeBytes / buffer.length
    if (ratio > 100) {
      return {
        isSafe: false,
        quarantined: true,
        threatDetected: 'ZIP_BOMB_DECOMPRESSION_ATTACK',
        details: `Ratio de compresión malicioso detectado: ${Math.round(ratio)}:1`
      }
    }
  }

  const scan = scanFileForThreats(fileName, buffer)
  if (scan.scanStatus === 'quarantined' || scan.scanStatus === 'infected') {
    return {
      isSafe: false,
      quarantined: true,
      threatDetected: scan.scanStatus === 'infected' ? 'MALWARE_OR_EXECUTABLE' : 'PDF_ACTIVE_CONTENT_OR_EXPLOIT',
      details: scan.threatDetails || 'Amenaza detectada en el análisis heurístico.'
    }
  }

  return {
    isSafe: true,
    quarantined: false
  }
}

export interface RetentionPurgeRecord {
  documentId: string
  fileName: string
  documentKind: string
  ageDays: number
  retentionLimitDays: number
  purgedAt: string
}

export interface RetentionPurgeResult {
  evaluatedCount: number
  purgedCount: number
  retainedCount: number
  purgedDetails: RetentionPurgeRecord[]
  autoPurgeExecuted: boolean
  auditLog: string[]
}

/**
 * US-042: Evalúa y ejecuta la política operativa de retención y purga documental por proyecto.
 */
export function executeRetentionPurgePolicy(
  arg1: any,
  arg2?: any,
  arg3?: any
): RetentionPurgeResult & any {
  let documents: any[] = []
  let config: ProjectConfiguration
  let currentDate: Date = new Date()

  if (typeof arg1 === 'string') {
    documents = Array.isArray(arg2) ? arg2 : []
    config = arg3
  } else {
    documents = Array.isArray(arg1) ? arg1 : []
    config = arg2
    if (arg3 instanceof Date) currentDate = arg3
  }

  const auditLog: string[] = []
  const purgedDetails: RetentionPurgeRecord[] = []
  let retainedCount = 0
  let bytesReclaimed = 0

  if (!config || !config.autoPurgeEnabled) {
    auditLog.push('La purga automática está deshabilitada en la configuración del expediente.')
    return {
      evaluatedCount: documents.length,
      purgedCount: 0,
      purgedFilesCount: 0,
      retainedCount: documents.length,
      retainedFilesCount: documents.length,
      purgedDetails: [],
      purgedFileIds: [],
      bytesReclaimed: 0,
      autoPurgeExecuted: false,
      auditLog
    }
  }

  const nowMs = currentDate.getTime()

  for (const doc of documents) {
    const uploadedTime = doc.uploadedAt || doc.createdAt || new Date().toISOString()
    const uploadedMs = new Date(uploadedTime).getTime()
    const ageDays = Math.floor((nowMs - uploadedMs) / (1000 * 60 * 60 * 24))
    const docKind = doc.kind || doc.category || 'raw'

    let retentionLimit = config.retentionDaysRaw
    if (docKind === 'soporte' || docKind === 'derivado') {
      retentionLimit = config.retentionDaysDerivatives
    } else if (docKind === 'export' || docKind === 'xlsx_export') {
      retentionLimit = config.retentionDaysExports
    }

    if (ageDays >= retentionLimit) {
      const record: RetentionPurgeRecord = {
        documentId: doc.id,
        fileName: doc.name,
        documentKind: docKind,
        ageDays,
        retentionLimitDays: retentionLimit,
        purgedAt: currentDate.toISOString()
      }
      purgedDetails.push(record)
      bytesReclaimed += doc.sizeBytes || 0
      auditLog.push(`Documento purgado: '${doc.name}' (${doc.id}) - Antigüedad: ${ageDays} días (Límite: ${retentionLimit} días).`)
    } else {
      retainedCount++
    }
  }

  return {
    evaluatedCount: documents.length,
    purgedCount: purgedDetails.length,
    purgedFilesCount: purgedDetails.length,
    purgedFileIds: purgedDetails.map((p) => p.documentId),
    retainedCount,
    retainedFilesCount: retainedCount,
    bytesReclaimed,
    purgedDetails,
    autoPurgeExecuted: true,
    auditLog
  }
}

export function createNewDocumentVersion(
  document: SourceDocument,
  newStoragePath: string,
  newFileName: string,
  newSize: number,
  newSha256: string,
  existingVersions: DocumentVersion[] = [],
  changeSummary: string = 'Actualización de documento fuente',
  authorId?: string
): { version: DocumentVersion; updatedVersions: DocumentVersion[] } {
  const currentDocVersions = existingVersions.filter(v => v.documentId === document.id)
  const nextVersionNumber = currentDocVersions.length + 1

  // Marcar versiones anteriores como no actuales
  const updatedVersions = existingVersions.map(v =>
    v.documentId === document.id ? { ...v, isCurrent: false } : v
  )

  const newVersion: DocumentVersion = {
    id: `ver-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    documentId: document.id,
    projectId: document.projectId,
    versionNumber: nextVersionNumber,
    fileName: newFileName,
    storagePath: newStoragePath,
    sizeBytes: newSize,
    sha256: newSha256,
    isCurrent: true,
    changeSummary,
    createdBy: authorId ?? null,
    createdAt: new Date().toISOString()
  }

  updatedVersions.push(newVersion)

  return {
    version: newVersion,
    updatedVersions
  }
}
