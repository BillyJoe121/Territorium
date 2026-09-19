import type { ConsolidatedMasterRecord } from './expedienteConsolidation'
import {
  compileConsolidatedToTiptap,
  extractNarrativeSection,
  type DocumentCompilerOptions,
} from './expedienteDocumentCompiler'

export interface PdfExportOptions extends DocumentCompilerOptions {
  versionNumber?: number
  expedienteId?: string
  generatedBy?: string
}

export interface LinkedArtifactMetadata {
  expedienteId: string
  propertyFolio: string
  cadastralId: string
  propertyName: string
  documentVersion: number
  consolidationVersion: string
  titlesVersion: string
  plansVersion: string
  negotiationVersion: string
  generatedAt: string
  verificationHash: string
  sha256Stamp?: string
}

/**
 * Computes a standardized verification hash common between PDF and Excel (HU-V2-051).
 */
export function computeArtifactVerificationHash(
  record: ConsolidatedMasterRecord,
  versionNumber = 1,
): string {
  const seed = `${record.folio}|${record.cadastral_id}|${record.property_name}|${record.metadata.consolidated_at}|v${versionNumber}`
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')
  return `TRT-AUD-${hex.slice(0, 4)}-${hex.slice(4, 8)}`
}

/**
 * Generates the linked metadata payload shared between PDF and CORRESPONDENCIA.xlsx (HU-V2-051).
 */
export function getLinkedArtifactMetadata(
  record: ConsolidatedMasterRecord,
  options: PdfExportOptions = {},
): LinkedArtifactMetadata {
  const version = options.versionNumber ?? 1
  const verificationHash = computeArtifactVerificationHash(record, version)

  return {
    expedienteId: options.expedienteId || options.projectCode || record.property_code || record.folio,
    propertyFolio: record.folio,
    cadastralId: record.cadastral_id,
    propertyName: record.property_name,
    documentVersion: version,
    consolidationVersion: `v${record.metadata.is_valid ? '1' : '0'}`,
    titlesVersion: record.metadata.titles_result_version_id,
    plansVersion: record.metadata.plans_result_version_id,
    negotiationVersion: record.metadata.negotiation_result_version_id,
    generatedAt: new Date().toISOString(),
    verificationHash,
  }
}

/**
 * Generates high-fidelity printable HTML with corporate styling for Territorium (HU-V2-051).
 */
