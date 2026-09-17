import React from 'react'
import { CheckCircle2, AlertTriangle, Layers, ShieldAlert } from 'lucide-react'

export interface KpiMetric {
  id: string
  title: string
  value: string | number
  trend?: string
  trendPositive?: boolean
  description: string
  icon: React.ReactNode
  variant?: 'primary' | 'success' | 'warning' | 'danger'
}

interface BentoGridKpisProps {
  metrics?: KpiMetric[]
}

const DEFAULT_METRICS: KpiMetric[] = [
  {
    id: 'total-predios',
    title: 'Predios en Proceso',
    value: '184',
    trend: '+12% esta semana',
    trendPositive: true,
    description: 'En 6 proyectos territoriales activos',
    icon: <Layers size={20} />,
    variant: 'primary',
  },
  {
    id: 'aprobados',
    title: 'Títulos Consolidados',
    value: '142',
    trend: '77.1% completitud',
    trendPositive: true,
    description: 'Reconciliados y sin discrepancias críticas',
    icon: <CheckCircle2 size={20} />,
    variant: 'success',
  },
  {
    id: 'discrepancias',
    title: 'Discrepancias Activas',
    value: '18',
    trend: '-4 resueltas hoy',
    trendPositive: true,
    description: 'Requieren revisión jurídica o topográfica',
    icon: <AlertTriangle size={20} />,
    variant: 'warning',
  },
  {
    id: 'alertas-legales',
    title: 'Riesgos Jurídicos Altos',
    value: '5',
    trend: 'Embargos / Falsa tradición',
    trendPositive: false,
    description: 'Retenidos de la oferta económica',
    icon: <ShieldAlert size={20} />,
    variant: 'danger',
  },
]

export function BentoGridKpis({ metrics = DEFAULT_METRICS }: BentoGridKpisProps) {
  return (
    <div className="bento-grid-container">
      {metrics.map((metric) => (
        <div key={metric.id} className={`bento-kpi-card variant-${metric.variant || 'primary'}`}>
          <div className="bento-kpi-header">
            <span className="bento-kpi-title">{metric.title}</span>
            <div className="bento-kpi-icon">{metric.icon}</div>
          </div>
          <div className="bento-kpi-body">
            <span className="bento-kpi-value">{metric.value}</span>
            {metric.trend && (
              <span className={`bento-kpi-trend ${metric.trendPositive ? 'positive' : 'negative'}`}>
                <span>{metric.trend}</span>
              </span>
            )}
          </div>
          <p className="bento-kpi-description">{metric.description}</p>
        </div>
      ))}
    </div>
  )
}
