import React from 'react'
import { Filter, X, RotateCcw, Check } from 'lucide-react'

export interface FacetedFilterGroup {
  id: string
  label: string
  options: {
    value: string
    label: string
    count?: number
  }[]
  selectedValues: string[]
}

interface FacetedFiltersProps {
  groups: FacetedFilterGroup[]
  onToggleOption: (groupId: string, value: string) => void
  onClearAll: () => void
  totalResults?: number
  className?: string
}

/**
 * US-265: Barra de filtros facetados superiores con píldoras combinables.
 * Provee filtrado multi-dimensión (Estado, Municipio, Tipo de Discrepancia, Nivel de Confianza)
 * con remoción individual rápida y botón de limpieza masiva.
 */
export const FacetedFilters: React.FC<FacetedFiltersProps> = ({
  groups,
  onToggleOption,
  onClearAll,
  totalResults,
  className = '',
}) => {
  const totalActiveFilters = groups.reduce((acc, g) => acc + g.selectedValues.length, 0)

  return (
    <div className={`faceted-filters-container flex flex-col gap-2 p-3 bg-slate-900/80 border border-slate-800 rounded-xl ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Filter className="w-3.5 h-3.5 text-emerald-400" />
          <span>Filtros Facetados</span>
          {totalActiveFilters > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
              {totalActiveFilters} activo(s)
            </span>
          )}
          {totalResults !== undefined && (
            <span className="text-[11px] text-slate-500 font-normal">
              ({totalResults} resultado{totalResults === 1 ? '' : 's'})
            </span>
          )}
        </div>

        {totalActiveFilters > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-300 px-2 py-1 rounded-md hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Limpiar todo
          </button>
        )}
      </div>

      {/* Selector pills by group */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/60">
        {groups.map((group) => (
          <div key={group.id} className="flex items-center gap-1">
            <span className="text-[11px] font-medium text-slate-400 mr-1">{group.label}:</span>
            {group.options.map((opt) => {
              const isSelected = group.selectedValues.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onToggleOption(group.id, opt.value)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg transition-all duration-150 border cursor-pointer select-none ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-950'
                      : 'bg-slate-800/70 text-slate-400 border-slate-700/60 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />}
                  <span>{opt.label}</span>
                  {opt.count !== undefined && (
                    <span className="text-[10px] opacity-70 font-mono">({opt.count})</span>
                  )}
                  {isSelected && (
                    <span className="ml-0.5 text-emerald-400 hover:text-emerald-200">
                      <X className="w-2.5 h-2.5" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
