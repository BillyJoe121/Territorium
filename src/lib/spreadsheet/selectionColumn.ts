/**
 * Columna de casillas para seleccionar filas de la hoja (p. ej. para generar documentos). Va
 * siempre en la columna A e inmovilizada; sus celdas quedan vacías en los datos y la marca se
 * dibuja en pantalla. Módulo aparte para no cargar el conversor de Excel en el paquete principal.
 */
import type { ResultColumn } from '../../components/expediente/types'

export const SELECTION_COLUMN_KEY = '__select'
export const SELECTION_COLUMN: ResultColumn = { key: SELECTION_COLUMN_KEY, label: 'Selección', editable: false, width: 92, kind: 'selection' }

/** Columna fija con un botón por fila (p. ej. "Comparador" → "Comparar"). */
export const ACTION_COLUMN_KEY = '__action'
export function actionColumn(label: string, actionLabel: string): ResultColumn {
  return { key: ACTION_COLUMN_KEY, label, editable: false, width: 112, kind: 'action', actionLabel }
}
