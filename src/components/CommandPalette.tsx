import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Search,
  Folder,
  Layers,
  FileText,
  Settings,
  Download,
  Users,
  AlertCircle,
  CornerDownLeft,
  X
} from 'lucide-react'
import { Project, Batch, PropertyRecord } from '../types'

export interface CommandItem {
  id: string
  title: string
  subtitle?: string
  category: 'Navegación' | 'Expedientes' | 'Lotes' | 'Predios' | 'Acciones'
  icon: React.ReactNode
  onSelect: () => void
}

export interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  projects: Project[]
  batches: Batch[]
  records: PropertyRecord[]
  onSelectTab: (tab: string) => void
  onSelectProject: (projectId: string) => void
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  projects,
  batches,
  records,
  onSelectTab,
  onSelectProject
}) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Capturar tecla Esc y navegación
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].onSelect()
        onClose()
      }
    }
  }

  const items: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      {
        id: 'nav-projects',
        title: 'Ir a Expedientes y Proyectos',
        category: 'Navegación',
        icon: <Folder size={16} className="text-emerald-500" />,
        onSelect: () => onSelectTab('proyectos')
      },
      {
        id: 'nav-ingestion',
        title: 'Ir a Carga de Insumos y Manifiesto',
        category: 'Navegación',
        icon: <Layers size={16} className="text-blue-500" />,
        onSelect: () => onSelectTab('ingesta')
      },
      {
        id: 'nav-review',
        title: 'Ir a Estación de Revisión Jurídica',
        category: 'Navegación',
        icon: <FileText size={16} className="text-amber-500" />,
        onSelect: () => onSelectTab('revision')
      },
      {
        id: 'nav-users',
        title: 'Ir a Participantes y Roles',
        category: 'Navegación',
        icon: <Users size={16} className="text-purple-500" />,
        onSelect: () => onSelectTab('participantes')
      },
      {
        id: 'nav-config',
        title: 'Ir a Configuración de Extractores e IA',
        category: 'Navegación',
        icon: <Settings size={16} className="text-slate-500" />,
        onSelect: () => onSelectTab('configuracion')
      },
      {
        id: 'nav-export',
        title: 'Ir a Exportaciones de Libros y Minutas',
        category: 'Navegación',
        icon: <Download size={16} className="text-teal-500" />,
        onSelect: () => onSelectTab('exportacion')
      }
    ]

    // Expedientes
    for (const p of projects) {
      list.push({
        id: `proj-${p.id}`,
        title: p.name,
        subtitle: `${p.municipality}, ${p.department} · ${p.clientName || 'Sin cliente'}`,
        category: 'Expedientes',
        icon: <Folder size={16} className="text-emerald-600" />,
        onSelect: () => {
          onSelectProject(p.id)
          onSelectTab('ingesta')
        }
      })
    }

    // Lotes
    for (const b of batches) {
      list.push({
        id: `batch-${b.id}`,
        title: `Lote: ${b.name}`,
        subtitle: `Estado: ${b.jobState} · ${b.documentCount || 0} archivos`,
        category: 'Lotes',
        icon: <Layers size={16} className="text-blue-600" />,
        onSelect: () => onSelectTab('ingesta')
      })
    }

    // Predios
    for (const r of records.slice(0, 30)) {
      list.push({
        id: `rec-${r.id}`,
        title: `Predio: ${r.name}`,
        subtitle: `Folio: ${r.folio || 'S/F'} · Estado: ${r.reviewState}`,
        category: 'Predios',
        icon: <FileText size={16} className="text-amber-600" />,
        onSelect: () => onSelectTab('revision')
      })
    }

    return list
  }, [projects, batches, records, onSelectTab, onSelectProject])

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items.slice(0, 15)
    const q = query.toLowerCase()
    return items
      .filter(
        item =>
          item.title.toLowerCase().includes(q) ||
          item.subtitle?.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      )
      .slice(0, 20)
  }, [items, query])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/40 backdrop-blur-xs p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos de Territorium"
    >
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Buscador */}
        <div className="flex items-center px-3.5 border-b border-slate-200 bg-white">
          <Search size={18} className="text-slate-400 shrink-0 mr-2.5" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Buscar expediente, lote, predio, matrícula o comando rápido..."
            className="w-full py-3.5 text-sm outline-hidden text-slate-800 placeholder-slate-400"
            aria-autocomplete="list"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded">
            ESC
          </kbd>
          <button
            type="button"
            onClick={onClose}
            className="p-1 ml-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
            aria-label="Cerrar paleta de comandos"
          >
            <X size={16} />
          </button>
        </div>

        {/* Lista de resultados */}
        <div className="overflow-y-auto p-2 space-y-1 divide-y divide-slate-100">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              <AlertCircle size={24} className="mx-auto text-slate-300 mb-2" />
              No se encontraron coincidencias para "{query}".
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    item.onSelect()
                    onClose()
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected ? 'bg-emerald-50 text-emerald-950 font-medium' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <div className="p-1.5 bg-white rounded border border-slate-200 shrink-0">
                      {item.icon}
                    </div>
                    <div className="truncate">
                      <div className="text-sm truncate">{item.title}</div>
                      {item.subtitle && (
                        <div className="text-xs text-slate-500 truncate">{item.subtitle}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0 ml-3">
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-normal">
                      {item.category}
                    </span>
                    {isSelected && <CornerDownLeft size={14} className="text-emerald-600" />}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer accesible */}
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center space-x-3">
            <span>
              <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded">↑</kbd>{' '}
              <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded">↓</kbd> Navegar
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded">Enter</kbd> Seleccionar
            </span>
          </div>
          <span>Territorium Global Search (US-176)</span>
        </div>
      </div>
    </div>
  )
}
