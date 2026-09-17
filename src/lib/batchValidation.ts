import JSZip from 'jszip'
import type { BatchItem, DocumentKind, DuplicateDecision, ManifestSummary, SourceDocument } from '../types'
import { classifyFileName } from '../data/platformRepository'

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'zip']
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

export function extractFileExtension(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

/**
 * Normaliza y deduce el código o identificador del predio a partir del nombre del archivo.
 * Soporta de forma explícita sufijos y variantes como SAN-CIM-036A y SAN-CIM-036B sin fusionarlas (US-027).
 */
export function extractPropertyCode(fileName: string): string {
  // Limpiar extensión
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '')

  // Limpiar descriptores comunes de documentos al inicio para evitar falsos positivos
  const cleaned = nameWithoutExt
    .replace(/^(?:estudio[_\s-]+(?:de[_\s-]+)?t[ií]tulos|estudio|plano[_\s-]+topogr[aá]fico|plano|ficha[_\s-]+catastral|ficha|minuta|oferta|avaluo|avalúo)[_\s-]+/i, '')

  // Patrón 1: Códigos tipo SIG / Proyectos (ej. SAN-CIM-036A, BOG-TUN-001, PR-102B)
  const codeMatch = cleaned.match(/(?:^|[_()\s\[\]])([A-Z]{2,6}(?:-[A-Z0-9]+)+[A-Z]?)(?:$|[_()\s\[\]])/i)
  if (codeMatch && codeMatch[1] && !/^(?:FICHA|PLANO|ESTUDIO|TITULO|CATASTRO)/i.test(codeMatch[1])) {
    return codeMatch[1].toUpperCase()
  }

  // Patrón 2: Prefijos Predio / Ficha / Lote con número y sufijo opcional (ej. Predio_12B, Lote_04A)
  const parcelMatch = nameWithoutExt.match(/(?:predio|ficha|lote)[_\s-]+([A-Z0-9]+[A-Z]?)(?:$|[_()\s\[\]])/i)
  if (parcelMatch && parcelMatch[1]) {
    return parcelMatch[1].toUpperCase()
  }

  // Patrón 3: Cédula catastral o matrícula inmobiliaria (ej. 190-12345A)
  const matriculaMatch = nameWithoutExt.match(/(?:^|[_()\s\[\]])(\d{3}-\d{5,8}[A-Z]?)(?:$|[_()\s\[\]])/i)
  if (matriculaMatch && matriculaMatch[1]) {
    return matriculaMatch[1].toUpperCase()
  }

  return ''
}

export function normalizePropertyCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '-')
}

/**
 * Parsea una lista de predios esperados ingresados por el operador (separados por coma, nueva línea o espacio).
 */
export function parseExpectedProperties(input: string): string[] {
  if (!input.trim()) return []
  const tokens = input
    .split(/[\n,;]+/)
    .map((s) => normalizePropertyCode(s))
    .filter(Boolean)

  return Array.from(new Set(tokens))
}

/**
 * Calcula el hash SHA-256 de un archivo en el navegador.
 */
export async function calculateSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Validación integral de archivo de entrada (US-022).
 */
export async function validateFileEntry(file: File): Promise<{
  errors: string[]
  warnings: string[]
  hash: string
}> {
  const errors: string[] = []
  const warnings: string[] = []
  let hash = ''

  // Validación de tamaño vacío (0 bytes)
  if (file.size === 0) {
    errors.push('El archivo está vacío (0 bytes).')
  }

  // Validación de límite de tamaño (50 MB)
  if (file.size > MAX_FILE_SIZE) {
    errors.push(`El archivo supera el límite permitido de 50 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`)
  }

  // Validación de extensión
  const ext = extractFileExtension(file.name)
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    errors.push(`Formato no compatible (.${ext || 'desconocido'}). Solo se aceptan PDF, DOC, DOCX, imágenes o ZIP.`)
  }

  // Verificación de legibilidad / archivo dañado
  if (file.size > 0 && errors.length === 0) {
    try {
      // Intentar leer los primeros bytes para asegurar que no esté corrupto
      const slice = file.slice(0, Math.min(file.size, 1024))
      await slice.arrayBuffer()
      hash = await calculateSha256(file)
    } catch {
      errors.push('El archivo parece estar dañado o no puede ser leído.')
    }
  }

  return { errors, warnings, hash }
}

/**
 * Descomprime un archivo .zip y extrae todos los documentos legibles (US-019).
 */
