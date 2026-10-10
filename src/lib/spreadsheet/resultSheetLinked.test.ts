import { describe, expect, it } from 'vitest'
import type { ICellData, IWorkbookData } from '@univerjs/presets'
import type { EditableResultRow, ResultColumn } from '../../components/expediente/types'
import { buildPlanTitleLinkage, LINK_STATUS_KEY, READONLY_ROW_FLAG } from '../planTitleLinking'
import {
  buildResultWorkbook,
  cellText,
  freezeWithSelection,
  ID_COLUMN_KEY,
  planSheetUpdate,
  READONLY_ID_PREFIX,
  readResultRows,
  reconcileResultWorkbook,
  SELECTION_COLUMN,
  SELECTION_COLUMN_KEY,
  sheetColumnsOf,
  viewValues,
  type SheetContract,
  type SheetView,
} from './resultSheet'
import { workbookDataToXlsx, xlsxToWorkbookData } from './univerXlsx'

const columns: ResultColumn[] = [
  { key: 'status', label: 'Estado', editable: false },
  { key: 'fmi', label: 'FMI' },
  { key: 'amount', label: 'Valor negociado (números)', required: true },
  { key: 'letters', label: 'Valor negociado (letras)', editable: false },
  { key: 'project', label: 'Proyecto', broadcast: true },
]
const contract: SheetContract = { title: 'Negociación', columns }
const sheetColumns = sheetColumnsOf(contract)
const col = (key: string) => sheetColumns.findIndex((c) => c.key === key)

const record = (n: number, overrides: Partial<EditableResultRow> = {}): EditableResultRow => ({
  id: `neg-row-${n}`, status: 'Vinculada', fmi: `350-${n}`, amount: '', letters: '', project: 'ARREBOLES', ...overrides,
})
const readonly = (id: string, fmi: string): EditableResultRow => ({ id, [READONLY_ROW_FLAG]: 'true', status: 'Sin negociación', fmi, amount: '', letters: '', project: '' })

const sheetOf = (data: IWorkbookData) => data.sheets[data.sheetOrder[0]]!
const cell = (data: IWorkbookData, row: number, key: string) => cellText(sheetOf(data).cellData?.[row]?.[col(key)])
const setCell = (data: IWorkbookData, row: number, key: string, value: ICellData) => {
  const cells = sheetOf(data).cellData!
  cells[row] = { ...(cells[row] ?? {}), [col(key)]: value }
}
/** Aplica las escrituras de un plan sobre el libro, como lo haría Univer. */
const applyWrites = (data: IWorkbookData, writes: Record<number, Record<number, ICellData | null>>) => {
  const cells = sheetOf(data).cellData!
  for (const [row, line] of Object.entries(writes)) {
    for (const [c, value] of Object.entries(line)) {
      cells[Number(row)] = { ...(cells[Number(row)] ?? {}), [Number(c)]: { ...(cells[Number(row)]?.[Number(c)] ?? {}), ...value } as ICellData }
    }
  }
}

const rows = [record(1), record(2), readonly('pair-only-350-9', '350-9')]
const view: SheetView = { rows }

describe('hidden ID column and read-only rows', () => {
  it('appends a hidden ID column, marks required headers and places read-only rows after a blank row', () => {
    const data = buildResultWorkbook(contract, rows)
    const sheet = sheetOf(data)
    expect(sheet.columnData?.[col(ID_COLUMN_KEY)]?.hd).toBe(1)
    expect(cell(data, 0, 'amount')).toBe('Valor negociado (números) *')
    expect(cell(data, 1, ID_COLUMN_KEY)).toBe('neg-row-1')
    expect(cell(data, 3, ID_COLUMN_KEY)).toBe('')
    expect(cell(data, 4, ID_COLUMN_KEY)).toBe(`${READONLY_ID_PREFIX}pair-only-350-9`)
  })

  it('reads only records, identified by the hidden ID even after sorting', () => {
    const data = buildResultWorkbook(contract, rows)
    const cells = sheetOf(data).cellData!
    ;[cells[1], cells[2]] = [cells[2], cells[1]]
    setCell(data, 1, 'amount', { v: '9.000.000' })
    const read = readResultRows(data, contract, rows)
    expect(read.errors).toEqual([])
    expect(read.rows.map((row) => [row.id, row.amount])).toEqual([['neg-row-1', ''], ['neg-row-2', '9.000.000']])
  })

  it('rejects rows whose ID was changed', () => {
    const data = buildResultWorkbook(contract, rows)
    setCell(data, 2, ID_COLUMN_KEY, { v: 'otro' })
    expect(readResultRows(data, contract, rows).errors[0]).toMatch(/Fila 3: "otro" no corresponde/)
  })

  it('reconciles a saved file through xlsx, ignoring stale read-only rows', async () => {
    const saved = buildResultWorkbook(contract, rows)
    const fromFile = await xlsxToWorkbookData(await workbookDataToXlsx(saved))
    const next = [record(1, { amount: '5000' }), record(2)]
    const { workbook, regenerated } = reconcileResultWorkbook(fromFile, contract, next)
    expect(regenerated).toBe(false)
    expect(cell(workbook, 1, 'amount')).toBe('5000')
    expect(sheetOf(workbook).columnData?.[col(ID_COLUMN_KEY)]?.hd).toBe(1)
  })
})

