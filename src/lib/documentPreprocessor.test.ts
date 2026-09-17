import { describe, expect, it } from 'vitest'
import {
  analyzePdfBuffer,
  extractDocxWorkingText,
  preProcessDocument,
} from './documentPreprocessor'
import JSZip from 'jszip'

describe('Detección de PDF escaneado vs texto nativo y metadatos (US-036, US-037)', () => {
  it('detecta texto nativo seleccionable y conteo de páginas en PDF digital', () => {
    // PDF simulado con operadores de texto BT/ET, Font y cadena de texto
    const fakePdfText = `
      %PDF-1.4
      1 0 obj
      << /Type /Pages /Count 3 >>
      endobj
      2 0 obj
      << /Font << /F1 3 0 R >> >>
      stream
      BT
      /F1 12 Tf
      (Predio San Carlos Folio 190-12345 con linderos al norte) Tj
      (Segunda linea de texto con descripcion juridica) Tj
      ET
      endstream
      endobj
    `
    const encoder = new TextEncoder()
    const buffer = encoder.encode(fakePdfText).buffer

    const result = analyzePdfBuffer(buffer)
    expect(result.isEncrypted).toBe(false)
    expect(result.pageCount).toBe(3)
    expect(result.isScanned).toBe(false)
    expect(result.needsOcr).toBe(false)
    expect(result.hasSelectableText).toBe(true)
    expect(result.extractedTextPreview).toContain('Predio San Carlos')
  })

  it('detecta PDF escaneado (puras imágenes XObject sin operadores de texto) y señala necesidad de OCR (US-037)', () => {
    const fakeScannedPdf = `
      %PDF-1.4
      1 0 obj
      << /Type /Pages /Count 2 >>
      endobj
      2 0 obj
      << /Subtype /Image /Width 1200 /Height 1800 /ColorSpace /DeviceRGB >>
      stream
      ...binary image data...
      endstream
      endobj
    `
    const encoder = new TextEncoder()
    const buffer = encoder.encode(fakeScannedPdf).buffer

    const result = analyzePdfBuffer(buffer)
    expect(result.isEncrypted).toBe(false)
    expect(result.pageCount).toBe(2)
    expect(result.isScanned).toBe(true)
    expect(result.needsOcr).toBe(true)
    expect(result.hasSelectableText).toBe(false)
  })

  it('detecta PDF protegido con contraseña / encriptado (US-040)', () => {
    const encryptedPdf = `
      %PDF-1.4
      1 0 obj
      << /Type /Catalog /Pages 2 0 R /Encrypt 3 0 R >>
      endobj
      3 0 obj
      << /Filter /Standard /V 4 /R 4 /O <abcdef> /U <123456> >>
      endobj
    `
    const encoder = new TextEncoder()
    const buffer = encoder.encode(encryptedPdf).buffer

    const result = analyzePdfBuffer(buffer)
    expect(result.isEncrypted).toBe(true)
    expect(result.needsOcr).toBe(false)
  })
})

describe('Representación de trabajo para Word DOCX sin alterar el archivo original (US-039)', () => {
  it('extrae el texto de word/document.xml limpiamente', async () => {
    const zip = new JSZip()
    const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>Estudio de títulos predio La Esperanza.</w:t></w:r></w:p>
          <w:p><w:r><w:t>Área de servidumbre: 2.5 hectáreas.</w:t></w:r></w:p>
        </w:body>
      </w:document>`
    zip.file('word/document.xml', sampleXml)
    const blob = await zip.generateAsync({ type: 'blob' })
    const file = new File([blob], 'Estudio_Titulos.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    const result = await extractDocxWorkingText(file)
    expect(result.isEncrypted).toBe(false)
    expect(result.isBlank).toBe(false)
    expect(result.workingText).toContain('Estudio de títulos predio La Esperanza')
    expect(result.workingText).toContain('Área de servidumbre: 2.5 hectáreas')
  })

  it('detecta paquete Word cifrado o protegido por contraseña (US-040)', async () => {
    const zip = new JSZip()
    zip.file('EncryptedPackage', new Uint8Array([1, 2, 3]))
    const blob = await zip.generateAsync({ type: 'blob' })
    const file = new File([blob], 'Documento_Protegido.docx')

    const result = await extractDocxWorkingText(file)
    expect(result.isEncrypted).toBe(true)
    expect(result.workingText).toBe('')
  })
})

describe('Trazabilidad de origen y ruteo a excepción (US-038, US-040)', () => {
  it('asigna textOrigin "ocr" a documentos escaneados o imágenes', async () => {
    const imgFile = new File(['fake-png-bytes'], 'Plano_Predial.png', { type: 'image/png' })
    const analysis = await preProcessDocument(imgFile)

    expect(analysis.isScanned).toBe(true)
    expect(analysis.needsOcr).toBe(true)
    expect(analysis.textOrigin).toBe('ocr')
    expect(analysis.preprocessingStatus).toBe('needs_ocr')
  })

  it('marca archivo vacío como corrupto/excepción (US-040)', async () => {
    const emptyFile = new File([], 'vacio.pdf', { type: 'application/pdf' })
    const analysis = await preProcessDocument(emptyFile)

    expect(analysis.preprocessingStatus).toBe('corrupt')
    expect(analysis.textOrigin).toBe('exception')
    expect(analysis.exceptionReason).toContain('0 bytes')
  })
})
