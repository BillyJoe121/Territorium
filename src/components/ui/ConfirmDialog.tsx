import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'primary'
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="radix-dialog-overlay" />
        <Dialog.Content className="radix-dialog-content">
          <div className="radix-dialog-header">
            <div className={`radix-dialog-icon ${variant}`}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <Dialog.Title className="radix-dialog-title">{title}</Dialog.Title>
              <Dialog.Description className="radix-dialog-description">
                {description}
              </Dialog.Description>
            </div>
          </div>

          <div className="radix-dialog-actions">
            <Dialog.Close asChild>
              <button type="button" className="btn btn-secondary">
                {cancelLabel}
              </button>
            </Dialog.Close>
            <button
              type="button"
              className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => {
                onConfirm()
                onOpenChange(false)
              }}
            >
              {confirmLabel}
            </button>
          </div>

          <Dialog.Close asChild>
            <button type="button" className="radix-dialog-close" aria-label="Cerrar">
              <X size={16} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
