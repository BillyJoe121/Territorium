import { FormEvent, useMemo, useState } from 'react'
import { Archive, ArchiveRestore, Building2, Calendar, CheckCircle2, Edit3, FolderKanban, MapPin, Plus, Search, Shield, UserCheck } from 'lucide-react'
import type { Project, ProjectMetadataInput } from '../types'

interface ProjectsManagementViewProps {
  projects: Project[]
  activeId: string
  onSelect: (id: string) => void
  onCreate: (input: ProjectMetadataInput) => Promise<void>
  onUpdateMetadata: (projectId: string, input: ProjectMetadataInput) => Promise<void>
  onToggleArchive: (projectId: string, isArchived: boolean) => Promise<void>
  busyAction: string | null
}

type FilterStatus = 'activos' | 'archivados' | 'todos'

/** Normaliza la lista de municipios: "Pereira ,Dosquebradas" → "Pereira, Dosquebradas". */
export function normalizeMunicipalities(raw: string): string {
  return raw
    .split(/[,;]/)
    .map((item) => item.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join(', ')
}

export function ProjectsManagementView({
  projects,
  activeId,
  onSelect,
  onCreate,
  onUpdateMetadata,
  onToggleArchive,
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
  const [newResponsible, setNewResponsible] = useState('')

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editClient, setEditClient] = useState('')
  const [editMunicipality, setEditMunicipality] = useState('')
  const [editDepartment, setEditDepartment] = useState('')
  const [editResponsible, setEditResponsible] = useState('')

  function openEditModal(project: Project, event: React.MouseEvent) {
    event.stopPropagation()
    setEditingProject(project)
    setEditName(project.name)
    setEditClient(project.clientName ?? '')
    setEditMunicipality(project.municipality)
    setEditDepartment(project.department)
    setEditResponsible(project.responsibleName ?? '')
  }

  async function handleCreateSubmit(event: FormEvent) {
    event.preventDefault()
    if (!newName.trim() || !newResponsible.trim()) return

    await onCreate({
      name: newName.trim(),
      clientName: newClient.trim(),
      municipality: normalizeMunicipalities(newMunicipality) || 'Sin definir',
      department: newDepartment.trim() || 'Sin definir',
      responsibleName: newResponsible.trim().replace(/\s+/g, ' '),
    })

    setNewName('')
    setNewClient('')
    setNewMunicipality('')
    setNewDepartment('')
    setNewResponsible('')
  }

  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editingProject || !editName.trim() || !editResponsible.trim()) return

    await onUpdateMetadata(editingProject.id, {
      name: editName.trim(),
      clientName: editClient.trim(),
      municipality: normalizeMunicipalities(editMunicipality) || 'Sin definir',
      department: editDepartment.trim() || 'Sin definir',
      responsibleName: editResponsible.trim().replace(/\s+/g, ' '),
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
        (p.responsibleName && p.responsibleName.toLowerCase().includes(term))
      )
    })
  }, [projects, search, statusFilter])

  return (
    <div className="projects-management-view">
      <div className="projects-header-bar">
        <div className="projects-header-info">
          <div className="projects-header-title-wrap">
            <h1 className="projects-header-kicker">Proyectos y ciclo de vida</h1>
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
                placeholder="Buscar por nombre, cliente, responsable o municipio…"
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
                    ? `No se encontraron proyectos que coincidan con "${search}".`
                    : statusFilter === 'archivados'
                    ? 'No hay proyectos archivados en este momento.'
                    : 'Aún no hay proyectos creados.'}
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
                              title="Editar metadatos del proyecto"
                              onClick={(e) => openEditModal(project, e)}
                            >
                              <Edit3 size={15} />
                            </button>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              className="icon-button small"
                              title={project.isArchived ? 'Restaurar proyecto' : 'Archivar proyecto'}
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
                        {project.responsibleName && (
                          <div className="meta-line line-highlight" title="Profesional responsable">
                            <UserCheck size={13} />
                            <span>{project.responsibleName}</span>
                          </div>
                        )}
                        <div className="meta-line date-line">
                          <Calendar size={13} />
                          <span>Creado {new Date(project.createdAt).toLocaleDateString('es-CO')}</span>
                        </div>
                      </div>

                      <div className="card-bottom">
                        {project.role && (
                          <span className={`status ${project.role}`} title="Tu rol en este proyecto">
                            <Shield size={11} /> {project.role}
                          </span>
                        )}
                        <span className="open-hint">Abrir proyecto →</span>
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
            <p className="eyebrow">NUEVO PROYECTO</p>
            <h3>Crear proyecto</h3>
            <p className="form-sub">
              Registra los datos maestros del proyecto antes de cargar estudios de títulos o planos.
            </p>
          </div>

          <div className="form-field">
            <label>
              <span>Nombre del proyecto *</span>
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
                <span>Municipio(s) *</span>
                <input
                  required
                  name="municipality"
                  maxLength={400}
                  placeholder="Ej. Pereira, Dosquebradas"
                  value={newMunicipality}
                  onChange={(e) => setNewMunicipality(e.target.value)}
                  aria-describedby="new-municipality-hint"
                />
                <small id="new-municipality-hint" className="form-hint">Si el proyecto abarca varios, sepáralos con coma.</small>
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
              <span>Profesional responsable *</span>
              <input
                required
                name="responsibleName"
                autoComplete="name"
                maxLength={180}
                placeholder="Ej. María Fernanda Gómez Ruiz"
                value={newResponsible}
                onChange={(e) => setNewResponsible(e.target.value)}
                aria-describedby="new-responsible-hint"
              />
              <small id="new-responsible-hint" className="form-hint">Nombre completo del abogado o profesional que crea el proyecto y responde por él.</small>
            </label>
          </div>

          <div className="form-actions">
            <button className="button primary full-width" type="submit" disabled={busyAction === 'create-project' || !newName.trim() || !newResponsible.trim()}>
              <Plus size={17} />
              {busyAction === 'create-project' ? 'Creando proyecto…' : 'Crear y abrir proyecto'}
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
                <p className="eyebrow">METADATOS DEL PROYECTO</p>
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
                  <span>Municipio(s)</span>
                  <input
                    type="text"
                    required
                    maxLength={400}
                    placeholder="Ej. Pereira, Dosquebradas"
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
                <span>Profesional responsable *</span>
                <input
                  type="text"
                  required
                  maxLength={180}
                  placeholder="Ej. María Fernanda Gómez Ruiz"
                  value={editResponsible}
                  onChange={(e) => setEditResponsible(e.target.value)}
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
                  disabled={busyAction === `edit:${editingProject.id}` || !editName.trim() || !editResponsible.trim()}
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
