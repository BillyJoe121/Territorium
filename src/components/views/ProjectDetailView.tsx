import React, { useState } from 'react'
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Layers,
  MapPin,
  Settings2,
  Shield,
  UploadCloud,
  Users,
  Zap,
} from 'lucide-react'
import type { Batch, Project, PropertyRecord, ReviewTask, SourceDocument } from '../../types'
import { PageHeader } from '../common/PageHeader'
import { StatusBadge } from '../common/StatusBadge'

export interface ProjectDetailViewProps {
  project: Project
  batches: Batch[]
  records: PropertyRecord[]
  reviews: ReviewTask[]
  documents: SourceDocument[]
  onNavigate: (screen: any) => void
  onEditMetadata?: () => void
}

export function ProjectDetailView({
  project,
  batches,
  records,
  reviews,
  documents,
  onNavigate,
  onEditMetadata,
}: ProjectDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'resumen' | 'lotes' | 'predios'>('resumen')

  const projectBatches = batches.filter((b) => b.projectId === project.id)
  const projectRecords = records.filter((r) => r.projectId === project.id)
  const projectDocs = documents.filter((d) => d.projectId === project.id)

  const approvedCount = projectRecords.filter((r) => r.reviewState === 'aprobado').length
  const pendingCount = projectRecords.filter((r) => r.reviewState === 'pendiente').length
  const returnedCount = projectRecords.filter((r) => r.reviewState === 'devuelto').length

  const progressPercent =
    projectRecords.length > 0 ? Math.round((approvedCount / projectRecords.length) * 100) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Expediente #${project.id.slice(0, 8)}`}
        title={project.name}
        description={`Proyecto de infraestructura en ${project.municipality}, ${project.department}. Cliente: ${project.clientName || 'Infraestructura Nacional'}.`}
        meta={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-[#526071]">
              <MapPin size={14} className="text-[#667085]" />
              {project.municipality}, {project.department}
            </span>
            {project.powerLine && (
              <span className="flex items-center gap-1.5 text-xs text-[#526071]">
                <Zap size={14} className="text-[#667085]" />
                Línea: {project.powerLine}
              </span>
            )}
            <StatusBadge
              status={project.isArchived ? 'cancelado' : 'aprobado'}
              label={project.isArchived ? 'Archivado' : 'Activo'}
            />
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate('usuarios')}
            >
              <Users size={14} /> Equipo
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onNavigate('carga')}
            >
              <UploadCloud size={14} /> Cargar Lote
            </button>
          </div>
        }
      />

      {/* Tabs de Navegación Contextual */}
      <div className="flex items-center gap-2 border-b border-[#E4E7EC] pb-px">
        <button
          type="button"
          className={`px-4 py-2 text-xs font-semibold rounded-t-md transition-colors ${
            activeTab === 'resumen'
              ? 'border-b-2 border-b-[#2459D3] text-[#2459D3] bg-[#FFFFFF]'
              : 'text-[#526071] hover:text-[#182230] hover:bg-[#F1F3F6]'
          }`}
          onClick={() => setActiveTab('resumen')}
        >
          Resumen y Métricas
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-xs font-semibold rounded-t-md transition-colors ${
            activeTab === 'lotes'
              ? 'border-b-2 border-b-[#2459D3] text-[#2459D3] bg-[#FFFFFF]'
              : 'text-[#526071] hover:text-[#182230] hover:bg-[#F1F3F6]'
          }`}
          onClick={() => setActiveTab('lotes')}
        >
          Lotes Documentales ({projectBatches.length})
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-xs font-semibold rounded-t-md transition-colors ${
            activeTab === 'predios'
              ? 'border-b-2 border-b-[#2459D3] text-[#2459D3] bg-[#FFFFFF]'
              : 'text-[#526071] hover:text-[#182230] hover:bg-[#F1F3F6]'
          }`}
          onClick={() => setActiveTab('predios')}
        >
          Predios Consolidados ({projectRecords.length})
        </button>
      </div>

      {activeTab === 'resumen' && (
        <div className="space-y-6">
          {/* Ciclo de Vida del Expediente (Pipeline Stages) */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#182230]">
                Avance del Ciclo Predial
              </h3>
              <span className="text-xs font-semibold tabular-nums text-[#2459D3]">
                {progressPercent}% Completado
              </span>
            </div>

            {/* Barra de Progreso */}
            <div className="w-full bg-[#F1F3F6] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#2459D3] h-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* 5 Etapas del Pipeline */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
              <div className="p-3 bg-[#F7F8FA] border border-[#E4E7EC] rounded-lg">
                <span className="text-[10px] font-semibold text-[#667085] uppercase tracking-wider block">
                  Etapa 1
                </span>
                <strong className="text-xs text-[#182230] block mt-0.5">Ingesta</strong>
                <p className="text-[11px] text-[#526071] mt-1 tabular-nums">
                  {projectDocs.length} documentos
                </p>
              </div>

              <div className="p-3 bg-[#F7F8FA] border border-[#E4E7EC] rounded-lg">
                <span className="text-[10px] font-semibold text-[#667085] uppercase tracking-wider block">
                  Etapa 2
                </span>
                <strong className="text-xs text-[#182230] block mt-0.5">Validación</strong>
                <p className="text-[11px] text-[#526071] mt-1 tabular-nums">
                  {projectBatches.length} lotes validados
                </p>
              </div>

              <div className="p-3 bg-[#F7F8FA] border border-[#E4E7EC] rounded-lg">
                <span className="text-[10px] font-semibold text-[#667085] uppercase tracking-wider block">
                  Etapa 3
                </span>
                <strong className="text-xs text-[#182230] block mt-0.5">Extracción IA</strong>
                <p className="text-[11px] text-[#526071] mt-1 tabular-nums">
                  {projectRecords.length} predios
                </p>
              </div>

              <div className="p-3 bg-[#F7F8FA] border border-[#E4E7EC] rounded-lg">
                <span className="text-[10px] font-semibold text-[#667085] uppercase tracking-wider block">
                  Etapa 4
                </span>
                <strong className="text-xs text-[#182230] block mt-0.5">Revisión Jurídica</strong>
                <p className="text-[11px] text-[#9A6700] mt-1 tabular-nums font-medium">
                  {pendingCount} pendientes
                </p>
              </div>

              <div className="p-3 bg-[#F7F8FA] border border-[#E4E7EC] rounded-lg">
                <span className="text-[10px] font-semibold text-[#667085] uppercase tracking-wider block">
                  Etapa 5
                </span>
                <strong className="text-xs text-[#182230] block mt-0.5">Entregables</strong>
                <p className="text-[11px] text-[#18794E] mt-1 tabular-nums font-medium">
                  {approvedCount} listos
                </p>
              </div>
            </div>
          </div>

          {/* Tarjetas de Acciones Rápidas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="w-8 h-8 rounded-lg bg-[#EDF3FF] text-[#2459D3] flex items-center justify-center mb-3">
                  <UploadCloud size={18} />
                </div>
                <h4 className="text-sm font-semibold text-[#182230]">Ingesta de Archivos</h4>
                <p className="text-xs text-[#526071] leading-relaxed">
                  Cargar nuevos paquetes documentales, certificados de tradición o planos en formato ZIP.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('carga')}
                className="mt-4 text-xs font-medium text-[#2459D3] hover:underline flex items-center gap-1 self-start"
              >
                Abrir ingesta y manifiesto <ArrowRight size={13} />
              </button>
            </div>

            <div className="card p-5 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="w-8 h-8 rounded-lg bg-[#FEF7EC] text-[#9A6700] flex items-center justify-center mb-3">
                  <Clock size={18} />
                </div>
                <h4 className="text-sm font-semibold text-[#182230]">Mesa de Revisión</h4>
                <p className="text-xs text-[#526071] leading-relaxed">
                  {pendingCount > 0
                    ? `Hay ${pendingCount} predio(s) esperando certificación o corrección de linderos.`
                    : 'Todos los predios de este proyecto han sido certificados.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('revision')}
                className="mt-4 text-xs font-medium text-[#2459D3] hover:underline flex items-center gap-1 self-start"
              >
                Abrir estación de revisión <ArrowRight size={13} />
              </button>
            </div>

            <div className="card p-5 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="w-8 h-8 rounded-lg bg-[#EDFDF5] text-[#18794E] flex items-center justify-center mb-3">
                  <FileSpreadsheet size={18} />
                </div>
                <h4 className="text-sm font-semibold text-[#182230]">Exportar Entregables</h4>
                <p className="text-xs text-[#526071] leading-relaxed">
                  Generar libro oficial CORRESPONDENCIA.xlsx y descargar minutas contractuales.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('exportar')}
                className="mt-4 text-xs font-medium text-[#2459D3] hover:underline flex items-center gap-1 self-start"
              >
                Ir a exportaciones <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'lotes' && (
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-[#E4E7EC] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#182230]">Historial de Lotes Cargados</h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate('carga')}
            >
              <UploadCloud size={14} /> Cargar Lote
            </button>
          </div>
          {projectBatches.length > 0 ? (
            <div className="divide-y divide-[#E4E7EC]">
              {projectBatches.map((batch) => (
                <div key={batch.id} className="p-4 flex items-center justify-between hover:bg-[#F7F8FA]">
                  <div className="space-y-1">
                    <strong className="text-xs font-semibold text-[#182230]">{batch.id}</strong>
                    <p className="text-[11px] text-[#526071]">
                      Cargado el {new Date(batch.createdAt).toLocaleDateString('es-CO')} · {batch.documentCount || 0} archivos
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={batch.jobState} />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onNavigate('carga')}
                    >
                      Ver Pipeline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-[#667085]">
              No hay lotes cargados en este expediente todavía.
            </div>
          )}
        </div>
      )}

      {activeTab === 'predios' && (
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-[#E4E7EC] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#182230]">Predios Extraídos y Consolidados</h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate('revision')}
            >
              Abrir en Estación de Revisión
            </button>
          </div>
          {projectRecords.length > 0 ? (
            <div className="divide-y divide-[#E4E7EC]">
              {projectRecords.map((record) => (
                <div key={record.id} className="p-4 flex items-center justify-between hover:bg-[#F7F8FA]">
                  <div className="space-y-1">
                    <strong className="text-xs font-semibold text-[#182230]">{record.name}</strong>
                    <p className="text-[11px] text-[#526071]">
                      Folio: <span className="font-mono">{record.folio || 'POR VALIDAR'}</span> · Municipio: {record.municipality}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={record.reviewState} />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onNavigate('revision')}
                    >
                      Revisar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-[#667085]">
              No hay predios extraídos aún. Inicie el procesamiento de un lote documental.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
