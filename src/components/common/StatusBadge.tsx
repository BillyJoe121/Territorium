import React from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  LoaderCircle,
  XCircle,
  Ban
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

  const config: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    aprobado: {
      label: 'Aprobado',
      icon: <CheckCircle2 size={13} />,
      className: 'bg-[#EDFDF5] text-[#18794E] border border-[#A3E6C5]',
    },
    completado: {
      label: 'Completado',
      icon: <CheckCircle2 size={13} />,
      className: 'bg-[#EDFDF5] text-[#18794E] border border-[#A3E6C5]',
    },
    pendiente: {
      label: 'Pendiente',
      icon: <Clock size={13} />,
      className: 'bg-[#FEF7EC] text-[#9A6700] border border-[#F7D59A]',
    },
    requiere_revision: {
      label: 'Requiere revisión',
      icon: <AlertTriangle size={13} />,
      className: 'bg-[#FEF7EC] text-[#9A6700] border border-[#F7D59A]',
    },
    discrepancia: {
      label: 'Discrepancia',
      icon: <AlertCircle size={13} />,
      className: 'bg-[#FDF2F2] text-[#B42318] border border-[#F9C3C0]',
    },
    devuelto: {
      label: 'Devuelto',
      icon: <XCircle size={13} />,
      className: 'bg-[#FDF2F2] text-[#B42318] border border-[#F9C3C0]',
    },
    fallido: {
      label: 'Fallido',
      icon: <XCircle size={13} />,
      className: 'bg-[#FDF2F2] text-[#B42318] border border-[#F9C3C0]',
    },
    cancelado: {
      label: 'Cancelado',
      icon: <Ban size={13} />,
      className: 'bg-[#F1F3F6] text-[#667085] border border-[#E4E7EC]',
    },
    bloqueado: {
      label: 'Bloqueado',
      icon: <Ban size={13} />,
      className: 'bg-[#FDF2F2] text-[#B42318] border border-[#F9C3C0]',
    },
    en_proceso: {
      label: 'En proceso',
      icon: <LoaderCircle size={13} className="spin" />,
      className: 'bg-[#F0F9FF] text-[#026AA2] border border-[#BAE6FD]',
    },
    info: {
      label: 'Informativo',
      icon: <HelpCircle size={13} />,
      className: 'bg-[#EDF3FF] text-[#2459D3] border border-[#BCD0FB]',
    },
  }

  const current = config[normStatus] || {
    label: label || normStatus,
    icon: <HelpCircle size={13} />,
    className: 'bg-[#F1F3F6] text-[#526071] border border-[#E4E7EC]',
  }

  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[6px] font-medium leading-normal select-none ${sizeClasses} ${current.className} ${className}`}
    >
      {showIcon && current.icon}
      <span>{label || current.label}</span>
    </span>
  )
}
