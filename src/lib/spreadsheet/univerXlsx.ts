/**
 * Conversión entre archivos .xlsx (ExcelJS) y el modelo de libro de Univer (IWorkbookData).
 *
 * La importación/exportación nativa de Univer es parte de su edición Pro (requiere servidor),
 * así que el editor de resultados usa este conversor en el navegador. Conserva lo que un
 * revisor usa a diario: valores, fórmulas (con su último resultado), formato de número,
 * fuente, relleno, bordes, alineación y ajuste de texto, anchos y altos, filas/columnas
 * ocultas, celdas combinadas, paneles inmovilizados, líneas de cuadrícula y varias hojas.
 * No conserva gráficos, imágenes, validaciones ni formatos condicionales.
 */
import ExcelJS from 'exceljs'
import type {
  BorderStyleTypes,
  CellValueType,
  HorizontalAlign,
  IBorderData,
  IBorderStyleData,
  ICellData,
  IColumnData,
  IRange,
  IRowData,
  IStyleData,
  IWorkbookData,
  IWorksheetData,
  LocaleType,
  VerticalAlign,
  WrapStrategy,
} from '@univerjs/presets'

// Valores de los enums de @univerjs/core (se repiten aquí para no cargar Univer en el conversor).
const TRUE = 1 as const
const CELL_STRING = 1 as CellValueType
const CELL_NUMBER = 2 as CellValueType
const CELL_BOOLEAN = 3 as CellValueType
const WRAP = 3 as WrapStrategy
const ES_ES = 'esES' as LocaleType

const H_ALIGN: Record<string, HorizontalAlign> = { left: 1, center: 2, centerContinuous: 2, right: 3, justify: 4, fill: 1, distributed: 6 } as Record<string, HorizontalAlign>
const H_ALIGN_OUT: Record<number, ExcelJS.Alignment['horizontal']> = { 1: 'left', 2: 'center', 3: 'right', 4: 'justify', 5: 'justify', 6: 'distributed' }
const V_ALIGN: Record<string, VerticalAlign> = { top: 1, middle: 2, bottom: 3, distributed: 2, justify: 2 } as Record<string, VerticalAlign>
const V_ALIGN_OUT: Record<number, ExcelJS.Alignment['vertical']> = { 1: 'top', 2: 'middle', 3: 'bottom' }

const BORDER_IN: Record<string, BorderStyleTypes> = {
  thin: 1, hair: 2, dotted: 3, dashed: 4, dashDot: 5, dashDotDot: 6, double: 7,
  medium: 8, mediumDashed: 9, mediumDashDot: 10, mediumDashDotDot: 11, slantDashDot: 12, thick: 13,
} as Record<string, BorderStyleTypes>
const BORDER_OUT = Object.fromEntries(Object.entries(BORDER_IN).map(([name, value]) => [value, name])) as Record<number, ExcelJS.BorderStyle>
const BORDER_SIDES = [['top', 't'], ['right', 'r'], ['bottom', 'b'], ['left', 'l']] as const

/** Ancho de columna: Excel mide en caracteres; Univer en píxeles. */
export const excelWidthToPx = (width: number) => Math.round(width * 7 + 5)
export const pxToExcelWidth = (px: number) => Math.max(0, Math.round(((px - 5) / 7) * 100) / 100)
/** Alto de fila: Excel mide en puntos; Univer en píxeles. */
export const pointsToPx = (pt: number) => Math.round((pt * 4) / 3)
export const pxToPoints = (px: number) => Math.round(((px * 3) / 4) * 100) / 100

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30)
const dateToSerial = (date: Date) => (date.getTime() - EXCEL_EPOCH_MS) / 86_400_000

// ---------- Colores ----------

function argbToHex(color: Partial<ExcelJS.Color> | undefined): string | undefined {
  const argb = color?.argb
  if (!argb || !/^[0-9a-f]{6,8}$/i.test(argb)) return undefined
  return `#${argb.slice(-6).toUpperCase()}`
}

function hexToArgb(color: unknown): string | undefined {
  if (typeof color !== 'string' || !color) return undefined
  const value = color.trim()
  let match = /^#([0-9a-f]{3})$/i.exec(value)
  if (match) return `FF${match[1].split('').map((c) => c + c).join('').toUpperCase()}`
  match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value)
  if (match) return `${(match[2] ?? 'FF').toUpperCase()}${match[1].toUpperCase()}`
  match = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value)
  if (match) return `FF${match.slice(1, 4).map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('').toUpperCase()}`
  return undefined
}

// ---------- Estilos ----------

