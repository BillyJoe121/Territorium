import { Download, Eye, Link2, LoaderCircle, Lock, PencilLine, RefreshCcw, Trash2, Upload } from 'lucide-react'
import type { ChangeEvent } from 'react'
import type { RemoteExpedienteFile, RemoteExpedienteGroup } from '../../data/expedienteProcessing'
import type { ExpedienteUploadProgress } from '../../data/expedienteUpload'
import type { ExpedienteGroupKey } from '../../lib/expedienteWorkflow'
import { StatusText, groupInfo, progressFor, statusText } from './expedienteGroups'
import { formatFileSize } from './types'

interface Props {
  group: RemoteExpedienteGroup
  groups: Record<ExpedienteGroupKey, RemoteExpedienteGroup>
  busy: boolean
  progress: ExpedienteUploadProgress | null
  deletingFileId: string | null
  downloadingFileId: string | null
  zippingGroup: ExpedienteGroupKey | null
  onSelectFiles: (files: FileList | null) => void
  onDownloadGroup: () => void
  onPreviewFile: (file: RemoteExpedienteFile) => void
  onDownloadFile: (file: RemoteExpedienteFile) => void
  onRemoveFile: (file: RemoteExpedienteFile) => void
  onEnqueue: () => void
  onReview: () => void
}

