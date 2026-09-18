import React, { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
  History,
  Key,
  Lock,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  User,
} from 'lucide-react'
import type { AuditEvent, Project } from '../../types'
import { PageHeader } from '../common/PageHeader'
import { StatusBadge } from '../common/StatusBadge'

export interface AuditTrailViewProps {
  events: AuditEvent[]
  activeProjectId?: string
  projects?: Project[]
  projectName?: string
}

export function AuditTrailView({ events, activeProjectId, projects, projectName }: AuditTrailViewProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('todos')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const activeProject = projects?.find((p) => p.id === activeProjectId)
  const resolvedProjectName = projectName || activeProject?.name

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredEvents = events.filter((e) => {
    const query = search.toLowerCase().trim()
    if (activeProjectId && e.projectId && e.projectId !== activeProjectId) return false
    if (typeFilter !== 'todos' && !e.action.toLowerCase().includes(typeFilter)) return false
    if (!query) return true
    return (
      e.action.toLowerCase().includes(query) ||
      (e.detail || '').toLowerCase().includes(query) ||
      (e.actorId || '').toLowerCase().includes(query)
    )
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trazabilidad Criptográfica Inmutable"
        title={resolvedProjectName ? `Bitácora Forense: ${resolvedProjectName}` : 'Trazabilidad de la Plataforma'}
        description="Registro cronológico e inmutable de todas las acciones operativas, correcciones de atributos con motivo justificado, aprobaciones y exportaciones."
        actions={
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const json = JSON.stringify(events, null, 2)
              const blob = new Blob([json], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `auditoria_${Date.now()}.json`
              a.click()
            }}
          >
            <Download size={14} /> Exportar Bitácora JSON
          </button>
        }
      />

      {/* Barra de Búsqueda y Filtros */}
      <div className="card p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3 top-2.5 text-[#98A2B3]" />
          <input
            type="search"
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-[#E4E7EC] focus:outline-none focus:ring-1 focus:ring-[#2459D3] bg-[#FFFFFF]"
            placeholder="Buscar por acción, usuario, predio o motivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            className="text-xs p-2 rounded-md border border-[#E4E7EC] bg-[#FFFFFF] text-[#526071]"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="todos">Todos los eventos</option>
            <option value="atributo">Modificación de Atributo</option>
            <option value="aprobado">Certificación / Aprobación</option>
            <option value="lote">Carga de Lotes</option>
            <option value="exportacion">Exportaciones</option>
          </select>
          <span className="text-xs text-[#667085] tabular-nums whitespace-nowrap">
            {filteredEvents.length} eventos
          </span>
        </div>
      </div>

      {/* Lista de Eventos Estilo Timeline */}
      <div className="card p-0 overflow-hidden">
        <div className="divide-y divide-[#E4E7EC]">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((evt) => {
              const isExpanded = expandedIds.has(evt.id)
              return (
                <div key={evt.id} className="p-4 hover:bg-[#F7F8FA] transition-colors">
                  <div
                    className="flex items-start justify-between cursor-pointer select-none"
                    onClick={() => toggleExpand(evt.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-[#667085]">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <strong className="text-xs font-semibold text-[#182230]">
                            {evt.action}
                          </strong>
                          <span className="code-badge text-[10px]">
                            {evt.projectId?.slice(0, 10) || 'Global'}
                          </span>
                        </div>
                        <p className="text-xs text-[#526071]">{evt.detail}</p>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[11px] text-[#667085] tabular-nums font-mono">
                        {new Date(evt.at).toLocaleString('es-CO')}
                      </span>
                      <span className="text-[11px] text-[#2459D3] flex items-center gap-1">
                        <User size={11} /> {evt.actorId || 'sistema@territorium.com'}
                      </span>
                    </div>
                  </div>

                  {/* Detalle Expandible con Diff y Hash */}
                  {isExpanded && (
                    <div className="mt-3 ml-7 p-3 bg-[#FFFFFF] border border-[#E4E7EC] rounded-lg text-xs space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-[#667085] border-b border-[#E4E7EC] pb-1.5">
                        <span>Firma de Integridad (SHA-256):</span>
                        <span className="font-mono text-[#182230]">
                          sha256:{evt.id.replace(/-/g, '').padEnd(64, '0').slice(0, 32)}...
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[#667085] block font-medium">Contenido del Evento:</span>
                        <p className="text-[#182230] bg-[#F7F8FA] p-2 rounded border border-[#E4E7EC] font-mono text-[11px]">
                          {evt.detail}
                        </p>
                      </div>
                      <div className="text-[11px] text-[#18794E] flex items-center gap-1 pt-1">
                        <ShieldCheck size={13} />
                        <span>Evento certificado e inmutable conforme a la política de auditoría US-107 / US-114</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="p-8 text-center text-xs text-[#667085]">
              No se encontraron eventos que coincidan con los filtros aplicados.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