function styleFromExcel(style: Partial<ExcelJS.Style> | undefined): IStyleData | undefined {
  if (!style) return undefined
  const out: IStyleData = {}
  const { font, fill, alignment, border, numFmt } = style
  if (font) {
    if (font.name) out.ff = font.name
    if (font.size) out.fs = font.size
    if (font.bold) out.bl = TRUE
    if (font.italic) out.it = TRUE
    if (font.underline) out.ul = { s: TRUE }
    if (font.strike) out.st = { s: TRUE }
    const color = argbToHex(font.color)
    if (color) out.cl = { rgb: color }
  }
  if (fill && fill.type === 'pattern' && fill.pattern === 'solid') {
    const color = argbToHex(fill.fgColor)
    if (color) out.bg = { rgb: color }
  }
  if (alignment) {
    if (alignment.horizontal && H_ALIGN[alignment.horizontal]) out.ht = H_ALIGN[alignment.horizontal]
    if (alignment.vertical && V_ALIGN[alignment.vertical]) out.vt = V_ALIGN[alignment.vertical]
    if (alignment.wrapText) out.tb = WRAP
    if (typeof alignment.textRotation === 'number' && alignment.textRotation !== 0) out.tr = { a: alignment.textRotation }
  }
  if (border) {
    const bd: IBorderData = {}
    for (const [excelSide, univerSide] of BORDER_SIDES) {
      const side = border[excelSide]
      if (side?.style && BORDER_IN[side.style] !== undefined) {
        bd[univerSide] = { s: BORDER_IN[side.style], cl: { rgb: argbToHex(side.color) ?? '#000000' } }
      }
    }
    if (Object.keys(bd).length) out.bd = bd
  }
  if (numFmt && numFmt !== 'General') out.n = { pattern: numFmt }
  return Object.keys(out).length ? out : undefined
}

function styleToExcel(style: IStyleData | null | undefined): Partial<ExcelJS.Style> {
  const out: Partial<ExcelJS.Style> = {}
  if (!style) return out
  const font: Partial<ExcelJS.Font> = {}
  if (style.ff) font.name = style.ff
  if (style.fs) font.size = style.fs
  if (style.bl === TRUE) font.bold = true
  if (style.it === TRUE) font.italic = true
  if (style.ul?.s === TRUE) font.underline = true
  if (style.st?.s === TRUE) font.strike = true
  const fontColor = hexToArgb(style.cl?.rgb)
  if (fontColor) font.color = { argb: fontColor }
  if (Object.keys(font).length) out.font = font
  const fillColor = hexToArgb(style.bg?.rgb)
  if (fillColor) out.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } }
  const alignment: Partial<ExcelJS.Alignment> = {}
  if (style.ht && H_ALIGN_OUT[style.ht]) alignment.horizontal = H_ALIGN_OUT[style.ht]
  if (style.vt && V_ALIGN_OUT[style.vt]) alignment.vertical = V_ALIGN_OUT[style.vt]
  if (style.tb === WRAP) alignment.wrapText = true
  if (style.tr?.a) alignment.textRotation = style.tr.a
  if (Object.keys(alignment).length) out.alignment = alignment
  if (style.bd) {
    const border: Partial<ExcelJS.Borders> = {}
    for (const [excelSide, univerSide] of BORDER_SIDES) {
      const side = style.bd[univerSide] as IBorderStyleData | null | undefined
      if (side && side.s && BORDER_OUT[side.s]) {
        border[excelSide] = { style: BORDER_OUT[side.s], color: { argb: hexToArgb(side.cl?.rgb) ?? 'FF000000' } }
      }
    }
    if (Object.keys(border).length) out.border = border
  }
  if (style.n?.pattern) out.numFmt = style.n.pattern
  return out
}

function resolveStyle(data: IWorkbookData, style: unknown): IStyleData | undefined {
  if (!style) return undefined
  if (typeof style === 'string') return data.styles?.[style] ?? undefined
  return style as IStyleData
}

// ---------- Valores ----------

/** Texto plano de una celda con formato enriquecido de Univer (dataStream termina en "\r\n"). */
export function richTextToPlain(dataStream: string): string {
  return dataStream.replace(/\r?\n$/, '').replace(/\r$/, '').replace(/\r/g, '\n')
}

