/**
 * Contrato entre la tabla de resultados (columnas + filas) y la hoja de cálculo.
 *
 * - Hoja de datos: la primera hoja cuya fila 1 tiene el encabezado de la columna que identifica
 *   los registros.
 * - Fila 1: encabezados. Las columnas se reconocen por su etiqueta (sin distinguir mayúsculas,
 *   tildes ni el "*" de obligatorio), así que pueden reordenarse; las columnas u hojas adicionales
 *   se conservan en el archivo pero no van a la base de datos.
 * - Desde la fila 2: un registro por fila. Lo identifica una columna visible (contract.keyColumn,
 *   p. ej. "Documento fuente" en títulos) o, si no hay, una columna oculta "ID interno".
 * - Filas de solo lectura (p. ej. estudios sin plano): van después de los registros, con el ID
 *   marcado; la hoja las reescribe y no son registros.
 * - Las columnas no editables (datos del cotejo, letras del valor negociado, cálculos) siempre
 *   muestran lo que calcula el sistema.
 * - La base de datos manda en los datos: al abrir un archivo guardado se reconcilian sus celdas
 *   con las filas vigentes y se conserva su formato.
 */
import type { ICellData, IFreeze, IStyleData, IWorkbookData, IWorksheetData, LocaleType } from '@univerjs/presets'
import type { EditableResultRow, ResultColumn } from '../../components/expediente/types'
import { READONLY_ROW_FLAG } from '../planTitleLinking'
import { ACTION_COLUMN_KEY, SELECTION_COLUMN_KEY } from './selectionColumn'
import { richTextToPlain } from './univerXlsx'

const CELL_STRING = 1 as const
const DATA_SHEET_ID = 'datos'

export const ID_COLUMN_KEY = '__id'
export const READONLY_ID_PREFIX = 'solo-lectura:'
const ID_COLUMN: ResultColumn = { key: ID_COLUMN_KEY, label: 'ID interno (no modificar)', editable: false, width: 150 }

/**
 * Casillas para seleccionar filas (p. ej. para generar documentos): siempre en la columna A e
 * inmovilizada. Sus celdas quedan vacías en los datos; la marca se dibuja en pantalla.
 */
export { ACTION_COLUMN_KEY, actionColumn, SELECTION_COLUMN, SELECTION_COLUMN_KEY } from './selectionColumn'

/** Columna fija en A (Selección o un botón por fila): siempre inmovilizada y en su lugar. */
const pinnedColumnOf = (contract: SheetContract) => (contract.columns[0]?.kind ? contract.columns[0] : undefined)

/** Inmovilizado con la columna A incluida, o null si ya la incluye. */
export function freezeWithSelection(freeze: Partial<IFreeze> | undefined): IFreeze | null {
  const xSplit = freeze?.xSplit ?? 0
  const startColumn = freeze?.startColumn ?? -1
  if (xSplit >= 1 && startColumn - xSplit === 0) return null
  const columns = Math.max(1, startColumn)
  return {
    xSplit: columns,
    startColumn: columns,
    ySplit: freeze?.ySplit ?? 0,
    startRow: freeze?.startRow ?? -1,
  }
}

export interface SheetContract {
  title: string
  columns: ResultColumn[]
  /** Columna visible que identifica cada registro. Sin ella se usa la columna oculta "ID interno". */
  keyColumn?: string
}

export interface SheetAlert {
  rowId: string
  columnKey: string
  severity: 'error' | 'warning'
  kind: string
  message: string
}

export interface SheetView {
  /** Registros y filas de solo lectura (READONLY_ROW_FLAG), en el orden en que se muestran. */
  rows: EditableResultRow[]
  alerts?: SheetAlert[]
  /** Filas que se tiñen completas (p. ej. plano sin estudio de títulos). */
  errorRows?: Set<string>
  /** Filas marcadas en la columna Selección. */
  selected?: Set<string>
  /** Columna de acción: por registro, null si tiene el botón o el motivo por el que no lo tiene. */
  actions?: Map<string, string | null>
}

export interface ResultSheetRead {
  rows: EditableResultRow[]
  /** Errores que impiden convertir la hoja en filas; se muestran al revisor. */
  errors: string[]
}

export type DecorationTone = 'error' | 'warning' | 'missing' | 'row-error' | 'selected'

