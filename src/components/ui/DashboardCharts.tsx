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
    <div className="chart-card">
      <div className="chart-header">
        <h4>Distribución de Predios por Estado</h4>
        <span className="badge badge-neutral">{total} predios evaluados</span>
      </div>
      <div className="chart-container" style={{ width: '100%', height: 260 }}>
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
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                borderColor: '#334155',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '12px',
              }}
              formatter={(val: any) => [`${val} predios (${total ? Math.round((Number(val) / total) * 100) : 0}%)`, 'Cantidad']}
            />
            <Legend verticalAlign="bottom" height={36} iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function DiscrepancyBarChart({ data = DEFAULT_DISCREPANCIES }: { data?: DiscrepancyCategoryData[] }) {
  return (
    <div className="chart-card">
      <div className="chart-header">
        <h4>Discrepancias por Categoría</h4>
        <span className="badge badge-warning">Alertas jurídicas activas</span>
      </div>
      <div className="chart-container" style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 10, right: 30, left: 40, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
            <XAxis type="number" stroke="#94a3b8" />
            <YAxis
              dataKey="category"
              type="category"
              stroke="#94a3b8"
              width={120}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                borderColor: '#334155',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '12px',
              }}
            />
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
    </div>
  )
}

export function DashboardCharts({
  statusData = DEFAULT_STATUS_DATA,
  discrepancyData = DEFAULT_DISCREPANCIES,
}: DashboardChartsProps) {
  return (
    <div className="dashboard-charts-grid">
      <PropertyStatusDonut data={statusData} />
      <DiscrepancyBarChart data={discrepancyData} />
    </div>
  )
}