function cellFromExcel(cell: ExcelJS.Cell, date1904: boolean): ICellData | null {
  const value = cell.value
  const out: ICellData = {}
  const style = styleFromExcel(cell.style)
  if (style) out.s = style
  if (value === null || value === undefined) return style ? out : null

  if (typeof value === 'number') {
    out.v = value
    out.t = CELL_NUMBER
  } else if (typeof value === 'string') {
    out.v = value
    out.t = CELL_STRING
  } else if (typeof value === 'boolean') {
    out.v = value ? 'TRUE' : 'FALSE'
    out.t = CELL_BOOLEAN
  } else if (value instanceof Date) {
    out.v = dateToSerial(value) - (date1904 ? 1462 : 0)
    out.t = CELL_NUMBER
    if (!out.s || !(out.s as IStyleData).n) out.s = { ...(out.s as IStyleData | undefined), n: { pattern: 'dd/mm/yyyy' } }
  } else if (typeof value === 'object') {
    if ('formula' in value || 'sharedFormula' in value) {
      const formula = cell.formula
      if (formula) out.f = `=${formula}`
      const result = (value as ExcelJS.CellFormulaValue).result
      if (typeof result === 'number' || typeof result === 'string') out.v = result
      else if (typeof result === 'boolean') out.v = result ? 'TRUE' : 'FALSE'
      else if (result instanceof Date) out.v = dateToSerial(result)
    } else if ('richText' in value) {
      out.v = value.richText.map((part) => part.text).join('')
      out.t = CELL_STRING
    } else if ('text' in value) {
      out.v = String((value as ExcelJS.CellHyperlinkValue).text ?? '')
      out.t = CELL_STRING
    } else if ('error' in value) {
      out.v = String(value.error)
      out.t = CELL_STRING
    }
  }
  return out
}

function cellValueToExcel(cell: ICellData): ExcelJS.CellValue {
  const plain = cell.p?.body?.dataStream !== undefined ? richTextToPlain(cell.p.body.dataStream) : undefined
  if (cell.f) {
    const result = cell.v ?? plain
    return { formula: cell.f.replace(/^=/, ''), result: result === null || result === undefined ? undefined : result } as ExcelJS.CellFormulaValue
  }
  if (plain !== undefined) return plain
  const value = cell.v
  if (value === null || value === undefined) return null
  if (cell.t === CELL_BOOLEAN) return value === 1 || value === true || value === 'TRUE'
  if (typeof value === 'number' && cell.t !== CELL_STRING) return value
  return typeof value === 'boolean' ? value : String(value)
}

// ---------- xlsx → Univer ----------

const sheetIdFor = (index: number) => `hoja-${index + 1}`

export async function xlsxToWorkbookData(file: ArrayBuffer | Uint8Array, name = 'Libro'): Promise<IWorkbookData> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(file as ArrayBuffer)
  const date1904 = Boolean(workbook.properties?.date1904)
  const sheets: IWorkbookData['sheets'] = {}
  const sheetOrder: string[] = []

  workbook.worksheets.forEach((worksheet, index) => {
    const id = sheetIdFor(index)
    sheetOrder.push(id)
    const cellData: NonNullable<IWorksheetData['cellData']> = {}
    let maxRow = 0
    let maxCol = 0
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        // Las celdas cubiertas por una combinación solo repiten el valor de la principal.
        if (cell.isMerged && cell.master !== cell) return
        const converted = cellFromExcel(cell, date1904)
        if (!converted) return
        ;(cellData[rowNumber - 1] ??= {})[colNumber - 1] = converted
        maxRow = Math.max(maxRow, rowNumber)
        maxCol = Math.max(maxCol, colNumber)
      })
    })

    const columnData: NonNullable<IWorksheetData['columnData']> = {}
    const columnCount = Math.max(worksheet.columnCount, maxCol)
    for (let col = 1; col <= columnCount; col++) {
      const column = worksheet.getColumn(col)
      const entry: Record<string, unknown> = {}
      if (column.width) entry.w = excelWidthToPx(column.width)
      if (column.hidden) entry.hd = TRUE
      const style = styleFromExcel(column.style)
      if (style) entry.s = style
      if (Object.keys(entry).length) columnData[col - 1] = entry
    }

    const rowData: NonNullable<IWorksheetData['rowData']> = {}
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const entry: Record<string, unknown> = {}
      if (row.height) entry.h = pointsToPx(row.height)
      if (row.hidden) entry.hd = TRUE
      if (Object.keys(entry).length) rowData[rowNumber - 1] = entry
    })

    const mergeData: IRange[] = []
    const merges = (worksheet.model as { merges?: string[] }).merges ?? []
    for (const ref of merges) {
      const [start, end] = ref.split(':')
      if (!start || !end) continue
      const a = worksheet.getCell(start)
      const b = worksheet.getCell(end)
      mergeData.push({ startRow: Number(a.row) - 1, startColumn: Number(a.col) - 1, endRow: Number(b.row) - 1, endColumn: Number(b.col) - 1 })
    }

    const view = worksheet.views?.[0] as Partial<ExcelJS.WorksheetViewFrozen & ExcelJS.WorksheetViewCommon> | undefined
    const xSplit = view?.state === 'frozen' ? view.xSplit ?? 0 : 0
    const ySplit = view?.state === 'frozen' ? view.ySplit ?? 0 : 0

    sheets[id] = {
      id,
      name: worksheet.name,
      tabColor: argbToHex(worksheet.properties?.tabColor) ?? '',
      hidden: worksheet.state === 'hidden' || worksheet.state === 'veryHidden' ? TRUE : 0,
      freeze: { xSplit, ySplit, startRow: ySplit ? ySplit : -1, startColumn: xSplit ? xSplit : -1 },
      rowCount: Math.max(maxRow + 100, 200),
      columnCount: Math.max(columnCount + 6, 26),
      showGridlines: view?.showGridLines === false ? 0 : TRUE,
      cellData,
      columnData,
      rowData,
      mergeData,
    } as Partial<IWorksheetData>
  })

  return {
    id: `libro-${Date.now().toString(36)}`,
    name,
    appVersion: '1.0.3',
    locale: ES_ES,
    styles: {},
    sheetOrder,
    sheets,
  }
}

