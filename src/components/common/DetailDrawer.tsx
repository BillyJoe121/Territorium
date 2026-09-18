import React, { useEffect } from 'react'
import { X } from 'lucide-react'

export interface DetailDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  width?: string
}

export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'max-w-xl',
}: DetailDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-[2px] transition-opacity">
      <div
        className={`h-full w-full ${width} bg-[#FFFFFF] shadow-2xl flex flex-col border-l border-[#E4E7EC] transform transition-transform duration-200 ease-out`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-[#E4E7EC] flex items-center justify-between">
          <div>
            <h2 id="drawer-title" className="text-base font-semibold text-[#182230]">
              {title}
            </h2>
            {subtitle && <p className="text-xs text-[#526071] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-[#667085] hover:text-[#182230] hover:bg-[#F1F3F6] transition-colors"
            aria-label="Cerrar panel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {children}
        </div>

        {/* Drawer Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-[#E4E7EC] bg-[#F7F8FA] flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
