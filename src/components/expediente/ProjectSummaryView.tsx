import { ChevronRight, ClipboardCheck, FileText } from 'lucide-react'
import type { Project } from '../../types'
import type { RemoteExpedienteGroup } from '../../data/expedienteProcessing'
import type { ExpedienteGroupKey } from '../../lib/expedienteWorkflow'
import { GENERATED_DOCUMENT_TYPES, type GeneratedDocumentKind } from '../../lib/generatedDocuments'
import { StatusText, consolidationLabel, groupInfo, orderedKeys, statusText } from './expedienteGroups'
import type { EditableResultRow, PrototypeConsolidationStatus } from './types'

interface Props {
  project: Project
  groups: Record<ExpedienteGroupKey, RemoteExpedienteGroup>
  responsibleName: string
  correspondenciaRows: EditableResultRow[]
  approvedGroupsCount: number
  consolidationStatus: PrototypeConsolidationStatus
  generatedDocuments: { documents: Record<GeneratedDocumentKind, unknown[]>; loading: boolean; error: unknown }
  onContinue: () => void
}

/** Pestaña Resumen: identificación del proyecto y avance de fuentes, consolidado y documentos finales. */
export function ProjectSummaryView({
  project,
  groups,
  responsibleName,
  correspondenciaRows,
  approvedGroupsCount,
  consolidationStatus,
  generatedDocuments,
  onContinue,
}: Props) {
  const allGroupsApproved = approvedGroupsCount === 3
  const generatedTotal = Object.values(generatedDocuments.documents).reduce((sum, files) => sum + files.length, 0)

  return (
    <section className="expediente-summary" aria-label="Resumen del proyecto">
      <article className="expediente-identity-card">
        <div className="expediente-section-heading">
          <div>
            <p>Identificación del proyecto</p>
            <h2>{project.name}</h2>
          </div>
          <button type="button" className="expediente-secondary-action" onClick={onContinue}>
            <ChevronRight size={16} />
            Continuar a extracción
          </button>
        </div>
        <dl className="expediente-identity-grid">
          <div>
            <dt>Predios consolidados</dt>
            <dd>{correspondenciaRows.length ? `${correspondenciaRows.length} predio(s)` : 'Pendiente de consolidación'}</dd>
          </div>
          <div>
            <dt>Matrículas (FMI)</dt>
            <dd title={correspondenciaRows.map((row) => row.B).join(', ')}>
              {correspondenciaRows.length ? correspondenciaRows.slice(0, 3).map((row) => row.B).join(', ') + (correspondenciaRows.length > 3 ? '…' : '') : 'Pendiente de consolidación'}
            </dd>
          </div>
          <div>
            <dt>Proyecto</dt>
            <dd>{project.name}</dd>
          </div>
          <div>
            <dt>Municipio(s)</dt>
            <dd>
              {project.municipality}, {project.department}
            </dd>
          </div>
          <div>
            <dt>Profesional responsable</dt>
            <dd>{responsibleName}</dd>
          </div>
          <div>
            <dt>Estado general</dt>
            <dd>
              {allGroupsApproved && consolidationStatus === 'approved'
                ? 'Listo para documento final'
                : allGroupsApproved
                ? 'Listo para consolidar'
                : `${approvedGroupsCount} de 3 subconjuntos aprobados`}
            </dd>
          </div>
        </dl>
      </article>

      <article className="expediente-overview-card">
        <div className="expediente-section-heading">
          <div>
            <p>Avance del proyecto</p>
            <h2>Fuentes y entregables</h2>
          </div>
          <span>{approvedGroupsCount}/3 aprobaciones</span>
        </div>
        <div className="expediente-stage-list">
          {orderedKeys.map((key) => {
            const group = groups[key]
            const info = groupInfo[key]
            const Icon = info.icon
            return (
              <div className="expediente-stage-row" key={key}>
                <span className="expediente-stage-icon">
                  <Icon size={17} />
                </span>
                <div>
                  <strong>{info.title}</strong>
                  <small>
                    {group.files.length} archivo(s) · {statusText(group)}
                  </small>
                </div>
                <StatusText status={group.status} label={statusText(group)} />
              </div>
            )
          })}
          <div className="expediente-stage-row">
            <span className="expediente-stage-icon">
              <ClipboardCheck size={17} />
            </span>
            <div>
              <strong>Consolidado</strong>
              <small>{consolidationLabel(consolidationStatus)}</small>
            </div>
            <StatusText status={consolidationStatus} label={consolidationLabel(consolidationStatus)} />
          </div>
          <div className="expediente-stage-row is-final-documents">
            <span className="expediente-stage-icon">
              <FileText size={17} />
            </span>
            <div>
              <strong>Documentos finales</strong>
              {generatedDocuments.error ? (
                <small>No se pudo consultar los documentos generados.</small>
              ) : (
                <ul className="final-document-counts" aria-label="Documentos generados por tipo">
                  {GENERATED_DOCUMENT_TYPES.map((type) => (
                    <li key={type.kind} className={type.source === 'upcoming' ? 'is-upcoming' : undefined}>
                      <span>{type.sectionTitle}</span>
                      <b>{type.source === 'upcoming' ? 'Próximamente' : generatedDocuments.loading ? '…' : generatedDocuments.documents[type.kind].length}</b>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <StatusText
              status={generatedTotal > 0 ? 'approved' : 'blocked'}
              label={generatedTotal > 0 ? `${generatedTotal} generado(s)` : 'Sin generar'}
            />
          </div>
        </div>
      </article>
    </section>
  )
}
