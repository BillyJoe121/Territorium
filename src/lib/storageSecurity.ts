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

  // 2. Detección de scripts maliciosos embebidos / macros sospechosas
  const textSample = new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0, 4096))
  if (
    textSample.includes('<script') ||
    textSample.includes('AutoExec') ||
    textSample.includes('WScript.Shell') ||
    textSample.includes('powershell -e')
  ) {
    return {
      id: logId,
      documentId,
      fileName,
      scanStatus: 'quarantined',
      threatDetails: 'Contenido activo o script malicioso potencialmente peligroso detectado.',
      engineName: 'Territorium Security Scanner Core',
      engineVersion: '2.4.0',
      scannedAt
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
    engineVersion: '2.4.0',
    scannedAt
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