export interface SheetDecoration {
  tone: DecorationTone
  message?: string
}

export interface SheetLayout {
  sheetId: string
  /** Columna de la hoja por clave del contrato (incluye la columna de ID). */
  columnIndex: Map<string, number>
  /** Fila de la hoja (base 0) por id de registro. */
  records: Map<string, number>
  /** Filas de solo lectura presentes en la hoja. */
  readonly: { rowIndex: number; id: string }[]
  lastRecordRow: number
  /** Columna de casillas de selección, si la hay. */
  selectionColumn?: number
  /** Columna con un botón por fila, si la hay. */
  actionColumn?: number
  errors: string[]
}

export interface SheetUpdatePlan {
  layout: SheetLayout
  /** Celdas a escribir (fila → columna → celda), o vacío. */
  writes: Record<number, Record<number, ICellData | null>>
  hasWrites: boolean
  /** Resaltado por casilla: clave "fila:columna". */
  decorations: Map<string, SheetDecoration>
}

const MISSING_KINDS = new Set(['empty', 'missing', 'missing_value'])

const normalizeHeader = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

const normalizeKey = (text: string) => text.replace(/\s+/g, ' ').trim()

const isReadonlyRow = (row: EditableResultRow) => row[READONLY_ROW_FLAG] === 'true'

export const recordRowsOf = (rows: EditableResultRow[]) => rows.filter((row) => !isReadonlyRow(row))

/** Columnas de la hoja: las del contrato y, sin columna clave visible, la de ID oculta al final. */
export function sheetColumnsOf(contract: SheetContract): ResultColumn[] {
  return contract.keyColumn ? contract.columns : [...contract.columns, ID_COLUMN]
}

const identityColumnOf = (contract: SheetContract): ResultColumn =>
  (contract.keyColumn && contract.columns.find((column) => column.key === contract.keyColumn)) || ID_COLUMN

const identityOf = (row: EditableResultRow, contract: SheetContract) =>
  normalizeKey(contract.keyColumn ? String(row[contract.keyColumn] ?? '') : row.id)

const valueOf = (row: EditableResultRow, column: ResultColumn) =>
  column.key === ID_COLUMN_KEY ? (isReadonlyRow(row) ? `${READONLY_ID_PREFIX}${row.id}` : row.id) : String(row[column.key] ?? '')

const headerTextOf = (column: ResultColumn) => (column.required ? `${column.label} *` : column.label)

/** Columna del contrato cuyo encabezado es este texto (o undefined). */
export function contractColumnFor(columns: ResultColumn[], headerText: string): ResultColumn | undefined {
  const target = normalizeHeader(headerText)
  return target ? [...columns, ID_COLUMN].find((column) => normalizeHeader(column.label) === target) : undefined
}

/** Texto visible de una celda tal como lo guarda la base de datos. */
export function cellText(cell: ICellData | null | undefined): string {
  if (!cell) return ''
  if (cell.p?.body?.dataStream !== undefined) return richTextToPlain(cell.p.body.dataStream)
  const value = cell.v
  if (value === null || value === undefined) return ''
  return String(value)
}

/** Nombre válido para una hoja de Excel. */
export function sheetNameFor(title: string): string {
  return title.replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Resultados'
}

// ---------- Estilos ----------

const border = { s: 1, cl: { rgb: '#C9D5CE' } }
const borders = { t: border, r: border, b: border, l: border }
const STYLE_HEADER = { bl: 1, fs: 10, cl: { rgb: '#1F3B2D' }, bg: { rgb: '#E3EEE7' }, vt: 2, tb: 3, bd: borders, n: { pattern: '@' } } as IStyleData
const STYLE_HEADER_REQUIRED = { ...STYLE_HEADER, cl: { rgb: '#B42318' } } as IStyleData
const STYLE_CELL = { fs: 10, vt: 2, tb: 2, bd: borders, n: { pattern: '@' } } as IStyleData
const STYLE_LOCKED = { ...STYLE_CELL, cl: { rgb: '#4B5563' }, bg: { rgb: '#F3F4F6' } } as IStyleData
const STYLE_READONLY_ROW = { ...STYLE_CELL, it: 1, cl: { rgb: '#6B7280' }, bg: { rgb: '#EEF0F3' } } as IStyleData
const STYLE_SELECTION = { ...STYLE_CELL, ht: 2, fs: 13, cl: { rgb: '#2F5D45' } } as IStyleData
const STYLE_SELECTION_HEADER = { ...STYLE_HEADER, ht: 2 } as IStyleData
const STYLE_ACTION = { ...STYLE_CELL, ht: 2, bl: 1, cl: { rgb: '#1D4ED8' } } as IStyleData

