import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import type { IStyleData, IWorkbookData } from '@univerjs/presets'
import { excelWidthToPx, pxToExcelWidth, richTextToPlain, workbookDataToXlsx, xlsxToWorkbookData } from './univerXlsx'

const workbook: IWorkbookData = {
  id: 'libro',
  name: 'Prueba',
  appVersion: '1.0.3',
  locale: 'esES' as IWorkbookData['locale'],
  styles: {
    head: { bl: 1, fs: 12, cl: { rgb: '#1F3B2D' }, bg: { rgb: '#E3EEE7' }, ht: 2, vt: 2, tb: 3, bd: { b: { s: 8, cl: { rgb: '#FF0000' } } } } as IStyleData,
  },
  sheetOrder: ['s1', 's2'],
  sheets: {
    s1: {
      id: 's1',
      name: 'Estudio de Títulos',
      freeze: { xSplit: 0, ySplit: 1, startRow: 1, startColumn: 0 },
      showGridlines: 1,
      cellData: {
        0: { 0: { v: 'Folio', s: 'head' }, 1: { v: 'Área', s: 'head' }, 2: { v: 'Total', s: 'head' } },
        1: { 0: { v: '350-42578', t: 1 }, 1: { v: 12.5, t: 2, s: { n: { pattern: '0.00' } } as IStyleData }, 2: { f: '=B2*2', v: 25 } },
        2: { 0: { v: '73026000200130070000', t: 1 }, 1: { v: 7, t: 2 }, 2: { p: { id: 'd', body: { dataStream: 'línea 1\rlínea 2\r\n' } } as never } },
      },
      columnData: { 0: { w: 180, s: { n: { pattern: '@' } } }, 1: { w: 96, hd: 0 } },
      rowData: { 0: { h: 40 }, 2: { hd: 1 } },
      mergeData: [{ startRow: 4, startColumn: 0, endRow: 4, endColumn: 2 }],
    },
    s2: { id: 's2', name: 'Notas', cellData: { 0: { 0: { v: 'libre' } } } },
  },
}

describe('univer ↔ xlsx', () => {
  it('converts widths between pixels and Excel characters', () => {
    expect(pxToExcelWidth(excelWidthToPx(20))).toBeCloseTo(20, 1)
  })

  it('reads rich text as plain text with line breaks', () => {
    expect(richTextToPlain('línea 1\rlínea 2\r\n')).toBe('línea 1\nlínea 2')
  })

  it('round-trips values, formulas, styles, layout and sheets', async () => {
    const back = await xlsxToWorkbookData(await workbookDataToXlsx(workbook))
    expect(back.sheetOrder).toHaveLength(2)
    const [first, second] = back.sheetOrder.map((id) => back.sheets[id]!)
    expect(first.name).toBe('Estudio de Títulos')
    expect(second.name).toBe('Notas')
    expect(second.cellData?.[0]?.[0]?.v).toBe('libre')

    const cells = first.cellData!
    expect(cells[1][0].v).toBe('350-42578')
    // 20 dígitos guardados como texto: sin pérdida de precisión.
    expect(cells[2][0].v).toBe('73026000200130070000')
    expect(cells[1][1].v).toBe(12.5)
    expect((cells[1][1].s as IStyleData).n?.pattern).toBe('0.00')
    expect(cells[1][2].f).toBe('=B2*2')
    expect(cells[1][2].v).toBe(25)
    expect(cells[2][2].v).toBe('línea 1\nlínea 2')

    const head = cells[0][0].s as IStyleData
    expect(head.bl).toBe(1)
    expect(head.fs).toBe(12)
    expect(head.cl?.rgb).toBe('#1F3B2D')
    expect(head.bg?.rgb).toBe('#E3EEE7')
    expect(head.ht).toBe(2)
    expect(head.vt).toBe(2)
    expect(head.tb).toBe(3)
    expect(head.bd?.b).toEqual({ s: 8, cl: { rgb: '#FF0000' } })

    expect(first.freeze).toMatchObject({ xSplit: 0, ySplit: 1 })
    expect(first.columnData?.[0]?.w).toBeCloseTo(180, -1)
    expect((first.columnData?.[0]?.s as IStyleData | undefined)?.n?.pattern).toBe('@')
    expect(first.rowData?.[0]?.h).toBe(40)
    expect(first.rowData?.[2]?.hd).toBe(1)
    expect(first.mergeData).toEqual([{ startRow: 4, startColumn: 0, endRow: 4, endColumn: 2 }])
  })

  it('reads workbooks made in Excel: dates, booleans, rich text and shared formulas', async () => {
    const book = new ExcelJS.Workbook()
    const sheet = book.addWorksheet('Hoja1')
    sheet.getCell('A1').value = new Date(Date.UTC(2024, 9, 16))
    sheet.getCell('A1').numFmt = 'dd/mm/yyyy'
    sheet.getCell('B1').value = true
    sheet.getCell('C1').value = { richText: [{ text: 'Hola ' }, { text: 'mundo', font: { bold: true } }] }
    sheet.getCell('D1').value = 2
    sheet.getCell('D2').value = 3
    sheet.getCell('E1').value = { formula: 'D1*10', result: 20 }
    sheet.getCell('E2').value = { sharedFormula: 'E1', result: 30 }
    const data = await xlsxToWorkbookData(new Uint8Array(await book.xlsx.writeBuffer() as ArrayBuffer))
    const cells = data.sheets[data.sheetOrder[0]]!.cellData!
    expect(cells[0][0].v).toBe(45581)
    expect((cells[0][0].s as IStyleData).n?.pattern).toBe('dd/mm/yyyy')
    expect(cells[0][1]).toMatchObject({ v: 'TRUE', t: 3 })
    expect(cells[0][2].v).toBe('Hola mundo')
    expect(cells[0][4]).toMatchObject({ f: '=D1*10', v: 20 })
    expect(cells[1][4]).toMatchObject({ f: '=D2*10', v: 30 })
  })
})
