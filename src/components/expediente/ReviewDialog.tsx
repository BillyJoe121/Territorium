import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight, Download, LoaderCircle, Lock, PencilLine, RefreshCcw, Save, X } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cellAlertKey, ResultDataTable, type CellAlert } from './ResultDataTable'
import type { ResultSpreadsheetHandle, ResultSpreadsheetSource, SheetView } from './ResultSpreadsheet'
import { NegotiationLinkagePanel, PlanLinkagePanel } from './PlanLinkagePanel'
import type { ValidationNotice } from '../../lib/expedienteResultAdapters'
import { buildNegotiationLinkage, deriveNegotiationRow, negotiationAlertCount, type LinkedPair } from '../../lib/negotiationLinking'
import {
  buildPlanTitleLinkage,
  linkageAlertCount,
  READONLY_ROW_FLAG,
} from '../../lib/planTitleLinking'
import { downloadBlob } from '../../lib/download'
import { missingDataAlerts } from '../../lib/missingData'
import { actionColumn, SELECTION_COLUMN } from '../../lib/spreadsheet/selectionColumn'
import { negotiatedValueLetters } from '../../lib/negotiatedValue'
import type { DocumentGroup, DocumentGroupKey, EditableResultRow } from './types'

// Univer y ExcelJS pesan varios MB: se descargan solo al abrir un modal con hoja de cálculo.
const ResultSpreadsheet = lazy(() => import('./ResultSpreadsheet'))
const SHEET_AUTOSAVE_MS = 2000

const cloneRows = (rows: EditableResultRow[]) => rows.map((row) => ({ ...row }))

/** Ofertas cuyo cambio obliga a revisar de nuevo si números y letras coinciden. */
const NEGOTIATION_OFFER_FIELDS = ['firstOfferNumbers', 'firstOfferLetters', 'secondOfferNumbers', 'secondOfferLetters']
/** Filas que se tiñen completas: no tienen pareja en el cotejo. */
const ORPHAN_KINDS = new Set(['plan_without_title', 'negotiation_without_pair'])

/** Negociación: el valor en letras se escribe solo mientras se digitan los números. */
const negotiationLiveDerive = (columnKey: string, text: string) =>
  columnKey === 'negotiatedValueNumbers' ? { negotiatedValueLetters: negotiatedValueLetters(text) } : null

/**
 * Borrador editable a partir de las filas guardadas. En negociación las letras se redactan
 * desde los números, también en borradores antiguos escritos a mano; una versión aprobada
 * se muestra tal cual se aprobó.
 */
const draftFrom = (rows: EditableResultRow[], groupKey: ReviewDialogProps['groupKey'], isApproved: boolean) =>
  groupKey === 'negotiation' && !isApproved ? rows.map(deriveNegotiationRow) : cloneRows(rows)

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

