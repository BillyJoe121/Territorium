import type { FormEvent, ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { FolderKanban, X } from 'lucide-react'
import type { Project } from '../../types'

export interface ProjectDraft {
  name: string
  clientName: string
  municipality: string
  department: string
  powerLine: string
}

export function ProjectCard({ project, selected, onOpen, actions }: { project: Project; selected?: boolean; onOpen: () => void; actions?: ReactNode }) {
  return (
    <article className={`project-card ${selected ? 'selected' : ''} ${project.isArchived ? 'archived' : ''}`}>
      <button type="button" className="project-card-open" onClick={onOpen}>
        <span className="project-card-kicker"><FolderKanban size={15} />{project.isArchived ? 'Archivado' : 'Expediente'}</span>
        <strong>{project.name}</strong>
        <span>{project.clientName || 'Sin cliente asignado'}</span>
        <small>{project.municipality}, {project.department}</small>
      </button>
      {actions && <div className="card-actions">{actions}</div>}
    </article>
  )
}

function ProjectFormDialog({
  open,
  onOpenChange,
  title,
  description,
  values,
  submitLabel,
  busy,
  onSubmit,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  values: ProjectDraft
  submitLabel: string
  busy?: boolean
  onSubmit: (event: FormEvent) => void
  onChange: (field: keyof ProjectDraft, value: string) => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="radix-dialog-overlay" />
        <Dialog.Content className="radix-dialog-content project-form-dialog">
          <Dialog.Title className="radix-dialog-title">{title}</Dialog.Title>
          <Dialog.Description className="radix-dialog-description">{description}</Dialog.Description>
          <form onSubmit={onSubmit} className="project-form-fields">
            <label>Nombre del expediente<input required value={values.name} onChange={(event) => onChange('name', event.target.value)} /></label>
            <label>Cliente o titular<input value={values.clientName} onChange={(event) => onChange('clientName', event.target.value)} /></label>
            <div><label>Municipio<input required value={values.municipality} onChange={(event) => onChange('municipality', event.target.value)} /></label><label>Departamento<input required value={values.department} onChange={(event) => onChange('department', event.target.value)} /></label></div>
            <label>Infraestructura o línea<input value={values.powerLine} onChange={(event) => onChange('powerLine', event.target.value)} /></label>
            <footer><Dialog.Close asChild><button type="button" className="btn btn-secondary">Cancelar</button></Dialog.Close><button type="submit" className="btn btn-primary" disabled={busy || !values.name.trim()}>{busy ? 'Guardando…' : submitLabel}</button></footer>
          </form>
          <Dialog.Close asChild><button className="radix-dialog-close" type="button" aria-label="Cerrar"><X size={16} /></button></Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function NewProjectModal(props: Omit<Parameters<typeof ProjectFormDialog>[0], 'title' | 'description' | 'submitLabel'>) {
  return <ProjectFormDialog {...props} title="Crear expediente" description="Registra los datos maestros antes de cargar los documentos." submitLabel="Crear expediente" />
}

export function EditProjectModal(props: Omit<Parameters<typeof ProjectFormDialog>[0], 'title' | 'description' | 'submitLabel'>) {
  return <ProjectFormDialog {...props} title="Editar expediente" description="Los documentos y las extracciones existentes se conservarán." submitLabel="Guardar cambios" />
}
