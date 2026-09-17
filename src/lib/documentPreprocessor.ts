import JSZip from 'jszip'
import type { PreprocessingStatus, TextOrigin } from '../types'
import { calculateSha256 } from './batchValidation'

export interface DocumentAnalysisResult {
  sha256: string
  sizeBytes: number
  pageCount: number
  isScanned: boolean
  needsOcr: boolean
  ocrApplied: boolean
  isEncrypted: boolean
  isBlank: boolean
  textOrigin: TextOrigin
  workingText: string
  preprocessingStatus: PreprocessingStatus
  exceptionReason?: string
}

/**
 * Analiza un buffer PDF para determinar encriptación, conteo de páginas y si es escaneado o texto nativo (US-036, US-037, US-040).
 */
export function analyzePdfBuffer(buffer: ArrayBuffer): {
  isEncrypted: boolean
  pageCount: number
  isScanned: boolean
  needsOcr: boolean
  hasSelectableText: boolean
  extractedTextPreview: string
} {
  const decoder = new TextDecoder('latin1')
  const content = decoder.decode(buffer)

  // 1. Detección de contraseña / cifrado (US-040)
  const isEncrypted = /\/Encrypt\b/.test(content)
  if (isEncrypted) {
    return {
      isEncrypted: true,
      pageCount: 0,
      isScanned: false,
      needsOcr: false,
      hasSelectableText: false,
      extractedTextPreview: '',
    }
  }

  // 2. Conteo de páginas aproximado (US-036)
  let pageCount = 1
  const countMatch = content.match(/\/Type\s*\/Pages\b[\s\S]*?\/Count\s+(\d+)/)
  if (countMatch && countMatch[1]) {
    pageCount = Math.max(1, parseInt(countMatch[1], 10))
  } else {
    // Contar ocurrencias de /Type /Page
    const pageMatches = content.match(/\/Type\s*\/Page\b/g)
    if (pageMatches) {
      pageCount = Math.max(1, pageMatches.length)
    }
  }

  // 3. Detección de texto nativo seleccionable vs escaneado (US-037)
  // Buscar operadores de texto PDF (BT = Begin Text, ET = End Text, Tj/TJ = Show Text)
  const hasTextOperators = /\bBT\b[\s\S]*?\bET\b/.test(content)
  const hasFonts = /\/Font\b/.test(content)
  const hasImages = /\/Subtype\s*\/Image\b/.test(content)

  // Extraer texto literal de cadenas entre paréntesis (ej: (Texto de prueba) Tj)
  const textSnippets: string[] = []
  const textRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g
  let match: RegExpExecArray | null
  while ((match = textRegex.exec(content)) !== null) {
    const snippet = match[1].trim()
    if (snippet.length > 1) {
      textSnippets.push(snippet)
    }
    if (textSnippets.length > 50) break
  }

  const rawExtracted = textSnippets.join(' ')
  const characterCount = rawExtracted.replace(/\s+/g, '').length

  // Si tiene imágenes pero menos de 25 caracteres de texto por página, es escaneado
  const isScanned = (hasImages && characterCount < pageCount * 25) || (!hasTextOperators && !hasFonts)
  const needsOcr = isScanned
  const hasSelectableText = !isScanned && characterCount >= 20

  return {
    isEncrypted: false,
    pageCount,
    isScanned,
    needsOcr,
    hasSelectableText,
    extractedTextPreview: rawExtracted.slice(0, 500),
  }
}

/**
 * Extrae la representación de trabajo de un archivo DOCX sin alterar el original (US-039).
 */
export async function extractDocxWorkingText(file: File): Promise<{
  workingText: string
  isEncrypted: boolean
  isBlank: boolean
}> {
  try {
    const zip = new JSZip()
    const loaded = await zip.loadAsync(file)

    // Si es un paquete cifrado de Word
    if (loaded.files['EncryptedPackage']) {
      return { workingText: '', isEncrypted: true, isBlank: false }
    }

    const docXml = loaded.files['word/document.xml']
    if (!docXml) {
      return { workingText: '', isEncrypted: false, isBlank: true }
    }

    const xmlContent = await docXml.async('text')
    // Extraer texto dentro de etiquetas <w:t>
    const textPieces: string[] = []
    const tagRegex = /<w:t[^>]*>([^<]+)<\/w:t>/g
    let match: RegExpExecArray | null
    while ((match = tagRegex.exec(xmlContent)) !== null) {
      textPieces.push(match[1])
    }

    const fullText = textPieces.join(' ').trim()
    return {
      workingText: fullText,
      isEncrypted: false,
      isBlank: fullText.length === 0,
    }
  } catch {
    return { workingText: '', isEncrypted: false, isBlank: true }
  }
}

