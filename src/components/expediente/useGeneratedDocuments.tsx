/**
 * Estado y acciones de los documentos generados desde el consolidado: tipo de documento elegido,
 * plantilla personalizada, generación por fila, lista por tipo, visualizar, descargar (uno o todos
 * en .zip) y eliminar.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from '../ui/ToastLayer'
import {
  DOCX_MIME,
  GeneratedDocumentsPermissionError,
  supabaseGeneratedDocumentsStore,
  type GeneratedDocumentFile,
  type GeneratedDocumentsStore,
} from '../../data/generatedDocumentsStorage'
import { correspondenciaRowToMasterRecord } from '../../lib/correspondencia'
import { fillCustomTemplate, readCustomTemplate, type CustomTemplate } from '../../lib/customTemplate'
import { buildZip, downloadBlob } from '../../lib/download'
import { compileConsolidatedToTiptap } from '../../lib/expedienteDocumentCompiler'
import type { ConsolidatedMasterRecord } from '../../lib/expedienteConsolidation'
import {
  GENERATED_DOCUMENT_TYPES,
  generatedDocumentName,
  storageSafe,
  templateForDocumentType,
  type GeneratedDocumentKind,
  type GeneratedDocumentType,
} from '../../lib/generatedDocuments'
import { buildDocxBlob } from '../../lib/tiptapToDocx'
import { DocumentGenerationMenu, GeneratedDocumentsPanel, type GenerationProgress } from './ConsolidatedDocuments'
import type { FilePreviewTarget } from './FilePreviewDialog'
import type { ReviewToolbarContext } from './ReviewDialog'

type DocumentsByKind = Record<GeneratedDocumentKind, GeneratedDocumentFile[]>
type ExpandedByKind = Record<GeneratedDocumentKind, boolean>
const EMPTY: DocumentsByKind = { escritura: [], linderos: [], minuta: [], epm: [], personalizada: [] }
/** Tipos con documentos en Storage (EPM aún no tiene plantilla). */
const ALL_KINDS = GENERATED_DOCUMENT_TYPES.filter((type) => type.source !== 'upcoming').map((type) => type.kind)
const typeOf = (kind: GeneratedDocumentKind) => GENERATED_DOCUMENT_TYPES.find((type) => type.kind === kind)!

interface Options {
  projectId: string
  projectName: string
  responsibleName: string
  consolidationVersion: number
  consolidationMetadata: Partial<ConsolidatedMasterRecord['metadata']>
  /** La lista se carga cuando se activa (modal del consolidado abierto o pestaña Resumen). */
  active: boolean
  onPreview: (target: FilePreviewTarget) => void
  /** Dónde se guardan los documentos; por defecto, Supabase Storage del proyecto. */
  store?: GeneratedDocumentsStore
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))
const rowLabel = (row: { id: string; A?: string; B?: string }) => row.A || (row.B ? `FMI ${row.B}` : row.id)

