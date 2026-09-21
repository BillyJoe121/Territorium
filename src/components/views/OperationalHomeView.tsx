import React, { useMemo } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FolderKanban,
  Layers,
  UploadCloud,
} from 'lucide-react'
import type { Batch, Project, PropertyRecord, ReviewTask } from '../../types'
import { PageHeader } from '../common/PageHeader'
import {
  DashboardCharts,
  DASHBOARD_CHART_COLORS,
  type BatchStatusData,
  type DiscrepancyCategoryData,
  type ProjectWorkloadData,
  type PropertyStatusData,
} from '../ui/DashboardCharts'

export interface OperationalHomeViewProps {
  projects: Project[]
  batches: Batch[]
  records: PropertyRecord[]
  reviews: ReviewTask[]
  activeProject?: Project
  onNavigate: (screen: any) => void
  onSelectProject: (projectId: string) => void
  onClearContext: () => void
}

export function OperationalHomeView({
  projects,
  batches,
  records,
  reviews,
  activeProject,
  onNavigate,
  onSelectProject,
  onClearContext,
}: OperationalHomeViewProps) {
  const activeProjects = useMemo(() => projects.filter((p) => !p.isArchived), [projects])

  // Métricas reales y operativas derivadas del estado actual
  const currentRecords = useMemo(
    () => activeProject ? records.filter((r) => r.projectId === activeProject.id) : records,
    [activeProject?.id, records],
  )
  const currentBatches = useMemo(
    () => activeProject ? batches.filter((b) => b.projectId === activeProject.id) : batches,
    [activeProject?.id, batches],
  )
  const currentReviews = useMemo(
    () => activeProject ? reviews.filter((rev) => currentRecords.some((rec) => rec.id === rev.recordId)) : reviews,
    [activeProject?.id, currentRecords, reviews],
  )

  const pendingCount = currentReviews.filter((r) => r.state === 'pendiente').length
  const approvedCount = currentRecords.filter((r) => r.reviewState === 'aprobado').length
  const returnedCount = currentRecords.filter((r) => r.reviewState === 'devuelto').length
  const inProgressBatches = currentBatches.filter((b) => b.jobState === 'en_proceso')
  const failedBatches = currentBatches.filter((b) => b.jobState === 'fallido')

  const propertyStatusData = useMemo<PropertyStatusData[]>(() => [
    { name: 'Aprobados', value: currentRecords.filter((record) => record.reviewState === 'aprobado').length, color: DASHBOARD_CHART_COLORS.complete },
    { name: 'Por revisar', value: currentRecords.filter((record) => record.reviewState === 'pendiente').length, color: DASHBOARD_CHART_COLORS.pending },
    { name: 'Devueltos', value: currentRecords.filter((record) => record.reviewState === 'devuelto').length, color: DASHBOARD_CHART_COLORS.risk },
  ], [currentRecords])

  const batchStatusData = useMemo<BatchStatusData[]>(() => {
    const states = [
      { key: 'completado', name: 'Completados', color: DASHBOARD_CHART_COLORS.complete },
      { key: 'en_proceso', name: 'En proceso', color: DASHBOARD_CHART_COLORS.accent },
      { key: 'pendiente', name: 'Pendientes', color: DASHBOARD_CHART_COLORS.pending },
      { key: 'fallido', name: 'Fallidos', color: DASHBOARD_CHART_COLORS.risk },
    ] as const
    return states.map((state) => ({
      name: state.name,
      value: currentBatches.filter((batch) => batch.jobState === state.key).length,
      color: state.color,
    }))
  }, [currentBatches])

  const projectWorkloadData = useMemo<ProjectWorkloadData[]>(() => activeProjects.slice(0, 6).map((project) => {
    const projectRecords = records.filter((record) => record.projectId === project.id)
    const projectRecordIds = new Set(projectRecords.map((record) => record.id))
    return {
      name: project.name.length > 18 ? `${project.name.slice(0, 18)}…` : project.name,
      records: projectRecords.length,
      pending: reviews.filter((review) => projectRecordIds.has(review.recordId) && review.state === 'pendiente').length,
    }
  }), [activeProjects, records, reviews])

  const discrepancyData = useMemo<DiscrepancyCategoryData[]>(() => {
    const grouped = new Map<string, { count: number; severity: 'alta' | 'media' | 'baja' }>()
    const severityRank = { baja: 1, media: 2, alta: 3 }
    for (const review of currentReviews) {
      const category = review.title?.split(':')[0]?.trim() || 'Revisión jurídica'
      const current = grouped.get(category)
      if (!current) {
        grouped.set(category, { count: 1, severity: review.severity })
      } else {
        current.count += 1
        if (severityRank[review.severity] > severityRank[current.severity]) current.severity = review.severity
      }
    }
    return Array.from(grouped, ([category, value]) => ({ category, ...value }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [currentReviews])

  return (
    <div className="space-y-6">
      <PageHeader
        className={activeProject ? undefined : 'operational-home-header compact'}
        eyebrow="Panel de Control Operativo"
        title={activeProject?.name}
        description={activeProject
          ? `Expediente activo en ${activeProject.municipality}, ${activeProject.department}. Seleccione una tarea para intervenir o cambiar de contexto.`
          : undefined}
        actions={
          <div className="flex items-center gap-2">
            {activeProject ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={onClearContext}
                >
                  Vista Global
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => onNavigate('proyecto_detalle')}
                >
                  <FileSpreadsheet size={14} /> Ficha del Expediente
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onNavigate('expedientes')}
              >
                <FolderKanban size={14} /> Ver Expedientes
              </button>
            )}
          </div>
        }
      />

      <div className="operational-workspace-grid">
        <div className="operational-main-column">

      {/* Fila 1: Bandeja de Atención Prioritaria */}
      <div className="operational-priority-row">
        <article className="operational-priority-card">
          <div className="operational-priority-header">
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider">
              Revisiones Pendientes
            </span>
            <Clock size={15} />
          </div>
          <div className="operational-priority-value">
            <span className="text-3xl font-semibold tabular-nums text-[#182230]">
              {pendingCount}
            </span>
            <span className="text-xs text-[#667085]">predios por validar</span>
          </div>
          {pendingCount > 0 ? (
            <button
              type="button"
              onClick={() => onNavigate(activeProject ? 'proyecto_detalle' : 'expedientes')}
              className="operational-priority-action"
            >
              Ir a la ficha del expediente <ArrowRight size={13} />
            </button>
          ) : (
            <p className="operational-priority-note">Al día, sin pendientes</p>
          )}
        </article>

        <article className="operational-priority-card">
          <div className="operational-priority-header">
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider">
              Predios Aprobados
            </span>
            <CheckCircle2 size={15} />
          </div>
          <div className="operational-priority-value">
            <span className="text-3xl font-semibold tabular-nums text-[#182230]">
              {approvedCount}
            </span>
            <span className="text-xs text-[#667085]">certificados</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate(activeProject ? 'proyecto_detalle' : 'expedientes')}
            className="operational-priority-action"
          >
            Ver entregables y matrices <ArrowRight size={13} />
          </button>
        </article>

        <article className="operational-priority-card">
          <div className="operational-priority-header">
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider">
              Lotes en Proceso
            </span>
            <Layers size={15} />
          </div>
          <div className="operational-priority-value">
            <span className="text-3xl font-semibold tabular-nums text-[#182230]">
              {inProgressBatches.length}
            </span>
            <span className="text-xs text-[#667085]">tareas activas</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate(activeProject ? 'proyecto_detalle' : 'expedientes')}
            className="operational-priority-action"
          >
            Ver estado de procesamiento <ArrowRight size={13} />
          </button>
        </article>

        <article className="operational-priority-card">
          <div className="operational-priority-header">
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider">
              Devueltos o Fallos
            </span>
            <AlertTriangle size={15} />
          </div>
          <div className="operational-priority-value">
            <span className="text-3xl font-semibold tabular-nums text-[#182230]">
              {returnedCount + failedBatches.length}
            </span>
            <span className="text-xs text-[#667085]">excepciones</span>
          </div>
          <p className="operational-priority-note">
            {returnedCount > 0 ? `${returnedCount} predios con observaciones` : 'Sin errores críticos'}
          </p>
        </article>
      </div>

      <DashboardCharts
        statusData={propertyStatusData}
        batchData={batchStatusData}
        projectData={projectWorkloadData}
        discrepancyData={discrepancyData}
      />

      {/* Expedientes recientes */}
      <section className="operational-projects-panel card">
        <div className="operational-projects-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#182230]">Expedientes Prediales</h2>
              <p className="text-xs text-[#526071]">Seleccione un proyecto para enfocar la sesión de trabajo</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('expedientes')}
              className="btn btn-secondary btn-sm"
            >
              Ver todos ({activeProjects.length})
            </button>
          </div>

          <div className="divide-y divide-[#E4E7EC] -mx-6">
            {activeProjects.slice(0, 5).map((project) => {
              const projRecords = records.filter((r) => r.projectId === project.id)
              const projPending = reviews.filter(
                (rev) => projRecords.some((r) => r.id === rev.recordId) && rev.state === 'pendiente'
              ).length
              const isSelected = activeProject?.id === project.id

              return (
                <div
                  key={project.id}
                  className={`px-6 py-3.5 flex items-center justify-between transition-colors hover:bg-[#EDF1F6] cursor-pointer ${
                    isSelected ? 'bg-[#EDF3FF] border-l-2 border-l-[#2459D3]' : ''
                  }`}
                  onClick={() => onSelectProject(project.id)}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-semibold text-[#182230]">
                        {project.name}
                      </strong>
                      {isSelected && (
                        <span className="text-[10px] font-semibold uppercase bg-[#2459D3] text-white px-1.5 py-0.2 rounded">
                          Activo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#526071]">
                      {project.municipality}, {project.department} · {project.clientName || 'Infraestructura'}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-xs font-semibold tabular-nums text-[#182230]">
                        {projRecords.length} predios
                      </span>
                      <p className="text-[11px] text-[#667085]">
                        {projPending > 0 ? (
                          <span className="text-[#9A6700] font-medium">{projPending} pendientes</span>
                        ) : (
                          'Al día'
                        )}
                      </p>
                    </div>
                    <ArrowRight size={16} className="text-[#98A2B3]" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </section>
        </div>

      </div>
    </div>
  )
}
