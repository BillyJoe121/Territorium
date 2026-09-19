import React from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  LoaderCircle,
  XCircle,
  Ban,
} from 'lucide-react'

export type BadgeStatus =
  | 'pendiente'
  | 'en_proceso'
  | 'requiere_revision'
  | 'aprobado'
  | 'devuelto'
  | 'bloqueado'
  | 'fallido'
  | 'cancelado'
  | 'discrepancia'
  | 'info'

interface StatusBadgeProps {
  status: BadgeStatus | string
  label?: string
  showIcon?: boolean
  className?: string
  size?: 'sm' | 'md'
}

export function StatusBadge({
  status,
  label,
  showIcon = true,
  className = '',
  size = 'md',
}: StatusBadgeProps) {
  const normStatus = (status || 'pendiente').toLowerCase()

  const config: Record<string, { label: string; icon: React.ReactNode; variant: string }> = {
    aprobado: {
      label: 'Aprobado',
      icon: <CheckCircle2 size={12} />,
      variant: 'status-success',
    },
    completado: {
      label: 'Completado',
      icon: <CheckCircle2 size={12} />,
      variant: 'status-success',
    },
    pendiente: {
      label: 'Pendiente',
      icon: <Clock size={12} />,
      variant: 'status-warning',
    },
    requiere_revision: {
      label: 'Requiere revisión',
      icon: <AlertTriangle size={12} />,
      variant: 'status-warning',
    },
    discrepancia: {
      label: 'Discrepancia',
      icon: <AlertCircle size={12} />,
      variant: 'status-danger',
    },
    devuelto: {
      label: 'Devuelto',
      icon: <XCircle size={12} />,
      variant: 'status-danger',
    },
    fallido: {
      label: 'Fallido',
      icon: <XCircle size={12} />,
      variant: 'status-danger',
    },
    cancelado: {
      label: 'Cancelado',
      icon: <Ban size={12} />,
      variant: 'status-neutral',
    },
    bloqueado: {
      label: 'Bloqueado',
      icon: <Ban size={12} />,
      variant: 'status-danger',
    },
    en_proceso: {
      label: 'En proceso',
      icon: <LoaderCircle size={12} className="spin" />,
      variant: 'status-info',
    },
    info: {
      label: 'Informativo',
      icon: <HelpCircle size={12} />,
      variant: 'status-accent',
    },
  }

  const current = config[normStatus] || {
    label: label || normStatus,
    icon: <HelpCircle size={12} />,
    variant: 'status-neutral',
  }

  return (
    <span className={`status-badge ${current.variant} size-${size} ${className}`}>
      {showIcon && current.icon}
      <span>{label || current.label}</span>
    </span>
  )
}
