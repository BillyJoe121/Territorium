import React, { useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  Treemap,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { TrendingUp, ShieldCheck, Activity, BarChart2, Layers } from 'lucide-react'

// --- US-234: AreaChart Flujo de Procesamiento Temporal ---
export interface ProcessingTimelinePoint {
  date: string
  ingresados: number
  revisados: number
}

interface ProcessingFlowAreaChartProps {
  data?: ProcessingTimelinePoint[]
  className?: string
}

export const ProcessingFlowAreaChart: React.FC<ProcessingFlowAreaChartProps> = ({
  data,
  className = '',
}) => {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d')

  const defaultData: ProcessingTimelinePoint[] = [
    { date: 'Sem 1', ingresados: 12, revisados: 4 },
    { date: 'Sem 2', ingresados: 25, revisados: 16 },
    { date: 'Sem 3', ingresados: 40, revisados: 28 },
    { date: 'Sem 4', ingresados: 35, revisados: 32 },
    { date: 'Sem 5', ingresados: 52, revisados: 45 },
    { date: 'Sem 6', ingresados: 48, revisados: 46 },
  ]

  const chartData = data && data.length > 0 ? data : defaultData

  return (
    <div className={`dashboard-analytics-card p-4 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-semibold text-slate-100">
            Flujo de Procesamiento: Ingresados vs Revisados (US-234)
          </h3>
        </div>
        <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-750 text-[10px]">
          {(['7d', '30d', '90d'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`dashboard-range-button ${range === r ? 'active' : ''}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorIngresados" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6f9d7c" stopOpacity={0.34} />
                <stop offset="95%" stopColor="#6f9d7c" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorRevisados" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
            <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                borderRadius: '8px',
                fontSize: '11px',
              }}
            />
            <Area
              type="monotone"
              dataKey="ingresados"
              name="Predios Ingresados"
              stroke="#6f9d7c"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorIngresados)"
            />
            <Area
              type="monotone"
              dataKey="revisados"
              name="Predios Revisados"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorRevisados)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// --- US-235: RadarChart Madurez de Expediente (Estilo PMO) ---
export interface DocumentMaturityPoint {
  axis: string
  actual: number // 0-100
  base: number // 0-100
}

interface MaturityRadarChartProps {
  data?: DocumentMaturityPoint[]
  className?: string
}

