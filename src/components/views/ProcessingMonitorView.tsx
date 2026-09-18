import React, { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  Layers,
  LoaderCircle,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  StopCircle,
} from 'lucide-react'
import type { Batch, DocumentTask, Project } from '../../types'
import { PageHeader } from '../common/PageHeader'
import { StatusBadge } from '../common/StatusBadge'

export interface ProcessingMonitorViewProps {
  project: Project
  batches: Batch[]
  tasks: DocumentTask[]
  onRunBatch?: (batchId: string) => Promise<void>
  onCancelBatch?: (batchId: string) => Promise<void>
  onReprocessTask?: (taskId: string) => Promise<void>
  onNavigateToReview?: () => void
  busyAction?: string | null
}

export function ProcessingMonitorView({
  project,
  batches,
  tasks,
  onRunBatch,
  onCancelBatch,
  onReprocessTask,
  onNavigateToReview,
  busyAction,
}: ProcessingMonitorViewProps) {
  const [selectedBatchId, setSelectedBatchId] = useState<string>(
    batches[0]?.id ?? ''
  )
  const [isPaused, setIsPaused] = useState(false)

  const activeBatch = batches.find((b) => b.id === selectedBatchId) || batches[0]
  const batchTasks = tasks.filter((t) => !activeBatch || t.sourceDocumentId) // o mapeados por batch

  // Pipeline stages
  const stages = [
    { id: 'recepcion', label: '1. Recepción', desc: 'Ingesta de archivos y ZIP' },
    { id: 'validacion', label: '2. Validación', desc: 'Integridad y manifiesto' },
    { id: 'extraccion', label: '3. Extracción IA', desc: 'Títulos, planos y negocio' },
    { id: 'conciliacion', label: '4. Conciliación', desc: 'Cruce multifuente y reglas' },
    { id: 'revision', label: '5. Revisión', desc: 'Mesa humana y certificación' },
  ]

  const activeStageIndex = !activeBatch
    ? 0
    : activeBatch.jobState === 'pendiente'
    ? 1
    : activeBatch.jobState === 'en_proceso'
    ? 2
    : activeBatch.jobState === 'requiere_revision'
    ? 4
    : activeBatch.jobState === 'completado'
    ? 4
    : 2

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Orquestador en Tiempo Real"
        title="Monitor de Procesamiento"
        description={`Supervisión del pipeline de extracción y conciliación para el expediente "${project.name}".`}
        actions={
          <div className="flex items-center gap-2">
            {activeBatch && activeBatch.jobState === 'en_proceso' && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsPaused((prev) => !prev)}
                >
                  {isPaused ? <Play size={14} /> : <Pause size={14} />}
                  {isPaused ? 'Reanudar Lote' : 'Pausar Lote'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => onCancelBatch && onCancelBatch(activeBatch.id)}
                  disabled={busyAction === `cancel:${activeBatch.id}`}
                >
                  <Ban size={14} /> Cancelar Lote
                </button>
              </>
            )}
            {activeBatch && activeBatch.jobState === 'pendiente' && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onRunBatch && onRunBatch(activeBatch.id)}
                disabled={busyAction === `run:${activeBatch.id}`}
              >
                <Play size={14} /> Iniciar Procesamiento
              </button>
            )}
          </div>
        }
      />

      {/* Selector de Lotes */}
      {batches.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-semibold text-[#667085]">Lote:</span>
          {batches.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors ${
                (activeBatch?.id === b.id)
                  ? 'bg-[#2459D3] text-white border-[#2459D3]'
                  : 'bg-white text-[#526071] border-[#E4E7EC] hover:bg-[#F1F3F6]'
              }`}
              onClick={() => setSelectedBatchId(b.id)}
            >
              {b.id}
            </button>
          ))}
        </div>
      )}

      {/* Visualización del Pipeline en 5 Etapas */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-3">
          <div>
            <h3 className="text-sm font-semibold text-[#182230]">
              Estado del Pipeline Operativo
            </h3>
            <p className="text-xs text-[#526071]">
              Flujo secuencial de procesamiento documental e integración jurídica
            </p>
          </div>
          {activeBatch && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#667085]">Estado del lote:</span>
              <StatusBadge status={activeBatch.jobState} />
            </div>
          )}
        </div>

        {/* Diagrama de etapas */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {stages.map((st, idx) => {
            const isCompleted = idx < activeStageIndex
            const isCurrent = idx === activeStageIndex
            return (
              <div
                key={st.id}
                className={`p-4 rounded-lg border transition-all ${
                  isCurrent
                    ? 'bg-[#EDF3FF] border-[#2459D3] shadow-sm'
                    : isCompleted
                    ? 'bg-[#EDFDF5] border-[#A3E6C5]'
                    : 'bg-[#F7F8FA] border-[#E4E7EC] opacity-80'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#667085]">
                    Paso {idx + 1}
                  </span>
                  {isCompleted && <CheckCircle2 size={14} className="text-[#18794E]" />}
                  {isCurrent && activeBatch?.jobState === 'en_proceso' && (
                    <LoaderCircle size={14} className="text-[#2459D3] spin" />
                  )}
                </div>
                <strong className="text-xs font-semibold text-[#182230] block">
                  {st.label}
                </strong>
                <p className="text-[11px] text-[#526071] mt-1 leading-snug">
                  {st.desc}
                </p>
              </div>
            )
          })}
        </div>

        {/* Progreso del Lote Activo */}
        {activeBatch && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#526071]">
                Progreso del lote ({activeBatch.documentCount || 0} documentos registrados)
              </span>
              <span className="font-semibold tabular-nums text-[#182230]">
                {Math.round(activeBatch.progress || 0)}%
              </span>
            </div>
            <div className="w-full bg-[#F1F3F6] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#2459D3] h-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.max(0, Math.round(activeBatch.progress || 0)))}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabla de Tareas del Lote */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-[#E4E7EC] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#182230]">
              Tareas del Lote
            </h3>
            <p className="text-xs text-[#526071]">
              Registro detallado de tareas por extractor y leases asignados
            </p>
          </div>
        </div>

        {tasks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID Tarea</th>
                  <th>Tipo Extractor</th>
                  <th>Estado</th>
                  <th>Dependencias</th>
                  <th>Reintentos</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <span className="code-badge">{task.id.slice(0, 10)}</span>
                    </td>
                    <td className="font-medium text-xs">
                      {task.extractorKey === 'title_study'
                        ? 'Estudio de Títulos'
                        : task.extractorKey === 'plan'
                        ? 'Plano Topográfico'
                        : task.extractorKey === 'negotiation'
                        ? 'Ficha de Negociación'
                        : task.extractorKey}
                    </td>
                    <td>
                      <StatusBadge status={task.status} />
                    </td>
                    <td>
                      <span
                        className={`text-xs ${
                          task.dependencyStatus === 'blocked'
                            ? 'text-[#B42318] font-medium'
                            : task.dependencyStatus === 'waiting'
                            ? 'text-[#9A6700]'
                            : 'text-[#18794E]'
                        }`}
                      >
                        {task.dependencyStatus === 'ready'
                          ? 'Cumplidas'
                          : task.dependencyStatus === 'blocked'
                          ? 'Bloqueadas'
                          : 'En espera'}
                      </span>
                    </td>
                    <td className="tabular-nums text-xs">
                      {task.attemptCount || 0} / {task.maxAttempts || 3}
                    </td>
                    <td>
                      {(task.status === 'failed' || task.status === 'blocked') && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onReprocessTask && onReprocessTask(task.id)}
                          disabled={busyAction === `reprocess:${task.id}`}
                        >
                          <RotateCcw size={12} /> Reprocesar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-[#667085]">
            No hay tareas registradas en este lote.
          </div>
        )}
      </div>
    </div>
  )
}
