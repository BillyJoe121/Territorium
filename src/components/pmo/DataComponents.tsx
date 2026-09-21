import type { CSSProperties, ReactNode } from 'react'
import { CheckCircle2, Clock3, XCircle } from 'lucide-react'
import { ConfirmDialog } from '../ui/ConfirmDialog'

export function ChartPanel({
  title,
  summary,
  eyebrow,
  className,
  children,
}: {
  title: string
  summary?: string
  eyebrow?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`chart-card${className ? ` ${className}` : ''}`}>
      <div className="chart-header">
        <div className="chart-heading">
          {eyebrow && <p className="chart-eyebrow">{eyebrow}</p>}
          <h4>{title}</h4>
        </div>
        {summary && <span className="chart-summary">{summary}</span>}
      </div>
      <div className="chart-container">{children}</div>
    </section>
  )
}

export function ModernTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean
  label?: string | number
  payload?: Array<{ name?: string; value?: string | number; color?: string }>
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="modern-tooltip" role="status">
      {label && <strong>{label}</strong>}
      {payload.map((item, index) => <span key={`${item.name ?? 'dato'}-${index}`} style={{ '--tooltip-color': item.color ?? 'var(--ui-accent)' } as CSSProperties}>{item.name}: {item.value}</span>)}
    </div>
  )
}

export interface KpiStripItem {
  id: string
  label: string
  value: string | number
  detail?: string
  tone?: 'default' | 'success' | 'warning' | 'danger'
}

export function PhaseKpiStrip({ items }: { items: KpiStripItem[] }) {
  return (
    <div className="phase-kpi-strip" role="list">
      {items.map((item) => (
        <div className={`phase-kpi-item tone-${item.tone ?? 'default'}`} key={item.id} role="listitem">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.detail && <small>{item.detail}</small>}
        </div>
      ))}
    </div>
  )
}

export function PhaseDataBlocks({ items }: { items: Array<{ label: string; value: ReactNode; note?: string }> }) {
  return (
    <dl className="phase-data-blocks">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
          {item.note && <small>{item.note}</small>}
        </div>
      ))}
    </dl>
  )
}

export function PhaseConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = 'Confirmar cambio',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onConfirm: () => void
  confirmLabel?: string
}) {
  return <ConfirmDialog open={open} onOpenChange={onOpenChange} title={title} description={description} onConfirm={onConfirm} confirmLabel={confirmLabel} variant="warning" />
}

export function ProcessingState({ state }: { state: 'pending' | 'running' | 'complete' | 'failed' }) {
  const content = {
    pending: { icon: <Clock3 size={15} />, label: 'Pendiente' },
    running: { icon: <Clock3 size={15} />, label: 'En procesamiento' },
    complete: { icon: <CheckCircle2 size={15} />, label: 'Procesado' },
    failed: { icon: <XCircle size={15} />, label: 'Requiere atención' },
  }[state]
  return <span className={`processing-state ${state}`}>{content.icon}{content.label}</span>
}
