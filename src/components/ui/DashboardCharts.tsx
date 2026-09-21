import React from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from 'recharts'
import { ChartPanel, ModernTooltip } from '../pmo/DataComponents'

export interface PropertyStatusData {
  name: string
  value: number
  color: string
}

export interface DiscrepancyCategoryData {
  category: string
  count: number
  severity: 'alta' | 'media' | 'baja'
}

export interface BatchStatusData {
  name: string
  value: number
  color: string
}

export interface ProjectWorkloadData {
  name: string
  records: number
  pending: number
}

export const DASHBOARD_CHART_COLORS = {
  accent: '#6045E8',
  complete: '#7969DA',
  progress: '#8C7DE0',
  pending: '#A79CE9',
  risk: '#C56D7F',
} as const

interface DashboardChartsProps {
  statusData: PropertyStatusData[]
  discrepancyData: DiscrepancyCategoryData[]
}

const DEFAULT_STATUS_DATA: PropertyStatusData[] = [
  { name: 'Aprobados', value: 42, color: DASHBOARD_CHART_COLORS.complete },
  { name: 'Requiere revisión', value: 18, color: DASHBOARD_CHART_COLORS.pending },
  { name: 'Con discrepancias', value: 8, color: DASHBOARD_CHART_COLORS.risk },
  { name: 'En proceso', value: 12, color: DASHBOARD_CHART_COLORS.progress },
]

const DEFAULT_DISCREPANCIES: DiscrepancyCategoryData[] = [
  { category: 'Cabida / Área', count: 14, severity: 'alta' },
  { category: 'Linderos / Rumbos', count: 9, severity: 'media' },
  { category: 'Gravámenes / Embargos', count: 5, severity: 'alta' },
  { category: 'Falsa tradición', count: 3, severity: 'alta' },
  { category: 'Cédula / Identificación', count: 6, severity: 'baja' },
]

const severityColors = {
  alta: DASHBOARD_CHART_COLORS.risk,
  media: DASHBOARD_CHART_COLORS.progress,
  baja: DASHBOARD_CHART_COLORS.pending,
} as const

function EmptyChartState({ message }: { message: string }) {
  return <p className="chart-empty-state">{message}</p>
}

function ChartSeriesKey({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="chart-series-key" aria-label="Series del gráfico">
      {items.map((item) => (
        <span key={item.label}>
          <i style={{ backgroundColor: item.color }} aria-hidden="true" />
          {item.label}
        </span>
      ))}
    </div>
  )
}

export function PropertyStatusDonut({ data = DEFAULT_STATUS_DATA }: { data?: PropertyStatusData[] }) {
  const total = data.reduce((acc, curr) => acc + curr.value, 0)
  const visibleData = data.filter((entry) => entry.value > 0)

  return (
    <ChartPanel
      className="chart-card--status"
      eyebrow="Cobertura de revisión"
      title="Distribución de Predios por Estado"
      summary={`${total} predios evaluados`}
    >
      {total > 0 ? (
        <div className="chart-donut-layout">
          <div className="chart-donut-visual" role="img" aria-label={`Distribución de ${total} predios por estado`}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={visibleData}
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={80}
                  paddingAngle={2}
                  cornerRadius={3}
                  dataKey="value"
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                >
                  {visibleData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={<ModernTooltip />}
                  formatter={(value: unknown) => [`${value} predios (${Math.round((Number(value) / total) * 100)}%)`, 'Cantidad']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="chart-donut-total" aria-hidden="true">
              <strong>{total}</strong>
              <span>predios</span>
            </div>
          </div>

          <ul className="chart-distribution-list" aria-label="Detalle por estado">
            {visibleData.map((entry) => {
              const percentage = Math.round((entry.value / total) * 100)
              return (
                <li key={entry.name}>
                  <span className="chart-distribution-name">
                    <i style={{ backgroundColor: entry.color }} aria-hidden="true" />
                    {entry.name}
                  </span>
                  <span className="chart-distribution-value">
                    <strong>{entry.value}</strong>
                    <small>{percentage}%</small>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : <EmptyChartState message="Aún no hay predios evaluados en este contexto." />}
    </ChartPanel>
  )
}

export function DiscrepancyBarChart({ data = DEFAULT_DISCREPANCIES }: { data?: DiscrepancyCategoryData[] }) {
  const total = data.reduce((acc, entry) => acc + entry.count, 0)

  return (
    <ChartPanel
      className="chart-card--discrepancies"
      eyebrow="Atención jurídica"
      title="Discrepancias por Categoría"
      summary={total > 0 ? `Alertas jurídicas activas · ${total}` : 'Sin alertas activas'}
    >
      {total > 0 ? (
        <div className="chart-visual chart-visual--horizontal" role="img" aria-label={`${total} alertas jurídicas agrupadas por categoría`}>
        <ResponsiveContainer>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 4, right: 30, left: 2, bottom: 0 }}
          >
            <CartesianGrid stroke="var(--color-border-subtle)" strokeDasharray="2 4" horizontal={false} />
            <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
            <YAxis
              dataKey="category"
              type="category"
              axisLine={false}
              tickLine={false}
              width={112}
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 10, fontWeight: 600 }}
            />
            <Tooltip cursor={{ fill: 'var(--color-surface-hover)' }} content={<ModernTooltip />} />
            <Bar
              dataKey="count"
              name="Alertas"
              radius={[0, 5, 5, 0]}
              barSize={16}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`bar-${index}`}
                  fill={severityColors[entry.severity]}
                />
              ))}
              <LabelList dataKey="count" position="right" fill="var(--color-text-secondary)" fontSize={10} fontWeight={700} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      ) : <EmptyChartState message="No hay discrepancias abiertas para este contexto." />}
    </ChartPanel>
  )
}

