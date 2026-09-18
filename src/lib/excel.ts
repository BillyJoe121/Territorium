import writeXlsxFile, { type Cell } from 'write-excel-file/browser'
import type { PropertyMasterRecord } from './masterRecordReconciliation'
import type { PropertyRecord } from '../types'

function safeCell(value: unknown) {
  const text = value == null ? '' : String(value)
  return /^[=+\-@]/.test(text) ? `'${text}` : text
}

const headerCell = (value: string): Cell => ({
  value,
  fontWeight: 'bold',
  textColor: '#FFFFFF',
  backgroundColor: '#1E3A2B', // Territorium Brand Forest Green
  wrap: true,
  alignVertical: 'center',
})

const subHeaderCell = (value: string): Cell => ({
  value,
  fontWeight: 'bold',
  textColor: '#1E3A2B',
  backgroundColor: '#E8EFE9',
  wrap: true,
})

const textCell = (value: unknown): Cell => ({
  value: safeCell(value),
  wrap: true,
  alignVertical: 'top',
})

export interface ExportOptions {
  batchId?: string
  batchVersion?: number
  projectName?: string
  userEmail?: string
  inclusionCriteria?: 'all' | 'only_approved' | 'exceptions_only'
  allowBlockedExport?: boolean
  filename?: string
}

/**
 * Encabezados oficiales equivalentes a CORRESPONDENCIA.xlsx para entrega predial y jurídica
 */
export const CORRESPONDENCIA_COLUMNS = [
  { key: 'codigo_predial', label: 'CÓDIGO PREDIAL' },
  { key: 'nombre_predio', label: 'NOMBRE DEL PREDIO' },
  { key: 'folio_matricula', label: 'MATRÍCULA INMOBILIARIA' },
  { key: 'cedula_catastral', label: 'CÉDULA CATASTRAL' },
  { key: 'municipio', label: 'MUNICIPIO' },
  { key: 'departamento', label: 'DEPARTAMENTO' },
  { key: 'orip', label: 'OFICINA DE REGISTRO (ORIP)' },
  { key: 'propietarios_actuales', label: 'PROPIETARIOS ACTUALES' },
  { key: 'modo_adquisicion', label: 'MODO DE ADQUISICIÓN' },
  { key: 'linderos_literales', label: 'LINDEROS LITERALES' },
  { key: 'condiciones_juridicas', label: 'GRAVÁMENES Y LIMITACIONES' },
  { key: 'radicado_snr', label: 'RADICADO CONSULTA SNR' },
  { key: 'area_titulo_m2', label: 'ÁREA TÍTULO (M²)' },
  { key: 'area_total_plano_m2', label: 'ÁREA TOTAL PLANO (M²)' },
  { key: 'area_afectada_plano_m2', label: 'ÁREA DE AFECTACIÓN (M²)' },
  { key: 'longitud_servidumbre_m', label: 'LONGITUD SERVIDUMBRE (M)' },
  { key: 'ancho_franja_m', label: 'ANCHO DE FRANJA (M)' },
  { key: 'conteo_postes_torres', label: 'CANTIDAD DE POSTES/TORRES' },
  { key: 'escala_plano', label: 'ESCALA DEL PLANO' },
  { key: 'estado_revision', label: 'ESTADO DE REVISIÓN' },
  { key: 'calidad_semantica', label: 'CALIDAD SEMÁNTICA' },
]

/**
 * US-116, US-117 & US-118: Exportación certificada de registros maestros en libro Excel.
 */
