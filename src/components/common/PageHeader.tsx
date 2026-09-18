import React from 'react'

export interface PageHeaderProps {
  title: string
  eyebrow?: string
  description?: string
  actions?: React.ReactNode
  meta?: React.ReactNode
}

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  meta,
}: PageHeaderProps) {
  return (
    <header className="mb-6 pb-4 border-b border-[#E4E7EC] flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div className="space-y-1">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl md:text-[28px] font-semibold text-[#182230] leading-tight tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-[#526071] max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {(actions || meta) && (
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          {meta && <div className="text-xs text-[#667085] flex items-center gap-2">{meta}</div>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
    </header>
  )
}
