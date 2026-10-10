import type { Project } from '../../types'
import { dataMode } from '../../lib/supabase'
import { ExpedientePrototype } from '../expediente/ExpedientePrototype'
import { RemoteExpedienteWorkspace } from '../expediente/RemoteExpedienteWorkspace'

export interface ProjectDetailViewProps {
  project: Project
  onBack: () => void
}

export function ProjectDetailView({ project, onBack }: ProjectDetailViewProps) {
  return (
    <div className="project-detail-layout" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {dataMode === 'supabase'
        ? <RemoteExpedienteWorkspace project={project} onBack={onBack} />
        : <ExpedientePrototype project={project} onBack={onBack} />}
    </div>
  )
}