const cellStyleOf = (column: ResultColumn) =>
  column.kind === 'selection' ? 'seleccion' : column.kind === 'action' ? 'accion' : column.editable === false ? 'celda-fija' : 'celda'
const headerStyleOf = (column: ResultColumn) => (column.kind ? 'encabezado-seleccion' : column.required ? 'encabezado-obligatorio' : 'encabezado')

// ---------- Construcción ----------

/** Libro nuevo: encabezados inmovilizados, registros, filas de solo lectura y columnas en texto. */
export function buildResultWorkbook(contract: SheetContract, rows: EditableResultRow[]): IWorkbookData {
  const columns = sheetColumnsOf(contract)
  const styles: Record<string, IStyleData> = {
    encabezado: STYLE_HEADER,
    'encabezado-obligatorio': STYLE_HEADER_REQUIRED,
    celda: STYLE_CELL,
    'celda-fija': STYLE_LOCKED,
    'fila-solo-lectura': STYLE_READONLY_ROW,
    seleccion: STYLE_SELECTION,
    accion: STYLE_ACTION,
    'encabezado-seleccion': STYLE_SELECTION_HEADER,
  }

  const cellData: NonNullable<IWorksheetData['cellData']> = { 0: {} }
  columns.forEach((column, col) => {
    cellData[0][col] = { v: headerTextOf(column), t: CELL_STRING, s: headerStyleOf(column) }
  })
  const records = recordRowsOf(rows)
  const readonlyRows = rows.filter(isReadonlyRow)
  const writeRow = (rowIndex: number, row: EditableResultRow, readonly: boolean) => {
    const line: Record<number, ICellData> = {}
    columns.forEach((column, col) => {
      const value = valueOf(row, column)
      const style = readonly ? 'fila-solo-lectura' : cellStyleOf(column)
      line[col] = value ? { v: value, t: CELL_STRING, s: style } : { s: style }
    })
    cellData[rowIndex] = line
  }
  records.forEach((row, index) => writeRow(index + 1, row, false))
  readonlyRows.forEach((row, index) => writeRow(records.length + 2 + index, row, true))

  const columnData: NonNullable<IWorksheetData['columnData']> = {}
  columns.forEach((column, col) => {
    // Formato texto en toda la columna: un FMI o una cédula de 20 dígitos no se vuelven número.
    columnData[col] = { w: Math.max(90, column.width ?? 160), s: { n: { pattern: '@' } }, ...(column.key === ID_COLUMN_KEY ? { hd: 1 } : {}) }
  })

  const sheet: Partial<IWorksheetData> = {
    id: DATA_SHEET_ID,
    name: sheetNameFor(contract.title),
    tabColor: '',
    hidden: 0,
    // Encabezados inmovilizados y, si la hay, la columna Selección.
    freeze: pinnedColumnOf(contract) ? { xSplit: 1, ySplit: 1, startRow: 1, startColumn: 1 } : { xSplit: 0, ySplit: 1, startRow: 1, startColumn: 0 },
    rowCount: Math.max(rows.length + 100, 200),
    columnCount: Math.max(columns.length + 6, 26),
    defaultRowHeight: 26,
    showGridlines: 1,
    cellData,
    columnData,
    rowData: { 0: { h: 40 } },
    mergeData: [],
  }

  return {
    id: `resultados-${Date.now().toString(36)}`,
    name: contract.title,
    appVersion: '1.0.3',
    locale: 'esES' as LocaleType,
    styles,
    sheetOrder: [DATA_SHEET_ID],
    sheets: { [DATA_SHEET_ID]: sheet },
  }
}

// ---------- Ubicación de registros ----------

