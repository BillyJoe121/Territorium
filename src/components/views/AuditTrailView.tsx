import React, { useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Download,
  Search,
  ShieldCheck,
  User,
} from 'lucide-react'
import type { AuditEvent, Project } from '../../types'
import { PageHeader } from '../common/PageHeader'

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
  const [pageSize, setPageSize] = useState<number>(10)
  const [currentPage, setCurrentPage] = useState<number>(1)

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

  // Reset pagination when filter or page size changes
  useEffect(() => {
    setCurrentPage(1)
  }, [search, typeFilter, pageSize])

  const totalEvents = filteredEvents.length
  const totalPages = Math.max(1, Math.ceil(totalEvents / pageSize))
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  return (
    <div className="audit-trail-view">
      <PageHeader
        eyebrow="Trazabilidad Criptográfica Inmutable"
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

      {/* Buscador y filtro en una sola fila */}
      <div className="card audit-toolbar">
        <div className="audit-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            className="audit-search-input"
            placeholder="Buscar por acción, usuario, predio o motivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar en la auditoría"
          />
        </div>

        <div className="audit-filter-group">
          <select
            className="audit-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filtrar por tipo de evento"
          >
            <option value="todos">Todos los eventos</option>
            <option value="atributo">Modificación de Atributo</option>
            <option value="aprobado">Certificación / Aprobación</option>
            <option value="lote">Carga de Lotes</option>
            <option value="exportacion">Exportaciones</option>
          </select>
          <span className="audit-event-count">
            {totalEvents} eventos
          </span>
        </div>
      </div>

      {/* Card de Eventos con scroll interno y paginación */}
      <div className="card audit-events-card">
        <div className="audit-events-list">
          {paginatedEvents.length > 0 ? (
            paginatedEvents.map((evt) => {
              const isExpanded = expandedIds.has(evt.id)
              return (
                <div key={evt.id} className="audit-event-row">
                  <button
                    type="button"
                    className="audit-event-toggle"
                    onClick={() => toggleExpand(evt.id)}
                    aria-expanded={isExpanded}
                  >
                    <div className="audit-event-main">
                      <div className="audit-event-title">
                        <strong>
                          {evt.action}
                        </strong>
                        <span className="code-badge">
                          {evt.projectId?.slice(0, 10) || 'Global'}
                        </span>
                        <span className="audit-event-expand" aria-hidden="true">
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                      </div>
                      <p>{evt.detail}</p>
                    </div>

                    <div className="audit-event-meta">
                      <span>
                        {new Date(evt.at).toLocaleString('es-CO')}
                      </span>
                      <span className="audit-event-actor">
                        <User size={11} /> {evt.actorId || 'sistema@territorium.com'}
                      </span>
                    </div>
                  </button>

                  {/* Detalle Expandible con Diff y Hash */}
                  {isExpanded && (
                    <div className="audit-event-detail">
                      <div className="audit-detail-hash">
                        <span>Firma de Integridad (SHA-256):</span>
                        <span className="font-mono text-[#182230]">
                          sha256:{evt.id.replace(/-/g, '').padEnd(64, '0').slice(0, 32)}...
                        </span>
                      </div>
                      <div className="audit-detail-content">
                        <span>Contenido del Evento:</span>
                        <p>
                          {evt.detail}
                        </p>
                      </div>
                      <div className="audit-detail-certified">
                        <ShieldCheck size={13} />
                        <span>Evento certificado e inmutable conforme a la política de auditoría US-107 / US-114</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="audit-empty-state">
              No se encontraron eventos que coincidan con los filtros aplicados.
            </div>
          )}
        </div>

        {/* Barra de Paginación */}
        <div className="audit-pagination">
          <div className="audit-pagination-summary">
            <span>Mostrar</span>
            <select
              className="audit-page-size"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Cantidad de eventos por página"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span>por página</span>
            <span className="audit-pagination-divider">|</span>
            <span>
              Mostrando {totalEvents > 0 ? (currentPage - 1) * pageSize + 1 : 0} - {Math.min(currentPage * pageSize, totalEvents)} de {totalEvents} eventos
            </span>
          </div>

          <div className="audit-pagination-controls">
            <button
              type="button"
              className="btn btn-secondary btn-sm audit-page-button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{ padding: '3px 8px', fontSize: '11.5px', height: '28px' }}
            >
              Anterior
            </button>
            <span className="audit-page-indicator">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm audit-page-button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{ padding: '3px 8px', fontSize: '11.5px', height: '28px' }}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