export const MaturityRadarChart: React.FC<MaturityRadarChartProps> = ({ data, className = '' }) => {
  const defaultRadarData: DocumentMaturityPoint[] = [
    { axis: 'Estudios de Título', actual: 95, base: 100 },
    { axis: 'Planos Topográficos', actual: 88, base: 100 },
    { axis: 'Minutas / Escrituras', actual: 72, base: 100 },
    { axis: 'Paz y Salvos', actual: 60, base: 100 },
    { axis: 'Validación Catastral', actual: 82, base: 100 },
  ]

  const chartData = data && data.length > 0 ? data : defaultRadarData

  return (
    <div className={`dashboard-analytics-card p-4 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="w-4 h-4 text-indigo-400" />
        <h3 className="text-xs font-semibold text-slate-100">
          Completitud Documental del Expediente (US-235)
        </h3>
      </div>
      <p className="text-[11px] text-slate-400 mb-2">
        Evaluación multidimensional de 5 ejes (Línea Base vs Estado Real)
      </p>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="axis" stroke="#94a3b8" fontSize={9} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" fontSize={8} />
            <Radar
              name="Línea Base Esperada"
              dataKey="base"
              stroke="#64748b"
              fill="#64748b"
              fillOpacity={0.15}
            />
            <Radar
              name="Completitud Real (%)"
              dataKey="actual"
              stroke="#2f8151"
              fill="#64a579"
              fillOpacity={0.4}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                borderRadius: '8px',
                fontSize: '11px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// --- US-236: Donut Chart de Niveles de Confianza IA ---
interface AiConfidenceDonutChartProps {
  highCount?: number // >90%
  mediumCount?: number // 75-90%
  lowCount?: number // <75%
  onSelectTier?: (tier: 'high' | 'medium' | 'low') => void
  selectedTier?: 'high' | 'medium' | 'low' | null
  className?: string
}

export const AiConfidenceDonutChart: React.FC<AiConfidenceDonutChartProps> = ({
  highCount = 68,
  mediumCount = 24,
  lowCount = 8,
  onSelectTier,
  selectedTier,
  className = '',
}) => {
  const data = [
    { tier: 'high', name: 'Alta (>90%)', value: highCount, color: '#10b981' },
    { tier: 'medium', name: 'Media (75-90%)', value: mediumCount, color: '#f59e0b' },
    { tier: 'low', name: 'Baja (<75%)', value: lowCount, color: '#f43f5e' },
  ]

  const total = highCount + mediumCount + lowCount

  return (
    <div className={`dashboard-analytics-card p-4 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-semibold text-slate-100">
            Niveles de Confianza IA (US-236)
          </h3>
        </div>
        {selectedTier && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
            Filtrando: {selectedTier}
          </span>
        )}
      </div>

      <div className="h-52 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={50}
              outerRadius={75}
              paddingAngle={4}
              dataKey="value"
              onClick={(entry: any) => onSelectTier?.(entry?.tier)}
              className="cursor-pointer focus:outline-none"
            >
              {data.map((entry) => (
                <Cell
                  key={entry.tier}
                  fill={entry.color}
                  stroke={selectedTier === entry.tier ? '#ffffff' : '#0f172a'}
                  strokeWidth={selectedTier === entry.tier ? 2 : 1}
                  opacity={selectedTier && selectedTier !== entry.tier ? 0.4 : 1}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                borderRadius: '8px',
                fontSize: '11px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-bold text-slate-100 font-mono">{total}</span>
          <span className="text-[9px] text-slate-400">Atributos</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 pt-2 text-[11px]">
        {data.map((item) => (
          <button
            key={item.tier}
            type="button"
            onClick={() => onSelectTier?.(item.tier as any)}
            className="flex items-center gap-1.5 cursor-pointer hover:underline text-slate-300"
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span>{item.name}</span>
            <span className="font-mono text-slate-400">({item.value})</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// --- US-237: Mini Sparklines en Tabla ---
interface MiniSparklineProps {
  progressPercentage: number // 0-100
  color?: string
  width?: number
  className?: string
}

export const MiniSparkline: React.FC<MiniSparklineProps> = ({
  progressPercentage,
  color = '#10b981',
  width = 60,
  className = '',
}) => {
  const clamped = Math.min(100, Math.max(0, progressPercentage))

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      title={`Avance del predio: ${clamped}%`}
    >
      <div
        style={{ width: `${width}px` }}
        className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60"
      >
        <div
          style={{ width: `${clamped}%`, backgroundColor: color }}
          className="h-full rounded-full transition-all duration-300"
        />
      </div>
      <span className="text-[10px] font-mono text-slate-400 w-7 text-right">{clamped}%</span>
    </div>
  )
}

// --- US-238: Treemap de Lotes por Tamaño y Volumen ---
export interface BatchTreemapNode {
  name: string
  size: number
  status: 'completado' | 'en_proceso' | 'bloqueado'
  [key: string]: any
}

interface BatchesTreemapProps {
  batches?: BatchTreemapNode[]
  className?: string
}

export const BatchesTreemap: React.FC<BatchesTreemapProps> = ({ batches, className = '' }) => {
  const defaultBatches: BatchTreemapNode[] = [
    { name: 'Lote 01 (Norte)', size: 45, status: 'completado' },
    { name: 'Lote 02 (Urbano)', size: 32, status: 'completado' },
    { name: 'Lote 03 (Variante)', size: 28, status: 'en_proceso' },
    { name: 'Lote 04 (Subestación)', size: 18, status: 'en_proceso' },
    { name: 'Lote 05 (Reserva)', size: 12, status: 'bloqueado' },
  ]

  const data = batches && batches.length > 0 ? batches : defaultBatches

  const CustomContent = (props: any) => {
    const { x, y, width, height, name, size, status } = props
    if (width < 30 || height < 20) return null

    const bgColors = {
      completado: '#065f46',
      en_proceso: '#1e3a8a',
      bloqueado: '#881337',
    }

    const color = bgColors[status as keyof typeof bgColors] || '#334155'

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: color,
            stroke: '#0f172a',
            strokeWidth: 2,
            rx: 6,
          }}
        />
        {width > 60 && height > 35 && (
          <>
            <text
              x={x + width / 2}
              y={y + height / 2 - 4}
              textAnchor="middle"
              fill="#ffffff"
              fontSize={10}
              fontWeight="bold"
            >
              {name}
            </text>
            <text
              x={x + width / 2}
              y={y + height / 2 + 10}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize={9}
              fontFamily="monospace"
            >
              {size} predios
            </text>
          </>
        )}
      </g>
    )
  }

  return (
    <div className={`dashboard-analytics-card p-4 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <Layers className="w-4 h-4 text-emerald-400" />
        <h3 className="text-xs font-semibold text-slate-100">
          Volumen Documental por Lote - Treemap (US-238)
        </h3>
      </div>
      <p className="text-[11px] text-slate-400 mb-2">
        Área proporcional a la cantidad de folios procesados
      </p>

      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            aspectRatio={4 / 3}
            stroke="#0f172a"
            content={<CustomContent />}
          />
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-4 mt-2 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-emerald-800" />
          <span className="text-slate-300">Completado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-blue-900" />
          <span className="text-slate-300">En Proceso</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-rose-950" />
          <span className="text-slate-300">Bloqueado</span>
        </div>
      </div>
    </div>
  )
}
