import React from 'react'

export interface PageHeaderProps {
  title?: string
  eyebrow?: string
  description?: string
  actions?: React.ReactNode
  meta?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header className={`page-header-banner${className ? ` ${className}` : ''}`}>
      <div className="header-text-group">
        {!title && eyebrow && <p className="header-eyebrow">{eyebrow}</p>}
        {title && <h1 className="header-title">{title}</h1>}
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
