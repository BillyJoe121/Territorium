import type { ChangeEvent, ReactNode } from 'react'
import { FileText, Upload } from 'lucide-react'
import type { SourceDocument } from '../../types'

export function DocumentUploadSection({
  title = 'Cargar documentos',
  detail,
  accept,
  disabled,
  onFiles,
}: {
  title?: string
  detail: string
  accept?: string
  disabled?: boolean
  onFiles: (files: FileList | null) => void
}) {
  return (
    <label className={`document-upload-section ${disabled ? 'is-disabled' : ''}`}>
      <Upload size={18} aria-hidden="true" />
      <span><strong>{title}</strong><small>{detail}</small></span>
      <input type="file" accept={accept} multiple disabled={disabled} onChange={(event: ChangeEvent<HTMLInputElement>) => onFiles(event.target.files)} />
    </label>
  )
}

export function DocumentList({ documents, action }: { documents: SourceDocument[]; action?: (document: SourceDocument) => ReactNode }) {
  if (!documents.length) return <div className="empty-state">No hay documentos cargados aún.</div>
  return (
    <ul className="document-list" aria-label="Documentos cargados">
      {documents.map((document) => (
        <li key={document.id}>
          <FileText size={16} aria-hidden="true" />
          <div><strong>{document.name}</strong><small>{document.kind.replaceAll('_', ' ')}</small></div>
          {action?.(document)}
        </li>
      ))}
    </ul>
  )
}

export function DocumentacionProcessingOverlay({ visible, label = 'Procesando documentos…' }: { visible: boolean; label?: string }) {
  if (!visible) return null
  return <div className="document-processing-overlay" role="status" aria-live="polite"><span>{label}</span></div>
}

export function ProcessingView({ title, detail, children }: { title: string; detail: string; children?: ReactNode }) {
  return <section className="processing-view" role="status"><h2>{title}</h2><p>{detail}</p>{children}</section>
}

export function DocumentRenderer({ title, metadata, children }: { title: string; metadata?: string; children: ReactNode }) {
  return <section className="document-renderer" aria-label={title}><header><div><h3>{title}</h3>{metadata && <small>{metadata}</small>}</div></header><div className="document-renderer-content">{children}</div></section>
}