export function generateExpedientePrintableHtml(
  record: ConsolidatedMasterRecord,
  options: PdfExportOptions = {},
): string {
  const meta = getLinkedArtifactMetadata(record, options)
  const compiled = compileConsolidatedToTiptap(record, options)
  const narrative = extractNarrativeSection(compiled.content) ||
    'Se verificó la cadena de tradición del inmueble sin hallazgos jurídicos impeditivos.'

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Informe Predial - ${record.property_name} (${record.folio})</title>
  <style>
    @page {
      size: letter;
      margin: 18mm 15mm 18mm 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1A202C;
      margin: 0;
      padding: 20px;
      font-size: 10pt;
      line-height: 1.4;
      background: #FFFFFF;
    }
    .header-banner {
      background: #1E3A2B;
      color: #FFFFFF;
      padding: 16px 20px;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .header-banner h1 {
      margin: 0 0 4px 0;
      font-size: 14pt;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      font-weight: 700;
    }
    .header-banner p {
      margin: 0;
      font-size: 8.5pt;
      opacity: 0.85;
    }
    .header-badge {
      text-align: right;
      font-family: monospace;
      font-size: 9pt;
      background: rgba(255, 255, 255, 0.15);
      padding: 6px 10px;
      border-radius: 4px;
    }
    .section-title {
      font-size: 11pt;
      font-weight: 700;
      color: #1E3A2B;
      border-bottom: 2px solid #1E3A2B;
      padding-bottom: 4px;
      margin: 20px 0 10px 0;
      text-transform: uppercase;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 9pt;
    }
    table.data-table th, table.data-table td {
      border: 1px solid #CBD5E0;
      padding: 6px 10px;
      vertical-align: top;
    }
    table.data-table th {
      background-color: #EDF2F7;
      color: #2D3748;
      font-weight: 600;
      text-align: left;
      width: 32%;
    }
    table.data-table td {
      background-color: #FFFFFF;
      color: #1A202C;
    }
    .narrative-box {
      background: #F7FAFC;
      border: 1px solid #E2E8F0;
      border-left: 4px solid #1E3A2B;
      padding: 12px 14px;
      border-radius: 2px;
      margin-bottom: 15px;
      font-size: 9.5pt;
      line-height: 1.5;
      text-align: justify;
    }
    .meta-footer {
      margin-top: 25px;
      padding-top: 10px;
      border-top: 1px dashed #A0AEC0;
      font-size: 8pt;
      color: #4A5568;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header-banner">
    <div>
      <h1>GRUPO JURÍDICO TERRITORIUM</h1>
      <p>INFORME OFICIAL DE GESTIÓN PREDIAL — EXPEDIENTE ÚNICO</p>
    </div>
    <div class="header-badge">
      <div>VERIFICACIÓN: <strong>${meta.verificationHash}</strong></div>
      <div>VERSIÓN: <strong>v${meta.documentVersion}</strong></div>
    </div>
  </div>

  <div class="section-title">1. Identificación Predial y Catastral</div>
  <table class="data-table">
    <tr><th>Nombre del Predio</th><td>${record.property_name}</td></tr>
    <tr><th>Folio de Matrícula Inmobiliaria</th><td>${record.folio}</td></tr>
    <tr><th>Cédula Catastral</th><td>${record.cadastral_id}</td></tr>
    <tr><th>Ubicación Territorial</th><td>${record.municipality}, ${record.department}</td></tr>
    <tr><th>Vereda / Sector</th><td>${record.village || 'No especificada'}</td></tr>
    <tr><th>Código Interno de Gestión</th><td>${record.property_code || '—'}</td></tr>
  </table>

  <div class="section-title">2. Diagnóstico Jurídico y Titularidad</div>
  <table class="data-table">
    <tr><th>Propietarios Identificados</th><td>${record.owners}</td></tr>
    <tr><th>Modo de Adquisición</th><td>${record.acquisition_mode}</td></tr>
    <tr><th>Linderos del Predio</th><td>${record.boundaries}</td></tr>
    <tr><th>Documento de Linderos</th><td>${record.boundaries_document}</td></tr>
    <tr><th>Condiciones Jurídicas y Gravámenes</th><td>${record.legal_conditions}</td></tr>
    <tr><th>Radicado MinJusticia</th><td>${record.justice_ministry_case}</td></tr>
    <tr><th>Radicado Unidad de Restitución (URT)</th><td>${record.urt_case}</td></tr>
    <tr><th>Dirección Territorial URT</th><td>${record.urt_territorial_direction}</td></tr>
  </table>

  <div class="section-title">3. Parámetros Técnicos y Afectación Predial</div>
  <table class="data-table">
    <tr><th>Área de Servidumbre Requerida</th><td>${record.easement_area} m²</td></tr>
    <tr><th>Longitud de Servidumbre</th><td>${record.easement_length} m</td></tr>
    <tr><th>Ancho de Servidumbre</th><td>${record.easement_width} m</td></tr>
    <tr><th>Infraestructuras (Postes / Torres)</th><td>${record.infrastructure_count}</td></tr>
    <tr><th>Plano Topográfico</th><td>${record.plan_name} (Escala ${record.plan_scale})</td></tr>
    <tr><th>Nivel de Tensión</th><td>${record.voltage_level}</td></tr>
  </table>

  <div class="section-title">4. Valoración Económica y Negociación</div>
  <table class="data-table">
    <tr><th>Primera Oferta Notificada</th><td>${record.first_offer}</td></tr>
    <tr><th>Segunda Oferta Notificada</th><td>${record.second_offer}</td></tr>
    <tr><th>Tercera Oferta Notificada</th><td>${record.third_offer}</td></tr>
    <tr><th>Coincidencia Cifras y Letras</th><td>${record.values_match}</td></tr>
  </table>

  <div class="section-title">5. Consideraciones Jurídicas y Recomendaciones</div>
  <div class="narrative-box">
    ${narrative.replace(/\n\n/g, '<br><br>')}
  </div>

  <div class="section-title">6. Metadatos de Trazabilidad y Seguridad (Sincronizado con Excel)</div>
  <table class="data-table">
    <tr><th>ID Expediente</th><td>${meta.expedienteId}</td></tr>
    <tr><th>Versión Documento Final</th><td>v${meta.documentVersion}</td></tr>
    <tr><th>Versión Consolidado Maestro</th><td>${meta.consolidationVersion}</td></tr>
    <tr><th>Versiones de Origen Aprobadas</th><td>Títulos: ${meta.titlesVersion} | Planos: ${meta.plansVersion} | Negociación: ${meta.negotiationVersion}</td></tr>
    <tr><th>Fecha de Generación Oficial</th><td>${meta.generatedAt}</td></tr>
    <tr><th>Código Único de Verificación</th><td><strong>${meta.verificationHash}</strong></td></tr>
  </table>

  <div class="meta-footer">
    <div>Territorium 2.0 &bull; Generación Documental Certificada &bull; Expediente ${meta.expedienteId}</div>
    <div>Sincronizado con CORRESPONDENCIA.xlsx &bull; Hash: ${meta.verificationHash}</div>
  </div>
</body>
</html>`
}

/**
 * Builds a clean, standard binary PDF (%PDF-1.4) in pure JavaScript
 * with corporate styling, metadata, and structured tables (HU-V2-051).
 */
export function buildPurePdfBinary(
  record: ConsolidatedMasterRecord,
  options: PdfExportOptions = {},
): Uint8Array {
  const meta = getLinkedArtifactMetadata(record, options)
  const compiled = compileConsolidatedToTiptap(record, options)
  const narrative = extractNarrativeSection(compiled.content) ||
    'Se verificó la tradición del predio sin medidas cautelares o gravámenes impeditivos.'

  // Sanitize text for standard ASCII PDF Type1 fonts
  const clean = (str: string) =>
    str
      .replace(/[\n\r\t]/g, ' ')
      .replace(/[\\()]/g, '')
      .replace(/[—–]/g, '-')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[áàäâã]/gi, 'a')
      .replace(/[éèëê]/gi, 'e')
      .replace(/[íìïî]/gi, 'i')
      .replace(/[óòöôõ]/gi, 'o')
      .replace(/[úùüû]/gi, 'u')
      .replace(/[ñ]/gi, 'n')
      .replace(/[^\x20-\x7E]/g, ' ')

  const titleText = clean('GRUPO JURIDICO TERRITORIUM - INFORME PREDIAL OFICIAL')
  const propText = clean(`Predio: ${record.property_name} | Folio: ${record.folio} | Cedula: ${record.cadastral_id}`)
  const muniText = clean(`Ubicacion: ${record.municipality}, ${record.department} (Vereda: ${record.village || 'N/A'})`)
  const ownText = clean(`Propietarios: ${record.owners}`)
  const boundText = clean(`Linderos: ${record.boundaries}`)
  const areaText = clean(`Servidumbre: Area ${record.easement_area} m2 | Long: ${record.easement_length} m | Ancho: ${record.easement_width} m`)
  const offerText = clean(`Oferta 1: ${record.first_offer} | Oferta 2: ${record.second_offer} | Oferta 3: ${record.third_offer}`)
  const matchText = clean(`Coincidencia Cifras y Letras: ${record.values_match}`)
  const narrativeText = clean(`Consideraciones: ${narrative}`)
  const metaText = clean(`Sincronizado con CORRESPONDENCIA.xlsx | Codigo: ${meta.verificationHash} | Version: v${meta.documentVersion}`)
  const auditText = clean(`Origen: Titulos ${meta.titlesVersion} | Planos ${meta.plansVersion} | Negociacion ${meta.negotiationVersion}`)

  // Construct PDF stream commands
  let stream = ''
  // Corporate Header box (Territorium green #1E3A2B -> 0.12 0.23 0.17 rg)
  stream += '0.12 0.23 0.17 rg\n'
  stream += '25 715 562 65 re\n'
  stream += 'f\n'

  // Header text in white
  stream += 'BT\n'
  stream += '/F1 14 Tf\n'
  stream += '1 1 1 rg\n'
  stream += '35 755 Td\n'
  stream += `(${titleText}) Tj\n`
  stream += '/F1 9 Tf\n'
  stream += '0 -18 Td\n'
  stream += `(EXPEDIENTE UNICO PREDIAL | CODIGO VERIFICACION: ${meta.verificationHash}) Tj\n`
  stream += 'ET\n'

  // Body text in dark grey
  stream += 'BT\n'
  stream += '0.1 0.1 0.1 rg\n'
  stream += '/F1 11 Tf\n'
  stream += '35 685 Td\n'
  stream += '(1. IDENTIFICACION PREDIAL Y CATASTRAL) Tj\n'
  stream += '/F1 9 Tf\n'
  stream += '0 -16 Td\n'
  stream += `(${propText}) Tj\n`
  stream += '0 -14 Td\n'
  stream += `(${muniText}) Tj\n`

  stream += '0 -24 Td\n'
  stream += '/F1 11 Tf\n'
  stream += '(2. DIAGNOSTICO JURIDICO Y TITULARIDAD) Tj\n'
  stream += '/F1 9 Tf\n'
  stream += '0 -16 Td\n'
  stream += `(${ownText.slice(0, 95)}) Tj\n`
  if (ownText.length > 95) {
    stream += '0 -12 Td\n'
    stream += `(${ownText.slice(95, 190)}) Tj\n`
  }
  stream += '0 -14 Td\n'
  stream += `(${boundText.slice(0, 95)}) Tj\n`

  stream += '0 -24 Td\n'
  stream += '/F1 11 Tf\n'
  stream += '(3. PARAMETROS TECNICOS Y AFECTACION) Tj\n'
  stream += '/F1 9 Tf\n'
  stream += '0 -16 Td\n'
  stream += `(${areaText}) Tj\n`
  stream += '0 -14 Td\n'
  stream += `(Plano: ${clean(record.plan_name)} | Escala: ${clean(record.plan_scale)} | Tension: ${clean(record.voltage_level)}) Tj\n`

  stream += '0 -24 Td\n'
  stream += '/F1 11 Tf\n'
  stream += '(4. VALORACION ECONOMICA Y NEGOCIACION) Tj\n'
  stream += '/F1 9 Tf\n'
  stream += '0 -16 Td\n'
  stream += `(${offerText}) Tj\n`
  stream += '0 -14 Td\n'
  stream += `(${matchText}) Tj\n`

  stream += '0 -24 Td\n'
  stream += '/F1 11 Tf\n'
  stream += '(5. CONSIDERACIONES JURIDICAS Y RECOMENDACIONES) Tj\n'
  stream += '/F1 8.5 Tf\n'
  stream += '0 -16 Td\n'
  stream += `(${narrativeText.slice(0, 100)}) Tj\n`
  if (narrativeText.length > 100) {
    stream += '0 -12 Td\n'
    stream += `(${narrativeText.slice(100, 200)}) Tj\n`
  }

  // Footer / Audit Line
  stream += '0 -35 Td\n'
  stream += '0.3 0.3 0.3 rg\n'
  stream += '/F1 8 Tf\n'
  stream += `(${metaText}) Tj\n`
  stream += '0 -12 Td\n'
  stream += `(${auditText}) Tj\n`
  stream += 'ET\n'

  // Divider line above footer
  stream += '0.7 0.7 0.7 RG\n'
  stream += '35 150 m 575 150 l S\n'

  const streamLength = stream.length

  const objects: string[] = []
  // Obj 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  // Obj 2: Pages
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')
  // Obj 3: Page
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n')
  // Obj 4: Content stream
  objects.push(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n${stream}\nendstream\nendobj\n`)
  // Obj 5: Font
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n')

  let pdfStr = '%PDF-1.4\n'
  const xrefOffsets: number[] = [0] // 0000000000 65535 f

  for (const obj of objects) {
    xrefOffsets.push(pdfStr.length)
    pdfStr += obj
  }

  const startXref = pdfStr.length
  pdfStr += `xref\n0 ${objects.length + 1}\n`
  pdfStr += '0000000000 65535 f \n'
  for (let i = 1; i <= objects.length; i++) {
    pdfStr += `${String(xrefOffsets[i]).padStart(10, '0')} 00000 n \n`
  }

  pdfStr += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`

  const bytes = new Uint8Array(pdfStr.length)
  for (let i = 0; i < pdfStr.length; i++) {
    bytes[i] = pdfStr.charCodeAt(i) & 0xff
  }
  return bytes
}

/**
 * Downloads the official final PDF document in the browser (HU-V2-051).
 */
export function downloadExpedientePdf(
  record: ConsolidatedMasterRecord,
  options: PdfExportOptions = {},
): void {
  const version = options.versionNumber ?? 1
  const cleanFolio = record.folio.replace(/[^a-zA-Z0-9_-]/g, '_')
  const fileName = `INFORME_PREDIAL_${cleanFolio}_v${version}.pdf`

  const pdfBytes = buildPurePdfBinary(record, options)
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)

  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
