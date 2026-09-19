import React from 'react'
import { ChevronRight, Home, Folder, Layers, FileText, CheckCircle2 } from 'lucide-react'

export interface BreadcrumbItem {
  id: string
  label: string
  icon?: 'home' | 'project' | 'batch' | 'property' | 'action'
  onClick?: () => void
  active?: boolean
}

export interface ProjectBreadcrumbsProps {
  items: BreadcrumbItem[]
  /** Slot for trailing content on the far right (e.g. ThemeToggle) */
  trailingSlot?: React.ReactNode
}

export const ProjectBreadcrumbs: React.FC<ProjectBreadcrumbsProps> = ({ items, trailingSlot }) => {
  if (!items || items.length === 0) return null

  const renderIcon = (icon?: BreadcrumbItem['icon']) => {
    switch (icon) {
      case 'home':
        return <Home size={13} className="breadcrumb-icon home" />
      case 'project':
        return <Folder size={13} className="breadcrumb-icon project" />
      case 'batch':
        return <Layers size={13} className="breadcrumb-icon batch" />
      case 'property':
        return <FileText size={13} className="breadcrumb-icon property" />
      case 'action':
        return <CheckCircle2 size={13} className="breadcrumb-icon action" />
      default:
        return null
    }
  }

  return (
    <nav aria-label="Migas de pan" className="project-breadcrumbs-nav">
      <div className="breadcrumbs-list">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1
          return (
            <React.Fragment key={item.id}>
              {idx > 0 && <ChevronRight size={12} className="breadcrumb-sep" />}
              <button
                type="button"
                onClick={item.onClick}
                disabled={isLast || !item.onClick}
                className={`breadcrumb-item ${isLast ? 'active' : ''}`}
                aria-current={isLast ? 'page' : undefined}
              >
                {renderIcon(item.icon)}
                <span className="breadcrumb-label">{item.label}</span>
              </button>
            </React.Fragment>
          )
        })}
      </div>
      {trailingSlot && <div className="breadcrumbs-trailing">{trailingSlot}</div>}
    </nav>
  )
}
