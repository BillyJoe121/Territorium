import React from 'react'
import { Check, Cloud, Loader2, AlertCircle } from 'lucide-react'

export type SaveStatus = 'saved' | 'saving' | 'error' | 'idle'

interface AutoSaveIndicatorProps {
  status: SaveStatus
  lastSavedAt?: Date | null
  className?: string
}

/**
 * US-282: Micro-texto de guardado automático con retardo debounce (tipo Google Docs).
 * Transmite retroalimentación no invasiva sobre el estado de persistencia de atributos jurídicos.
 */
export const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({
  status,
  lastSavedAt,
  className = '',
}) => {
  if (status === 'idle') return null

  const formatTime = (d?: Date | null) => {
    if (!d) return ''
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
        status === 'saving'
          ? 'text-amber-300 bg-amber-500/10 border border-amber-500/20'
          : status === 'saved'
          ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/20'
          : 'text-rose-300 bg-rose-500/10 border border-rose-500/20'
      } ${className}`}
    >
      {status === 'saving' && (
        <>
          <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
          <span>Guardando...</span>
        </>
      )}

      {status === 'saved' && (
        <>
          <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
          <span>
            Cambios guardados {lastSavedAt && <span className="opacity-75 font-mono">({formatTime(lastSavedAt)})</span>}
          </span>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle className="w-3 h-3 text-rose-400" />
          <span>Error al guardar cambios</span>
        </>
      )}
    </div>
  )
}
