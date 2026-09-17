import React from 'react'
import { CheckCircle2, AlertCircle, Clock, XCircle, HelpCircle } from 'lucide-react'

export type StatusPillKind =
  | 'aprobado'
  | 'en_proceso'
  | 'requiere_revision'
  | 'discrepancia'
  | 'fallido'
  | 'pendiente'
  | 'neutral'

interface StatusPillProps {
  status: StatusPillKind | string
  label?: string
  size?: 'sm' | 'md'
  showIcon?: boolean
}

export function StatusPill({ status, label, size = 'md', showIcon = true }: StatusPillProps) {
  const normalized = status.toLowerCase()

  let colorClass = 'status-pill-neutral'
  let Icon = HelpCircle
  let defaultText = label || status

  if (normalized.includes('aprob') || normalized.includes('complet')) {
    colorClass = 'status-pill-success'
    Icon = CheckCircle2
    defaultText = label || 'Aprobado'
  } else if (normalized.includes('discrepan') || normalized.includes('error') || normalized.includes('fall')) {
    colorClass = 'status-pill-danger'
    Icon = XCircle
    defaultText = label || 'Discrepancia'
  } else if (normalized.includes('revis') || normalized.includes('alerta')) {
    colorClass = 'status-pill-warning'
    Icon = AlertCircle
    defaultText = label || 'Requiere revisión'
  } else if (normalized.includes('proceso') || normalized.includes('marcha')) {
    colorClass = 'status-pill-info'
    Icon = Clock
    defaultText = label || 'En proceso'
  } else if (normalized.includes('pend') || normalized.includes('espera')) {
    colorClass = 'status-pill-pending'
    Icon = Clock
    defaultText = label || 'Pendiente'
  }

  return (
    <span className={`status-pill ${colorClass} size-${size}`} role="status">
      {showIcon && <Icon className="status-pill-icon" size={size === 'sm' ? 12 : 14} />}
      <span className="status-pill-label">{defaultText}</span>
    </span>
  )
}
