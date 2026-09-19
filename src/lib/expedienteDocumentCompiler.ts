import type { JSONContent } from '@tiptap/react'
import type { ConsolidatedMasterRecord } from './expedienteConsolidation'
import {
  OFFICIAL_PREDIAL_TEMPLATE_V1,
  type ExpedienteDocumentTemplate,
} from './expedienteDocumentTemplates'

export interface DocumentCompilationMetadata {
  templateId: string
  templateVersion: number
  consolidatedAt: string
  titlesVersionId: string
  plansVersionId: string
  negotiationVersionId: string
  compiledAt: string
  compiledBy?: string
  folio: string
  cadastralId: string
  verificationHash: string
}

export interface DocumentCompilationResult {
  content: JSONContent
  metadata: DocumentCompilationMetadata
  warnings: string[]
}

export interface DocumentCompilerOptions {
  projectName?: string
  projectCode?: string
  compiledBy?: string
  narrativeOverride?: string
  template?: ExpedienteDocumentTemplate
}

/**
 * Creates a standard paragraph node for Tiptap JSONContent.
 */
function createParagraph(text: string, boldPrefix?: string): JSONContent {
  const content: JSONContent[] = []
  if (boldPrefix) {
    content.push({
      type: 'text',
      marks: [{ type: 'bold' }],
      text: boldPrefix,
    })
  }
  if (text) {
    content.push({
      type: 'text',
      text,
    })
  }
  return {
    type: 'paragraph',
    content: content.length > 0 ? content : undefined,
  }
}

/**
 * Creates a heading node (H1, H2, H3).
 */
function createHeading(level: 1 | 2 | 3, text: string): JSONContent {
  return {
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  }
}

/**
 * Creates a 2-column key-value table node.
 */
function createKeyValueTable(rows: [string, string][]): JSONContent {
  const tableRows: JSONContent[] = rows.map(([key, val]) => ({
    type: 'tableRow',
    content: [
      {
        type: 'tableHeader',
        attrs: { colspan: 1, rowspan: 1, colwidth: [220] },
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', marks: [{ type: 'bold' }], text: key }],
          },
        ],
      },
      {
        type: 'tableCell',
        attrs: { colspan: 1, rowspan: 1, colwidth: [460] },
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: val || '—' }],
          },
        ],
      },
    ],
  }))

  return {
    type: 'table',
    content: tableRows,
  }
}

/**
 * Deterministic generation of verification hash based on immutable properties.
 */
function computeDeterministicVerificationCode(record: ConsolidatedMasterRecord, version: number): string {
  const seed = `${record.folio}|${record.cadastral_id}|${record.property_name}|${record.metadata.consolidated_at}|v${version}`
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32bit integer
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')
  return `TRT-DOC-${hex.slice(0, 4)}-${hex.slice(4, 8)}`
}

/**
 * Deterministically compiles an approved ConsolidatedMasterRecord into
 * structured Tiptap JSONContent (HU-V2-048).
 *
 * Rules:
 * - Structured fields (Folio, Cédula, Propietarios, Linderos, Ofertas, Áreas) are injected
 *   verbatim without AI hallucinations.
 * - Missing values are highlighted with warning indicators.
 * - Only narrative sections are designated as AI-refinable.
 */
