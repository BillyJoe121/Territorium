import React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'

export interface TabItem {
  id: string
  label: string
  icon?: React.ReactNode
  badgeCount?: number
  content: React.ReactNode
}

interface AccessibleTabsProps {
  items: TabItem[]
  defaultValue?: string
  value?: string
  onValueChange?: (val: string) => void
  className?: string
  ariaLabel?: string
}

/**
 * US-222: Pestañas fluidas y accesibles con @radix-ui/react-tabs
 * Soporta navegación por teclado (flechas izquierda/derecha, Home, End),
 * separación de categorías (Identificación, Propietarios, Linderos, Jurídico, Económico)
 * y transición suave sin recálculo brusco de layout.
 */
export const AccessibleTabs: React.FC<AccessibleTabsProps> = ({
  items,
  defaultValue,
  value,
  onValueChange,
  className = '',
  ariaLabel = 'Pestañas de navegación',
}) => {
  const initialValue = value || defaultValue || items[0]?.id

  return (
    <TabsPrimitive.Root
      value={value}
      defaultValue={initialValue}
      onValueChange={onValueChange}
      className={`accessible-tabs-root flex flex-col w-full ${className}`}
    >
      <TabsPrimitive.List
        aria-label={ariaLabel}
        className="accessible-tabs-list flex items-center gap-1 border-b border-slate-700/60 pb-px overflow-x-auto scrollbar-none"
      >
        {items.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.id}
            value={tab.id}
            className="accessible-tabs-trigger group relative px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-all duration-150 flex items-center gap-2 cursor-pointer select-none text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 data-[state=active]:text-emerald-400 data-[state=active]:bg-slate-800/80 data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          >
            {tab.icon && <span className="w-3.5 h-3.5 flex items-center justify-center opacity-80 group-data-[state=active]:opacity-100">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badgeCount !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  tab.badgeCount > 0
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-slate-700/50 text-slate-400'
                }`}
              >
                {tab.badgeCount}
              </span>
            )}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      {items.map((tab) => (
        <TabsPrimitive.Content
          key={tab.id}
          value={tab.id}
          className="accessible-tabs-content pt-4 focus:outline-none transition-opacity duration-200"
        >
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  )
}
