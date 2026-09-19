import { FormEvent, useMemo, useState } from 'react'
import { Archive, ArchiveRestore, Building2, Calendar, CheckCircle2, Edit3, Filter, FolderKanban, MapPin, Plus, Search, Shield, Users, Zap } from 'lucide-react'
import type { Project } from '../types'

interface ProjectsManagementViewProps {
  projects: Project[]
  activeId: string
  onSelect: (id: string) => void
  onCreate: (input: { name: string; clientName: string; municipality: string; department: string; powerLine: string }) => Promise<void>
  onUpdateMetadata: (projectId: string, input: { name: string; clientName: string; municipality: string; department: string; powerLine: string }) => Promise<void>
  onToggleArchive: (projectId: string, isArchived: boolean) => Promise<void>
  onNavigateToUsers: (projectId: string) => void
  busyAction: string | null
}

type FilterStatus = 'activos' | 'archivados' | 'todos'

export function ProjectsManagementView({
  projects,
  activeId,
  onSelect,
  onCreate,
  onUpdateMetadata,
  onToggleArchive,
  onNavigateToUsers,
  busyAction,
}: ProjectsManagementViewProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('activos')
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  // Creation form state
  const [newName, setNewName] = useState('')
  const [newClient, setNewClient] = useState('')
  const [newMunicipality, setNewMunicipality] = useState('')
  const [newDepartment, setNewDepartment] = useState('')
  const [newPowerLine, setNewPowerLine] = useState('')

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editClient, setEditClient] = useState('')
  const [editMunicipality, setEditMunicipality] = useState('')
  const [editDepartment, setEditDepartment] = useState('')
  const [editPowerLine, setEditPowerLine] = useState('')

  function openEditModal(project: Project, event: React.MouseEvent) {
    event.stopPropagation()
    setEditingProject(project)
    setEditName(project.name)
    setEditClient(project.clientName ?? '')
    setEditMunicipality(project.municipality)
    setEditDepartment(project.department)
    setEditPowerLine(project.powerLine ?? '')
  }

  async function handleCreateSubmit(event: FormEvent) {
    event.preventDefault()
    if (!newName.trim()) return

    await onCreate({
      name: newName.trim(),
      clientName: newClient.trim(),
      municipality: newMunicipality.trim() || 'Sin definir',
      department: newDepartment.trim() || 'Sin definir',
      powerLine: newPowerLine.trim(),
    })

    setNewName('')
    setNewClient('')
    setNewMunicipality('')
    setNewDepartment('')
    setNewPowerLine('')
  }

  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editingProject || !editName.trim()) return

    await onUpdateMetadata(editingProject.id, {
      name: editName.trim(),
      clientName: editClient.trim(),
      municipality: editMunicipality.trim() || 'Sin definir',
      department: editDepartment.trim() || 'Sin definir',
      powerLine: editPowerLine.trim(),
    })

    setEditingProject(null)
  }

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase()
    return projects.filter((p) => {
      // Filter by status (US-015)
      if (statusFilter === 'activos' && p.isArchived) return false
      if (statusFilter === 'archivados' && !p.isArchived) return false

      // Search by query (US-013)
      if (!term) return true
      return (
        p.name.toLowerCase().includes(term) ||
        (p.clientName && p.clientName.toLowerCase().includes(term)) ||
        p.municipality.toLowerCase().includes(term) ||
        p.department.toLowerCase().includes(term) ||
        (p.powerLine && p.powerLine.toLowerCase().includes(term))
      )
    })
  }, [projects, search, statusFilter])

  return (
    <div className="projects-management-view">
      <div className="projects-header-bar">
        <div className="projects-header-info">
          <p className="eyebrow">ADMINISTRACIÓN TERRITORIAL</p>
          <div className="projects-header-title-wrap">
            <h2>Expedientes y ciclo de vida</h2>
            <span className="projects-header-desc">
              Gestión de expedientes prediales, infraestructura eléctrica y metadatos con trazabilidad.
            </span>
          </div>
        </div>
      </div>

      <div className="projects-layout">
        <section className="projects-main">
          {/* US-013: Búsqueda y filtros */}
          <div className="filter-toolbar">
            <div className="search-box">
              <Search size={16} />
              <input
                type="search"
                placeholder="Buscar por nombre, cliente, línea o municipio…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar proyectos"
              />
            </div>

            <div className="status-pills" role="tablist" aria-label="Filtrar por estado">
              <button
                type="button"
                className={statusFilter === 'activos' ? 'pill active' : 'pill'}
                onClick={() => setStatusFilter('activos')}
              >
                Activos ({projects.filter((p) => !p.isArchived).length})
              </button>
              <button
                type="button"
                className={statusFilter === 'archivados' ? 'pill active' : 'pill'}
                onClick={() => setStatusFilter('archivados')}
              >
                Archivados ({projects.filter((p) => p.isArchived).length})
              </button>
              <button
                type="button"
                className={statusFilter === 'todos' ? 'pill active' : 'pill'}
                onClick={() => setStatusFilter('todos')}
              >
                Todos ({projects.length})
              </button>
            </div>
          </div>

          <div className="project-grid-scroll-wrap">
            {filteredProjects.length === 0 ? (
              <div className="empty-state">
                <FolderKanban size={24} />
                <span>
                  {search
                    ? `No se encontraron expedientes que coincidan con "${search}".`
                    : statusFilter === 'archivados'
                    ? 'No hay expedientes archivados en este momento.'
                    : 'Aún no hay expedientes creados.'}
                </span>
              </div>
            ) : (
              <div className="project-grid">
                {filteredProjects.map((project) => {
                  const isSelected = project.id === activeId
                  const canManage = project.role === 'owner' || !project.role

                  return (
                    <article
                      className={`project-card ${isSelected ? 'selected' : ''} ${project.isArchived ? 'archived' : ''}`}
                      key={project.id}
                      onClick={() => onSelect(project.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="card-top">
                        <div className="project-badge">
                          <FolderKanban size={18} />
                          {project.isArchived && <span className="archive-tag">Archivado</span>}
                        </div>

                        <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                          {canManage && (
                            <button
                              type="button"
                              className="icon-button small"
                              title="Editar metadatos del expediente (US-012)"
                              onClick={(e) => openEditModal(project, e)}
                            >
                              <Edit3 size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="icon-button small"
                            title="Gestionar participantes y roles (US-014)"
                            onClick={() => {
                              onSelect(project.id)
                              onNavigateToUsers(project.id)
                            }}
                          >
                            <Users size={15} />
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              className="icon-button small"
                              title={project.isArchived ? 'Restaurar expediente (US-015)' : 'Archivar expediente (US-015)'}
                              onClick={() => void onToggleArchive(project.id, !project.isArchived)}
                              disabled={busyAction === `archive:${project.id}`}
                            >
                              {project.isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                            </button>
                          )}
                        </div>
                      </div>

                      <strong className="project-title">{project.name}</strong>

                      <div className="project-meta-details">
                        {project.clientName && (
                          <div className="meta-line">
                            <Building2 size={13} />
                            <span>{project.clientName}</span>
                          </div>
                        )}
                        <div className="meta-line">
                          <MapPin size={13} />
                          <span>{project.municipality}, {project.department}</span>
                        </div>
                        {project.powerLine && (
                          <div className="meta-line line-highlight">
                            <Zap size={13} />
                            <span>{project.powerLine}</span>
                          </div>
                        )}
                        <div className="meta-line date-line">
                          <Calendar size={13} />
                          <span>Creado {new Date(project.createdAt).toLocaleDateString('es-CO')}</span>
                        </div>
                      </div>

                      <div className="card-bottom">
                        {project.role && (
                          <span className={`status ${project.role}`} title="Tu rol en este expediente">
                            <Shield size={11} /> {project.role}
                          </span>
                        )}
                        <span className="open-hint">Abrir expediente →</span>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* US-011: Formulario de Creación Completa */}
        <form className="card form-card" onSubmit={handleCreateSubmit}>
          <div className="form-card-header">
            <p className="eyebrow">NUEVO EXPEDIENTE TERRITORIAL (US-011)</p>
            <h3>Crear proyecto completo</h3>
            <p className="form-sub">
              Registra los datos maestros del proyecto antes de cargar estudios de títulos o planos.
            </p>
          </div>

          <div className="form-field">
            <label>
              <span>Nombre del proyecto / expediente *</span>
              <input
                required
                name="name"
                placeholder="Ej. Línea 230 kV La Virginia - Nueva Palmira"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
          </div>

          <div className="form-field">
            <label>
              <span>Cliente o Titular del proyecto</span>
              <input
                name="clientName"
                placeholder="Ej. ISA Intercolombia / Enel / EPM"
                value={newClient}
                onChange={(e) => setNewClient(e.target.value)}
              />
            </label>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>
                <span>Municipio *</span>
                <input
                  required
                  name="municipality"
                  placeholder="Ej. Pereira"
                  value={newMunicipality}
                  onChange={(e) => setNewMunicipality(e.target.value)}
                />
              </label>
            </div>
            <div className="form-field">
              <label>
                <span>Departamento *</span>
                <input
                  required
                  name="department"
                  placeholder="Ej. Risaralda"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="form-field">
            <label>
              <span>Línea de transmisión / Infraestructura</span>
              <input
                name="powerLine"
                placeholder="Ej. Tramo torre 45 a subestación"
                value={newPowerLine}
                onChange={(e) => setNewPowerLine(e.target.value)}
              />
            </label>
          </div>

          <div className="form-actions">
            <button className="button primary full-width" type="submit" disabled={busyAction === 'create-project' || !newName.trim()}>
              <Plus size={17} />
              {busyAction === 'create-project' ? 'Creando expediente…' : 'Crear y abrir expediente'}
            </button>
          </div>
        </form>
      </div>

      {/* US-012: Modal de Edición de Metadatos sin alterar extracciones */}
      {editingProject && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-project-title">
          <div className="card modal-card">
            <div className="section-title">
              <div>
                <p className="eyebrow">METADATOS DEL EXPEDIENTE (US-012)</p>
                <h3 id="edit-project-title">Editar metadatos: {editingProject.name}</h3>
              </div>
              <button className="text-button" onClick={() => setEditingProject(null)}>✕</button>
            </div>

            <p className="modal-desc">
              Modifica los datos de identificación general. Las extracciones históricas, atributos de predios y documentos cargados se preservan intactos.
            </p>

            <form onSubmit={handleEditSubmit}>
              <label className="form-label">
                <span>Nombre del proyecto *</span>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </label>

              <label className="form-label">
                <span>Cliente o Empresa titular</span>
                <input
                  type="text"
                  placeholder="Ej. ISA Intercolombia"
                  value={editClient}
                  onChange={(e) => setEditClient(e.target.value)}
                />
              </label>

              <div className="form-row">
                <label className="form-label">
                  <span>Municipio</span>
                  <input
                    type="text"
                    required
                    value={editMunicipality}
                    onChange={(e) => setEditMunicipality(e.target.value)}
                  />
                </label>
                <label className="form-label">
                  <span>Departamento</span>
                  <input
                    type="text"
                    required
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                  />
                </label>
              </div>

              <label className="form-label">
                <span>Línea eléctrica / Proyecto</span>
                <input
                  type="text"
                  placeholder="Ej. Línea 230 kV"
                  value={editPowerLine}
                  onChange={(e) => setEditPowerLine(e.target.value)}
                />
              </label>

              <div className="modal-buttons">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setEditingProject(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="button primary"
                  disabled={busyAction === `edit:${editingProject.id}` || !editName.trim()}
                >
                  <CheckCircle2 size={16} />
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
