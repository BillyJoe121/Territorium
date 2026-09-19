import React from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
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

interface DashboardChartsProps {
  statusData: PropertyStatusData[]
  discrepancyData: DiscrepancyCategoryData[]
}

const DEFAULT_STATUS_DATA: PropertyStatusData[] = [
  { name: 'Aprobados', value: 42, color: '#10b981' },
  { name: 'Requiere revisión', value: 18, color: '#f59e0b' },
  { name: 'Con discrepancias', value: 8, color: '#ef4444' },
  { name: 'En proceso', value: 12, color: '#3b82f6' },
]

const DEFAULT_DISCREPANCIES: DiscrepancyCategoryData[] = [
  { category: 'Cabida / Área', count: 14, severity: 'alta' },
  { category: 'Linderos / Rumbos', count: 9, severity: 'media' },
  { category: 'Gravámenes / Embargos', count: 5, severity: 'alta' },
  { category: 'Falsa tradición', count: 3, severity: 'alta' },
  { category: 'Cédula / Identificación', count: 6, severity: 'baja' },
]

export function PropertyStatusDonut({ data = DEFAULT_STATUS_DATA }: { data?: PropertyStatusData[] }) {
  const total = data.reduce((acc, curr) => acc + curr.value, 0)

  return (
    <ChartPanel title="Distribución de Predios por Estado" summary={`${total} predios evaluados`}>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              innerRadius={65}
              outerRadius={95}
              paddingAngle={4}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<ModernTooltip />} formatter={(val: unknown) => [`${val} predios (${total ? Math.round((Number(val) / total) * 100) : 0}%)`, 'Cantidad']} />
            <Legend verticalAlign="bottom" height={36} iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartPanel>
  )
}

export function DiscrepancyBarChart({ data = DEFAULT_DISCREPANCIES }: { data?: DiscrepancyCategoryData[] }) {
  return (
    <ChartPanel title="Discrepancias por Categoría" summary="Alertas jurídicas activas">
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 10, right: 30, left: 40, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--ui-line)" horizontal={false} />
            <XAxis type="number" stroke="var(--ui-ink-faint)" />
            <YAxis
              dataKey="category"
              type="category"
              stroke="var(--ui-ink-faint)"
              width={120}
              tick={{ fontSize: 11 }}
            />
            <Tooltip content={<ModernTooltip />} />
            <Bar
              dataKey="count"
              radius={[0, 4, 4, 0]}
              fill="#f59e0b"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`bar-${index}`}
                  fill={entry.severity === 'alta' ? '#ef4444' : entry.severity === 'media' ? '#f59e0b' : '#3b82f6'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartPanel>
  )
}

export function BatchStatusBarChart({ data }: { data: BatchStatusData[] }) {
  const total = data.reduce((acc, curr) => acc + curr.value, 0)

  return (
    <ChartPanel title="Lotes por estado" summary={`${total} lotes registrados`}>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 10, right: 18, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--ui-line)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--ui-ink-faint)" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} stroke="var(--ui-ink-faint)" />
            <Tooltip content={<ModernTooltip />} />
            <Bar dataKey="value" name="Lotes" radius={[4, 4, 0, 0]}>
              {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartPanel>
  )
}

export function ProjectWorkloadBarChart({ data }: { data: ProjectWorkloadData[] }) {
  return (
    <ChartPanel title="Carga por expediente" summary="Predios y pendientes">
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 10, right: 18, left: 8, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--ui-line)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} stroke="var(--ui-ink-faint)" />
            <YAxis dataKey="name" type="category" width={115} stroke="var(--ui-ink-faint)" tick={{ fontSize: 11 }} />
            <Tooltip content={<ModernTooltip />} />
            <Legend />
            <Bar dataKey="records" name="Predios" fill="#2459D3" radius={[0, 4, 4, 0]} />
            <Bar dataKey="pending" name="Pendientes" fill="#9A6700" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
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
