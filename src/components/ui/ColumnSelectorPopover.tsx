import React from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Columns, Check, RotateCcw, X } from 'lucide-react'

export interface ColumnOption {
  key: string
  label: string
  isVisible: boolean
}

interface ColumnSelectorPopoverProps {
  columns: ColumnOption[]
  onToggleColumn: (key: string) => void
  onResetColumns?: () => void
  className?: string
}

/**
 * US-220: Popover inteligente con @radix-ui/react-popover para selección de columnas visibles.
 * Posicionamiento inteligente automático para evitar colisiones con los bordes de pantalla.
 */
export const ColumnSelectorPopover: React.FC<ColumnSelectorPopoverProps> = ({
  columns,
  onToggleColumn,
  onResetColumns,
  className = '',
}) => {
  const visibleCount = columns.filter((c) => c.isVisible).length

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Configurar columnas visibles"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-750 hover:border-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${className}`}
        >
          <Columns className="w-3.5 h-3.5 text-emerald-400" />
          <span>Columnas</span>
          <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
            {visibleCount}/{columns.length}
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={6}
          className="z-50 w-64 p-3 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl shadow-black/80 backdrop-blur-md focus:outline-none animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Columns className="w-3.5 h-3.5 text-emerald-400" />
              Columnas visibles
            </span>
            {onResetColumns && (
              <button
                type="button"
                onClick={onResetColumns}
                title="Restablecer columnas por defecto"
                className="text-[10px] text-slate-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                Reiniciar
              </button>
            )}
          </div>

          <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
            {columns.map((col) => (
              <button
                key={col.key}
                type="button"
                onClick={() => onToggleColumn(col.key)}
                className="flex items-center justify-between w-full px-2 py-1.5 text-xs rounded-md text-left transition-colors hover:bg-slate-800/80 text-slate-300 hover:text-white"
              >
                <span className="truncate">{col.label}</span>
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                    col.isVisible
                      ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                      : 'border-slate-600 bg-slate-800/50 text-transparent'
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              </button>
            ))}
          </div>

          <Popover.Close
            className="absolute top-2.5 right-2.5 p-1 text-slate-400 hover:text-slate-200 rounded-md hover:bg-slate-800 transition-colors focus:outline-none"
            aria-label="Cerrar selector de columnas"
          >
            <X className="w-3 h-3" />
          </Popover.Close>
          <Popover.Arrow className="fill-slate-900" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