export function useGeneratedDocuments({ projectId, projectName, responsibleName, consolidationVersion, consolidationMetadata, active, onPreview, store: customStore }: Options): {
  toolbar: (context: ReviewToolbarContext) => ReactNode
  panel: ReactNode
  /** Documentos generados por tipo (para el resumen del proyecto). */
  documents: DocumentsByKind
  loading: boolean
  error: string | null
} {
  const [documents, setDocuments] = useState<DocumentsByKind>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<GenerationProgress | null>(null)
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [zippingKind, setZippingKind] = useState<GeneratedDocumentKind | null>(null)
  const [selectedKind, setSelectedKind] = useState<GeneratedDocumentKind | null>(null)
  const [customTemplate, setCustomTemplate] = useState<CustomTemplate | null>(null)
  const [readingTemplate, setReadingTemplate] = useState(false)
  // Las secciones empiezan plegadas: el usuario despliega las que quiere ver.
  const [expanded, setExpanded] = useState<ExpandedByKind>({ escritura: false, linderos: false, minuta: false, epm: false, personalizada: false })
  const store = useMemo(() => customStore ?? supabaseGeneratedDocumentsStore(projectId), [customStore, projectId])

  const reload = useCallback(async (kinds: GeneratedDocumentKind[] = ALL_KINDS) => {
    setLoading(true)
    try {
      const lists = await Promise.all(kinds.map((kind) => store.list(kind)))
      setDocuments((current) => ({ ...current, ...Object.fromEntries(kinds.map((kind, index) => [kind, lists[index]])) }))
      setError(null)
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setLoading(false)
    }
  }, [store])

  useEffect(() => {
    if (active) void reload()
  }, [active, reload])

  const pickCustomTemplate = useCallback(async (file: File) => {
    setReadingTemplate(true)
    try {
      const template = await readCustomTemplate(file)
      setCustomTemplate(template)
      setSelectedKind('personalizada')
      const known = template.placeholders.length - template.unknownPlaceholders.length
      toast.success(`Plantilla "${template.name}" lista: ${known} marcador(es) se llenarán con el consolidado.`)
      if (template.unknownPlaceholders.length) {
        const names = template.unknownPlaceholders.map((name) => `{{${name}}}`).join(', ')
        toast.warning(`Estos marcadores no son columnas del consolidado y quedarán tal cual: ${names}.`, { duration: 15000 })
      }
    } catch (caught) {
      toast.error(messageOf(caught), { duration: 12000 })
    } finally {
      setReadingTemplate(false)
    }
  }, [])

  const generate = useCallback(async (type: GeneratedDocumentType, context: ReviewToolbarContext) => {
    const { rows, selectedIds, blockedRows } = context
    const targets = selectedIds.size ? rows.filter((row) => selectedIds.has(row.id)) : rows
    if (!targets.length || type.source === 'upcoming') return
    if (type.source === 'custom' && !customTemplate) {
      toast.error('Primero sube la plantilla personalizada (.docx).')
      return
    }
    const template = type.source === 'official' ? templateForDocumentType(type) : null
    // Plantilla personalizada: los archivos llevan el nombre de la plantilla ("Acta de entrega TOL-ANZ-045.docx").
    const naming = customTemplate && type.source === 'custom'
      ? { ...type, filePrefix: storageSafe(customTemplate.name.replace(/\.docx$/i, '')) || type.filePrefix }
      : type
    const skipped: string[] = []
    const failed: string[] = []
    let generated = 0
    let withWarnings = 0
    let permissionError: string | null = null
    setProgress({ kind: type.kind, done: 0, total: targets.length })
    for (const [index, row] of targets.entries()) {
      if (blockedRows.has(row.id)) {
        // Casillas en rojo (p. ej. valor negociado que no coincide): el documento saldría mal.
        skipped.push(rowLabel(row))
      } else {
        try {
          let blob: Blob
          let warnings: number
          if (template) {
            const master = correspondenciaRowToMasterRecord(row, consolidationMetadata)
            const compiled = compileConsolidatedToTiptap(master, { template, projectCode: projectId, projectName, compiledBy: responsibleName })
            blob = await buildDocxBlob(compiled.content, { title: template.name, author: responsibleName })
            warnings = compiled.warnings.length
          } else {
            const filled = await fillCustomTemplate(customTemplate!, row)
            blob = filled.blob
            warnings = filled.missing
          }
          await store.save(type.kind, generatedDocumentName(naming, row, rows), blob, {
            plantilla: template ? template.id : `personalizada:${naming.filePrefix}`,
            consolidado_version: String(consolidationVersion),
            fila: row.id,
            fmi: String(row.B ?? ''),
            generado_por: responsibleName,
          })
          generated++
          if (warnings) withWarnings++
        } catch (caught) {
          // Sin permiso en Storage, las demás filas fallarían igual: se detiene la generación.
          if (caught instanceof GeneratedDocumentsPermissionError) {
            permissionError = caught.message
            break
          }
          failed.push(`${rowLabel(row)}: ${messageOf(caught)}`)
        }
      }
      setProgress({ kind: type.kind, done: index + 1, total: targets.length })
    }
    setProgress(null)
    await reload([type.kind])

    if (generated) toast.success(`${generated} documento(s) de ${type.label} generado(s).`)
    if (withWarnings) toast.warning(`${withWarnings} documento(s) tienen campos requeridos sin dato en el consolidado: revísalos antes de usarlos.`)
    if (skipped.length) toast.warning(`No se generaron ${skipped.length} predio(s) con casillas en rojo: ${skipped.join(', ')}. Corrígelas y vuelve a generar.`)
    if (permissionError) toast.error(permissionError, { duration: 12000 })
    if (failed.length) toast.error(`No se pudieron generar ${failed.length} documento(s). ${failed[0]}`)
  }, [projectId, projectName, responsibleName, consolidationVersion, consolidationMetadata, customTemplate, reload, store])

  const view = useCallback((file: GeneratedDocumentFile) => {
    onPreview({
      document: { id: file.path, storage_path: file.path, original_name: file.name, mime_type: DOCX_MIME },
      loadBlob: () => store.load(file.path),
    })
  }, [onPreview, store])

  const download = useCallback(async (file: GeneratedDocumentFile) => {
    setBusyPath(file.path)
    try {
      downloadBlob(await store.load(file.path), file.name)
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setBusyPath(null)
    }
  }, [store])

  const remove = useCallback(async (file: GeneratedDocumentFile) => {
    if (!window.confirm(`¿Deseas eliminar el documento "${file.name}"?`)) return
    setBusyPath(file.path)
    try {
      await store.remove(file.path)
      toast.success(`Documento "${file.name}" eliminado.`)
      await reload([file.kind])
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setBusyPath(null)
    }
  }, [reload, store])

  const downloadAll = useCallback(async (kind: GeneratedDocumentKind) => {
    const files = documents[kind]
    const type = typeOf(kind)
    if (!files.length) return
    setZippingKind(kind)
    try {
      const blobs = await Promise.all(files.map(async (file) => ({ name: file.name, blob: await store.load(file.path) })))
      const safeProject = projectName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 _-]+/g, ' ').trim()
      downloadBlob(await buildZip(blobs), `${type.sectionTitle} - ${safeProject}.zip`)
    } catch (caught) {
      toast.error(`No se pudo preparar el .zip: ${messageOf(caught)}`)
    } finally {
      setZippingKind(null)
    }
  }, [documents, projectName, store])

  return {
    toolbar: (context) => (
      <DocumentGenerationMenu
        context={context}
        progress={progress}
        selected={selectedKind ? typeOf(selectedKind) : null}
        customTemplateName={customTemplate?.name ?? null}
        readingTemplate={readingTemplate}
        onSelect={(type) => setSelectedKind(type.kind)}
        onPickCustomTemplate={(file) => void pickCustomTemplate(file)}
        onGenerate={(type, ctx) => void generate(type, ctx)}
      />
    ),
    documents,
    loading,
    error,
    panel: (
      <GeneratedDocumentsPanel
        documents={documents}
        loading={loading}
        error={error}
        busyPath={busyPath}
        zippingKind={zippingKind}
        expanded={expanded}
        onToggle={(kind) => setExpanded((current) => ({ ...current, [kind]: !current[kind] }))}
        onRetry={() => void reload()}
        onView={view}
        onDownload={(file) => void download(file)}
        onDelete={(file) => void remove(file)}
        onDownloadAll={(kind) => void downloadAll(kind)}
      />
    ),
  }
}