/** Encuentra encabezados, registros y filas de solo lectura en la hoja de datos. */
export function locateSheet(data: IWorkbookData, contract: SheetContract, baseRows: EditableResultRow[]): SheetLayout {
  const columns = sheetColumnsOf(contract)
  const identity = identityColumnOf(contract)
  const identityHeader = normalizeHeader(identity.label)
  const sheetId = data.sheetOrder.find((id) => {
    const header = data.sheets[id]?.cellData?.[0] ?? {}
    return Object.values(header).some((cell) => normalizeHeader(cellText(cell)) === identityHeader)
  }) ?? data.sheetOrder[0]
  const sheet = data.sheets[sheetId]
  const sheetName = sheet?.name ?? 'la hoja'
  const cellData = sheet?.cellData ?? {}
  const errors: string[] = []

  const columnIndex = new Map<string, number>()
  const headerCells = Object.entries(cellData[0] ?? {})
  for (const column of columns) {
    const target = normalizeHeader(column.label)
    const found = headerCells.find(([, cell]) => normalizeHeader(cellText(cell)) === target)
    if (found) columnIndex.set(column.key, Number(found[0]))
    else errors.push(`No se encontró la columna "${column.label}" en la fila 1 de "${sheetName}". No cambies ni borres los encabezados.`)
  }
  const empty: SheetLayout = { sheetId, columnIndex, records: new Map(), readonly: [], lastRecordRow: 0, errors }
  if (!columnIndex.has(identity.key)) return empty

  const baseByIdentity = new Map<string, EditableResultRow>()
  for (const row of recordRowsOf(baseRows)) baseByIdentity.set(identityOf(row, contract), row)

  const identityCol = columnIndex.get(identity.key)!
  const records = new Map<string, number>()
  const readonly: SheetLayout['readonly'] = []
  const seen = new Set<string>()
  let lastRecordRow = 0
  const lastRow = Math.max(0, ...Object.keys(cellData).map(Number))
  for (let rowIndex = 1; rowIndex <= lastRow; rowIndex++) {
    const line = cellData[rowIndex]
    if (!line) continue
    const key = normalizeKey(cellText(line[identityCol]))
    if (!contract.keyColumn && key.startsWith(READONLY_ID_PREFIX)) {
      readonly.push({ rowIndex, id: key.slice(READONLY_ID_PREFIX.length) })
      continue
    }
    const hasData = columns.some((column) => columnIndex.has(column.key) && cellText(line[columnIndex.get(column.key)!]).trim() !== '')
    if (!hasData) continue
    const base = key ? baseByIdentity.get(key) : undefined
    if (!key) {
      errors.push(`Fila ${rowIndex + 1}: falta "${identity.label}". Cada fila debe conservar el registro al que pertenece.`)
    } else if (!base) {
      errors.push(`Fila ${rowIndex + 1}: "${key}" no corresponde a ningún registro de este resultado. No cambies la columna "${identity.label}" ni agregues filas nuevas.`)
    } else if (seen.has(key)) {
      errors.push(`Fila ${rowIndex + 1}: el registro "${key}" está repetido.`)
    } else {
      seen.add(key)
      records.set(base.id, rowIndex)
      lastRecordRow = Math.max(lastRecordRow, rowIndex)
    }
  }
  for (const [key] of baseByIdentity) {
    if (key && !seen.has(key)) errors.push(`Falta la fila de "${key}". No elimines filas de registros.`)
  }
  return { sheetId, columnIndex, records, readonly, lastRecordRow, selectionColumn: columnIndex.get(SELECTION_COLUMN_KEY), actionColumn: columnIndex.get(ACTION_COLUMN_KEY), errors }
}

/** Convierte la hoja en filas de la tabla (en el orden guardado), o devuelve los errores que lo impiden. */
export function readResultRows(data: IWorkbookData, contract: SheetContract, baseRows: EditableResultRow[]): ResultSheetRead {
  const layout = locateSheet(data, contract, baseRows)
  if (layout.errors.length) return { rows: [], errors: layout.errors }
  const cellData = data.sheets[layout.sheetId]?.cellData ?? {}
  const errors: string[] = []
  const rows = recordRowsOf(baseRows).map((base) => {
    const rowIndex = layout.records.get(base.id)!
    const next: EditableResultRow = { ...base }
    for (const column of contract.columns) {
      if (column.editable === false) continue
      const cell = cellData[rowIndex]?.[layout.columnIndex.get(column.key)!]
      if (typeof cell?.v === 'number' && Number.isInteger(cell.v) && !Number.isSafeInteger(cell.v)) {
        errors.push(`Fila ${rowIndex + 1}, "${column.label}": el número es demasiado largo y perdió dígitos. Escríbelo de nuevo con la celda en formato texto.`)
      }
      next[column.key] = cellText(cell)
    }
    return next
  })
  return errors.length ? { rows: [], errors } : { rows, errors: [] }
}

