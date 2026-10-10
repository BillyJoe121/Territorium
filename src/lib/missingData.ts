/**
 * Casillas sin dato en una tabla de resultados: vacías o con los marcadores que usa la extracción
 * cuando no encuentra el dato ("no identificado", "—", "N/A"…). Se señalan como advertencia en
 * las columnas editables de cada registro; las columnas opcionales y las filas de solo lectura
 * no cuentan. Las reglas que bloquean la aprobación (p. ej. el valor negociado) viven en su cotejo.
 */
import type { EditableResultRow, ResultColumn } from '../components/expediente/types'
import { isEmptyValue, READONLY_ROW_FLAG } from './planTitleLinking'

export interface MissingDataAlert {
  rowId: string
  columnKey: string
  severity: 'warning'
  kind: 'missing'
  message: string
}

export function missingDataAlerts(rows: EditableResultRow[], columns: ResultColumn[]): MissingDataAlert[] {
  const expected = columns.filter((column) => column.editable !== false && !column.optional)
  const alerts: MissingDataAlert[] = []
  for (const row of rows) {
    if (row[READONLY_ROW_FLAG] === 'true') continue
    for (const column of expected) {
      if (!isEmptyValue(row[column.key])) continue
      alerts.push({
        rowId: row.id,
        columnKey: column.key,
        severity: 'warning',
        kind: 'missing',
        message: column.required ? `${column.label}: dato obligatorio sin diligenciar.` : `${column.label}: sin dato.`,
      })
    }
  }
  return alerts
}
