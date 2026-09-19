import * as Dialog from '@radix-ui/react-dialog'
import { Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'

export interface AiRevisionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (comment: string) => void
}

export function AiRevisionDialog({ open, onOpenChange, onConfirm }: AiRevisionDialogProps) {
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setComment('')
      setError('')
    }
  }, [open])

  const submit = () => {
    if (comment.trim().length < 8) {
      setError('Describe el ajuste solicitado en al menos ocho caracteres.')
      return
    }
    onConfirm(comment.trim())
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="expediente-modal-overlay" />
        <Dialog.Content className="expediente-ai-modal">
          <header className="expediente-modal-header compact">
            <div>
              <p className="expediente-modal-kicker">Nueva propuesta</p>
              <Dialog.Title>Solicitar cambios a IA</Dialog.Title>
              <Dialog.Description>La versión actual se conservará. La IA preparará una propuesta nueva a partir de tus comentarios.</Dialog.Description>
            </div>
            <Dialog.Close asChild><button type="button" className="expediente-modal-close" aria-label="Cerrar solicitud"><X size={18} /></button></Dialog.Close>
          </header>
          <div className="expediente-ai-body">
            <label htmlFor="ai-revision-comment">¿Qué deseas ajustar?</label>
            <textarea id="ai-revision-comment" rows={5} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Ejemplo: ajusta el tono del apartado de observaciones y conserva intactos los valores aprobados." autoFocus />
            {error && <p className="expediente-inline-error" role="alert">{error}</p>}
          </div>
          <footer className="expediente-modal-footer compact">
            <button type="button" className="expediente-secondary-action" onClick={() => onOpenChange(false)}>Cancelar</button>
            <button type="button" className="expediente-primary-action" onClick={submit}><Sparkles size={16} />Crear propuesta</button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