/**
 * Libro para abrir en el editor a partir del archivo guardado: conserva su formato y toma los
 * datos de las filas vigentes. Si su estructura ya no corresponde, se genera uno nuevo.
 */
export function reconcileResultWorkbook(data: IWorkbookData, contract: SheetContract, rows: EditableResultRow[]): { workbook: IWorkbookData; regenerated: boolean } {
  const layout = locateSheet(data, contract, rows)
  const pinned = pinnedColumnOf(contract)
  const pinnedMoved = pinned !== undefined && layout.columnIndex.get(pinned.key) !== 0
  if (layout.errors.length || pinnedMoved) return { workbook: buildResultWorkbook(contract, rows), regenerated: true }
  const sheet = data.sheets[layout.sheetId]!
  const freeze = pinned ? freezeWithSelection(sheet.freeze) : null
  const cellData = { ...(sheet.cellData ?? {}) }
  for (const row of recordRowsOf(rows)) {
    const rowIndex = layout.records.get(row.id)!
    const line = { ...(cellData[rowIndex] ?? {}) }
    for (const column of sheetColumnsOf(contract)) {
      const col = layout.columnIndex.get(column.key)!
      const expected = valueOf(row, column)
      const cell = line[col]
      if (cellText(cell) === expected) continue
      line[col] = { s: cell?.s ?? null, ...(expected ? { v: expected, t: CELL_STRING } : {}) }
    }
    cellData[rowIndex] = line
  }
  return {
    workbook: { ...data, sheets: { ...data.sheets, [layout.sheetId]: { ...sheet, cellData, ...(freeze ? { freeze } : {}) } } },
    regenerated: false,
  }
}

// ---------- Actualización en vivo ----------

const valueCell = (value: string): ICellData => (value ? { v: value, t: CELL_STRING, p: null, f: null, si: null } : { v: null, p: null, f: null, si: null })
const CLEARED: ICellData = { v: null, p: null, f: null, si: null, s: null }

function toneOf(alert: SheetAlert): DecorationTone {
  if (alert.severity === 'error') return 'error'
  return MISSING_KINDS.has(alert.kind) ? 'missing' : 'warning'
}

const TONE_RANK: Record<DecorationTone, number> = { error: 4, warning: 3, missing: 2, 'row-error': 1, selected: 0 }

/**
 * Qué escribir y qué resaltar para que la hoja muestre la vista actual:
 * - columnas no editables: siempre el valor calculado (cotejo, letras, cálculos);
 * - columnas editables: solo si el sistema cambió el valor desde la última vista (p. ej. un dato
 *   del proyecto que se replica en todas las filas), sin pisar lo que el revisor acaba de escribir;
 * - filas de solo lectura: después del último registro, separadas por una fila en blanco;
 * - resaltado por casilla y en el encabezado de las columnas con alertas.
 * Con includeWrites=false solo recalcula el resaltado (p. ej. tras mover filas).
 */
