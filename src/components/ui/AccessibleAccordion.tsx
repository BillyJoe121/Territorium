import React from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDown, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react'

export interface AccordionSection {
  id: string
  title: string
  severity?: 'critical' | 'warning' | 'info'
  itemCount?: number
  content: React.ReactNode
}

interface AccessibleAccordionProps {
  sections: AccordionSection[]
  type?: 'single' | 'multiple'
  defaultValue?: string | string[]
  className?: string
}

/**
 * US-224: Acordeón colapsable animado con @radix-ui/react-accordion.
 * Permite desglosar y revisar discrepancias jurídicas de forma independiente,
 * con flechas indicadoras animadas y códigos visuales de severidad.
 */
export const AccessibleAccordion: React.FC<AccessibleAccordionProps> = ({
  sections,
  type = 'multiple',
  defaultValue,
  className = '',
}) => {
  const getSeverityBadge = (severity?: 'critical' | 'warning' | 'info') => {
    switch (severity) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            Crítico
          </span>
        )
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Advertencia
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Normal
          </span>
        )
    }
  }

  // Si type es multiple, defaultValue debe ser string[] o undefined
  if (type === 'multiple') {
    const multiDefault = Array.isArray(defaultValue)
      ? defaultValue
      : typeof defaultValue === 'string'
      ? [defaultValue]
      : undefined

    return (
      <AccordionPrimitive.Root
        type="multiple"
        defaultValue={multiDefault}
        className={`accessible-accordion-root divide-y divide-slate-800 rounded-xl border border-slate-700/70 overflow-hidden bg-slate-900/60 ${className}`}
      >
        {sections.map((section) => (
          <AccordionPrimitive.Item
            key={section.id}
            value={section.id}
            className="accessible-accordion-item overflow-hidden focus-within:relative focus-within:z-10"
          >
            <AccordionPrimitive.Header className="flex">
              <AccordionPrimitive.Trigger className="accessible-accordion-trigger group flex flex-1 items-center justify-between px-4 py-3 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50">
                <div className="flex items-center gap-2.5 text-left">
                  <span>{section.title}</span>
                  {section.severity && getSeverityBadge(section.severity)}
                  {section.itemCount !== undefined && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 font-mono">
                      {section.itemCount}
                    </span>
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 transition-transform duration-200 ease-out group-data-[state=open]:rotate-180" />
              </AccordionPrimitive.Trigger>
            </AccordionPrimitive.Header>
            <AccordionPrimitive.Content className="accessible-accordion-content overflow-hidden text-xs text-slate-300 transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <div className="px-4 py-3 bg-slate-950/40 border-t border-slate-800/80">{section.content}</div>
            </AccordionPrimitive.Content>
          </AccordionPrimitive.Item>
        ))}
      </AccordionPrimitive.Root>
    )
  }

  // Modo single
  const singleDefault = typeof defaultValue === 'string' ? defaultValue : undefined

  return (
    <AccordionPrimitive.Root
      type="single"
      collapsible
      defaultValue={singleDefault}
      className={`accessible-accordion-root divide-y divide-slate-800 rounded-xl border border-slate-700/70 overflow-hidden bg-slate-900/60 ${className}`}
    >
      {sections.map((section) => (
        <AccordionPrimitive.Item
          key={section.id}
          value={section.id}
          className="accessible-accordion-item overflow-hidden focus-within:relative focus-within:z-10"
        >
          <AccordionPrimitive.Header className="flex">
            <AccordionPrimitive.Trigger className="accessible-accordion-trigger group flex flex-1 items-center justify-between px-4 py-3 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50">
              <div className="flex items-center gap-2.5 text-left">
                <span>{section.title}</span>
                {section.severity && getSeverityBadge(section.severity)}
                {section.itemCount !== undefined && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 font-mono">
                    {section.itemCount}
                  </span>
                )}
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 transition-transform duration-200 ease-out group-data-[state=open]:rotate-180" />
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>
          <AccordionPrimitive.Content className="accessible-accordion-content overflow-hidden text-xs text-slate-300 transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="px-4 py-3 bg-slate-950/40 border-t border-slate-800/80">{section.content}</div>
          </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
      ))}
    </AccordionPrimitive.Root>
  )
}