export function ReviewDialog({
  open,
  title,
  description,
  version,
  rows,
  columns,
  approveLabel,
  isApproved = false,
  validationNotices = [],
  groupKey,
  linkedTitleRows,
  linkedPairs,
  approvalBlockedReason = null,
  deriveRow,
  headerPanel,
  headerMeta,
  validateRows,
  onOpenChange,
  onSave,
  onApprove,
  editLock,
  onReprocess,
  onDownloadExcel,
  autosaveOnly = false,
  spreadsheet,
  selectable = false,
  renderToolbar,
  sidePanel,
  sidePanelLabel = 'panel lateral',
  rowAction,
}: ReviewDialogProps) {
  const [draft, setDraft] = useState(() => draftFrom(rows, groupKey, isApproved))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [conflictError, setConflictError] = useState<string | null>(null)
  const [showDiscard, setShowDiscard] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [alertsAcknowledged, setAlertsAcknowledged] = useState(false)
  const saveTimeoutRef = useRef<number | null>(null)
  const sheetMode = Boolean(spreadsheet)
  const sheetRef = useRef<ResultSpreadsheetHandle>(null)
  const [sheetErrors, setSheetErrors] = useState<string[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [sheetKey, setSheetKey] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [actionRowId, setActionRowId] = useState<string | null>(null)
  const [sideCollapsed, setSideCollapsed] = useState(false)
  const [lockBusy, setLockBusy] = useState(false)
  // Solo lectura: versión aprobada o edición bloqueada con "Guardar cambios".
  const locked = isApproved || Boolean(editLock?.locked)
  // La hoja muestra su resumen de casillas resaltadas en la línea del título.
  const [legendSlot, setLegendSlot] = useState<HTMLDivElement | null>(null)

  // Los datos se cargan al abrir el modal. Mientras está abierto, el borrador manda: si el
  // autoguardado devuelve una versión anterior, no debe pisar lo que se sigue escribiendo.
  const loadedOnOpenRef = useRef(false)
  useEffect(() => {
    if (!open) {
      loadedOnOpenRef.current = false
      return
    }
    if (loadedOnOpenRef.current) return
    loadedOnOpenRef.current = true
    setDraft(draftFrom(rows, groupKey, isApproved))
    setDirty(false)
    setSaving(false)
    setConflictError(null)
    setShowDiscard(false)
    setLastSaved(null)
    setAlertsAcknowledged(false)
    setSheetErrors([])
    setFileError(null)
    setSelectedIds(new Set())
    setActionRowId(null)
  }, [open, rows, groupKey, isApproved])

  const planLinkage = useMemo(
    () => (groupKey === 'plans' && linkedTitleRows ? buildPlanTitleLinkage(draft, linkedTitleRows) : null),
    [draft, groupKey, linkedTitleRows],
  )
  const negotiationLinkage = useMemo(
    () => (groupKey === 'negotiation' && linkedPairs ? buildNegotiationLinkage(draft, linkedPairs) : null),
    [draft, groupKey, linkedPairs],
  )
  const linkage = planLinkage ?? negotiationLinkage
  // El valor negociado faltante bloquea; las demás alertas se aprueban bajo confirmación.
  const missingNegotiated = negotiationLinkage?.summary.missingValues ?? 0
  const linkageAlerts = planLinkage
    ? linkageAlertCount(planLinkage.summary)
    : negotiationLinkage ? negotiationAlertCount(negotiationLinkage.summary) - missingNegotiated : 0
  const rowAlerts = useMemo(() => (validateRows ? validateRows(draft) : []), [draft, validateRows])
  const rowAlertErrors = rowAlerts.filter((alert) => alert.severity === 'error').length
  // Filas y columnas que se muestran: las del cotejo cuando lo hay.
  const displayRows = linkage ? linkage.rows : draft
  const displayColumns = useMemo(() => {
    const base = linkage ? linkage.columns : columns
    const shown = isApproved ? base.map((col) => ({ ...col, editable: false })) : base
    if (sheetMode && rowAction) return [actionColumn(rowAction.columnLabel, rowAction.buttonLabel), ...shown]
    return sheetMode && selectable ? [SELECTION_COLUMN, ...shown] : shown
  }, [linkage, columns, isApproved, sheetMode, selectable, rowAction?.columnLabel, rowAction?.buttonLabel])
  // Alertas por casilla: cotejo, validaciones propias y datos faltantes (en ese orden de prioridad).
  const mergedAlerts = useMemo(() => {
    const byCell = new Map<string, RowAlert>()
    const all = [
      ...((linkage?.alerts ?? []) as RowAlert[]),
      ...rowAlerts,
      ...missingDataAlerts(displayRows, linkage ? linkage.columns : columns),
    ]
    for (const alert of all) {
      const key = cellAlertKey(alert.rowId, alert.columnKey)
      // Un error prevalece sobre una advertencia en la misma casilla.
      if (!byCell.has(key) || (alert.severity === 'error' && byCell.get(key)!.severity !== 'error')) byCell.set(key, alert)
    }
    return byCell
  }, [linkage, rowAlerts, displayRows, columns])
  const cellAlerts = useMemo(() => (mergedAlerts.size ? mergedAlerts as Map<string, CellAlert> : undefined), [mergedAlerts])
  const sheetView = useMemo<SheetView>(() => ({
    rows: displayRows,
    alerts: [...mergedAlerts.values()],
    errorRows: new Set((linkage?.alerts ?? []).filter((alert) => ORPHAN_KINDS.has(alert.kind)).map((alert) => alert.rowId)),
    selected: selectedIds,
    actions: rowAction
      ? new Map(displayRows.filter((row) => row[READONLY_ROW_FLAG] !== 'true').map((row) => [row.id, rowAction.unavailableReason(row)]))
      : undefined,
  }), [displayRows, mergedAlerts, linkage, selectedIds, rowAction])
  // Vista de la acción abierta (p. ej. el comparador de un plano), en lugar de la hoja.
  const actionRow = actionRowId ? displayRows.find((row) => row.id === actionRowId) : undefined
  const actionPanel = useMemo(
    () => (actionRow && rowAction ? rowAction.renderPanel(actionRow) : null),
    // Se arma al abrir la fila; las ediciones de la hoja no la reinician.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actionRowId, rowAction],
  )
  const blockedRows = useMemo(() => {
    const blocked = new Map<string, string>()
    for (const alert of mergedAlerts.values()) {
      if (alert.severity === 'error' && !blocked.has(alert.rowId)) blocked.set(alert.rowId, alert.message)
    }
    return blocked
  }, [mergedAlerts])
  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const approvalBlocker = approvalBlockedReason
    ?? (rowAlertErrors > 0 ? `Corrige las ${rowAlertErrors} casilla(s) marcadas en rojo antes de aprobar.` : null)
    ?? (missingNegotiated > 0 ? `Falta el valor negociado válido (números y letras que coincidan) en ${missingNegotiated} fila(s).` : null)
    ?? (linkageAlerts > 0 && !alertsAcknowledged ? 'Confirma que revisaste las alertas del cotejo antes de aprobar.' : null)

  const hasBlockingErrors = useMemo(
    () => validationNotices.some((notice) => notice.severity === 'error'),
    [validationNotices],
  )

  const close = () => {
    if (dirty) {
      setShowDiscard(true)
      return
    }
    onOpenChange(false)
  }

  const triggerSave = useCallback(async (rowsToSave: EditableResultRow[]) => {
    setSaving(true)
    try {
      await onSave(rowsToSave)
      setDirty(false)
      setSaving(false)
      setLastSaved(new Intl.DateTimeFormat('es-CO', { timeStyle: 'medium' }).format(new Date()))
    } catch (err: any) {
      setSaving(false)
      if (err?.name === 'EditConflictError' || err?.message?.includes('Conflicto')) {
        setConflictError(err.message)
      }
    }
  }, [onSave])

  const isApprovedRef = useRef(locked)
  isApprovedRef.current = locked
  const columnsRef = useRef(columns)
  columnsRef.current = columns
  const deriveRef = useRef(deriveRow)
  deriveRef.current = deriveRow
  const groupKeyRef = useRef(groupKey)
  groupKeyRef.current = groupKey

  /** Una edición con las mismas reglas en tabla y hoja: datos comunes, ofertas, letras y derivados. */
  const applyCellEdit = useCallback((rows: EditableResultRow[], rowId: string, key: string, value: string) => {
    const hasNegotiationComparison = columnsRef.current.some((column) => column.key === 'valuesMatch')
    // Columnas comunes (datos del proyecto): editar una fila actualiza todas.
    const broadcast = columnsRef.current.some((column) => column.key === key && column.broadcast)
    return rows.map((row) => {
      if (row.id !== rowId && !broadcast) return row
      let nextRow = { ...row, [key]: value }
      if (hasNegotiationComparison && NEGOTIATION_OFFER_FIELDS.includes(key)) nextRow = { ...nextRow, valuesMatch: 'Requiere revisión' }
      if (groupKeyRef.current === 'negotiation' && key === 'negotiatedValueNumbers') nextRow = deriveNegotiationRow(nextRow)
      return deriveRef.current ? deriveRef.current(nextRow) : nextRow
    })
  }, [])

  /** Lleva al borrador lo que cambió en la hoja (comparado con el borrador antes de aplicar nada). */
  const displayColumnsRef = useRef(displayColumns)
  displayColumnsRef.current = displayColumns
  const applySheetRows = useCallback((current: EditableResultRow[], sheetRows: EditableResultRow[]) => {
    const editable = displayColumnsRef.current.filter((column) => column.editable !== false).map((column) => column.key)
    const byId = new Map(current.map((row) => [row.id, row]))
    const changes: [string, string, string][] = []
    for (const sheetRow of sheetRows) {
      const before = byId.get(sheetRow.id)
      if (!before) continue
      for (const key of editable) {
        if (key in sheetRow && String(sheetRow[key] ?? '') !== String(before[key] ?? '')) changes.push([sheetRow.id, key, String(sheetRow[key] ?? '')])
      }
    }
    return changes.reduce((rows, [rowId, key, value]) => applyCellEdit(rows, rowId, key, value), current)
  }, [applyCellEdit])

  const updateCell = useCallback((rowId: string, key: string, value: string) => {
    if (isApprovedRef.current) return
    setDraft((currentDraft) => {
      const nextDraft = applyCellEdit(currentDraft, rowId, key, value)

      // Debounced autosave (HU-V2-043)
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = window.setTimeout(() => {
        void triggerSave(nextDraft)
      }, 1200)

      return nextDraft
    })
    setDirty(true)
  }, [triggerSave, applyCellEdit])

  // Hoja de cálculo: hoja → filas (contrato) → onSave (base de datos primero) → .xlsx a Storage.
  const spreadsheetRef = useRef(spreadsheet)
  spreadsheetRef.current = spreadsheet
  const sheetSavingRef = useRef(false)
  const scheduleSheetSaveRef = useRef<() => void>(() => {})
  const draftRef = useRef(draft)
  draftRef.current = draft

  /** Guarda la hoja. Devuelve las filas guardadas, o null si no se guardó. */
  const saveSheet = useCallback(async (manual: boolean): Promise<EditableResultRow[] | null> => {
    const sheet = sheetRef.current
    const source = spreadsheetRef.current
    if (!sheet || !source || isApprovedRef.current) return null
    // Sin interrumpir a quien escribe: el autoguardado espera a que cierre la celda.
    if (sheetSavingRef.current || (!manual && sheet.isEditing())) {
      scheduleSheetSaveRef.current()
      return null
    }
    sheetSavingRef.current = true
    setSaving(true)
    try {
      const snapshot = await sheet.collect({ commitEditing: manual })
      if (snapshot.errors.length) {
        setSheetErrors(snapshot.errors)
        return null
      }
      setSheetErrors([])
      // Las filas de la hoja pasan por las mismas reglas que una edición en la tabla.
      const nextDraft = applySheetRows(draftRef.current, snapshot.rows)
      await onSave(nextDraft)
      setDraft(nextDraft)
      try {
        await source.save(snapshot.file)
        setFileError(null)
      } catch (error) {
        setFileError(`Los datos quedaron guardados, pero el archivo Excel no se actualizó. ${error instanceof Error ? error.message : ''}`.trim())
      }
      sheet.markSaved(snapshot.fingerprint)
      setLastSaved(new Intl.DateTimeFormat('es-CO', { timeStyle: 'medium' }).format(new Date()))
      return nextDraft
    } catch (err: any) {
      if (err?.name === 'EditConflictError' || err?.message?.includes('Conflicto')) setConflictError(err.message)
      else setSheetErrors([err?.message ?? 'No se pudo guardar la hoja de cálculo.'])
      return null
    } finally {
      sheetSavingRef.current = false
      setSaving(false)
    }
  }, [onSave, applySheetRows])

  scheduleSheetSaveRef.current = () => {
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = window.setTimeout(() => void saveSheet(false), SHEET_AUTOSAVE_MS)
  }

  const handleSheetChange = useCallback((nextDirty: boolean) => {
    if (isApprovedRef.current) return
    setDirty(nextDirty)
    if (nextDirty) {
      scheduleSheetSaveRef.current()
      return
    }
    // De vuelta a lo guardado (p. ej. con deshacer): ya no hay nada que corregir ni guardar.
    setSheetErrors([])
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
  }, [])

  // Lo que escribe el revisor en la hoja llega al borrador: el cotejo, las letras y las alertas
  // se recalculan y vuelven a la hoja como vista.
  const handleSheetRows = useCallback((sheetRows: EditableResultRow[], errors: string[]) => {
    setSheetErrors(errors)
    if (errors.length || isApprovedRef.current) return
    setDraft((current) => applySheetRows(current, sheetRows))
  }, [applySheetRows])

  const focusAlert = useCallback((rowId: string, columnKey: string) => {
    sheetRef.current?.focusCell(rowId, columnKey)
  }, [])

  const downloadSheet = async () => {
    const snapshot = await sheetRef.current?.collect({ commitEditing: true })
    if (snapshot && spreadsheet) downloadBlob(snapshot.file, spreadsheet.fileName)
  }

  const saveManual = async () => {
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    if (sheetMode) await saveSheet(true)
    else await triggerSave(draft)
  }

  /**
   * Con autoguardado como único guardado: guarda ya lo pendiente (incluida la celda que se está
   * escribiendo) y devuelve las filas vigentes; null si la hoja tiene errores o no se pudo guardar.
   */
  const flushPendingSheet = async (): Promise<EditableResultRow[] | null> => {
    if (!sheetMode || !sheetRef.current) return draftRef.current
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    while (sheetSavingRef.current) await new Promise((resolve) => window.setTimeout(resolve, 100))
    if (!dirty && !sheetRef.current.isEditing()) return draftRef.current
    return saveSheet(true)
  }

  /** "Guardar cambios": guarda lo pendiente y bloquea la edición. */
  const handleSaveAndLock = async () => {
    if (!editLock || saving || lockBusy) return
    setLockBusy(true)
    try {
      const saved = autosaveOnly ? await flushPendingSheet() : draft
      if (saved) await editLock.onSave(saved)
    } finally {
      setLockBusy(false)
    }
  }

  /** "Editar": vuelve a habilitar la edición. */
  const handleEdit = async () => {
    if (!editLock || lockBusy) return
    setLockBusy(true)
    try {
      await editLock.onEdit()
    } finally {
      setLockBusy(false)
    }
  }

  const handleApprove = async () => {
    if (!onApprove || hasBlockingErrors || saving || approvalBlocker || (dirty && !autosaveOnly)) return
    let approvedRows = draft
    if (autosaveOnly) {
      const saved = await flushPendingSheet()
      // Lo recién escrito puede dejar casillas en rojo: la hoja ya las muestra y no se aprueba.
      if (!saved || validateRows?.(saved).some((alert) => alert.severity === 'error')) return
      approvedRows = saved
    }
    onApprove(approvedRows)
  }

  const handleDownloadExcel = async () => {
    if (!onDownloadExcel) return
    const rowsToExport = autosaveOnly && !locked ? await flushPendingSheet() : draft
    if (rowsToExport) onDownloadExcel(rowsToExport)
  }

  const handleReloadServer = () => {
    setDraft(draftFrom(rows, groupKey, isApproved))
    setConflictError(null)
    setDirty(false)
    // La hoja se vuelve a abrir desde el archivo y las filas guardadas.
    setSheetKey((key) => key + 1)
  }

  // Los menús de Univer se montan en <body>: en modo hoja el diálogo no es modal para Radix
  // (si lo fuera, bloquearía sus clics y su foco) y no se cierra por interacciones externas.
  const insideSheet = (node: EventTarget | Element | null) =>
    node instanceof Element && Boolean(node.closest('.result-spreadsheet, [class*="univer-"]'))

  const effectiveColumns = useMemo(() => {
    if (!isApproved) return columns
    return columns.map((col) => ({ ...col, editable: false }))
  }, [columns, isApproved])

  return (
    <Dialog.Root open={open} modal={!sheetMode} onOpenChange={(nextOpen) => { if (!nextOpen) close() }}>
      <Dialog.Portal>
        {sheetMode ? <div className="expediente-modal-overlay" aria-hidden="true" /> : <Dialog.Overlay className="expediente-modal-overlay" />}
        <Dialog.Content
          className={`expediente-review-modal expediente-results-modal${sheetMode ? ' has-spreadsheet' : ''}${actionPanel ? ' is-action-panel' : ''}`}
          aria-describedby="expediente-review-description"
          onInteractOutside={sheetMode ? (event) => event.preventDefault() : undefined}
          onEscapeKeyDown={sheetMode ? (event) => {
            // En la vista de la acción, Escape vuelve a la hoja.
            if (actionPanel) {
              event.preventDefault()
              setActionRowId(null)
            } else if (insideSheet(document.activeElement)) event.preventDefault()
          } : undefined}
        >
          <header className="expediente-modal-header">
            <div className="review-header-main">
              <Dialog.Title>{actionPanel ? actionPanel.title : title}</Dialog.Title>
              {!actionPanel && headerMeta}
              <div ref={setLegendSlot} className="review-header-legend" hidden={Boolean(actionPanel)} />
              {/* Solo para lectores de pantalla: el espacio visible es para la tabla. */}
              <Dialog.Description id="expediente-review-description" className="sr-only">
                {description} Versión {version}{isApproved ? ', aprobada y en solo lectura.' : '.'}
              </Dialog.Description>
            </div>
            {actionPanel ? (
              <button type="button" className="expediente-modal-close" onClick={() => setActionRowId(null)} aria-label="Volver a la tabla" title="Volver a la tabla"><ArrowLeft size={18} /></button>
            ) : (
              <button type="button" className="expediente-modal-close" onClick={close} aria-label="Cerrar revisión"><X size={18} /></button>
            )}
          </header>

          <div className={`expediente-modal-body${sidePanel ? ' has-side-panel' : ''}`}>
            <div className="review-main">
              {conflictError && (
                <div className="expediente-conflict-banner" role="alert">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={15} />
                    <span>{conflictError}</span>
                  </div>
                  <button type="button" onClick={handleReloadServer}>Recargar datos más recientes</button>
                </div>
              )}
              {planLinkage && <PlanLinkagePanel linkage={planLinkage} onSelectAlert={sheetMode ? focusAlert : undefined} />}
              {negotiationLinkage && <NegotiationLinkagePanel linkage={negotiationLinkage} onSelectAlert={sheetMode ? focusAlert : undefined} />}
              {headerPanel}
              {sheetErrors.length > 0 && (
                <div className="result-spreadsheet-errors" role="alert">
                  <strong>No se guardó: corrige la hoja de cálculo</strong>
                  <ul>
                    {sheetErrors.slice(0, 6).map((message) => <li key={message}>{message}</li>)}
                  </ul>
                  {sheetErrors.length > 6 && <span>Y {sheetErrors.length - 6} problema(s) más.</span>}
                </div>
              )}
              {fileError && (
                <div className="expediente-conflict-banner" role="alert">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={15} />
                    <span>{fileError}</span>
                  </div>
                </div>
              )}
              {spreadsheet ? (
                <Suspense
                  fallback={(
                    <div className="result-spreadsheet-loading is-static" role="status">
                      <LoaderCircle size={18} className="spin" aria-hidden="true" />
                      <span>Cargando editor de hoja de cálculo…</span>
                    </div>
                  )}
                >
                  <ResultSpreadsheet
                    key={sheetKey}
                    ref={sheetRef}
                    source={spreadsheet}
                    columns={displayColumns}
                    view={sheetView}
                    readOnly={locked}
                    readOnlyHint={editLock?.locked ? 'La edición está bloqueada. Pulsa "Editar" para modificar el consolidado.' : 'Esta versión está aprobada y es de solo lectura.'}
                    onChange={handleSheetChange}
                    onRowsChange={handleSheetRows}
                    liveDerive={groupKey === 'negotiation' ? negotiationLiveDerive : undefined}
                    onSelectionChange={selectable ? setSelectedIds : undefined}
                    onAction={rowAction ? setActionRowId : undefined}
                    legendContainer={legendSlot}
                  />
                </Suspense>
              ) : (
                <ResultDataTable
                  caption={`Resultados de ${title}`}
                  columns={linkage ? (isApproved ? linkage.columns.map((col) => ({ ...col, editable: false })) : linkage.columns) : effectiveColumns}
                  rows={linkage ? linkage.rows : draft}
                  validationNotices={validationNotices}
                  cellAlerts={cellAlerts}
                  rowClassName={linkage ? (row) => {
                    if (row[READONLY_ROW_FLAG] === 'true') return 'linkage-row-orphan'
                    return (linkage.alerts as { rowId: string; kind: string }[]).some((alert) => alert.rowId === row.id && (alert.kind === 'plan_without_title' || alert.kind === 'negotiation_without_pair'))
                      ? 'linkage-row-orphan'
                      : undefined
                  } : undefined}
                  onChange={updateCell}
                />
              )}
            </div>
            {sidePanel && (
              <aside className={`review-side${sideCollapsed ? ' is-collapsed' : ''}`}>
                <button
                  type="button"
                  className="review-side-toggle"
                  aria-expanded={!sideCollapsed}
                  aria-controls="review-side-content"
                  aria-label={sideCollapsed ? `Mostrar ${sidePanelLabel}` : `Ocultar ${sidePanelLabel}`}
                  title={sideCollapsed ? `Mostrar ${sidePanelLabel}` : `Ocultar ${sidePanelLabel}`}
                  onClick={() => setSideCollapsed((collapsed) => !collapsed)}
                >
                  {sideCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </button>
                <div id="review-side-content" className="review-side-content" hidden={sideCollapsed}>{sidePanel}</div>
              </aside>
            )}
            {/* La hoja sigue montada (oculta) para volver a ella tal como estaba. */}
            {actionPanel && <div className="review-action-panel">{actionPanel.content}</div>}
          </div>

          <footer className="expediente-modal-footer">
            {sheetMode && renderToolbar && (
              <div className="review-footer-tools">
                {renderToolbar({ rows: draft, selectedIds, blockedRows, clearSelection })}
              </div>
            )}
            <div className={`expediente-modal-footer-status ${saving ? 'saving' : dirty ? 'dirty' : conflictError ? 'conflict' : 'saved'}`} aria-live="polite">
              {saving ? (
                <>
                  <LoaderCircle size={14} className="spin" />
                  <span>Guardando borrador…</span>
                </>
              ) : conflictError ? (
                <span>Conflicto de edición detectado</span>
              ) : editLock?.locked ? (
                <>
                  <Lock size={14} />
                  <span>Cambios guardados · edición bloqueada</span>
                </>
              ) : dirty ? (
                <span>Cambios sin guardar (guardando automáticamente…)</span>
              ) : lastSaved ? (
                <>
                  <Check size={14} />
                  <span>Borrador guardado a las {lastSaved}</span>
                </>
              ) : (
                <span>Borrador sincronizado</span>
              )}
            </div>
            {!isApproved && linkageAlerts > 0 && !approvalBlockedReason && (
              <label className="linkage-acknowledge">
                <input type="checkbox" checked={alertsAcknowledged} onChange={(event) => setAlertsAcknowledged(event.target.checked)} />
                <span>Revisé las {linkageAlerts} alerta(s) del cotejo y apruebo bajo mi responsabilidad.</span>
              </label>
            )}
            <div className="expediente-modal-footer-actions">
              {/* El consolidado descarga el Excel oficial (plantilla CORRESPONDENCIA), no la hoja de trabajo. */}
              {spreadsheet && !onDownloadExcel && (
                <button type="button" className="expediente-secondary-action" onClick={() => void downloadSheet()}>
                  <Download size={16} />
                  Descargar Excel
                </button>
              )}
              {onDownloadExcel && (
                <button type="button" className="expediente-secondary-action" disabled={saving} onClick={() => void handleDownloadExcel()}>
                  <Download size={16} />
                  Descargar Excel
                </button>
              )}
              {!isApproved && onReprocess && (
                <button
                  type="button"
                  className="expediente-secondary-action"
                  disabled={saving}
                  onClick={onReprocess}
                  title="Vuelve a extraer los datos desde los archivos cargados"
                >
                  <RefreshCcw size={16} />
                  Reprocesar
                </button>
              )}
              {!isApproved && !autosaveOnly && (
                <button
                  type="button"
                  className="expediente-secondary-action"
                  disabled={!dirty || saving}
                  onClick={() => void saveManual()}
                >
                  Guardar borrador
                </button>
              )}
              {editLock && (locked ? (
                <button type="button" className="expediente-primary-action" disabled={lockBusy} onClick={() => void handleEdit()}>
                  {lockBusy ? <LoaderCircle size={16} className="spin" /> : <PencilLine size={16} />}
                  Editar
                </button>
              ) : (
                <button
                  type="button"
                  className="expediente-primary-action"
                  disabled={saving || lockBusy}
                  title="Guarda los cambios y bloquea la edición para proteger el archivo"
                  onClick={() => void handleSaveAndLock()}
                >
                  {lockBusy ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}
                  Guardar cambios
                </button>
              ))}
              {!isApproved && onApprove && !editLock && (
                <button
                  type="button"
                  className="expediente-primary-action"
                  disabled={hasBlockingErrors || (dirty && !autosaveOnly) || saving || Boolean(approvalBlocker)}
                  title={hasBlockingErrors ? 'Resuelve los errores antes de aprobar' : dirty && !autosaveOnly ? 'Guarda los cambios antes de aprobar' : approvalBlocker ?? (autosaveOnly ? 'Guarda los cambios pendientes y aprueba' : '')}
                  onClick={() => void handleApprove()}
                >
                  <Check size={16} />
                  {approveLabel}
                </button>
              )}
            </div>
          </footer>

          {showDiscard && (
            <div className="expediente-discard-prompt" role="alertdialog" aria-modal="true" aria-labelledby="discard-title">
              <div>
                <h4 id="discard-title">¿Descartar cambios sin guardar?</h4>
                <p>Hay modificaciones pendientes que aún no se han persistido en el servidor.</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                  <button type="button" className="expediente-secondary-action" onClick={() => setShowDiscard(false)}>Continuar editando</button>
                  <button type="button" className="expediente-primary-action" onClick={() => { setShowDiscard(false); setDirty(false); onOpenChange(false) }}>Descartar y cerrar</button>
                </div>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
