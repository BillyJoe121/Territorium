import type { ReactNode } from 'react'
import type { ValidationNotice } from '../../lib/expedienteResultAdapters'
import type { LinkedPair } from '../../lib/negotiationLinking'
import type { CellAlert } from './ResultDataTable'
import type { ResultSpreadsheetSource } from './ResultSpreadsheet'
import type { DocumentGroup, DocumentGroupKey, EditableResultRow } from './types'

export interface RowAlert extends CellAlert {
  rowId: string
  columnKey: string
}

export interface ReviewToolbarContext {
  /** Filas vigentes de la hoja (incluye cambios aún sin guardar). */
  rows: EditableResultRow[]
  /** Filas marcadas en la columna Selección. */
  selectedIds: Set<string>
  /** Filas con casillas en rojo y el motivo. */
  blockedRows: Map<string, string>
  clearSelection: () => void
}

/** Botón por fila en una columna fija (p. ej. "Comparar" en planos) que abre una vista propia. */
export interface ReviewRowAction {
  columnLabel: string
  buttonLabel: string
  /** Motivo por el que la fila no tiene el botón, o null si lo tiene. */
  unavailableReason: (row: EditableResultRow) => string | null
  /** Vista que reemplaza la hoja dentro del mismo modal; la flecha de la derecha vuelve a la hoja. */
  renderPanel: (row: EditableResultRow) => { title: string; content: ReactNode }
}

export interface ReviewDialogProps {
  open: boolean
  title: string
  description: string
  version: number
  rows: EditableResultRow[]
  columns: DocumentGroup['columns']
  /** Texto del botón de aprobar (los modales con `editLock` no aprueban). */
  approveLabel?: string
  groupKey?: DocumentGroupKey | 'consolidated'
  isApproved?: boolean
  validationNotices?: ValidationNotice[]
  /**
   * Planos: filas aprobadas del estudio de títulos. Con ellas la tabla resultante
   * es la suma plano + estudio, vinculada por FMI y con alertas por casilla.
   */
  linkedTitleRows?: EditableResultRow[]
  /** Negociación: parejas estudio ↔ plano aprobadas, para vincular cada fila por FMI. */
  linkedPairs?: LinkedPair[]
  /** Motivo externo que impide aprobar (p. ej. estudio de títulos no aprobado). */
  approvalBlockedReason?: string | null
  /** Recalcula columnas derivadas de una fila tras cada edición. */
  deriveRow?: (row: EditableResultRow) => EditableResultRow
  /** Contenido adicional sobre la tabla (p. ej. resumen de exclusiones). */
  headerPanel?: ReactNode
  /** Resumen corto en la línea del título (p. ej. predios consolidados y excluidos). */
  headerMeta?: ReactNode
  /** Validaciones por casilla propias del modal; los errores bloquean la aprobación. */
  validateRows?: (rows: EditableResultRow[]) => RowAlert[]
  onOpenChange: (open: boolean) => void
  onSave: (rows: EditableResultRow[]) => Promise<void> | void
  onApprove?: (rows: EditableResultRow[]) => void
  /**
   * Guardar y proteger el archivo en lugar de aprobarlo: "Guardar cambios" guarda y bloquea la
   * edición; "Editar" la vuelve a habilitar. El bloqueo se puede alternar las veces que se quiera.
   */
  editLock?: {
    locked: boolean
    onSave: (rows: EditableResultRow[]) => Promise<void>
    onEdit: () => Promise<void>
  }
  onReprocess?: () => void
  /** Descarga el Excel oficial con las filas indicadas (las vigentes, ya guardadas). */
  onDownloadExcel?: (rows: EditableResultRow[]) => void
  /**
   * Hoja de cálculo con autoguardado como único guardado: sin botón "Guardar borrador"; aprobar
   * y descargar el Excel guardan antes lo pendiente.
   */
  autosaveOnly?: boolean
  /**
   * Edición en hoja de cálculo (Univer) en lugar de la tabla: el archivo .xlsx se carga y se
   * sobreescribe con esta fuente, y sus filas se guardan con onSave como siempre.
   */
  spreadsheet?: ResultSpreadsheetSource
  /** Hoja de cálculo: columna "Selección" (casillas) inmovilizada en la columna A. */
  selectable?: boolean
  /** Controles en el pie del modal (p. ej. generar documentos) con las filas vigentes y las marcadas. */
  renderToolbar?: (context: ReviewToolbarContext) => ReactNode
  /** Panel plegable a la derecha del modal, p. ej. los documentos generados. */
  sidePanel?: ReactNode
  /** Nombre del panel lateral para el botón que lo muestra u oculta. */
  sidePanelLabel?: string
  /** Hoja de cálculo: columna fija con un botón por fila (disponible también si está aprobada). */
  rowAction?: ReviewRowAction
}
