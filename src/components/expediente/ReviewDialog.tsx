import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, Check, Download, LoaderCircle, RefreshCcw, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cellAlertKey, ResultDataTable, type CellAlert } from './ResultDataTable'
import { NegotiationLinkagePanel, PlanLinkagePanel } from './PlanLinkagePanel'
import type { ValidationNotice } from '../../lib/expedienteResultAdapters'
import { buildNegotiationLinkage, negotiationAlertCount, type LinkedPair } from '../../lib/negotiationLinking'
import {
  buildPlanTitleLinkage,
  linkageAlertCount,
  READONLY_ROW_FLAG,
} from '../../lib/planTitleLinking'
import type { DocumentGroup, DocumentGroupKey, EditableResultRow } from './types'

const cloneRows = (rows: EditableResultRow[]) => rows.map((row) => ({ ...row }))

export interface RowAlert extends CellAlert {
  rowId: string
  columnKey: string
}

export interface ReviewDialogProps {
  open: boolean
  title: string
  description: string
  version: number
  rows: EditableResultRow[]
  columns: DocumentGroup['columns']
  approveLabel: string
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
  /** Validaciones por casilla propias del modal; los errores bloquean la aprobación. */
  validateRows?: (rows: EditableResultRow[]) => RowAlert[]
  onOpenChange: (open: boolean) => void
  onSave: (rows: EditableResultRow[]) => Promise<void> | void
  onApprove: (rows: EditableResultRow[]) => void
  onReprocess?: () => void
  onDownloadExcel?: () => void
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
  validateRows,
  onOpenChange,
  onSave,
  onApprove,
  onReprocess,
  onDownloadExcel,
}: ReviewDialogProps) {
  const [draft, setDraft] = useState(() => cloneRows(rows))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [conflictError, setConflictError] = useState<string | null>(null)
  const [showDiscard, setShowDiscard] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [alertsAcknowledged, setAlertsAcknowledged] = useState(false)
  const saveTimeoutRef = useRef<number | null>(null)

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
    setDraft(cloneRows(rows))
    setDirty(false)
    setSaving(false)
    setConflictError(null)
    setShowDiscard(false)
    setLastSaved(null)
    setAlertsAcknowledged(false)
  }, [open, rows])

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
  const cellAlerts = useMemo(() => {
    if (!linkage && !rowAlerts.length) return undefined
    const map = new Map<string, CellAlert>()
    const all = [...((linkage?.alerts ?? []) as RowAlert[]), ...rowAlerts]
    for (const alert of all) {
      const key = cellAlertKey(alert.rowId, alert.columnKey)
      // Un error prevalece sobre una advertencia en la misma casilla.
      if (!map.has(key) || alert.severity === 'error') map.set(key, alert)
    }
    return map
  }, [linkage, rowAlerts])

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

  const isApprovedRef = useRef(isApproved)
  isApprovedRef.current = isApproved
  const columnsRef = useRef(columns)
  columnsRef.current = columns
  const deriveRef = useRef(deriveRow)
  deriveRef.current = deriveRow

  const updateCell = useCallback((rowId: string, key: string, value: string) => {
    if (isApprovedRef.current) return
    const negotiationFields = ['firstOfferNumbers', 'firstOfferLetters', 'secondOfferNumbers', 'secondOfferLetters']
    const hasNegotiationComparison = columnsRef.current.some((column) => column.key === 'valuesMatch')

    // Columnas comunes (datos del proyecto): editar una fila actualiza todas.
    const broadcast = columnsRef.current.some((column) => column.key === key && column.broadcast)

    setDraft((currentDraft) => {
      const nextDraft = currentDraft.map((row) => {
        if (row.id !== rowId && !broadcast) return row
        let nextRow = { ...row, [key]: value }
        if (hasNegotiationComparison && negotiationFields.includes(key)) nextRow = { ...nextRow, valuesMatch: 'Requiere revisión' }
        return deriveRef.current ? deriveRef.current(nextRow) : nextRow
      })

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
  }, [triggerSave])

  const saveManual = async () => {
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    await triggerSave(draft)
  }

  const handleApprove = () => {
    if (hasBlockingErrors || dirty || saving || approvalBlocker) return
    onApprove(draft)
  }

  const handleReloadServer = () => {
    setDraft(cloneRows(rows))
    setConflictError(null)
    setDirty(false)
  }

  const effectiveColumns = useMemo(() => {
    if (!isApproved) return columns
    return columns.map((col) => ({ ...col, editable: false }))
  }, [columns, isApproved])

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) close() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="expediente-modal-overlay" />
        <Dialog.Content className="expediente-review-modal" aria-describedby="expediente-review-description">
          <header className="expediente-modal-header">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {/* Solo para lectores de pantalla: el espacio visible es para la tabla. */}
              <Dialog.Description id="expediente-review-description" className="sr-only">
                {description} Versión {version}{isApproved ? ', aprobada y en solo lectura.' : '.'}
              </Dialog.Description>
            </div>
            <button type="button" className="expediente-modal-close" onClick={close} aria-label="Cerrar revisión"><X size={18} /></button>
          </header>

          <div className="expediente-modal-body">
            {conflictError && (
              <div className="expediente-conflict-banner" role="alert">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={15} />
                  <span>{conflictError}</span>
                </div>
                <button type="button" onClick={handleReloadServer}>Recargar datos más recientes</button>
              </div>
            )}
            {planLinkage && <PlanLinkagePanel linkage={planLinkage} />}
            {negotiationLinkage && <NegotiationLinkagePanel linkage={negotiationLinkage} />}
            {headerPanel}
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
          </div>

          <footer className="expediente-modal-footer">
            <div className={`expediente-modal-footer-status ${saving ? 'saving' : dirty ? 'dirty' : conflictError ? 'conflict' : 'saved'}`} aria-live="polite">
              {saving ? (
                <>
                  <LoaderCircle size={14} className="spin" />
                  <span>Guardando borrador…</span>
                </>
              ) : conflictError ? (
                <span>Conflicto de edición detectado</span>
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
              {onDownloadExcel && (
                <button type="button" className="expediente-secondary-action" onClick={onDownloadExcel}>
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
              {!isApproved && (
                <button
                  type="button"
                  className="expediente-secondary-action"
                  disabled={!dirty || saving}
                  onClick={() => void saveManual()}
                >
                  Guardar borrador
                </button>
              )}
              {!isApproved && (
                <button
                  type="button"
                  className="expediente-primary-action"
                  disabled={hasBlockingErrors || dirty || saving || Boolean(approvalBlocker)}
                  title={hasBlockingErrors ? 'Resuelve los errores antes de aprobar' : dirty ? 'Guarda los cambios antes de aprobar' : approvalBlocker ?? ''}
                  onClick={handleApprove}
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