export function compileConsolidatedToTiptap(
  record: ConsolidatedMasterRecord,
  options: DocumentCompilerOptions = {},
): DocumentCompilationResult {
  const template = options.template ?? OFFICIAL_PREDIAL_TEMPLATE_V1
  const warnings: string[] = []

  // Check required fields
  for (const field of template.requiredFields) {
    const val = record[field]
    if (!val || val === '—' || String(val).trim() === '') {
      warnings.push(`Campo requerido '${String(field)}' no cuenta con información en el consolidado.`)
    }
  }

  const verificationCode = computeDeterministicVerificationCode(record, template.version)
  const compiledAt = new Date().toISOString()

  const narrativeText =
    options.narrativeOverride ??
    template.sections.find((s) => s.type === 'narrative_observations')?.defaultNarrative ??
    'Se verificó la cadena de tradición del predio sin hallazgos impeditivos para el saneamiento.'

  const docNodes: JSONContent[] = [
    // Header
    createHeading(1, template.name.toUpperCase()),
    createParagraph(
      `Expediente Predial Oficial — Territorium Grupo Jurídico | Generación Determinística (Plantilla ${template.code} v${template.version})`,
    ),

    // 1. Identificación Predial
    createHeading(2, '1. Identificación Predial y Catastral'),
    createKeyValueTable([
      ['Nombre del Predio', record.property_name],
      ['Folio de Matrícula Inmobiliaria', record.folio],
      ['Cédula Catastral', record.cadastral_id],
      ['Ubicación Territorial', `${record.municipality}, ${record.department}`],
      ['Vereda / Sector', record.village || 'No especificada'],
      ['Código Interno de Gestión', record.property_code || '—'],
    ]),

    // 2. Diagnóstico Jurídico y Titularidad
    createHeading(2, '2. Diagnóstico Jurídico y Titularidad'),
    createKeyValueTable([
      ['Propietarios Identificados', record.owners],
      ['Modo de Adquisición', record.acquisition_mode],
      ['Linderos Registrados', record.boundaries],
      ['Documento de Linderos', record.boundaries_document],
      ['Condiciones Jurídicas y Gravámenes', record.legal_conditions],
      ['Radicado Ministerio de Justicia', record.justice_ministry_case],
      ['Radicado Unidad de Restitución de Tierras (URT)', record.urt_case],
      ['Dirección Territorial URT', record.urt_territorial_direction],
    ]),

    // 3. Parámetros Técnicos y Afectación
    createHeading(2, '3. Parámetros Técnicos y Franja de Servidumbre'),
    createKeyValueTable([
      ['Área de Servidumbre Requerida', `${record.easement_area} m²`],
      ['Longitud de Servidumbre', `${record.easement_length} m`],
      ['Ancho de Servidumbre', `${record.easement_width} m`],
      ['Infraestructuras Afectadas (Postes / Torres)', record.infrastructure_count],
      ['Plano Topográfico Referenciado', record.plan_name],
      ['Escala del Plano', record.plan_scale],
      ['Nivel de Tensión / Servidumbre', record.voltage_level],
    ]),

    // 4. Valoración Económica y Negociación
    createHeading(2, '4. Valoración Económica y Negociación Directa'),
    createKeyValueTable([
      ['Primera Oferta Formal Notificada', record.first_offer],
      ['Segunda Oferta Formal', record.second_offer],
      ['Tercera Oferta Formal', record.third_offer],
      ['Coincidencia de Valores Números/Letras', record.values_match],
    ]),

    // 5. Consideraciones Jurídicas (Sección Narrativa para IA / usuario)
    createHeading(2, '5. Consideraciones Jurídicas y Recomendaciones'),
    createParagraph(narrativeText),

    // 6. Trazabilidad y Firmas
    createHeading(2, '6. Constancia y Trazabilidad de Aprobación'),
    createKeyValueTable([
      ['Código Único de Verificación', verificationCode],
      ['Plantilla Utilizada', `${template.name} (${template.code} v${template.version})`],
      ['Versión Consolidado Maestro', `Consolidado v${record.metadata.is_valid ? '1' : '0'}`],
      ['Fecha y Hora de Consolidación', record.metadata.consolidated_at],
      ['Versiones de Origen Aprobadas', `Títulos: ${record.metadata.titles_result_version_id} | Planos: ${record.metadata.plans_result_version_id} | Negociación: ${record.metadata.negotiation_result_version_id}`],
      ['Fecha de Compilación Documental', compiledAt],
    ]),
  ]

  const content: JSONContent = {
    type: 'doc',
    content: docNodes,
  }

  const metadata: DocumentCompilationMetadata = {
    templateId: template.id,
    templateVersion: template.version,
    consolidatedAt: record.metadata.consolidated_at,
    titlesVersionId: record.metadata.titles_result_version_id,
    plansVersionId: record.metadata.plans_result_version_id,
    negotiationVersionId: record.metadata.negotiation_result_version_id,
    compiledAt,
    compiledBy: options.compiledBy,
    folio: record.folio,
    cadastralId: record.cadastral_id,
    verificationHash: verificationCode,
  }

  return {
    content,
    metadata,
    warnings,
  }
}