// ---------- Univer → xlsx ----------

export async function workbookDataToXlsx(data: IWorkbookData): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Territorium'
  workbook.created = new Date()

  for (const sheetId of data.sheetOrder) {
    const sheet = data.sheets[sheetId]
    if (!sheet) continue
    const xSplit = sheet.freeze?.xSplit ?? 0
    const ySplit = sheet.freeze?.ySplit ?? 0
    const worksheet = workbook.addWorksheet(safeSheetName(sheet.name ?? sheetId, workbook), {
      properties: sheet.tabColor && hexToArgb(sheet.tabColor) ? { tabColor: { argb: hexToArgb(sheet.tabColor)! } } : {},
      state: sheet.hidden ? 'hidden' : 'visible',
      views: [{
        state: xSplit || ySplit ? 'frozen' : 'normal',
        ...(xSplit || ySplit ? { xSplit, ySplit } : {}),
        showGridLines: sheet.showGridlines !== 0,
      } as ExcelJS.WorksheetView],
    })

    for (const [colKey, column] of Object.entries(sheet.columnData ?? {}) as [string, Partial<IColumnData> | undefined][]) {
      if (!column) continue
      const target = worksheet.getColumn(Number(colKey) + 1)
      if (column.w) target.width = pxToExcelWidth(column.w)
      if (column.hd) target.hidden = true
      const style = styleToExcel(resolveStyle(data, column.s))
      if (style.numFmt) target.numFmt = style.numFmt
    }

    for (const [rowKey, row] of Object.entries(sheet.rowData ?? {}) as [string, Partial<IRowData> | undefined][]) {
      if (!row) continue
      const target = worksheet.getRow(Number(rowKey) + 1)
      if (row.h) target.height = pxToPoints(row.h)
      if (row.hd) target.hidden = true
    }

    for (const [rowKey, cols] of Object.entries(sheet.cellData ?? {})) {
      for (const [colKey, cell] of Object.entries(cols ?? {}) as [string, ICellData | undefined][]) {
        if (!cell) continue
        const target = worksheet.getCell(Number(rowKey) + 1, Number(colKey) + 1)
        target.value = cellValueToExcel(cell)
        const style = styleToExcel(resolveStyle(data, cell.s))
        if (style.font) target.font = style.font as ExcelJS.Font
        if (style.fill) target.fill = style.fill
        if (style.alignment) target.alignment = style.alignment
        if (style.border) target.border = style.border
        if (style.numFmt) target.numFmt = style.numFmt
      }
    }

    for (const range of sheet.mergeData ?? []) {
      if (range.endRow === range.startRow && range.endColumn === range.startColumn) continue
      worksheet.mergeCells(range.startRow + 1, range.startColumn + 1, range.endRow + 1, range.endColumn + 1)
    }
  }

  if (!workbook.worksheets.length) workbook.addWorksheet('Hoja1')
  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer as ArrayBuffer)
}

/** Nombre válido y único para Excel: máximo 31 caracteres y sin []:*?/\ */
function safeSheetName(name: string, workbook: ExcelJS.Workbook): string {
  const base = name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Hoja'
  let candidate = base
  for (let n = 2; workbook.getWorksheet(candidate); n++) candidate = `${base.slice(0, 31 - String(n).length - 1)} ${n}`
  return candidate
}