export function planSheetUpdate(
  data: IWorkbookData,
  contract: SheetContract,
  view: SheetView,
  lastApplied: Map<string, Record<string, string>>,
  includeWrites = true,
): SheetUpdatePlan {
  const columns = sheetColumnsOf(contract)
  const records = recordRowsOf(view.rows)
  const layout = locateSheet(data, contract, records)
  const cellData = data.sheets[layout.sheetId]?.cellData ?? {}
  const writes: SheetUpdatePlan['writes'] = {}
  const write = (row: number, col: number, cell: ICellData) => { (writes[row] ??= {})[col] = cell }

  if (includeWrites) {
    for (const row of records) {
      const rowIndex = layout.records.get(row.id)
      if (rowIndex === undefined) continue
      const previous = lastApplied.get(row.id)
      for (const column of contract.columns) {
        const col = layout.columnIndex.get(column.key)
        if (col === undefined) continue
        const desired = String(row[column.key] ?? '')
        if (cellText(cellData[rowIndex]?.[col]) === desired) continue
        const systemChanged = column.editable === false || (previous !== undefined && previous[column.key] !== desired)
        if (systemChanged) write(rowIndex, col, valueCell(desired))
      }
    }

    if (!contract.keyColumn) {
      const desired = view.rows.filter(isReadonlyRow)
      const start = (layout.lastRecordRow || 0) + 2
      const inPlace = layout.readonly.length === desired.length && desired.every((row, index) => {
        const current = layout.readonly[index]
        if (!current || current.id !== row.id || current.rowIndex !== start + index) return false
        return columns.every((column) => {
          const col = layout.columnIndex.get(column.key)
          return col === undefined || cellText(cellData[current.rowIndex]?.[col]) === valueOf(row, column)
        })
      })
      if (!inPlace) {
        for (const { rowIndex } of layout.readonly) {
          for (const col of layout.columnIndex.values()) write(rowIndex, col, CLEARED)
        }
        desired.forEach((row, index) => {
          for (const column of columns) {
            const col = layout.columnIndex.get(column.key)
            if (col === undefined) continue
            const value = valueOf(row, column)
            write(start + index, col, { ...valueCell(value), s: STYLE_READONLY_ROW })
          }
        })
        layout.readonly = desired.map((row, index) => ({ rowIndex: start + index, id: row.id }))
      }
    }
  }

  const rowOf = new Map<string, number>(layout.records)
  for (const { rowIndex, id } of layout.readonly) rowOf.set(id, rowIndex)
  const decorations = new Map<string, SheetDecoration>()
  const decorate = (row: number, col: number, decoration: SheetDecoration) => {
    const key = `${row}:${col}`
    const current = decorations.get(key)
    if (!current || TONE_RANK[decoration.tone] > TONE_RANK[current.tone]) decorations.set(key, decoration)
  }

  const perColumn = new Map<number, { missing: number; other: number; error: boolean }>()
  for (const alert of view.alerts ?? []) {
    const row = rowOf.get(alert.rowId)
    const col = layout.columnIndex.get(alert.columnKey)
    if (row === undefined || col === undefined) continue
    const tone = toneOf(alert)
    decorate(row, col, { tone, message: alert.message })
    const count = perColumn.get(col) ?? { missing: 0, other: 0, error: false }
    if (MISSING_KINDS.has(alert.kind)) count.missing++
    else count.other++
    count.error ||= tone === 'error'
    perColumn.set(col, count)
  }
  for (const rowId of view.errorRows ?? []) {
    const row = rowOf.get(rowId)
    if (row === undefined) continue
    for (const col of layout.columnIndex.values()) decorate(row, col, { tone: 'row-error' })
  }
  for (const rowId of view.selected ?? []) {
    const row = layout.records.get(rowId)
    if (row === undefined) continue
    for (const col of layout.columnIndex.values()) decorate(row, col, { tone: 'selected' })
  }
  for (const [col, count] of perColumn) {
    const parts = [
      count.missing ? `${count.missing} casilla(s) sin dato` : '',
      count.other ? `${count.other} alerta(s)` : '',
    ].filter(Boolean)
    decorate(0, col, { tone: count.error ? 'error' : count.other ? 'warning' : 'missing', message: `En esta columna: ${parts.join(' y ')}.` })
  }

  return { layout, writes, hasWrites: Object.keys(writes).length > 0, decorations }
}

/** Valores de la vista por registro, para saber después qué cambió el sistema. */
export function viewValues(rows: EditableResultRow[]): Map<string, Record<string, string>> {
  return new Map(recordRowsOf(rows).map((row) => [row.id, Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value ?? '')]))]))
}

/**
 * Huella del contenido editable del libro, para saber si hay cambios sin guardar. Ignora
 * desplazamiento, zoom y altos automáticos, que cambian sin que el revisor edite nada.
 */
export function workbookFingerprint(data: IWorkbookData): string {
  const sheets = data.sheetOrder.map((id) => {
    const { scrollTop: _st, scrollLeft: _sl, zoomRatio: _z, rowData, ...rest } = (data.sheets[id] ?? {}) as Partial<IWorksheetData>
    const rows = Object.fromEntries(Object.entries(rowData ?? {}).map(([key, row]) => {
      const { ah: _ah, ...kept } = (row ?? {}) as Record<string, unknown>
      return [key, kept]
    }))
    return { ...rest, rowData: rows }
  })
  return JSON.stringify({ order: data.sheetOrder, styles: data.styles, sheets })
}