/** Tarjeta de un subconjunto en la pestaña Extracción: archivos, progreso, bloqueos por FMI y acciones. */
export function ExtractionGroupCard({
  group,
  groups,
  busy,
  progress,
  deletingFileId,
  downloadingFileId,
  zippingGroup,
  onSelectFiles,
  onDownloadGroup,
  onPreviewFile,
  onDownloadFile,
  onRemoveFile,
  onEnqueue,
  onReview,
}: Props) {
  const key = group.key
  const info = groupInfo[key]
  const Icon = info.icon
  const active = group.status === 'queued' || group.status === 'processing'
  // Los planos se corren solo después de aprobar el estudio de títulos (llave FMI).
  const waitingForTitles = (key === 'plans' && groups.titles.status !== 'approved')
    || (key === 'negotiation' && (groups.titles.status !== 'approved' || groups.plans.status !== 'approved'))
  const canEnqueue = group.files.length > 0 && !active && !waitingForTitles && group.status !== 'review_ready' && group.status !== 'approved'
  const canReview = !active && (group.status === 'review_ready' || group.status === 'approved')
  const uploadProgress = progress?.groupKey === key ? progress.percent : null
  const remoteProgress = progressFor(group)

  return (
    <article className={`extraction-card state-${group.status}`}>
      <header className="extraction-card-header">
        <div className="extraction-card-title">
          <span className="extraction-card-icon">
            <Icon size={19} />
          </span>
          <div>
            <h3>{info.title}</h3>
            <p>{info.description}</p>
          </div>
        </div>
        <StatusText status={group.status} label={statusText(group)} />
      </header>

      <div className="extraction-upload-row">
        <input
          id={`remote-expediente-${key}`}
          className="sr-only"
          type="file"
          accept={info.accept}
          multiple={info.multiple}
          disabled={busy || active}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onSelectFiles(event.target.files)
            event.target.value = ''
          }}
        />
        <label
          className="extraction-upload-button"
          htmlFor={`remote-expediente-${key}`}
          aria-disabled={busy || active}
        >
          {busy ? <LoaderCircle size={17} className="spin" /> : <Upload size={17} />}
          <span>{busy ? 'Cargando…' : 'Agregar archivos'}</span>
        </label>
        <button
          type="button"
          className="extraction-upload-button is-download"
          disabled={group.files.length === 0 || zippingGroup !== null}
          onClick={onDownloadGroup}
          title={group.files.length ? `Descargar los ${group.files.length} archivo(s) en un .zip` : 'No hay archivos para descargar'}
        >
          {zippingGroup === key ? <LoaderCircle size={17} className="spin" /> : <Download size={17} />}
          <span>{zippingGroup === key ? 'Preparando .zip…' : 'Descargar todos'}</span>
        </button>
      </div>

      <div className="extraction-file-list" aria-label={`Archivos de ${info.title}`}>
        {group.files.length === 0 ? (
          <div className="extraction-empty-files">
            <Upload size={17} />
            <span>Aún no hay archivos cargados.</span>
          </div>
        ) : (
          <ul>
            {group.files.map((file) => {
              const isDeleting = deletingFileId === file.id
              return (
                <li key={file.id}>
                  <button
                    type="button"
                    className="extraction-file-preview"
                    title={`Ver ${file.name}`}
                    aria-label={`Ver ${file.name}`}
                    onClick={() => onPreviewFile(file)}
                  >
                    <Eye size={15} />
                  </button>
                  <span className="extraction-file-name" title={file.name}>
                    {file.name}
                  </span>
                  <span className="extraction-file-meta">
                    {formatFileSize(file.sizeBytes)} ·{' '}
                    {file.validationStatus === 'validated'
                      ? 'validado'
                      : file.validationStatus === 'rejected'
                      ? 'requiere atención'
                      : 'pendiente'}
                  </span>
                  <button
                    type="button"
                    className="extraction-file-preview"
                    title={`Descargar ${file.name}`}
                    aria-label={`Descargar ${file.name}`}
                    disabled={downloadingFileId === file.id}
                    onClick={() => onDownloadFile(file)}
                  >
                    {downloadingFileId === file.id ? <LoaderCircle size={14} className="spin" /> : <Download size={14} />}
                  </button>
                  <button
                    type="button"
                    className="extraction-file-remove"
                    title={`Eliminar ${file.name}`}
                    aria-label={`Eliminar ${file.name}`}
                    disabled={busy || active || isDeleting}
                    onClick={() => onRemoveFile(file)}
                  >
                    {isDeleting ? (
                      <LoaderCircle size={14} className="spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {(active || uploadProgress !== null) && (
        <div className="extraction-progress" aria-live="polite">
          <div className="extraction-progress-label">
            <span>
              {uploadProgress !== null
                ? `Cargando ${progress?.fileName}`
                : group.execution?.stageMessage ?? 'Procesando insumos'}
            </span>
            <strong>{uploadProgress ?? remoteProgress}%</strong>
          </div>
          <div className="extraction-progress-track">
            <span style={{ width: `${uploadProgress ?? remoteProgress}%` }} />
          </div>
        </div>
      )}

      {waitingForTitles && (
        <p className="extraction-gate-note" role="note">
          <Lock size={14} aria-hidden="true" />
          <span>
            {key === 'negotiation'
              ? group.status === 'approved' || group.status === 'review_ready'
                ? 'El Estudio de Títulos o los Planos cambiaron. Apruébalos de nuevo y vuelve a revisar la negociación.'
                : 'Primero aprueba el Estudio de Títulos y los Planos. Luego cada fila de la negociación se vinculará con su predio por FMI.'
              : group.status === 'approved' || group.status === 'review_ready'
                ? 'El Estudio de Títulos cambió. Apruébalo de nuevo y vuelve a revisar el cotejo de planos.'
                : 'Primero analiza y aprueba el Estudio de Títulos. Luego podrás analizar los planos y vincularlos por FMI.'}
          </span>
        </p>
      )}
      {(key === 'plans' || key === 'negotiation') && !waitingForTitles && (
        <p className="extraction-gate-note is-ready">
          <Link2 size={14} aria-hidden="true" />
          <span>
            {key === 'plans'
              ? 'Estudio de Títulos aprobado: cada plano se vinculará por FMI y se cotejará con su estudio.'
              : 'Estudio y Planos aprobados: cada fila se vinculará con su predio por FMI y exigirá el valor negociado.'}
          </span>
        </p>
      )}
      {group.status === 'error' && (
        <p className="extraction-error-note">
          {group.lastErrorMessage ?? 'No fue posible preparar este grupo. Revisa los archivos y reintenta.'}
        </p>
      )}

      <div className="extraction-card-actions">
        <button
          type="button"
          className="expediente-primary-action"
          disabled={!canEnqueue || busy}
          onClick={onEnqueue}
        >
          {active || busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : group.status === 'error' ? (
            <RefreshCcw size={16} />
          ) : (
            <Upload size={16} />
          )}
          {active ? 'Procesando…' : group.status === 'error' ? 'Reintentar análisis' : 'Enviar para análisis'}
        </button>
        {canReview && (
          <button
            type="button"
            className="expediente-secondary-action"
            disabled={busy || active}
            onClick={onReview}
          >
            <PencilLine size={16} />
            {group.status === 'approved' ? 'Ver resultados' : 'Analizar resultados'}
          </button>
        )}
      </div>
    </article>
  )
}
