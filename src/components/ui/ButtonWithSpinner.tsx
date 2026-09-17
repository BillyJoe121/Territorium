import React from 'react'
import { Loader2 } from 'lucide-react'

interface ButtonWithSpinnerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean
  loadingText?: string
  icon?: React.ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
}

/**
 * US-280: Botones de acción pesada con spinner integrado, cambio de texto ("Procesando...")
 * y bloqueo automático contra clics duplicados concurrentes.
 */
export const ButtonWithSpinner: React.FC<ButtonWithSpinnerProps> = ({
  isLoading = false,
  loadingText = 'Procesando...',
  icon,
  variant = 'primary',
  children,
  disabled,
  className = '',
  onClick,
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-md shadow-emerald-950/50'
      case 'secondary':
        return 'bg-slate-800 hover:bg-slate-750 text-slate-100 border border-slate-700'
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-md shadow-rose-950/50'
      case 'ghost':
        return 'bg-transparent hover:bg-slate-800 text-slate-300 hover:text-white'
    }
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isLoading || disabled) {
      e.preventDefault()
      return
    }
    onClick?.(e)
  }

  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      onClick={handleClick}
      className={`relative inline-flex items-center justify-center gap-2 px-4 py-2 text-xs rounded-xl transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed select-none ${getVariantStyles()} ${className}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          <span>{children}</span>
        </>
      )}
    </button>
  )
}