export function BatchStatusBarChart({ data }: { data: BatchStatusData[] }) {
  const total = data.reduce((acc, curr) => acc + curr.value, 0)

  return (
    <ChartPanel
      className="chart-card--batches"
      eyebrow="Actividad de carga"
      title="Lotes por estado"
      summary={`${total} lotes registrados`}
    >
      {total > 0 ? (
        <div className="chart-visual chart-visual--columns" role="img" aria-label={`Estado de ${total} lotes registrados`}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border-subtle)" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={10} height={38} tick={{ fill: 'var(--color-text-secondary)', fontSize: 10, fontWeight: 600 }} interval={0} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
            <Tooltip cursor={{ fill: 'var(--color-surface-hover)' }} content={<ModernTooltip />} />
            <Bar dataKey="value" name="Lotes" radius={[5, 5, 0, 0]} maxBarSize={44}>
              {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      ) : <EmptyChartState message="Aún no hay lotes registrados en este contexto." />}
    </ChartPanel>
  )
}

export function ProjectWorkloadBarChart({ data }: { data: ProjectWorkloadData[] }) {
  const hasData = data.some((entry) => entry.records > 0 || entry.pending > 0)

  return (
    <ChartPanel
      className="chart-card--workload"
      eyebrow="Distribución de trabajo"
      title="Carga por expediente"
      summary="Predios y pendientes"
    >
      <ChartSeriesKey items={[{ label: 'Predios', color: DASHBOARD_CHART_COLORS.accent }, { label: 'Pendientes', color: DASHBOARD_CHART_COLORS.pending }]} />
      {hasData ? (
        <div className="chart-visual chart-visual--horizontal chart-visual--with-key" role="img" aria-label="Predios y revisiones pendientes por expediente">
        <ResponsiveContainer>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="var(--color-border-subtle)" strokeDasharray="2 4" horizontal={false} />
            <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
            <YAxis dataKey="name" type="category" width={104} axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-secondary)', fontSize: 10, fontWeight: 600 }} />
            <Tooltip cursor={{ fill: 'var(--color-surface-hover)' }} content={<ModernTooltip />} />
            <Bar dataKey="records" name="Predios" fill={DASHBOARD_CHART_COLORS.accent} radius={[0, 4, 4, 0]} barSize={12} />
            <Bar dataKey="pending" name="Pendientes" fill={DASHBOARD_CHART_COLORS.pending} radius={[0, 4, 4, 0]} barSize={12} />
          </BarChart>
        </ResponsiveContainer>
        </div>
      ) : <EmptyChartState message="Los expedientes aún no tienen predios ni revisiones por mostrar." />}
    </ChartPanel>
  )
}

export function DashboardCharts({
  statusData = DEFAULT_STATUS_DATA,
  discrepancyData = DEFAULT_DISCREPANCIES,
  batchData = [],
  projectData = [],
}: DashboardChartsProps & { batchData?: BatchStatusData[]; projectData?: ProjectWorkloadData[] }) {
  return (
    <div className="dashboard-charts-grid">
      <PropertyStatusDonut data={statusData} />
      <BatchStatusBarChart data={batchData} />
      <ProjectWorkloadBarChart data={projectData} />
      <DiscrepancyBarChart data={discrepancyData} />
    </div>
  )
}
