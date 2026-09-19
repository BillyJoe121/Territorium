import type { Batch, Project, PropertyRecord, ReviewTask, SourceDocument } from '../../types'
import { dataMode } from '../../lib/supabase'
import { ExpedientePrototype } from '../expediente/ExpedientePrototype'
import { RemoteExpedienteWorkspace } from '../expediente/RemoteExpedienteWorkspace'

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
  batches: _batches,
  records: _records,
  reviews: _reviews,
  documents: _documents,
  onNavigate: _onNavigate,
  onEditMetadata: _onEditMetadata,
}: ProjectDetailViewProps) {
  return dataMode === 'supabase'
    ? <RemoteExpedienteWorkspace project={project} />
    : <ExpedientePrototype project={project} />
}
