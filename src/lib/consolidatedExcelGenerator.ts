import writeXlsxFile,{ type Cell } from 'write-excel-file/browser'
import { CORRESPONDENCIA_COLUMNS, parseDecimal } from './correspondencia'

function safeCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return /^[=+\-@]/.test(text) ? `'${text}` : text
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
