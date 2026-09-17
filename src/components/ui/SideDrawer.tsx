import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

interface SideDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  side?: 'right' | 'left'
  children?: React.ReactNode
  footer?: React.ReactNode
  className?: string
  widthClass?: string
  disablePortal?: boolean
}

/**
 * US-264 & US-253: Panel lateral deslizante (Drawer / Sheet) con @radix-ui/react-dialog.
 * Provee consulta rápida de detalles de proyectos o lista de predios sin abandonar el contexto principal.
 */
export const SideDrawer: React.FC<SideDrawerProps> = ({
  open,
  onOpenChange,
  title,
  description,
  side = 'right',
  children,
  footer,
  className = '',
  widthClass = 'max-w-md w-full sm:w-[480px]',
  disablePortal = false,
}) => {
  const isRight = side === 'right'
  const PortalWrapper = disablePortal ? React.Fragment : Dialog.Portal

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <PortalWrapper>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 data-[state=closed]:opacity-0 data-[state=open]:opacity-100" />
        <Dialog.Content
          aria-describedby={description ? 'side-drawer-desc' : undefined}
          className={`fixed top-0 bottom-0 z-50 flex flex-col bg-slate-900 border-slate-700/80 shadow-2xl shadow-black/90 transition-transform duration-300 ease-out focus:outline-none ${widthClass} ${
            isRight
              ? 'right-0 border-l data-[state=closed]:translate-x-full data-[state=open]:translate-x-0'
              : 'left-0 border-r data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0'
          } ${className}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
            <div>
              <Dialog.Title className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description id="side-drawer-desc" className="text-xs text-slate-400 mt-0.5">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Cerrar panel lateral"
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            >
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-xs text-slate-300">
            {children}
          </div>

          {/* Footer (optional) */}
          {footer && (
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-2">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </PortalWrapper>
    </Dialog.Root>
  )
}
