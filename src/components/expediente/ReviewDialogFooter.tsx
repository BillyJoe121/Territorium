import { Check, Download, LoaderCircle, Lock, PencilLine, RefreshCcw, Save } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  /** Controles propios del modal (p. ej. generar documentos), a la izquierda; `undefined` sin contenedor. */
  tools?: ReactNode
  status: {
    saving: boolean
    dirty: boolean
    conflict: boolean
    editLocked: boolean
    lastSaved: string | null
  }
  /** Casilla para aprobar bajo confirmación las alertas del cotejo. */
  acknowledge?: { count: number; checked: boolean; onChange: (checked: boolean) => void }
  /** Descargar la hoja de trabajo tal como está (modales sin Excel oficial). */
  onDownloadSheet?: () => void
  /** Descargar el Excel oficial (plantilla CORRESPONDENCIA). */
  onDownloadExcel?: () => void
  onReprocess?: () => void
  /** "Guardar borrador" (no aplica con autoguardado como único guardado). */
  onSaveDraft?: () => void
  /** "Guardar cambios" / "Editar" en lugar de aprobar. */
  editLock?: { locked: boolean; busy: boolean; onSave: () => void; onEdit: () => void }
  approve?: { label?: string; disabled: boolean; title: string; onApprove: () => void }
}

/** Pie del modal de resultados: estado del guardado y acciones. */
export function ReviewDialogFooter({ tools, status, acknowledge, onDownloadSheet, onDownloadExcel, onReprocess, onSaveDraft, editLock, approve }: Props) {
  const { saving, dirty, conflict, editLocked, lastSaved } = status
  return (
    <footer className="expediente-modal-footer">
      {tools !== undefined && <div className="review-footer-tools">{tools}</div>}
      <div className={`expediente-modal-footer-status ${saving ? 'saving' : dirty ? 'dirty' : conflict ? 'conflict' : 'saved'}`} aria-live="polite">
        {saving ? (
          <>
            <LoaderCircle size={14} className="spin" />
            <span>Guardando borrador…</span>
          </>
        ) : conflict ? (
          <span>Conflicto de edición detectado</span>
        ) : editLocked ? (
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
      {acknowledge && (
        <label className="linkage-acknowledge">
          <input type="checkbox" checked={acknowledge.checked} onChange={(event) => acknowledge.onChange(event.target.checked)} />
          <span>Revisé las {acknowledge.count} alerta(s) del cotejo y apruebo bajo mi responsabilidad.</span>
        </label>
      )}
      <div className="expediente-modal-footer-actions">
        {onDownloadSheet && (
          <button type="button" className="expediente-secondary-action" onClick={onDownloadSheet}>
            <Download size={16} />
            Descargar Excel
          </button>
        )}
        {onDownloadExcel && (
          <button type="button" className="expediente-secondary-action" disabled={saving} onClick={onDownloadExcel}>
            <Download size={16} />
            Descargar Excel
          </button>
        )}
        {onReprocess && (
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
        {onSaveDraft && (
          <button
            type="button"
            className="expediente-secondary-action"
            disabled={!dirty || saving}
            onClick={onSaveDraft}
          >
            Guardar borrador
          </button>
        )}
        {editLock && (editLock.locked ? (
          <button type="button" className="expediente-primary-action" disabled={editLock.busy} onClick={editLock.onEdit}>
            {editLock.busy ? <LoaderCircle size={16} className="spin" /> : <PencilLine size={16} />}
            Editar
          </button>
        ) : (
          <button
            type="button"
            className="expediente-primary-action"
            disabled={saving || editLock.busy}
            title="Guarda los cambios y bloquea la edición para proteger el archivo"
            onClick={editLock.onSave}
          >
            {editLock.busy ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}
            Guardar cambios
          </button>
        ))}
        {approve && (
          <button
            type="button"
            className="expediente-primary-action"
            disabled={approve.disabled}
            title={approve.title}
            onClick={approve.onApprove}
          >
            <Check size={16} />
            {approve.label}
          </button>
        )}
      </div>
    </footer>
  )
}

/** Aviso al cerrar con cambios sin guardar. */
export function DiscardPrompt({ onContinue, onDiscard }: { onContinue: () => void; onDiscard: () => void }) {
  return (
    <div className="expediente-discard-prompt" role="alertdialog" aria-modal="true" aria-labelledby="discard-title">
      <div>
        <h4 id="discard-title">¿Descartar cambios sin guardar?</h4>
        <p>Hay modificaciones pendientes que aún no se han persistido en el servidor.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" className="expediente-secondary-action" onClick={onContinue}>Continuar editando</button>
          <button type="button" className="expediente-primary-action" onClick={onDiscard}>Descartar y cerrar</button>
        </div>
      </div>
    </div>
  )
}