export async function extractZipArchive(zipFile: File): Promise<File[]> {
  const zip = new JSZip()
  const loadedZip = await zip.loadAsync(zipFile)
  const extractedFiles: File[] = []

  const mimeByExt: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
  }

  const entries = Object.keys(loadedZip.files)
  for (const entryPath of entries) {
    const entry = loadedZip.files[entryPath]
    // Ignorar carpetas y archivos ocultos de macOS o Windows
    if (entry.dir || entry.name.startsWith('__MACOSX') || entry.name.includes('/.') || entry.name.startsWith('.')) {
      continue
    }

    const simpleName = entry.name.split('/').pop() || entry.name
    const ext = extractFileExtension(simpleName)
    if (!['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg'].includes(ext)) {
      continue
    }

    const blob = await entry.async('blob')
    const mimeType = mimeByExt[ext] || 'application/octet-stream'
    const extracted = new File([blob], simpleName, { type: mimeType, lastModified: Date.now() })
    extractedFiles.push(extracted)
  }

  return extractedFiles
}

/**
 * Detecta duplicados por SHA-256 en el lote actual y contra documentos previos del proyecto (US-023).
 */
export function analyzeBatchDuplicates(
  items: BatchItem[],
  existingDocs: SourceDocument[]
): BatchItem[] {
  const seenHashesInBatch = new Map<string, string>() // hash -> item.id

  return items.map((item) => {
    let isDuplicate = false
    let duplicateSource: 'batch' | 'project' | undefined
    let duplicateTargetName: string | undefined
    const errors = [...item.errors]
    const warnings = [...item.warnings]

    if (item.sha256) {
      // Comparar contra el lote actual
      if (seenHashesInBatch.has(item.sha256)) {
        isDuplicate = true
        duplicateSource = 'batch'
        const originalId = seenHashesInBatch.get(item.sha256)
        const orig = items.find((it) => it.id === originalId)
        duplicateTargetName = orig ? orig.name : 'otro archivo en el lote'
        warnings.push(`Contenido idéntico a ${duplicateTargetName} en este mismo lote.`)
      } else {
        seenHashesInBatch.set(item.sha256, item.id)

        // Comparar contra documentos ya cargados en el proyecto
        const existingMatch = existingDocs.find((doc) => doc.sha256 === item.sha256)
        if (existingMatch) {
          isDuplicate = true
          duplicateSource = 'project'
          duplicateTargetName = existingMatch.name
          warnings.push(`Este archivo ya existe en el expediente (${existingMatch.name}).`)
        }
      }
    }

    return {
      ...item,
      isDuplicate,
      duplicateSource,
      duplicateTargetName,
      warnings,
      errors,
    }
  })
}

/**
 * Calcula el resumen del manifiesto de insumos previo al procesamiento (US-028, US-029).
 */
export function computeManifestSummary(
  items: BatchItem[],
  expectedProperties: string[]
): ManifestSummary {
  const activeItems = items.filter((it) => it.duplicateDecision !== 'omit')
  const totalFiles = items.length

  let criticalErrors = 0
  let unresolvedDuplicates = 0
  let unassignedFiles = 0

  const receivedPropertiesSet = new Set<string>()

  for (const item of activeItems) {
    if (item.errors.length > 0) {
      criticalErrors += item.errors.length
    }
    if (item.isDuplicate && !item.duplicateDecision) {
      unresolvedDuplicates += 1
      criticalErrors += 1
    }
    if (item.propertyCode) {
      receivedPropertiesSet.add(item.propertyCode)
    } else {
      unassignedFiles += 1
    }
  }

  const expectedCount = expectedProperties.length
  const receivedPropertiesArray = Array.from(receivedPropertiesSet)
  const receivedCount = receivedPropertiesArray.length

  const missingProperties = expectedProperties.filter((code) => !receivedPropertiesSet.has(code))
  const coveragePercent = expectedCount > 0
    ? Math.round(((expectedCount - missingProperties.length) / expectedCount) * 100)
    : 100

  const duplicatesCount = items.filter((it) => it.isDuplicate).length
  const validFiles = activeItems.filter((it) => it.errors.length === 0).length

  const canProcess = criticalErrors === 0 && activeItems.length > 0

  return {
    totalFiles,
    validFiles,
    criticalErrors,
    expectedCount,
    receivedCount,
    coveragePercent,
    missingProperties,
    unassignedFiles,
    duplicatesCount,
    unresolvedDuplicates,
    canProcess,
  }
}
