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
    <header className="page-header-banner">
      <div className="header-text-group">
        {eyebrow && <p className="header-eyebrow">{eyebrow}</p>}
        <h1 className="header-title">{title}</h1>
        {description && <p className="header-description">{description}</p>}
      </div>

      {(actions || meta) && (
        <div className="header-right-group">
          {meta && <div className="header-meta-group">{meta}</div>}
          {actions && <div className="header-actions-group">{actions}</div>}
        </div>
      )}
    </header>
  )
}