describe('planSheetUpdate', () => {
  it('writes nothing when the sheet already shows the view', () => {
    const data = buildResultWorkbook(contract, rows)
    expect(planSheetUpdate(data, contract, view, viewValues(rows)).hasWrites).toBe(false)
  })

  it('always shows computed columns and writes editable cells only when the system changed them', () => {
    const data = buildResultWorkbook(contract, rows)
    const lastApplied = viewValues(rows)
    // El revisor escribe el valor; la vista aún no lo procesa: no se pisa lo escrito.
    setCell(data, 1, 'amount', { v: '1000' })
    expect(planSheetUpdate(data, contract, view, lastApplied).hasWrites).toBe(false)

    // La vista procesa la edición: letras calculadas y proyecto replicado en todas las filas.
    const next = [record(1, { amount: '1000', letters: 'Mil pesos', project: 'NUEVO' }), record(2, { project: 'NUEVO' }), rows[2]]
    setCell(data, 1, 'project', { v: 'NUEVO' })
    const plan = planSheetUpdate(data, contract, { rows: next }, lastApplied)
    applyWrites(data, plan.writes)
    expect(cell(data, 1, 'amount')).toBe('1000')
    expect(cell(data, 1, 'letters')).toBe('Mil pesos')
    expect(cell(data, 2, 'project')).toBe('NUEVO')
    expect(Object.keys(plan.writes[1] ?? {}).map(Number)).toEqual([col('letters')])
  })

  it('moves read-only rows below the last record and clears the old ones', () => {
    const data = buildResultWorkbook(contract, rows)
    const next = [record(1), record(2), readonly('pair-only-350-7', '350-7'), readonly('pair-only-350-8', '350-8')]
    const plan = planSheetUpdate(data, contract, { rows: next }, viewValues(rows))
    applyWrites(data, plan.writes)
    expect(cell(data, 4, ID_COLUMN_KEY)).toBe(`${READONLY_ID_PREFIX}pair-only-350-7`)
    expect(cell(data, 5, 'fmi')).toBe('350-8')
    expect(plan.layout.readonly.map((r) => r.rowIndex)).toEqual([4, 5])

    // Un registro queda debajo (orden de la hoja): las de solo lectura bajan tras él.
    const cells = sheetOf(data).cellData!
    cells[8] = cells[2]
    delete cells[2]
    const moved = planSheetUpdate(data, contract, { rows: next }, viewValues(next))
    applyWrites(data, moved.writes)
    expect(moved.layout.readonly.map((r) => r.rowIndex)).toEqual([10, 11])
    expect(cell(data, 4, 'fmi')).toBe('')
  })

  it('decorates alerts by tone, tints error rows and summarizes them in the header', () => {
    const data = buildResultWorkbook(contract, rows)
    const plan = planSheetUpdate(data, contract, {
      rows,
      errorRows: new Set(['neg-row-2']),
      alerts: [
        { rowId: 'neg-row-1', columnKey: 'amount', severity: 'error', kind: 'missing_value', message: 'Falta el valor negociado.' },
        { rowId: 'neg-row-2', columnKey: 'amount', severity: 'warning', kind: 'missing', message: 'Sin dato.' },
        { rowId: 'pair-only-350-9', columnKey: 'status', severity: 'error', kind: 'pair_without_negotiation', message: 'Sin negociación.' },
      ],
    }, viewValues(rows), false)
    expect(plan.hasWrites).toBe(false)
    expect(plan.decorations.get(`1:${col('amount')}`)).toEqual({ tone: 'error', message: 'Falta el valor negociado.' })
    expect(plan.decorations.get(`2:${col('amount')}`)?.tone).toBe('missing')
    expect(plan.decorations.get(`2:${col('fmi')}`)?.tone).toBe('row-error')
    expect(plan.decorations.get(`4:${col('status')}`)?.tone).toBe('error')
    expect(plan.decorations.get(`0:${col('amount')}`)).toEqual({ tone: 'error', message: 'En esta columna: 2 casilla(s) sin dato.' })
  })
})