/**
 * Análisis completo de preprocesamiento, metadatos y trazabilidad (E04).
 */
export async function preProcessDocument(file: File): Promise<DocumentAnalysisResult> {
  const sha256 = await calculateSha256(file)
  const sizeBytes = file.size
  const ext = file.name.split('.').pop()?.toLowerCase() || ''

  // Archivo vacío (0 bytes) -> Corrupto/Excepción (US-040)
  if (sizeBytes === 0) {
    return {
      sha256,
      sizeBytes,
      pageCount: 0,
      isScanned: false,
      needsOcr: false,
      ocrApplied: false,
      isEncrypted: false,
      isBlank: true,
      textOrigin: 'exception',
      workingText: '',
      preprocessingStatus: 'corrupt',
      exceptionReason: 'El archivo está vacío (0 bytes).',
    }
  }

  // Procesamiento según tipo de archivo
  if (ext === 'pdf') {
    const buffer = await file.arrayBuffer()
    const { isEncrypted, pageCount, isScanned, needsOcr, extractedTextPreview } = analyzePdfBuffer(buffer)

    if (isEncrypted) {
      return {
        sha256,
        sizeBytes,
        pageCount: 0,
        isScanned: false,
        needsOcr: false,
        ocrApplied: false,
        isEncrypted: true,
        isBlank: false,
        textOrigin: 'exception',
        workingText: '',
        preprocessingStatus: 'exception',
        exceptionReason: 'Documento PDF protegido por contraseña. Requiere versión desbloqueada.',
      }
    }

    const isBlank = pageCount === 0 || (!isScanned && extractedTextPreview.length === 0)

    return {
      sha256,
      sizeBytes,
      pageCount,
      isScanned,
      needsOcr,
      ocrApplied: false,
      isEncrypted: false,
      isBlank,
      textOrigin: isScanned ? 'ocr' : 'native',
      workingText: extractedTextPreview,
      preprocessingStatus: needsOcr ? 'needs_ocr' : isBlank ? 'exception' : 'ready',
      exceptionReason: isBlank ? 'Documento PDF sin contenido legible o en blanco.' : undefined,
    }
  }

  if (ext === 'docx') {
    const { workingText, isEncrypted, isBlank } = await extractDocxWorkingText(file)

    if (isEncrypted) {
      return {
        sha256,
        sizeBytes,
        pageCount: 1,
        isScanned: false,
        needsOcr: false,
        ocrApplied: false,
        isEncrypted: true,
        isBlank: false,
        textOrigin: 'exception',
        workingText: '',
        preprocessingStatus: 'exception',
        exceptionReason: 'Documento Word cifrado o protegido por contraseña.',
      }
    }

    return {
      sha256,
      sizeBytes,
      pageCount: 1,
      isScanned: false,
      needsOcr: false,
      ocrApplied: false,
      isEncrypted: false,
      isBlank,
      textOrigin: 'native',
      workingText,
      preprocessingStatus: isBlank ? 'exception' : 'ready',
      exceptionReason: isBlank ? 'Documento Word sin texto detectable.' : undefined,
    }
  }

  // Imágenes (PNG, JPG)
  if (['png', 'jpg', 'jpeg'].includes(ext)) {
    return {
      sha256,
      sizeBytes,
      pageCount: 1,
      isScanned: true,
      needsOcr: true,
      ocrApplied: false,
      isEncrypted: false,
      isBlank: false,
      textOrigin: 'ocr',
      workingText: '',
      preprocessingStatus: 'needs_ocr',
    }
  }

  // Otros tipos (DOC antiguo o texto plano)
  return {
    sha256,
    sizeBytes,
    pageCount: 1,
    isScanned: false,
    needsOcr: false,
    ocrApplied: false,
    isEncrypted: false,
    isBlank: false,
    textOrigin: 'native',
    workingText: '',
    preprocessingStatus: 'ready',
  }
}