export async function downloadMasterRecordsXlsx(
  records: PropertyMasterRecord[],
  options: ExportOptions = {}
) {
  const criteria = options.inclusionCriteria ?? 'all'
  const date = new Date().toISOString()
  const user = options.userEmail ?? 'operador@territorium.com'
  const batchVer = options.batchVersion ?? 1
  const batchId = options.batchId ?? 'LOTE-ACTIVO'

  // Filtrado según criterios de inclusión (US-117)
  let filteredRecords = [...records]
  if (criteria === 'only_approved') {
    filteredRecords = records.filter((r) => r.reviewState === 'aprobado')
  } else if (criteria === 'exceptions_only') {
    filteredRecords = records.filter((r) => r.criticalConflictCount > 0 || r.reviewState === 'devuelto' || r.isBlockedForExport)
  }

  // US-099 & US-118: Bloqueo estricto de exportación si hay predios con discrepancias o bloqueos activos
  if (!options.allowBlockedExport && criteria !== 'exceptions_only') {
    const blocked = filteredRecords.filter((r) => r.isBlockedForExport)
    if (blocked.length > 0) {
      const details = blocked.map((b) => `${b.propertyCode} (${b.exportBlockReasons.join('; ') || 'Discrepancias críticas'})`).join(', ')
      throw new Error(
        `Exportación bloqueada: Existen ${blocked.length} predio(s) con discrepancias críticas o bloqueos activos: ${details}. Corrija en la mesa de revisión o use 'exceptions_only'.`
      )
    }
  }

  // Generación de Checksum de integridad (US-118)
  const serialized = JSON.stringify(filteredRecords.map((r) => ({ code: r.propertyCode, state: r.reviewState, attrs: r.attributes })))
  let hashVal = 0
  for (let i = 0; i < serialized.length; i++) {
    hashVal = (hashVal << 5) - hashVal + serialized.charCodeAt(i)
    hashVal |= 0
  }
  const checksum = `TTM-INTEGRITY-${Math.abs(hashVal).toString(16).toUpperCase().padStart(8, '0')}-${filteredRecords.length}`

  // 1. Hoja CORRESPONDENCIA (Matriz consolidada)
  const headers = CORRESPONDENCIA_COLUMNS.map((c) => headerCell(c.label))
  const dataRows: Cell[][] = filteredRecords.map((rec) => {
    return CORRESPONDENCIA_COLUMNS.map((col) => {
      if (col.key === 'estado_revision') {
        return textCell(rec.reviewState.toUpperCase())
      }
      if (col.key === 'calidad_semantica') {
        return { value: rec.semanticQualityScore, type: Number, format: '0%' } satisfies Cell
      }
      const attr = rec.attributes[col.key]
      return textCell(attr?.activeValue ?? '')
    })
  })

  // 2. Hoja de Auditoría y Metadatos de Exportación (US-118)
  const metadataRows: Cell[][] = [
    [subHeaderCell('PARÁMETRO DE TRAZABILIDAD'), subHeaderCell('VALOR REGISTRADO')],
    [textCell('Proyecto'), textCell(options.projectName ?? 'Expediente Territorial')],
    [textCell('Identificador de Lote'), textCell(batchId)],
    [textCell('Versión del Lote'), textCell(String(batchVer))],
    [textCell('Fecha y Hora de Exportación'), textCell(date)],
    [textCell('Usuario Responsable'), textCell(user)],
    [textCell('Criterio de Inclusión Aplicado'), textCell(criteria.toUpperCase())],
    [textCell('Total de Predios Exportados'), textCell(String(filteredRecords.length))],
    [textCell('Predios Aprobados en Lote'), textCell(String(records.filter((r) => r.reviewState === 'aprobado').length))],
    [textCell('Predios con Excepciones / Conflictos'), textCell(String(records.filter((r) => r.criticalConflictCount > 0).length))],
    [textCell('Sello de Integridad del Libro'), textCell(checksum)],
    [textCell('Certificación de Integridad'), textCell('Exportación generada conforme al esquema maestro auditado Territorium')],
  ]

  // 3. Hoja de Trazabilidad por Atributo (3 estados: AI, Manual, Aprobado - US-101 & US-160)
  const detailHeaders: Cell[] = [
    'Código Predial',
    'Campo',
    'Valor Activo',
    'Origen del Valor',
    'Valor Original IA',
    'Valor Manual',
    'Valor Aprobado',
    'Motivo del Cambio',
    'Modificado Por',
    'Conflicto Activo',
    'Detalle Conflicto',
  ].map(headerCell)

  const detailRows: Cell[][] = filteredRecords.flatMap((rec) =>
    Object.values(rec.attributes).map((attr) => [
      textCell(rec.propertyCode),
      textCell(attr.label),
      textCell(attr.activeValue),
      textCell(attr.sourceState.toUpperCase()),
      textCell(attr.aiValue),
      textCell(attr.manualValue ?? 'Sin edición'),
      textCell(attr.approvedValue ?? 'Sin aprobación'),
      textCell(attr.changeMotive ?? 'N/A'),
      textCell(attr.lastModifiedBy ?? 'IA'),
      textCell(attr.hasConflict ? 'SÍ' : 'NO'),
      textCell(attr.conflictDetails ?? ''),
    ])
  )

  const filename = options.filename ?? `CORRESPONDENCIA_${batchId}_v${batchVer}.xlsx`

  await writeXlsxFile([
    {
      data: [headers, ...dataRows],
      sheet: 'CORRESPONDENCIA',
      stickyRowsCount: 1,
      columns: CORRESPONDENCIA_COLUMNS.map(() => ({ width: 25 })),
    },
    {
      data: [detailHeaders, ...detailRows],
      sheet: 'Trazabilidad Atributos',
      stickyRowsCount: 1,
      columns: [{ width: 18 }, { width: 25 }, { width: 35 }, { width: 18 }, { width: 30 }, { width: 30 }, { width: 30 }, { width: 30 }, { width: 25 }, { width: 15 }, { width: 35 }],
    },
    {
      data: metadataRows,
      sheet: 'Metadatos Exportación',
      stickyRowsCount: 1,
      columns: [{ width: 30 }, { width: 50 }],
    },
  ]).toFile(filename)
}

/**
 * Soporte retrocompatible para descarga de PropertyRecord[]
 */
export async function downloadRecordsXlsx(records: PropertyRecord[], filename = 'territorium-atributos.xlsx') {
  const detail: Cell[][] = [
    ['Predio', 'Matrícula inmobiliaria', 'Municipio', 'Atributo', 'Valor', 'Estado de revisión', 'Confianza'].map(headerCell),
    ...records.flatMap((record) =>
      Object.entries(record.fields).map(([attribute, value]) => [
        textCell(record.name),
        textCell(record.folio),
        textCell(record.municipality),
        textCell(attribute),
        textCell(value),
        textCell(record.reviewState),
        { value: record.confidence, type: Number, format: '0%' } satisfies Cell,
      ])
    ),
  ]
  const attributeKeys = Array.from(new Set(records.flatMap((record) => Object.keys(record.fields))))
  const matrix: Cell[][] = [
    ['Predio', 'Folio', 'Municipio', ...attributeKeys].map(headerCell),
    ...records.map((record) => [
      textCell(record.name),
      textCell(record.folio),
      textCell(record.municipality),
      ...attributeKeys.map((key) => textCell(record.fields[key])),
    ]),
  ]
  await writeXlsxFile([
    { data: detail, sheet: 'Atributos', stickyRowsCount: 1, columns: [{ width: 30 }, { width: 24 }, { width: 22 }, { width: 30 }, { width: 48 }, { width: 22 }, { width: 14 }] },
    { data: matrix, sheet: 'Matriz consolidada', stickyRowsCount: 1 },
  ]).toFile(filename)
}