describe('plans linked to title studies', () => {
  const titleRows: EditableResultRow[] = [
    { id: 'title-row-1', folio: '350-1', owners: 'ANA PÉREZ', cadastralId: '73043000200020024000' },
    { id: 'title-row-2', folio: '350-2', owners: 'LUIS GÓMEZ', cadastralId: '73043000200020025000' },
  ]
  const plans: EditableResultRow[] = [
    { id: 'plan-row-1', planFolio: '350-1', planSourceDocument: 'Plano_A.pdf', planOwners: 'ANA PÉREZ' },
    { id: 'plan-row-2', planFolio: '350-99', planSourceDocument: 'Plano_B.pdf', planOwners: 'X' },
  ]
  const linkage = buildPlanTitleLinkage(plans, titleRows)
  const planContract: SheetContract = { title: 'Planos', columns: linkage.columns }

  it('lists studies without a plan as read-only rows and follows FMI edits', () => {
    const data = buildResultWorkbook(planContract, linkage.rows)
    const linkedCols = sheetColumnsOf(planContract)
    const at = (row: number, key: string) => cellText(sheetOf(data).cellData?.[row]?.[linkedCols.findIndex((c) => c.key === key)])
    expect(at(4, LINK_STATUS_KEY)).toBe('Estudio de títulos sin plano')
    expect(at(4, 't_folio')).toBe('350-2')

    // El revisor corrige el FMI del plano B: queda vinculado y ya no hay estudios sin plano.
    const fmiCol = linkedCols.findIndex((c) => c.key === 'planFolio')
    sheetOf(data).cellData![2][fmiCol] = { v: '350-2' }
    const read = readResultRows(data, planContract, linkage.rows)
    const relinked = buildPlanTitleLinkage(read.rows, titleRows)
    const plan = planSheetUpdate(data, planContract, { rows: relinked.rows }, viewValues(linkage.rows))
    applyWrites(data, plan.writes)
    expect(at(2, LINK_STATUS_KEY)).toBe('Vinculado por FMI')
    expect(at(2, 't_owners')).toBe('LUIS GÓMEZ')
    expect(at(4, LINK_STATUS_KEY)).toBe('')
    expect(plan.layout.readonly).toEqual([])
  })
})

describe('selection column', () => {
  const selectable: SheetContract = { title: 'Consolidado', columns: [SELECTION_COLUMN, ...columns] }
  const selCols = sheetColumnsOf(selectable)
  const at = (data: IWorkbookData, row: number, key: string) => cellText(sheetOf(data).cellData?.[row]?.[selCols.findIndex((c) => c.key === key)])

  it('goes first, frozen, with empty cells', () => {
    const data = buildResultWorkbook(selectable, rows)
    expect(at(data, 0, SELECTION_COLUMN_KEY)).toBe('Selección')
    expect(sheetOf(data).freeze).toEqual({ xSplit: 1, ySplit: 1, startRow: 1, startColumn: 1 })
    expect(at(data, 1, SELECTION_COLUMN_KEY)).toBe('')
  })

  it('clears anything pasted into it and tints selected rows', () => {
    const data = buildResultWorkbook(selectable, rows)
    sheetOf(data).cellData![2][0] = { v: 'x' }
    const plan = planSheetUpdate(data, selectable, { rows, selected: new Set(['neg-row-2']) }, viewValues(rows))
    expect(plan.writes[2]?.[0]).toMatchObject({ v: null })
    expect(plan.layout.selectionColumn).toBe(0)
    expect(plan.decorations.get('2:3')?.tone).toBe('selected')
    expect(plan.decorations.get('1:3')).toBeUndefined()
  })

  it('regenerates a saved file whose selection column is not in A, and refreezes it', () => {
    const moved = buildResultWorkbook(selectable, rows)
    const cells = sheetOf(moved).cellData!
    for (const line of Object.values(cells)) [line[0], line[1]] = [line[1], line[0]]
    expect(reconcileResultWorkbook(moved, selectable, rows).regenerated).toBe(true)

    const unfrozen = buildResultWorkbook(selectable, rows)
    sheetOf(unfrozen).freeze = { xSplit: 0, ySplit: 1, startRow: 1, startColumn: -1 }
    const { workbook, regenerated } = reconcileResultWorkbook(unfrozen, selectable, rows)
    expect(regenerated).toBe(false)
    expect(sheetOf(workbook).freeze).toEqual({ xSplit: 1, startColumn: 1, ySplit: 1, startRow: 1 })
  })

  it('keeps column A inside any freeze the reviewer chooses', () => {
    expect(freezeWithSelection({ xSplit: 3, startColumn: 3, ySplit: 1, startRow: 1 })).toBeNull()
    expect(freezeWithSelection({ xSplit: 0, startColumn: -1, ySplit: 2, startRow: 2 })).toEqual({ xSplit: 1, startColumn: 1, ySplit: 2, startRow: 2 })
    // Inmovilizar C:D dejaría A fuera: se extiende desde A.
    expect(freezeWithSelection({ xSplit: 2, startColumn: 4, ySplit: 0, startRow: -1 })).toEqual({ xSplit: 4, startColumn: 4, ySplit: 0, startRow: -1 })
  })
})
