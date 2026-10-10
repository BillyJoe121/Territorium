import { describe, expect, it } from 'vitest'
import type { ICellData, IWorkbookData } from '@univerjs/presets'
import type { EditableResultRow } from '../../components/expediente/types'
import { TITLE_COLUMNS_CONTRACT } from '../expedienteResultAdapters'
import { buildResultWorkbook, readResultRows, reconcileResultWorkbook, sheetNameFor, workbookFingerprint, type SheetContract } from './resultSheet'
import { workbookDataToXlsx, xlsxToWorkbookData } from './univerXlsx'

const columns = TITLE_COLUMNS_CONTRACT
const col = (key: string) => columns.findIndex((c) => c.key === key)

const title = (n: number, overrides: Partial<EditableResultRow> = {}): EditableResultRow => ({
  id: `title-row-${n}`,
  ...Object.fromEntries(columns.map((c) => [c.key, ''])),
  sourceDocument: `ESTUDIO DE TÍTULOS_TOL-ANZ-0${n}.pdf`,
  folio: `350-4257${n}`,
  cadastralId: `7302600020013007000${n}`,
  owners: `PROPIETARIO ${n}`,
  ...overrides,
})

const rows = [title(1), title(2), title(3)]
const titles: SheetContract = { title: 'Estudio de Títulos', columns, keyColumn: 'sourceDocument' }
const build = () => buildResultWorkbook(titles, rows)
const sheetOf = (data: IWorkbookData) => data.sheets[data.sheetOrder[0]]!
const setCell = (data: IWorkbookData, row: number, column: number, cell: ICellData | undefined) => {
  const cells = sheetOf(data).cellData!
  cells[row] = { ...(cells[row] ?? {}) }
  if (cell) cells[row][column] = cell
  else delete cells[row][column]
}

describe('buildResultWorkbook', () => {
  it('lays out a frozen header and one text row per record', () => {
    const sheet = sheetOf(build())
    expect(sheet.name).toBe('Estudio de Títulos')
    expect(sheet.freeze).toMatchObject({ ySplit: 1, startRow: 1 })
    expect(sheet.cellData?.[0]?.[0]?.v).toBe('Documento fuente')
    expect(sheet.cellData?.[2]?.[col('cadastralId')]).toMatchObject({ v: '73026000200130070002', t: 1 })
    expect(sheet.columnData?.[col('folio')]?.s).toEqual({ n: { pattern: '@' } })
  })

  it('reads back exactly the rows it was built from', () => {
    expect(readResultRows(build(), titles, rows)).toEqual({ rows, errors: [] })
  })

  it('keeps sheet names valid for Excel', () => {
    expect(sheetNameFor('Planos / linderos: [2024] y más texto largo')).toBe('Planos linderos 2024 y más text')
  })
})

