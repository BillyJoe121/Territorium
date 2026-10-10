import type { SheetView } from '../../lib/spreadsheet/resultSheet'
import type { EditableResultRow, ResultColumn } from './types'

export interface ResultSpreadsheetSource {
  /** Nombre de la hoja de datos y del libro. */
  sheetName: string
  /** Nombre del archivo al descargarlo. */
  fileName: string
  /** Columna visible que identifica cada registro; sin ella se usa una columna oculta de ID. */
  keyColumn?: string
  /** Archivo guardado, o null si aún no existe. */
  load: () => Promise<Blob | null>
  /** Sobreescribe el archivo guardado. */
  save: (file: Blob) => Promise<void>
}

export interface ResultSpreadsheetSnapshot {
  rows: EditableResultRow[]
  errors: string[]
  file: Blob
  fingerprint: string
}

export interface ResultSpreadsheetHandle {
  /** Filas y archivo del estado actual. commitEditing cierra antes la celda en edición. */
  collect: (options?: { commitEditing?: boolean }) => Promise<ResultSpreadsheetSnapshot>
  /** La celda sigue en edición: el autoguardado espera a que termine. */
  isEditing: () => boolean
  /** El estado con esta huella quedó guardado. */
  markSaved: (fingerprint: string) => void
  /** Selecciona y muestra la casilla de un registro (p. ej. desde el panel de alertas). */
  focusCell: (rowId: string, columnKey: string) => void
}

export interface ResultSpreadsheetProps {
  source: ResultSpreadsheetSource
  /** Columnas que muestra la hoja (las del cotejo cuando lo hay). */
  columns: ResultColumn[]
  /** Filas, alertas y filas teñidas que calcula la revisión. */
  view: SheetView
  readOnly: boolean
  /** Tras cada edición: si el libro difiere de lo guardado. */
  onChange: (dirty: boolean) => void
  /** Tras cada edición: registros leídos de la hoja, o los errores que impiden leerlos. */
  onRowsChange: (rows: EditableResultRow[], errors: string[]) => void
  /** Valores que se completan mientras se escribe en una columna (p. ej. el valor en letras). */
  liveDerive?: (columnKey: string, text: string) => Record<string, string> | null
  /** Con columna Selección: nuevas filas marcadas tras un clic en una casilla o en el encabezado. */
  onSelectionChange?: (selected: Set<string>) => void
  /** Columna de acción: clic (o Enter/Espacio) en el botón de un registro. */
  onAction?: (rowId: string) => void
  /** Dónde mostrar el resumen de casillas resaltadas (p. ej. junto al título del modal). */
  legendContainer?: HTMLElement | null
  /** Aviso al intentar escribir con la hoja en solo lectura (p. ej. "Pulsa Editar…"). */
  readOnlyHint?: string
}
