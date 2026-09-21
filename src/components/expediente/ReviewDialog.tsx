import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, Check, ClipboardCheck, Download, LoaderCircle, RefreshCcw, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ResultDataTable } from './ResultDataTable'
import type { ValidationNotice } from '../../lib/expedienteResultAdapters'
import type { DocumentGroup, DocumentGroupKey, EditableResultRow } from './types'

const cloneRows = (rows: EditableResultRow[]) => rows.map((row) => ({ ...row }))

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
  onOpenChange: (open: boolean) => void
  onSave: (rows: EditableResultRow[]) => Promise<void> | void
  onApprove: (rows: EditableResultRow[]) => void
  onReprocess: () => void
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
  const saveTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (!open) return
    setDraft(cloneRows(rows))
    setDirty(false)
    setSaving(false)
    setConflictError(null)
    setShowDiscard(false)
    setLastSaved(null)
  }, [open, rows])

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

  const updateCell = useCallback((rowId: string, key: string, value: string) => {
    if (isApprovedRef.current) return
    const negotiationFields = ['firstOfferNumbers', 'firstOfferLetters', 'secondOfferNumbers', 'secondOfferLetters']
    const hasNegotiationComparison = columnsRef.current.some((column) => column.key === 'valuesMatch')

    setDraft((currentDraft) => {
      const nextDraft = currentDraft.map((row) => {
        if (row.id !== rowId) return row
        const nextRow = { ...row, [key]: value }
        return hasNegotiationComparison && negotiationFields.includes(key)
          ? { ...nextRow, valuesMatch: 'Requiere revisión' }
          : nextRow
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
    if (hasBlockingErrors || dirty || saving) return
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
              <p className="expediente-modal-kicker">
                {isApproved ? 'Versión aprobada y congelada' : 'Revisión y persistencia de borrador'} · versión {version}
              </p>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description id="expediente-review-description">{description}</Dialog.Description>
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
            <div className="expediente-review-context">
              <ClipboardCheck size={16} />
              <span>
                {isApproved
                  ? 'Esta versión ya fue aprobada formalmente. Los datos se encuentran en modo solo lectura para garantizar la integridad.'
                  : 'Los cambios se guardan automáticamente como borrador persistente. Puedes editar valores antes de emitir la aprobación formal.'}
              </span>
            </div>
            <ResultDataTable
              caption={`Resultados de ${title}`}
              columns={effectiveColumns}
              rows={draft}
              validationNotices={validationNotices}
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
            <div className="expediente-modal-footer-actions">
              {onDownloadExcel && (
                <button type="button" className="expediente-secondary-action" onClick={onDownloadExcel}>
                  <Download size={16} />
                  Descargar Excel
                </button>
              )}
              <button type="button" className="expediente-secondary-action" onClick={onReprocess}>
                <RefreshCcw size={16} />
                Repetir análisis
              </button>
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
                  disabled={hasBlockingErrors || dirty || saving}
                  title={hasBlockingErrors ? 'Resuelve los errores antes de aprobar' : dirty ? 'Guarda los cambios antes de aprobar' : ''}
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