describe('readResultRows', () => {
  it('takes edited values keeping row ids and the saved order', () => {
    const data = build()
    setCell(data, 2, col('owners'), { v: 'NUEVO PROPIETARIO', t: 1 })
    // Ordenar la hoja no cambia el orden guardado: los ids por posición siguen siendo estables.
    const cells = sheetOf(data).cellData!
    ;[cells[1], cells[3]] = [cells[3], cells[1]]
    const read = readResultRows(data, titles, rows)
    expect(read.errors).toEqual([])
    expect(read.rows.map((row) => row.id)).toEqual(['title-row-1', 'title-row-2', 'title-row-3'])
    expect(read.rows[1]).toEqual({ ...rows[1], owners: 'NUEVO PROPIETARIO' })
  })

  it('uses computed values of formulas and plain text of rich cells', () => {
    const data = build()
    setCell(data, 1, col('areaNumbers'), { f: '=2+3', v: 5 })
    setCell(data, 1, col('boundaries'), { p: { id: 'd', body: { dataStream: 'Norte\rSur\r\n' } } as never })
    const read = readResultRows(data, titles, rows)
    expect(read.rows[0].areaNumbers).toBe('5')
    expect(read.rows[0].boundaries).toBe('Norte\nSur')
  })

  it('matches columns by header even after reordering, and ignores extra columns', () => {
    const data = build()
    const cells = sheetOf(data).cellData!
    for (const line of Object.values(cells)) {
      const folio = line[col('folio')]
      line[col('folio')] = line[col('cadastralId')]
      line[col('cadastralId')] = folio
      line[40] = { v: 'nota libre' }
    }
    cells[0][40] = { v: 'Mis notas' }
    expect(readResultRows(data, titles, rows)).toEqual({ rows, errors: [] })
  })

  it('ignores blank rows', () => {
    const data = build()
    setCell(data, 10, col('owners'), { v: '   ' })
    expect(readResultRows(data, titles, rows).errors).toEqual([])
  })

  it('reports a missing header', () => {
    const data = build()
    setCell(data, 0, col('owners'), { v: 'Dueños' })
    expect(readResultRows(data, titles, rows).errors[0]).toMatch(/"Propietarios del predio"/)
  })

  it('reports unknown, duplicated and deleted records', () => {
    const changed = build()
    setCell(changed, 2, col('sourceDocument'), { v: 'otro.pdf' })
    const errors = readResultRows(changed, titles, rows).errors
    expect(errors[0]).toMatch(/Fila 3: "otro.pdf" no corresponde/)
    expect(errors[1]).toMatch(/Falta la fila de "ESTUDIO DE TÍTULOS_TOL-ANZ-02.pdf"/)

    const added = build()
    setCell(added, 6, col('owners'), { v: 'fila nueva' })
    expect(readResultRows(added, titles, rows).errors[0]).toMatch(/Fila 7: falta "Documento fuente"/)

    const duplicated = build()
    sheetOf(duplicated).cellData![4] = { ...sheetOf(duplicated).cellData![1] }
    expect(readResultRows(duplicated, titles, rows).errors[0]).toMatch(/Fila 5: .* está repetido/)
  })

  it('rejects numbers that lost digits', () => {
    const data = build()
    setCell(data, 1, col('cadastralId'), { v: 73026000200130070000, t: 2 })
    expect(readResultRows(data, titles, rows).errors[0]).toMatch(/Fila 2, "Cédula catastral": el número es demasiado largo/)
  })
})

describe('reconcileResultWorkbook', () => {
  it('keeps the saved formatting and takes the data from the database', async () => {
    const saved = build()
    setCell(saved, 1, col('owners'), { v: 'VALOR VIEJO', s: { bl: 1 } })
    sheetOf(saved).columnData![col('owners')] = { w: 400 }
    const fromFile = await xlsxToWorkbookData(await workbookDataToXlsx(saved))

    const { workbook, regenerated } = reconcileResultWorkbook(fromFile, titles, rows)
    expect(regenerated).toBe(false)
    const sheet = sheetOf(workbook)
    expect(sheet.cellData?.[1]?.[col('owners')]).toMatchObject({ v: 'PROPIETARIO 1', s: { bl: 1 } })
    expect(sheet.columnData?.[col('owners')]?.w).toBeCloseTo(400, -1)
    expect(readResultRows(workbook, titles, rows)).toEqual({ rows, errors: [] })
  })

  it('regenerates the sheet when its structure no longer matches', () => {
    const broken = build()
    setCell(broken, 0, col('folio'), undefined)
    const { workbook, regenerated } = reconcileResultWorkbook(broken, titles, rows)
    expect(regenerated).toBe(true)
    expect(readResultRows(workbook, titles, rows).errors).toEqual([])
  })
})

describe('workbookFingerprint', () => {
  it('ignores scroll, zoom and automatic row heights', () => {
    const a = build()
    const b = build()
    Object.assign(sheetOf(b), { scrollTop: 300, zoomRatio: 1.5, rowData: { 0: { h: 40, ah: 52 } } })
    expect(workbookFingerprint(b)).toBe(workbookFingerprint(a))
    setCell(b, 1, col('owners'), { v: 'cambio' })
    expect(workbookFingerprint(b)).not.toBe(workbookFingerprint(a))
  })
})
