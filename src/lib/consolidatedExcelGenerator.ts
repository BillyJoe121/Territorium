import writeXlsxFile, { type Cell } from 'write-excel-file/browser'
import type { ConsolidatedMasterRecord } from './expedienteConsolidation'
import { CORRESPONDENCIA_COLUMNS, parseDecimal } from './correspondencia'

function safeCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return /^[=+\-@]/.test(text) ? `'${text}` : text
}

const headerCell = (value: string): Cell => ({
  value,
  fontWeight: 'bold',
  textColor: '#FFFFFF',
  backgroundColor: '#1E3A2B',
  wrap: true,
  alignVertical: 'center',
})

const textCell = (value: unknown): Cell => ({
  value: safeCell(value),
  wrap: true,
  alignVertical: 'top',
})

const metaHeaderCell = (value: string): Cell => ({
  value,
  fontWeight: 'bold',
  textColor: '#FFFFFF',
  backgroundColor: '#333333',
  wrap: true,
})

export interface ConsolidatedExcelOptions {
  projectId: string
  projectName: string
  versionNumber: number
  filename?: string
}

export const CONSOLIDATED_EXCEL_HEADERS = [
  'CARPETA / ID PREDIO',
  'FOLIO DE MATRÍCULA',
  'CÉDULA CATASTRAL',
  'PROPIETARIOS DEL PREDIO',
  'NOMBRE DEL PREDIO',
  'MUNICIPIO DEL PREDIO',
  'DEPARTAMENTO DEL PREDIO',
  'VEREDA DEL PREDIO',
  'MODO DE ADQUISICIÓN',
  'LINDEROS DEL PREDIO (LITERAL)',
  'DOCUMENTO FUENTE DE LINDEROS',
  'CONDICIONES JURÍDICAS VIGENTES',
  'RADICADO MINJUSTICIA',
  'RADICADO URT',
  'DIRECCIÓN TERRITORIAL URT',
  'ÁREA SERVIDUMBRE (m²)',
  'LONGITUD SERVIDUMBRE (m)',
  'ANCHO SERVIDUMBRE (m)',
  'CANTIDAD DE POSTES / APOYOS',
  'NOMBRE DEL PLANO',
  'ESCALA DEL PLANO',
  'NIVEL DE TENSIÓN',
  'VALOR OFERTA NO. 1',
  'VALOR OFERTA NO. 2',
  'VALOR OFERTA NO. 3',
  'COINCIDENCIA NÚMEROS Y LETRAS',
]

export async function generateConsolidatedExcelData(
  record: ConsolidatedMasterRecord,
  options: ConsolidatedExcelOptions,
): Promise<{ sheets: any[] }> {
  // Sheet 1: Consolidado Predial
  const headerRow: Cell[] = CONSOLIDATED_EXCEL_HEADERS.map(headerCell)

  const dataRow: Cell[] = [
    textCell(record.property_code || record.folio),
    textCell(record.folio),
    textCell(record.cadastral_id),
    textCell(record.owners),
    textCell(record.property_name),
    textCell(record.municipality),
    textCell(record.department),
    textCell(record.village),
    textCell(record.acquisition_mode),
    textCell(record.boundaries),
    textCell(record.boundaries_document),
    textCell(record.legal_conditions),
    textCell(record.justice_ministry_case),
    textCell(record.urt_case),
    textCell(record.urt_territorial_direction),
    textCell(record.easement_area),
    textCell(record.easement_length),
    textCell(record.easement_width),
    textCell(record.infrastructure_count),
    textCell(record.plan_name),
    textCell(record.plan_scale),
    textCell(record.voltage_level),
    textCell(record.first_offer),
    textCell(record.second_offer),
    textCell(record.third_offer),
    textCell(record.values_match),
  ]

  const sheet1Data = [headerRow, dataRow]

  // Sheet 2: Metadatos y Auditoría
  const metaHeaderRow: Cell[] = [metaHeaderCell('Parámetro / Metadato'), metaHeaderCell('Valor Registrado')]

  const metaRows: Cell[][] = [
    metaHeaderRow,
    [textCell('Proyecto'), textCell(options.projectName)],
    [textCell('ID Expediente'), textCell(options.projectId)],
    [textCell('Versión Consolidada'), textCell(`v${options.versionNumber}`)],
    [textCell('Estado de Aprobación'), textCell('APROBADO')],
    [textCell('Fecha de Consolidación'), textCell(record.metadata.consolidated_at || new Date().toISOString())],
    [textCell('Versión Aprobada Títulos'), textCell(record.metadata.titles_result_version_id || '—')],
    [textCell('Versión Aprobada Planos'), textCell(record.metadata.plans_result_version_id || '—')],
    [textCell('Versión Aprobada Negociación'), textCell(record.metadata.negotiation_result_version_id || '—')],
    [textCell('Sistema Generador'), textCell('Territorium 2.0 (Fase 5)')],
  ]

  return {
    sheets: [
      {
        data: sheet1Data,
        sheet: 'Consolidado Predial',
        stickyRowsCount: 1,
        columns: CONSOLIDATED_EXCEL_HEADERS.map(() => ({ width: 25 })),
      },
      {
        data: metaRows,
        sheet: 'Metadatos y Auditoría',
        stickyRowsCount: 1,
        columns: [{ width: 30 }, { width: 40 }],
      },
    ],
  }
}

export async function downloadConsolidatedExcel(
  record: ConsolidatedMasterRecord,
  options: ConsolidatedExcelOptions,
): Promise<void> {
  const { sheets } = await generateConsolidatedExcelData(record, options)
  const defaultFilename = `Consolidado_${record.property_name || record.folio}_v${options.versionNumber}.xlsx`
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-\.]/g, '')

  const filename = options.filename || defaultFilename
  await (writeXlsxFile(sheets as any) as any).toFile(filename)
}

/**
 * CORRESPONDENCIA.xlsx: misma hoja ("Hoja1"), mismos 71 encabezados en el mismo orden
 * (A–BS) y una fila por predio. Las cifras se exportan como números, igual que la plantilla.
 */
export function generateCorrespondenciaSheet(rows: Record<string, string>[]): { data: Cell[][]; columns: { width: number }[] } {
  const header: Cell[] = CORRESPONDENCIA_COLUMNS.map((column) => ({
    value: column.header,
    fontWeight: 'bold',
    wrap: true,
    alignVertical: 'center',
  }))
  const body: Cell[][] = rows.map((row) =>
    CORRESPONDENCIA_COLUMNS.map((column) => {
      const raw = row[column.letter] ?? ''
      const numeric = column.numeric ? parseDecimal(raw) : null
      if (numeric !== null && String(raw).trim() !== '') return { value: numeric, type: Number, alignVertical: 'top' } as Cell
      return raw === '' ? null : { value: safeCell(raw), wrap: true, alignVertical: 'top' }
    }),
  )
  return { data: [header, ...body], columns: CORRESPONDENCIA_COLUMNS.map((c) => ({ width: ['P', 'Q', 'S'].includes(c.letter) ? 60 : 24 })) }
}

export async function downloadCorrespondenciaExcel(rows: Record<string, string>[], filename = 'CORRESPONDENCIA.xlsx'): Promise<void> {
  const { data, columns } = generateCorrespondenciaSheet(rows)
  await (writeXlsxFile([{ data, sheet: 'Hoja1', columns, stickyRowsCount: 1 }] as any) as any).toFile(filename)
}
