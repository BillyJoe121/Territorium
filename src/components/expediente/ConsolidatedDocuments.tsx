/**
 * Generación de documentos desde el consolidado: un solo botón con el tipo de documento (se
 * elige en una lista que se despliega hacia arriba) y el panel "Documentos generados" con una
 * sección plegable por tipo.
 */
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown, ChevronUp, Compass, Download, Eye, FilePen, FileSignature, FileText, Landmark, LoaderCircle, RefreshCcw, Scale, Trash2, X } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import type { GeneratedDocumentFile } from '../../data/generatedDocumentsStorage'
import { CUSTOM_TEMPLATE_EXAMPLE } from '../../lib/customTemplate'
import { GENERATED_DOCUMENT_TYPES, generateButtonLabel, type GeneratedDocumentKind, type GeneratedDocumentType } from '../../lib/generatedDocuments'
import type { ReviewToolbarContext } from './ReviewDialog'
import { formatFileSize } from './types'

const KIND_ICONS: Record<GeneratedDocumentKind, typeof FileText> = {
  escritura: FileSignature,
  linderos: Compass,
  minuta: Scale,
  epm: Landmark,
  personalizada: FilePen,
}

const DOCX_ACCEPT = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export interface GenerationProgress {
  kind: GeneratedDocumentKind
  done: number
  total: number
}

interface GenerationMenuProps {
  context: ReviewToolbarContext
  progress: GenerationProgress | null
  /** Tipo elegido en la lista; null hasta que se elige uno. */
  selected: GeneratedDocumentType | null
  /** Plantilla personalizada cargada (nombre del archivo). */
  customTemplateName: string | null
  /** Se está leyendo la plantilla personalizada que se acaba de subir. */
  readingTemplate: boolean
  onSelect: (type: GeneratedDocumentType) => void
  onPickCustomTemplate: (file: File) => void
  onGenerate: (type: GeneratedDocumentType, context: ReviewToolbarContext) => void
}

/**
 * "Seleccione tipo de documento" despliega la lista hacia arriba. Con un tipo elegido, el botón
 * genera ("para todos" o "para (x) seleccionados") y la flecha vuelve a abrir la lista.
 */
export function DocumentGenerationMenu({ context, progress, selected, customTemplateName, readingTemplate, onSelect, onPickCustomTemplate, onGenerate }: GenerationMenuProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const splitRef = useRef<HTMLDivElement>(null)
  const runRef = useRef<HTMLButtonElement>(null)
  // La lista se abre sobre el botón completo (no solo sobre la flecha), con su mismo ancho mínimo.
  const [menuGeometry, setMenuGeometry] = useState({ offset: 0, width: 0 })
  const measureMenu = (open: boolean) => {
    if (open) setMenuGeometry({ offset: -(runRef.current?.offsetWidth ?? 0), width: splitRef.current?.offsetWidth ?? 0 })
  }
  const selectedCount = context.rows.filter((row) => context.selectedIds.has(row.id)).length
  const busy = Boolean(progress) || readingTemplate
  const Icon = selected ? KIND_ICONS[selected.kind] : FileText

  const pickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = '' // Permite volver a elegir el mismo archivo tras corregirlo.
    if (file) onPickCustomTemplate(file)
  }

  return (
    <div className="document-generation" role="group" aria-label="Generar documentos">
      <input ref={fileRef} type="file" accept={DOCX_ACCEPT} hidden onChange={pickFile} />
      <div ref={splitRef} className={`document-generation-split${selected ? ' has-selection' : ''}`}>
        {selected && (
          <button
            ref={runRef}
            type="button"
            className="document-generation-run"
            disabled={busy || context.rows.length === 0}
            onClick={() => onGenerate(selected, context)}
          >
            {progress ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}
            <span>{progress ? `Generando ${progress.done} de ${progress.total}…` : generateButtonLabel(selected, selectedCount)}</span>
          </button>
        )}
        <DropdownMenu.Root modal={false} onOpenChange={measureMenu}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="document-generation-trigger"
              disabled={busy}
              aria-label={selected ? 'Cambiar tipo de documento' : undefined}
              title={selected ? 'Cambiar tipo de documento' : undefined}
            >
              {!selected && (
                <>
                  {readingTemplate ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <FileText size={16} aria-hidden="true" />}
                  <span>{readingTemplate ? 'Leyendo plantilla…' : 'Seleccione tipo de documento'}</span>
                </>
              )}
              <ChevronUp size={16} aria-hidden="true" className="document-generation-chevron" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="top"
              align="start"
              alignOffset={menuGeometry.offset}
              sideOffset={6}
              className="document-generation-menu"
              style={{ minWidth: Math.max(300, menuGeometry.width) }}
            >
              <DropdownMenu.Label className="document-generation-menu-label">Tipo de documento</DropdownMenu.Label>
              {GENERATED_DOCUMENT_TYPES.map((type) => {
                const OptionIcon = KIND_ICONS[type.kind]
                const isSelected = selected?.kind === type.kind
                return (
                  <DropdownMenu.Item
                    key={type.kind}
                    className={`document-generation-option${isSelected ? ' is-selected' : ''}`}
                    disabled={type.source === 'upcoming'}
                    onSelect={() => (type.source === 'custom' ? fileRef.current?.click() : onSelect(type))}
                  >
                    <OptionIcon size={16} aria-hidden="true" />
                    <span className="document-generation-option-text">
                      <span>{capitalize(type.label)}</span>
                      {type.source === 'custom' && (
                        <small>{customTemplateName ? `Cargada: ${customTemplateName}. Elige otra para cambiarla.` : `Sube un Word con marcadores como ${CUSTOM_TEMPLATE_EXAMPLE}.`}</small>
                      )}
                    </span>
                    {type.source === 'upcoming' && <span className="document-generation-soon">Próximamente</span>}
                    {isSelected && <Check size={15} aria-hidden="true" className="document-generation-check" />}
                  </DropdownMenu.Item>
                )
              })}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      {selected?.source === 'custom' && customTemplateName && (
        <span className="document-generation-template" title={customTemplateName}>
          <FilePen size={13} aria-hidden="true" />
          {customTemplateName}
        </span>
      )}
      {selectedCount > 0 && !progress && (
        <button type="button" className="document-generation-clear" onClick={context.clearSelection}>
          <X size={14} aria-hidden="true" />
          Quitar selección
        </button>
      )}
    </div>
  )
}

