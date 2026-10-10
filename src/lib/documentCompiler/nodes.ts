/** Piezas de Tiptap (párrafos, títulos, tablas) y normalización del registro consolidado. */
import type { JSONContent } from '@tiptap/react'
import type { ConsolidatedMasterRecord } from '../expedienteConsolidation'

/**
 * Creates a standard paragraph node for Tiptap JSONContent.
 */
export function createParagraph(text: string, boldPrefix?: string): JSONContent {
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
export function createHeading(level: 1 | 2 | 3, text: string): JSONContent {
  return {
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  }
}

/**
 * Creates a 2-column key-value table node.
 */
export function createKeyValueTable(rows: [string, string][]): JSONContent {
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
export function computeDeterministicVerificationCode(record: ConsolidatedMasterRecord, version: number): string {
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
 * Creates a multi-column table node for Tiptap JSONContent.
 */
export function createMultiColumnTable(
  headers: string[],
  rows: (string | number)[][],
  colWidths?: number[],
): JSONContent {
  const defaultWidth = Math.max(90, Math.floor(680 / Math.max(1, headers.length)))
  const headerRow: JSONContent = {
    type: 'tableRow',
    content: headers.map((h, i) => ({
      type: 'tableHeader',
      attrs: { colspan: 1, rowspan: 1, colwidth: [colWidths?.[i] ?? defaultWidth] },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', marks: [{ type: 'bold' }], text: h }],
        },
      ],
    })),
  }

  const dataRows: JSONContent[] = rows.map((r) => ({
    type: 'tableRow',
    content: r.map((cell, i) => ({
      type: 'tableCell',
      attrs: { colspan: 1, rowspan: 1, colwidth: [colWidths?.[i] ?? defaultWidth] },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: String(cell ?? '—') }],
        },
      ],
    })),
  }))

  return {
    type: 'table',
    content: [headerRow, ...dataRows],
  }
}

export function normalizeConsolidatedRecord(raw: any): Record<string, string> {
  const p = raw?.predio || {}
  const a = raw?.adquisicion || {}
  const s = raw?.afectacionServidumbre || {}
  const n = raw?.negociacion || {}
  const c = raw?.condicionesJuridicas || {}
  const ownersList = Array.isArray(raw?.propietarios)
    ? raw.propietarios
        .map((o: any) => `${o.nombre || ''} (${o.tipoDocumento || 'CC'} ${o.numeroDocumento || ''})`.trim())
        .join(', ')
    : ''

  const safeStr = (val: any, fallback = '—') => (val != null && String(val).trim() !== '' ? String(val) : fallback)
  const negotiated = (val: any) => (val != null && !['', '—'].includes(String(val).trim()) ? String(val).trim() : '')

  return {
    property_name: safeStr(raw?.property_name || p.nombre, 'PREDIO SIN NOMBRE'),
    cadastral_id: safeStr(raw?.cadastral_id || p.cedulaCatastral),
    folio: safeStr(raw?.folio || p.matriculaInmobiliaria),
    municipality: safeStr(raw?.municipality || p.municipio, 'Ibagué'),
    department: safeStr(raw?.department || p.departamento, 'Tolima'),
    village: safeStr(raw?.village || p.vereda, 'Centro'),
    owners: safeStr(raw?.owners || ownersList, 'PROPIETARIO REGISTRAL'),
    area_numbers: safeStr(raw?.area_numbers || p.areaTotal),
    area_letters: safeStr(raw?.area_letters, ''),
    registry_office: safeStr(raw?.registry_office || a.notaria, 'Oficina de Registro de Instrumentos Públicos'),
    acquisition_mode: safeStr(raw?.acquisition_mode || a.modo, 'Compraventa'),
    boundaries: safeStr(raw?.boundaries || raw?.linderosRegistrales),
    boundaries_document: safeStr(raw?.boundaries_document || a.escrituraNumero),
    legal_conditions: safeStr(raw?.legal_conditions || c.embargos, 'Ninguno registrado'),
    justice_ministry_case: safeStr(raw?.justice_ministry_case),
    urt_case: safeStr(raw?.urt_case || c.procesosRestitucion, 'Sin antecedentes'),
    urt_territorial_direction: safeStr(raw?.urt_territorial_direction || raw?.department || p.departamento),

    easement_area: safeStr(raw?.easement_area || s.areaFranja),
    easement_area_letters: safeStr(raw?.easement_area_letters, ''),
    easement_length: safeStr(raw?.easement_length || s.longitud),
    easement_length_letters: safeStr(raw?.easement_length_letters, ''),
    easement_width: safeStr(raw?.easement_width || s.ancho),
    easement_width_letters: safeStr(raw?.easement_width_letters, ''),
    infrastructure_count: safeStr(raw?.infrastructure_count || s.torresPostes, '0'),
    infrastructure_count_letters: safeStr(raw?.infrastructure_count_letters, ''),
    plan_name: safeStr(raw?.plan_name || s.nombrePlano),
    plan_scale: safeStr(raw?.plan_scale || s.escala, '1:1000'),
    voltage_level: safeStr(raw?.voltage_level || s.tipoProyecto, '230 kV'),

    property_code: safeStr(raw?.property_code || p.nombre),
    // El valor negociado (verificado números ↔ letras) prevalece sobre la primera oferta.
    // Las plantillas anteponen "$ ", así que el valor se guarda sin el signo.
    first_offer: safeStr(negotiated(raw?.negotiated_value) || raw?.first_offer || n.valorIndemnizacion, '0').replace(/^\$\s*/, ''),
    first_offer_letters: safeStr(negotiated(raw?.negotiated_value_letters).toUpperCase() || raw?.first_offer_letters || n.valorLetras, ''),
  }
}
