import type { LucideIcon } from 'lucide-react'
import type {
  ExpedienteConsolidationStatus,
  ExpedienteGroupKey,
  ExpedienteGroupStatus,
} from '../../lib/expedienteWorkflow'

export type DocumentGroupKey = ExpedienteGroupKey
export type PrototypeGroupStatus = ExpedienteGroupStatus
export type PrototypeConsolidationStatus = ExpedienteConsolidationStatus
export type DetailView = 'summary' | 'extraction' | 'document'

export interface PrototypeFile {
  id: string
  name: string
  size: number
  extension: string
  /** Archivo local seleccionado; habilita la vista previa en el modo prototipo. */
  source?: File
}

export interface EditableResultRow {
  id: string
  [key: string]: string
}

export interface ResultColumn {
  key: string
  label: string
  editable?: boolean
  inputMode?: 'text' | 'numeric'
  width?: number
  /** Ejemplo visible dentro de la casilla vacía. */
  placeholder?: string
  /** Casilla obligatoria (se marca con * en el encabezado). */
  required?: boolean
  /** Puede quedar vacía sin señalarse como dato faltante (p. ej. una tercera oferta). */
  optional?: boolean
  /**
   * Columna fija en la A de la hoja de cálculo: casillas de selección de filas o un botón por
   * fila (p. ej. "Comparar"). Sus celdas quedan vacías en los datos.
   */
  kind?: 'selection' | 'action'
  /** Texto del botón de cada fila en una columna de acción. */
  actionLabel?: string
  /** Dato común a todas las filas: editarlo en una fila lo aplica a todas. */
  broadcast?: boolean
  /** Ayuda corta que se muestra al pasar sobre el encabezado. */
  hint?: string
  /** Formato aplicado mientras se escribe: 'pesos' → "$ 93.468.040". */
  liveFormat?: 'pesos'
}

export interface DocumentGroup {
  key: DocumentGroupKey
  label: string
  singularLabel: string
  description: string
  helper: string
  acceptedTypes: string
  icon: LucideIcon
  files: PrototypeFile[]
  status: PrototypeGroupStatus
  progress: number
  resultVersion: number
  updatedAt?: string
  error?: string
  columns: ResultColumn[]
  rows: EditableResultRow[]
}

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1_000))} KB`
  return `${(bytes / 1_000_000).toFixed(bytes >= 10_000_000 ? 0 : 1)} MB`
}

export const statusLabel = (status: PrototypeGroupStatus): string => ({
  empty: 'Sin archivos',
  ready: 'Listo para analizar',
  queued: 'En cola',
  processing: 'Procesando',
  review_ready: 'Listo para revisar',
  approved: 'Aprobado',
  stale: 'Requiere actualización',
  error: 'Requiere atención',
})[status]