/**
 * Extracts the narrative section (Section 5) text from a compiled Tiptap JSONContent.
 */
export function extractNarrativeSection(content: JSONContent): string {
  if (!content.content || !Array.isArray(content.content)) return ''

  let foundHeading = false
  const narrativeParagraphs: string[] = []

  for (const node of content.content) {
    if (node.type === 'heading' && node.attrs?.level === 2) {
      const headingText = node.content?.map((c) => c.text || '').join('') || ''
      if (headingText.includes('Consideraciones Jurídicas') || headingText.includes('Recomendaciones')) {
        foundHeading = true
        continue
      } else if (foundHeading) {
        // Next heading reached, narrative section ended
        break
      }
    }

    if (foundHeading && node.type === 'paragraph') {
      const paraText = node.content?.map((c) => c.text || '').join('') || ''
      if (paraText.trim()) {
        narrativeParagraphs.push(paraText.trim())
      }
    }
  }

  return narrativeParagraphs.join('\n\n')
}

/**
 * Safely replaces only the narrative section in the Tiptap document,
 * keeping all structured tables (identificación, técnica, económica, trazabilidad) strictly intact.
 */
export function injectNarrativeSection(content: JSONContent, newNarrative: string): JSONContent {
  if (!content.content || !Array.isArray(content.content)) return content

  const newDocNodes: JSONContent[] = []
  let insideNarrative = false
  let narrativeInjected = false

  for (const node of content.content) {
    if (node.type === 'heading' && node.attrs?.level === 2) {
      const headingText = node.content?.map((c) => c.text || '').join('') || ''
      if (headingText.includes('Consideraciones Jurídicas') || headingText.includes('Recomendaciones')) {
        insideNarrative = true
        newDocNodes.push(node)
        // Inject new narrative paragraphs
        const paragraphs = newNarrative.split('\n\n').filter((p) => p.trim())
        for (const p of paragraphs) {
          newDocNodes.push(createParagraph(p.trim()))
        }
        narrativeInjected = true
        continue
      } else if (insideNarrative) {
        insideNarrative = false
        newDocNodes.push(node)
        continue
      }
    }

    if (insideNarrative) {
      // Skip old narrative nodes
      continue
    }

    newDocNodes.push(node)
  }

  // Fallback if heading wasn't found
  if (!narrativeInjected) {
    newDocNodes.push(createHeading(2, '5. Consideraciones Jurídicas y Recomendaciones'))
    newDocNodes.push(createParagraph(newNarrative))
  }

  return {
    ...content,
    content: newDocNodes,
  }
}

/**
 * Extracts key-value mappings from all structured tables in the document.
 * Used by the AI revision guard to guarantee no protected field is altered.
 */
export function extractStructuredFieldsFromDocument(content: JSONContent): Record<string, string> {
  const fields: Record<string, string> = {}
  if (!content.content || !Array.isArray(content.content)) return fields

  for (const node of content.content) {
    if (node.type === 'table' && Array.isArray(node.content)) {
      for (const row of node.content) {
        if (row.type === 'tableRow' && Array.isArray(row.content) && row.content.length >= 2) {
          const keyCell = row.content[0]
          const valCell = row.content[1]

          const keyText = keyCell.content?.flatMap((p: any) => p.content?.map((c: any) => c.text || '') || []).join('').trim() || ''
          const valText = valCell.content?.flatMap((p: any) => p.content?.map((c: any) => c.text || '') || []).join('').trim() || ''

          if (keyText) {
            fields[keyText] = valText
          }
        }
      }
    }
  }

  return fields
}
