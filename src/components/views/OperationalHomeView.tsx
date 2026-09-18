import React from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Layers,
  Play,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import type { Batch, Project, PropertyRecord, ReviewTask } from '../../types'
import { PageHeader } from '../common/PageHeader'
import { StatusBadge } from '../common/StatusBadge'

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
  const activeProjects = projects.filter((p) => !p.isArchived)

  // Métricas reales y operativas derivadas del estado actual
  const currentRecords = activeProject
    ? records.filter((r) => r.projectId === activeProject.id)
    : records
  const currentBatches = activeProject
    ? batches.filter((b) => b.projectId === activeProject.id)
    : batches
  const currentReviews = activeProject
    ? reviews.filter((rev) => currentRecords.some((rec) => rec.id === rev.recordId))
    : reviews

  const pendingCount = currentReviews.filter((r) => r.state === 'pendiente').length
  const approvedCount = currentRecords.filter((r) => r.reviewState === 'aprobado').length
  const returnedCount = currentRecords.filter((r) => r.reviewState === 'devuelto').length
  const inProgressBatches = currentBatches.filter((b) => b.jobState === 'en_proceso')
  const failedBatches = currentBatches.filter((b) => b.jobState === 'fallido')

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Panel de Control Operativo"
        title={activeProject ? activeProject.name : 'Operación Territorial Global'}
        description={
          activeProject
            ? `Expediente activo en ${activeProject.municipality}, ${activeProject.department}. Seleccione una tarea para intervenir o cambiar de contexto.`
            : 'Resumen consolidado de todos los proyectos prediales. Identifique lotes con atención prioritaria y seleccione un expediente para operar.'
        }
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
                  onClick={() => onNavigate('carga')}
                >
                  <UploadCloud size={14} /> Cargar Lote
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

      {/* Fila 1: Bandeja de Atención Prioritaria */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-5 border-l-4 border-l-[#9A6700]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider">
              Revisiones Pendientes
            </span>
            <Clock size={16} className="text-[#9A6700]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums text-[#182230]">
              {pendingCount}
            </span>
            <span className="text-xs text-[#667085]">predios por validar</span>
          </div>
          {pendingCount > 0 ? (
            <button
              type="button"
              onClick={() => onNavigate('revision')}
              className="mt-3 text-xs font-medium text-[#2459D3] hover:underline flex items-center gap-1"
            >
              Ir a la estación de revisión <ArrowRight size={13} />
            </button>
          ) : (
            <p className="mt-3 text-xs text-[#18794E]">Al día, sin pendientes</p>
          )}
        </div>

        <div className="card p-5 border-l-4 border-l-[#18794E]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider">
              Predios Aprobados
            </span>
            <CheckCircle2 size={16} className="text-[#18794E]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums text-[#182230]">
              {approvedCount}
            </span>
            <span className="text-xs text-[#667085]">certificados</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('exportar')}
            className="mt-3 text-xs font-medium text-[#2459D3] hover:underline flex items-center gap-1"
          >
            Generar matrices de entrega <ArrowRight size={13} />
          </button>
        </div>

        <div className="card p-5 border-l-4 border-l-[#026AA2]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider">
              Lotes en Proceso
            </span>
            <Layers size={16} className="text-[#026AA2]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums text-[#182230]">
              {inProgressBatches.length}
            </span>
            <span className="text-xs text-[#667085]">tareas activas</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('carga')}
            className="mt-3 text-xs font-medium text-[#2459D3] hover:underline flex items-center gap-1"
          >
            Ver monitor de pipeline <ArrowRight size={13} />
          </button>
        </div>

        <div className="card p-5 border-l-4 border-l-[#B42318]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider">
              Devueltos o Fallos
            </span>
            <AlertTriangle size={16} className="text-[#B42318]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums text-[#182230]">
              {returnedCount + failedBatches.length}
            </span>
            <span className="text-xs text-[#667085]">excepciones</span>
          </div>
          <p className="mt-3 text-xs text-[#526071]">
            {returnedCount > 0 ? `${returnedCount} predios con observaciones` : 'Sin errores críticos'}
          </p>
        </div>
      </div>

      {/* Fila 2: Expedientes Recientes y Acceso Rápido */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
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

        {/* Panel Lateral: Enlaces Rápidos y Seguridad */}
        <div className="space-y-6">
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-[#182230] border-b border-[#E4E7EC] pb-2">
              Flujo Operativo Recomendado
            </h3>
            <div className="space-y-2.5 text-xs text-[#526071]">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#F1F3F6] font-semibold text-[#182230] flex items-center justify-center flex-shrink-0">
                  1
                </span>
                <div>
                  <strong className="text-[#182230] block">Cargar y validar insumos</strong>
                  <span>Suba escrituras, certificados de tradición y planos topográficos en ZIP.</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#F1F3F6] font-semibold text-[#182230] flex items-center justify-center flex-shrink-0">
                  2
                </span>
                <div>
                  <strong className="text-[#182230] block">Revisión jurídica asistida</strong>
                  <span>Compare valores extraídos contra el documento fuente y resuelva discordancias.</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#F1F3F6] font-semibold text-[#182230] flex items-center justify-center flex-shrink-0">
                  3
                </span>
                <div>
                  <strong className="text-[#182230] block">Certificación y entregables</strong>
                  <span>Genere el libro CORRESPONDENCIA.xlsx con firmas y sellos de tiempo.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5 bg-[#F1F3F6] border border-[#E4E7EC] space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#182230]">
              <ShieldCheck size={16} className="text-[#2459D3]" />
              <span>Gobernanza y Trazabilidad</span>
            </div>
            <p className="text-xs text-[#526071] leading-relaxed">
              Toda modificación de atributo requiere motivo justificado y queda registrada con hash SHA-256 en la bitácora inmutable.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('trazabilidad')}
              className="text-xs font-medium text-[#2459D3] hover:underline block pt-1"
            >
              Consultar bitácora forense →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
