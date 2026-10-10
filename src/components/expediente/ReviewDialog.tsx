import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, LoaderCircle, X } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ResultDataTable } from './ResultDataTable'
import { NegotiationLinkagePanel, PlanLinkagePanel } from './PlanLinkagePanel'
import { downloadBlob } from '../../lib/download'
import { negotiatedValueLetters } from '../../lib/negotiatedValue'
import { DiscardPrompt, ReviewDialogFooter } from './ReviewDialogFooter'
import { useReviewDraft } from './useReviewDraft'
import { useReviewView } from './useReviewView'
import type { ReviewDialogProps } from './reviewDialogTypes'

export type { ReviewDialogProps, ReviewRowAction, ReviewToolbarContext, RowAlert } from './reviewDialogTypes'

// Univer y ExcelJS pesan varios MB: se descargan solo al abrir un modal con hoja de cálculo.
const ResultSpreadsheet = lazy(() => import('./ResultSpreadsheet'))

/** Negociación: el valor en letras se escribe solo mientras se digitan los números. */
const negotiationLiveDerive = (columnKey: string, text: string) =>
  columnKey === 'negotiatedValueNumbers' ? { negotiatedValueLetters: negotiatedValueLetters(text) } : null

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
  const [showDiscard, setShowDiscard] = useState(false)
  const [alertsAcknowledged, setAlertsAcknowledged] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [actionRowId, setActionRowId] = useState<string | null>(null)
  const [sideCollapsed, setSideCollapsed] = useState(false)
  const [lockBusy, setLockBusy] = useState(false)
  const sheetMode = Boolean(spreadsheet)
  // Solo lectura: versión aprobada o edición bloqueada con "Guardar cambios".
  const locked = isApproved || Boolean(editLock?.locked)
  // La hoja muestra su resumen de casillas resaltadas en la línea del título.
  const [legendSlot, setLegendSlot] = useState<HTMLDivElement | null>(null)

  const editor = useReviewDraft({ open, rows, columns, groupKey, isApproved, locked, deriveRow, onSave, spreadsheet })
  const { draft, dirty, saving, conflictError, sheetRef } = editor

  // Al abrir el modal se limpian la selección, la vista de acción y las confirmaciones.
  const resetOnOpenRef = useRef(false)
  useEffect(() => {
    if (!open) {
      resetOnOpenRef.current = false
      return
    }
    if (resetOnOpenRef.current) return
    resetOnOpenRef.current = true
    setShowDiscard(false)
    setAlertsAcknowledged(false)
    setSelectedIds(new Set())
    setActionRowId(null)
  }, [open])

  const view = useReviewView({
    draft,
    columns,
    groupKey,
    isApproved,
    linkedTitleRows,
    linkedPairs,
    validateRows,
    validationNotices,
    approvalBlockedReason,
    alertsAcknowledged,
    sheetMode,
    selectable,
    rowAction,
    selectedIds,
    actionRowId,
  })
  editor.displayColumnsRef.current = view.displayColumns
  const { actionPanel, approvalBlocker, hasBlockingErrors } = view
  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const close = () => {
    if (dirty) {
      setShowDiscard(true)
      return
    }
    onOpenChange(false)
  }

  const focusAlert = useCallback((rowId: string, columnKey: string) => {
    sheetRef.current?.focusCell(rowId, columnKey)
  }, [sheetRef])

  const downloadSheet = async () => {
    const snapshot = await sheetRef.current?.collect({ commitEditing: true })
    if (snapshot && spreadsheet) downloadBlob(snapshot.file, spreadsheet.fileName)
  }

  /** "Guardar cambios": guarda lo pendiente y bloquea la edición. */
  const handleSaveAndLock = async () => {
    if (!editLock || saving || lockBusy) return
    setLockBusy(true)
    try {
      const saved = autosaveOnly ? await editor.flushPendingSheet() : draft
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
      const saved = await editor.flushPendingSheet()
      // Lo recién escrito puede dejar casillas en rojo: la hoja ya las muestra y no se aprueba.
      if (!saved || validateRows?.(saved).some((alert) => alert.severity === 'error')) return
      approvedRows = saved
    }
    onApprove(approvedRows)
  }

  const handleDownloadExcel = async () => {
    if (!onDownloadExcel) return
    const rowsToExport = autosaveOnly && !locked ? await editor.flushPendingSheet() : draft
    if (rowsToExport) onDownloadExcel(rowsToExport)
  }

  // Los menús de Univer se montan en <body>: en modo hoja el diálogo no es modal para Radix
  // (si lo fuera, bloquearía sus clics y su foco) y no se cierra por interacciones externas.
  const insideSheet = (node: EventTarget | Element | null) =>
    node instanceof Element && Boolean(node.closest('.result-spreadsheet, [class*="univer-"]'))

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
                  <button type="button" onClick={editor.reloadFromServer}>Recargar datos más recientes</button>
                </div>
              )}
              {view.planLinkage && <PlanLinkagePanel linkage={view.planLinkage} onSelectAlert={sheetMode ? focusAlert : undefined} />}
              {view.negotiationLinkage && <NegotiationLinkagePanel linkage={view.negotiationLinkage} onSelectAlert={sheetMode ? focusAlert : undefined} />}
              {headerPanel}
              {editor.sheetErrors.length > 0 && (
                <div className="result-spreadsheet-errors" role="alert">
                  <strong>No se guardó: corrige la hoja de cálculo</strong>
                  <ul>
                    {editor.sheetErrors.slice(0, 6).map((message) => <li key={message}>{message}</li>)}
                  </ul>
                  {editor.sheetErrors.length > 6 && <span>Y {editor.sheetErrors.length - 6} problema(s) más.</span>}
                </div>
              )}
              {editor.fileError && (
                <div className="expediente-conflict-banner" role="alert">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={15} />
                    <span>{editor.fileError}</span>
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
                    key={editor.sheetKey}
                    ref={sheetRef}
                    source={spreadsheet}
                    columns={view.displayColumns}
                    view={view.sheetView}
                    readOnly={locked}
                    readOnlyHint={editLock?.locked ? 'La edición está bloqueada. Pulsa "Editar" para modificar el consolidado.' : 'Esta versión está aprobada y es de solo lectura.'}
                    onChange={editor.handleSheetChange}
                    onRowsChange={editor.handleSheetRows}
                    liveDerive={groupKey === 'negotiation' ? negotiationLiveDerive : undefined}
                    onSelectionChange={selectable ? setSelectedIds : undefined}
                    onAction={rowAction ? setActionRowId : undefined}
                    legendContainer={legendSlot}
                  />
                </Suspense>
              ) : (
                <ResultDataTable
                  caption={`Resultados de ${title}`}
                  columns={view.tableColumns}
                  rows={view.displayRows}
                  validationNotices={validationNotices}
                  cellAlerts={view.cellAlerts}
                  rowClassName={view.tableRowClassName}
                  onChange={editor.updateCell}
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

          <ReviewDialogFooter
            tools={sheetMode && renderToolbar ? renderToolbar({ rows: draft, selectedIds, blockedRows: view.blockedRows, clearSelection }) : undefined}
            status={{ saving, dirty, conflict: Boolean(conflictError), editLocked: Boolean(editLock?.locked), lastSaved: editor.lastSaved }}
            acknowledge={!isApproved && view.linkageAlerts > 0 && !approvalBlockedReason
              ? { count: view.linkageAlerts, checked: alertsAcknowledged, onChange: setAlertsAcknowledged }
              : undefined}
            // El consolidado descarga el Excel oficial (plantilla CORRESPONDENCIA), no la hoja de trabajo.
            onDownloadSheet={spreadsheet && !onDownloadExcel ? () => void downloadSheet() : undefined}
            onDownloadExcel={onDownloadExcel ? () => void handleDownloadExcel() : undefined}
            onReprocess={!isApproved ? onReprocess : undefined}
            onSaveDraft={!isApproved && !autosaveOnly ? () => void editor.saveManual() : undefined}
            editLock={editLock ? { locked, busy: lockBusy, onSave: () => void handleSaveAndLock(), onEdit: () => void handleEdit() } : undefined}
            approve={!isApproved && onApprove && !editLock ? {
              label: approveLabel,
              disabled: hasBlockingErrors || (dirty && !autosaveOnly) || saving || Boolean(approvalBlocker),
              title: hasBlockingErrors ? 'Resuelve los errores antes de aprobar' : dirty && !autosaveOnly ? 'Guarda los cambios antes de aprobar' : approvalBlocker ?? (autosaveOnly ? 'Guarda los cambios pendientes y aprueba' : ''),
              onApprove: () => void handleApprove(),
            } : undefined}
          />

          {showDiscard && (
            <DiscardPrompt
              onContinue={() => setShowDiscard(false)}
              onDiscard={() => { setShowDiscard(false); editor.setDirty(false); onOpenChange(false) }}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