interface GeneratedDocumentsPanelProps {
  documents: Record<GeneratedDocumentKind, GeneratedDocumentFile[]>
  loading: boolean
  error: string | null
  /** Ruta del documento con una acción en curso (descargar o eliminar). */
  busyPath: string | null
  zippingKind: GeneratedDocumentKind | null
  /** Secciones desplegadas. */
  expanded: Record<GeneratedDocumentKind, boolean>
  onToggle: (kind: GeneratedDocumentKind) => void
  onRetry: () => void
  onView: (file: GeneratedDocumentFile) => void
  onDownload: (file: GeneratedDocumentFile) => void
  onDelete: (file: GeneratedDocumentFile) => void
  onDownloadAll: (kind: GeneratedDocumentKind) => void
}

const dateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' })

function emptyText(type: GeneratedDocumentType, loading: boolean): string {
  if (type.source === 'upcoming') return 'Próximamente: aún no hay una plantilla para este documento.'
  if (loading) return 'Cargando…'
  if (type.source === 'custom') return `Aún no hay documentos. Elige "Plantilla personalizada" en el botón de generar y sube un Word con marcadores como ${CUSTOM_TEMPLATE_EXAMPLE}.`
  return 'Aún no hay documentos.'
}

export function GeneratedDocumentsPanel({ documents, loading, error, busyPath, zippingKind, expanded, onToggle, onRetry, onView, onDownload, onDelete, onDownloadAll }: GeneratedDocumentsPanelProps) {
  return (
    <section className="generated-documents" aria-labelledby="generated-documents-title">
      <header className="generated-documents-header">
        <h3 id="generated-documents-title">Documentos generados</h3>
        <button type="button" className="generated-documents-refresh" onClick={onRetry} disabled={loading} aria-label="Actualizar lista de documentos" title="Actualizar lista">
          {loading ? <LoaderCircle size={14} className="spin" /> : <RefreshCcw size={14} />}
        </button>
      </header>
      {error && <p className="generated-documents-error" role="alert">{error}</p>}
      {GENERATED_DOCUMENT_TYPES.map((type) => {
        const files = documents[type.kind]
        const Icon = KIND_ICONS[type.kind]
        const open = expanded[type.kind]
        const contentId = `generated-documents-${type.kind}`
        const zipping = zippingKind === type.kind
        return (
          <div key={type.kind} className={`generated-documents-section${open ? ' is-open' : ''}${type.source === 'upcoming' ? ' is-upcoming' : ''}`}>
            <div className="generated-documents-section-header">
              <button
                type="button"
                className="generated-documents-section-toggle"
                aria-expanded={open}
                aria-controls={contentId}
                title={open ? 'Contraer' : 'Desplegar'}
                onClick={() => onToggle(type.kind)}
              >
                <Icon size={15} aria-hidden="true" />
                <span className="generated-documents-section-title">{type.sectionTitle}</span>
                <span className="generated-documents-count">{type.source === 'upcoming' ? '—' : files.length}</span>
                {open ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
              </button>
              <button
                type="button"
                className="generated-documents-icon-button"
                disabled={files.length === 0 || zippingKind !== null}
                onClick={() => onDownloadAll(type.kind)}
                aria-label={`Descargar todos: ${type.sectionTitle} (.zip)`}
                title={files.length ? `Descargar los ${files.length} documentos en un .zip` : 'No hay documentos para descargar'}
              >
                {zipping ? <LoaderCircle size={14} className="spin" /> : <Download size={14} />}
              </button>
            </div>
            <div id={contentId} className="generated-documents-section-body" hidden={!open}>
              {files.length === 0 ? (
                <p className="generated-documents-empty">{emptyText(type, loading)}</p>
              ) : (
                <ul className="generated-documents-list">
                  {files.map((file) => {
                    const busy = busyPath === file.path
                    return (
                      <li key={file.path}>
                        <span className="generated-document-name" title={file.name}>{file.name}</span>
                        <span className="generated-document-meta">
                          {[file.updatedAt ? dateFormat.format(new Date(file.updatedAt)) : null, file.size !== null ? formatFileSize(file.size) : null].filter(Boolean).join(' · ')}
                        </span>
                        <span className="generated-document-actions">
                          <button type="button" className="extraction-file-preview" onClick={() => onView(file)} title={`Ver ${file.name}`} aria-label={`Ver ${file.name}`}>
                            <Eye size={15} />
                          </button>
                          <button type="button" className="extraction-file-preview" onClick={() => onDownload(file)} disabled={busy} title={`Descargar ${file.name}`} aria-label={`Descargar ${file.name}`}>
                            {busy ? <LoaderCircle size={14} className="spin" /> : <Download size={14} />}
                          </button>
                          <button type="button" className="extraction-file-remove" onClick={() => onDelete(file)} disabled={busy} title={`Eliminar ${file.name}`} aria-label={`Eliminar ${file.name}`}>
                            <Trash2 size={14} />
                          </button>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}
