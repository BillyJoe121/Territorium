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
}

export const ProjectBreadcrumbs: React.FC<ProjectBreadcrumbsProps> = ({ items }) => {
  if (!items || items.length === 0) return null

  const renderIcon = (icon?: BreadcrumbItem['icon']) => {
    switch (icon) {
      case 'home':
        return <Home size={14} className="text-slate-400" />
      case 'project':
        return <Folder size={14} className="text-emerald-500" />
      case 'batch':
        return <Layers size={14} className="text-blue-500" />
      case 'property':
        return <FileText size={14} className="text-amber-500" />
      case 'action':
        return <CheckCircle2 size={14} className="text-purple-500" />
      default:
        return null
    }
  }

  return (
    <nav
      aria-label="Migas de pan"
      className="flex items-center space-x-1.5 text-xs text-slate-500 py-2 px-3 bg-slate-50 border-b border-slate-200"
    >
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1
        return (
          <React.Fragment key={item.id}>
            {idx > 0 && <ChevronRight size={12} className="text-slate-400 shrink-0" />}
            <button
              type="button"
              onClick={item.onClick}
              disabled={isLast || !item.onClick}
              className={`flex items-center space-x-1 py-0.5 px-1.5 rounded transition-colors ${
                isLast
                  ? 'font-semibold text-slate-900 cursor-default bg-white shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-200/60 cursor-pointer'
              }`}
              aria-current={isLast ? 'page' : undefined}
            >
              {renderIcon(item.icon)}
              <span className="truncate max-w-[160px]">{item.label}</span>
            </button>
          </React.Fragment>
        )
      })}
    </nav>
  )
}
