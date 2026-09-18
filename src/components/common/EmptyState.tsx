import React from 'react'
import { FolderSearch } from 'lucide-react'

export interface EmptyStateProps {
  title?: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  title = 'Sin información disponible',
  description = 'No se encontraron registros en la vista actual.',
  icon = <FolderSearch size={28} className="text-[#98A2B3]" />,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`min-h-[220px] rounded-xl border border-dashed border-[#E4E7EC] bg-[#FFFFFF] p-8 text-center flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-[#F1F3F6] flex items-center justify-center">
        {icon}
      </div>
      <div className="space-y-1 max-w-md">
        <h3 className="text-sm font-semibold text-[#182230]">{title}</h3>
        <p className="text-xs text-[#526071] leading-relaxed">{description}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
