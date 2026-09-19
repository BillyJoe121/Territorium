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
    <div className="monitor-view">
      <PageHeader
        eyebrow="Orquestador en Tiempo Real"
        title="Monitor de Procesamiento"
        description={`Supervisión del pipeline de extracción y conciliación para el expediente "${project.name}".`}
        actions={
          <div className="monitor-top-actions">
            {activeBatch && activeBatch.jobState === 'en_proceso' && (
              <>
                <button
                  type="button"
                  className="button secondary small"
                  onClick={() => setIsPaused((prev) => !prev)}
                >
                  {isPaused ? <Play size={14} /> : <Pause size={14} />}
                  {isPaused ? 'Reanudar Lote' : 'Pausar Lote'}
                </button>
                <button
                  type="button"
                  className="button danger small"
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
                className="button primary small"
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
        <div className="monitor-batch-bar">
          <span className="batch-label">Lote:</span>
          {batches.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`monitor-batch-btn ${activeBatch?.id === b.id ? 'active' : ''}`}
              onClick={() => setSelectedBatchId(b.id)}
            >
              {b.id}
            </button>
          ))}
        </div>
      )}

      {/* Visualización del Pipeline en 5 Etapas */}
      <div className="card pipeline-card">
        <div className="pipeline-card-header">
          <div>
            <h3>Estado del Pipeline Operativo</h3>
            <p className="pipeline-subtitle">
              Flujo secuencial de procesamiento documental e integración jurídica
            </p>
          </div>
          {activeBatch && (
            <div className="pipeline-status-badge">
              <span>Estado del lote:</span>
              <StatusBadge status={activeBatch.jobState} />
            </div>
          )}
        </div>

        {/* Diagrama de etapas */}
        <div className="pipeline-stages-grid">
          {stages.map((st, idx) => {
            const isCompleted = idx < activeStageIndex
            const isCurrent = idx === activeStageIndex
            return (
              <div
                key={st.id}
                className={`pipeline-stage-card ${
                  isCurrent ? 'is-current' : isCompleted ? 'is-completed' : 'is-pending'
                }`}
              >
                <div className="stage-top">
                  <span className="stage-step-tag">Paso {idx + 1}</span>
                  {isCompleted && <CheckCircle2 size={14} className="text-success" />}
                  {isCurrent && activeBatch?.jobState === 'en_proceso' && (
                    <LoaderCircle size={14} className="spin text-accent" />
                  )}
                </div>
                <strong>{st.label}</strong>
                <p>{st.desc}</p>
              </div>
            )
          })}
        </div>

        {/* Progreso del Lote Activo */}
        {activeBatch && (
          <div className="monitor-progress-wrapper">
            <div className="monitor-progress-header">
              <span>
                Progreso del lote ({activeBatch.documentCount || 0} documentos registrados)
              </span>
              <strong>
                {Math.round(activeBatch.progress || 0)}%
              </strong>
            </div>
            <div className="monitor-progress-track">
              <div
                className="monitor-progress-fill"
                style={{
                  width: `${Math.min(100, Math.max(0, Math.round(activeBatch.progress || 0)))}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabla de Tareas del Lote */}
      <div className="card monitor-tasks-card">
        <div className="monitor-tasks-header">
          <div>
            <h3>Tareas del Lote</h3>
            <p className="pipeline-subtitle">
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
