import type { JSONContent } from '@tiptap/react'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  LayoutList,
  Link2,
  LoaderCircle,
  Lock,
  Map,
  PencilLine,
  Play,
  RefreshCcw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import type { Project } from '../../types'
import {
  loadRemoteExpedienteProcessing,
  subscribeRemoteExpedienteProcessing,
  type RemoteExpedienteGroup,
} from '../../data/expedienteProcessing'
import {
  deleteExpedienteFile,
  requestExpedienteAnalysis,
  uploadExpedienteFiles,
  type ExpedienteUploadProgress,
} from '../../data/expedienteUpload'
import {
  createExpedienteV2Repository,
  type ExpedienteDocumentVersionSnapshot,
  type ExpedienteResultVersionSnapshot,
  type ExpedienteV2Repository,
} from '../../data/expedienteV2Repository'
import {
  adaptCanonicalPayloadToTable,
  adaptTableRowsToPayload,
  type ValidationNotice,
} from '../../lib/expedienteResultAdapters'
import type { ConsolidatedMasterRecord } from '../../lib/expedienteConsolidation'
import { downloadCorrespondenciaExcel } from '../../lib/consolidatedExcelGenerator'
import {
  correspondenciaRowToMasterRecord,
  deriveCorrespondenciaRow,
  validateCorrespondenciaRows,
  type CorrespondenciaExclusion,
} from '../../lib/correspondencia'
import { LinkagePanel } from './LinkagePanel'
import { compileConsolidatedToTiptap } from '../../lib/expedienteDocumentCompiler'
import type { ExpedienteGroupKey } from '../../lib/expedienteWorkflow'
import { buildPlanTitleLinkage, linkageSnapshot } from '../../lib/planTitleLinking'
import {
  buildNegotiationLinkage,
  negotiationLinkageSnapshot,
  pairsFromPlanRecords,
  type LinkedPair,
} from '../../lib/negotiationLinking'
import { buildDocxBlob } from '../../lib/tiptapToDocx'
import { downloadBlob, exportPagesToPdf } from '../../lib/docxPreviewPdf'
import { ChooseDocumentTemplateModal } from './ChooseDocumentTemplateModal'
import { DocumentDocxViewer, type DocumentDocxViewerHandle } from './DocumentDocxViewer'
import { ReviewDialog } from './ReviewDialog'
import {
  OFFICIAL_FINAL_DOCUMENT_TEMPLATES,
  type ExpedienteDocumentTemplate,
} from '../../lib/expedienteDocumentTemplates'
import {
  formatFileSize,
  statusLabel,
  type DetailView,
  type DocumentGroup,
  type EditableResultRow,
  type PrototypeConsolidationStatus,
  type PrototypeDocumentStatus,
  type ResultColumn,
} from './types'

const groupInfo: Record<
  ExpedienteGroupKey,
  {
    title: string
    description: string
    accepted: string
    accept: string
    multiple: boolean
    icon: typeof FileText
  }
> = {
  titles: {
    title: 'Estudio de Títulos',
    description: 'Estudios de títulos de los predios. Se analiza y aprueba primero: su FMI es la llave de los planos.',
    accepted: 'PDF o DOCX',
    accept: '.pdf,.docx',
    multiple: true,
    icon: FileText,
  },
  plans: {
    title: 'Planos',
    description: 'Un plano por estudio de títulos. Se vincula por FMI y se coteja contra el estudio aprobado.',
    accepted: 'PDF, PNG o JPG',
    accept: '.pdf,.png,.jpg,.jpeg',
    multiple: true,
    icon: Map,
  },
  negotiation: {
    title: 'Plantilla de negociación',
    description: 'El Excel vigente de ofertas. Al aprobar se registra el valor negociado en números y letras.',
    accepted: 'XLSX',
    accept: '.xlsx',
    multiple: false,
    icon: FileSpreadsheet,
  },
}

const orderedKeys: ExpedienteGroupKey[] = ['titles', 'plans', 'negotiation']

const initialDocumentContent: JSONContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Ficha de gestión predial' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Documento consolidado oficial generado automáticamente desde Supabase.' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Información consolidada' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Consolidación de antecedentes jurídicos, soportes cartográficos y ofertas económicas aprobadas.' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Observaciones' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Aprueba el consolidado de las 3 fuentes documentales para compilar la plantilla oficial completa.' }] },
  ],
}

function progressFor(group: RemoteExpedienteGroup): number {
  if (group.status === 'review_ready' || group.status === 'approved') return 100
  if (group.status === 'queued') return 15
  if (group.status === 'error') return 0
  if (!group.execution || group.execution.totalUnits === 0) return 0

  const stage = group.execution.stage
  if (stage === 'extracting') return 80
  if (stage === 'ready_for_extraction') return 60

  const validationRatio = group.execution.totalUnits > 0
    ? group.execution.completedUnits / group.execution.totalUnits
    : 0
  return Math.min(50, Math.round(validationRatio * 50))
}

function statusText(group: RemoteExpedienteGroup): string {
  if (group.status === 'review_ready') return 'Listo para revisar'
  return statusLabel(group.status)
}

function StatusText({ status, label }: { status: string; label: string }) {
  return (
    <span className={`expediente-status status-${status}`}>
      <span aria-hidden="true" />
      {label}
    </span>
  )
}

const consolidationLabel = (status: PrototypeConsolidationStatus): string =>
  ({
    blocked: 'Bloqueado (requiere 3 aprobaciones)',
    available: 'Listo para consolidar',
    processing: 'Consolidando registro maestro',
    review_ready: 'Listo para revisión',
    approved: 'Consolidado aprobado',
    stale: 'Requiere actualización',
  })[status]

const documentLabel = (status: PrototypeDocumentStatus): string =>
  ({
    blocked: 'Pendiente de consolidación',
    generating: 'Generando documento',
    editable: 'Listo para revisar',
    reprocessing: 'Aplicando cambios solicitados',
    final: 'Versión final lista',
    stale: 'Requiere regeneración',
  })[status]

export function RemoteExpedienteWorkspace({ project, onBack }: { project: Project; onBack?: () => void }) {
  const [view, setView] = useState<DetailView>('extraction')
  const [groups, setGroups] = useState<Record<ExpedienteGroupKey, RemoteExpedienteGroup> | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const setError = useCallback((msg: string | null) => {
    if (msg) toast.error(msg)
  }, [])
  const setNotice = (msg: string) => { if (msg) toast.success(msg) }
  const [busyGroup, setBusyGroup] = useState<ExpedienteGroupKey | null>(null)
  const [progress, setProgress] = useState<ExpedienteUploadProgress | null>(null)

  // Review Dialog state for individual groups
  const [activeGroupKey, setActiveGroupKey] = useState<ExpedienteGroupKey | null>(null)
  const [groupResult, setGroupResult] = useState<{
    version: ExpedienteResultVersionSnapshot
    rows: EditableResultRow[]
    columns: ResultColumn[]
    validationNotices: ValidationNotice[]
    /** Planos: filas del estudio de títulos aprobado para vincular por FMI. */
    titleRows?: EditableResultRow[]
    /** Negociación: parejas estudio ↔ plano aprobadas. */
    pairs?: LinkedPair[]
  } | null>(null)

  // Consolidation state
  const [consolidationStatus, setConsolidationStatus] = useState<PrototypeConsolidationStatus>('blocked')
  const [consolidationVersion, setConsolidationVersion] = useState<number>(1)
  const [consolidating, setConsolidating] = useState(false)
  const [consolidatedOpen, setConsolidatedOpen] = useState(false)
  // Consolidado CORRESPONDENCIA: una fila por predio (estudio + plano + negociación).
  const [consolidatedRows, setConsolidatedRows] = useState<EditableResultRow[]>([])
  const [consolidatedColumns, setConsolidatedColumns] = useState<ResultColumn[]>([])
  const [consolidatedExcluded, setConsolidatedExcluded] = useState<CorrespondenciaExclusion[]>([])
  const [documentPredioId, setDocumentPredioId] = useState<string | null>(null)
  const [consolidatedResultVersion, setConsolidatedResultVersion] = useState<ExpedienteResultVersionSnapshot | null>(null)

  // Document workspace state
  const [documentState, setDocumentState] = useState<{
    status: PrototypeDocumentStatus
    version: number
    id: string | null
    updatedAt?: string
  }>({ status: 'blocked', version: 1, id: null })
  const [documentContent, setDocumentContent] = useState<JSONContent>(initialDocumentContent)
  // El .docx generado es la fuente única: se visualiza, se descarga y de él sale el PDF.
  const [documentDocx, setDocumentDocx] = useState<Blob | null>(null)
  const viewerRef = useRef<DocumentDocxViewerHandle>(null)
  const [chooseTemplateOpen, setChooseTemplateOpen] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState<ExpedienteDocumentTemplate>(
    OFFICIAL_FINAL_DOCUMENT_TEMPLATES[0],
  )
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)

  const responsibleName = project.responsibleName || project.clientName || 'Equipo jurídico territorial'
  const mounted = useRef(true)
  const repo: ExpedienteV2Repository = useMemo(() => createExpedienteV2Repository({ mode: 'supabase' }), [])

  const applyDocumentSnapshot = useCallback((document: ExpedienteDocumentVersionSnapshot) => {
    setDocumentContent(document.content as JSONContent)
    setDocumentState({
      id: document.id,
      status: document.finalizedAt ? 'final' : 'editable',
      version: document.versionNumber,
      updatedAt: new Intl.DateTimeFormat('es-CO', { timeStyle: 'medium' }).format(new Date(document.createdAt)),
    })
  }, [])

  const refresh = useCallback(async () => {
    try {
      const next = await loadRemoteExpedienteProcessing(project.id)
      if (mounted.current) {
        setGroups(next)
        setError(null)
      }

      // Check remote consolidation status
      try {
        const consSnap = await repo.getConsolidatedResultVersion(project.id)
        if (mounted.current && consSnap) {
          setConsolidatedResultVersion(consSnap)
          setConsolidationVersion(consSnap.versionNumber)
          const adapted = adaptCanonicalPayloadToTable('consolidated', consSnap.payload)
          setConsolidatedRows(adapted.rows)
          setConsolidatedColumns(adapted.columns)
          setConsolidatedExcluded(Array.isArray(consSnap.payload.excluded) ? (consSnap.payload.excluded as CorrespondenciaExclusion[]) : [])
          if (consSnap.status === 'approved') {
            setConsolidationStatus('approved')
          } else {
            setConsolidationStatus('review_ready')
          }
        }
      } catch {
        // Non-blocking if table not populated yet
      }
      const document = await repo.getCurrentDocument(project.id)
      if (mounted.current && document) applyDocumentSnapshot(document)
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : 'No fue posible sincronizar el proyecto.'
      if (mounted.current) {
        setLoadError(msg)
        setError(msg)
      }
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [applyDocumentSnapshot, project.id, repo])

  useEffect(() => {
    mounted.current = true
    setLoading(true)
    void refresh()
    const unsubscribe = subscribeRemoteExpedienteProcessing(project.id, () => void refresh())
    return () => {
      mounted.current = false
      unsubscribe()
    }
  }, [project.id, refresh])

  // Polling fallback: ensures the UI refreshes when background analysis finishes even without websocket realtime
  useEffect(() => {
    if (!groups) return
    const isAnyGroupBusy = Object.values(groups).some(
      (g) => g.status === 'queued' || g.status === 'processing' || g.execution?.status === 'queued' || g.execution?.status === 'processing'
    )
    if (!isAnyGroupBusy) return

    const interval = setInterval(() => {
      void refresh()
    }, 2000)

    return () => clearInterval(interval)
  }, [groups, refresh])


  useEffect(() => {
    if (!documentState.id) {
      setDocumentDocx(null)
      return
    }
    let cancelled = false
    buildDocxBlob(documentContent, { title: activeTemplate.name, author: responsibleName })
      .then((blob) => { if (!cancelled) setDocumentDocx(blob) })
      .catch(() => { if (!cancelled) setError('No fue posible preparar el documento para visualizarlo.') })
    return () => { cancelled = true }
  }, [activeTemplate.name, documentContent, documentState.id, responsibleName, setError])

  const approvedGroupsCount = useMemo(
    () => (groups ? orderedKeys.filter((key) => groups[key].status === 'approved').length : 0),
    [groups],
  )
  const allGroupsApproved = approvedGroupsCount === 3
  const correspondenciaRows = useMemo(() => consolidatedRows.filter((row) => 'B' in row && 'BE' in row), [consolidatedRows])
  const documentRow = correspondenciaRows.find((row) => row.id === documentPredioId) ?? correspondenciaRows[0]
  // Registro del predio elegido para el documento final.
  const consolidatedMasterRecord: ConsolidatedMasterRecord | null = useMemo(() => {
    if (!documentRow) return null
    const metadata = (consolidatedResultVersion?.payload?.metadata ?? {}) as Partial<ConsolidatedMasterRecord['metadata']>
    return correspondenciaRowToMasterRecord(documentRow, metadata)
  }, [consolidatedResultVersion, documentRow])
  const predioOptions = useMemo(
    () => correspondenciaRows.map((row) => ({ id: row.id, label: `${row.A || 'Sin carpeta'} · FMI ${row.B} · ${row.I || 'Predio'}` })),
    [correspondenciaRows],
  )

  const isConsolidatedReady = Boolean(
    correspondenciaRows.length > 0 ||
    consolidationStatus === 'approved' ||
    consolidationStatus === 'review_ready',
  )

  useEffect(() => {
    setConsolidationStatus((curr) => {
      if (curr === 'approved') return curr
      if (allGroupsApproved && curr === 'blocked') return 'available'
      if (!allGroupsApproved && ['available', 'processing', 'review_ready'].includes(curr)) return 'stale'
      return curr
    })
  }, [allGroupsApproved])

  async function selectFiles(group: RemoteExpedienteGroup, files: FileList | null) {
    if (!files?.length) return
    setBusyGroup(group.key)
    setProgress(null)
    try {
      await uploadExpedienteFiles(group.id, group.key, Array.from(files), 'keep_version', setProgress)
      setNotice(`Archivos subidos exitosamente para ${groupInfo[group.key].title}.`)
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'La carga no pudo completarse.')
    } finally {
      setBusyGroup(null)
      setTimeout(() => {
        if (mounted.current) {
          setProgress(null)
        }
      }, 500)
    }
  }

  async function handleRemoveFile(group: RemoteExpedienteGroup, fileId: string, fileName: string) {
    if (group.status === 'queued' || group.status === 'processing') {
      setError('No es posible eliminar archivos mientras el grupo se encuentra en análisis.')
      return
    }
    const confirmed = window.confirm(`¿Deseas retirar el archivo "${fileName}" de este grupo?`)
    if (!confirmed) return

    setDeletingFileId(fileId)
    setError(null)
    try {
      await deleteExpedienteFile(fileId)
      setNotice(`Archivo "${fileName}" retirado exitosamente.`)
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible eliminar el archivo.')
    } finally {
      if (mounted.current) setDeletingFileId(null)
    }
  }

  async function enqueue(group: RemoteExpedienteGroup) {
    if (group.key === 'plans' && groups?.titles.status !== 'approved') {
      setError('Primero analiza y aprueba el Estudio de Títulos: los planos se vinculan con él por FMI.')
      return
    }
    if (group.key === 'negotiation' && (groups?.titles.status !== 'approved' || groups?.plans.status !== 'approved')) {
      setError('Primero aprueba el Estudio de Títulos y los Planos: cada fila de la negociación se vincula con su pareja por FMI.')
      return
    }
    setBusyGroup(group.key)
    try {
      await requestExpedienteAnalysis({
        groupId: group.id,
        idempotencyKey: `expediente-v2:${group.id}:${crypto.randomUUID()}`,
        extractorSnapshot: { phase: '3-and-4', validation: 'binary-integrity-v1' },
        promptSnapshot: { schema: { phase: '4-orchestrated' } },
        modelSnapshot: { provider: 'default', model: 'pipeline-phase4' },
      })
      setNotice(`Se envió ${groupInfo[group.key].title} para análisis en el worker.`)
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible encolar el análisis.')
    } finally {
      setBusyGroup(null)
    }
  }

  async function openReviewForGroup(group: RemoteExpedienteGroup) {
    setBusyGroup(group.key)
    try {
      let snap = await repo.getResultVersion(group.id)

      // Reintentar brevemente si la versión aún se está sincronizando o el payload está vacío
      let attempts = 0
      while (
        attempts < 4 &&
        (!snap || !snap.payload || Object.keys(snap.payload).length === 0)
      ) {
        attempts++
        await new Promise((resolve) => setTimeout(resolve, 600))
        snap = await repo.getResultVersion(group.id)
      }

      if (!snap || !snap.payload || Object.keys(snap.payload).length === 0) {
        setError('Los resultados del análisis aún se están sincronizando con el servidor. Por favor espera unos momentos y vuelve a hacer clic en "Analizar resultados".')
        return
      }

      const payload = snap.payload
      const adapted = adaptCanonicalPayloadToTable(group.key, payload)
      let titleRows: EditableResultRow[] | undefined
      if (group.key === 'plans' && groups) {
        const titlesVersion = groups.titles.status === 'approved' ? await repo.getApprovedResultVersion(groups.titles.id) : null
        titleRows = titlesVersion?.payload ? adaptCanonicalPayloadToTable('titles', titlesVersion.payload).rows : []
      }
      let pairs: LinkedPair[] | undefined
      if (group.key === 'negotiation' && groups) {
        pairs = await loadApprovedPairs()
        if (!Array.isArray(payload.negotiations)) {
          // Resultado de un worker anterior: trae un solo predio y sin FMI, así que no puede vincularse.
          setError('Este resultado de negociación lo generó una versión anterior del worker (sin las filas por predio ni su FMI). Usa "Reprocesar" para extraerlo de nuevo con la versión actual.')
        }
      }
      setGroupResult({
        version: snap,
        rows: adapted.rows,
        columns: adapted.columns,
        validationNotices: adapted.validationNotices,
        titleRows,
        pairs,
      })
      setActiveGroupKey(group.key)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible cargar los resultados para revisión.')
    } finally {
      setBusyGroup(null)
    }
  }

  /** Parejas estudio ↔ plano de la versión aprobada de planos (su tabla resultante congelada). */
  async function loadApprovedPairs(): Promise<LinkedPair[]> {
    if (!groups || groups.plans.status !== 'approved') return []
    const plansVersion = await repo.getApprovedResultVersion(groups.plans.id)
    const records = plansVersion?.payload?.linked_records
    if (Array.isArray(records) && records.length) return pairsFromPlanRecords(records as EditableResultRow[])
    // Aprobaciones anteriores al cotejo: se recalcula el vínculo con los estudios aprobados.
    const titlesVersion = groups.titles.status === 'approved' ? await repo.getApprovedResultVersion(groups.titles.id) : null
    if (!plansVersion?.payload || !titlesVersion?.payload) return []
    const planRows = adaptCanonicalPayloadToTable('plans', plansVersion.payload).rows
    const titleRows = adaptCanonicalPayloadToTable('titles', titlesVersion.payload).rows
    return pairsFromPlanRecords(buildPlanTitleLinkage(planRows, titleRows).rows)
  }

  async function handleSaveGroupDraft(rows: EditableResultRow[]) {
    if (!activeGroupKey || !groupResult) return
    const key = activeGroupKey
    const existing = groupResult.version
    const updatedPayload = adaptTableRowsToPayload(key, rows, existing.payload)
    if (existing.id) {
      const editRevision = await repo.saveDraft(existing.id, updatedPayload, 'Edición manual de revisor', existing.editRevision)
      existing.editRevision = editRevision
    }
    setGroupResult((curr) =>
      curr
        ? {
            ...curr,
            rows,
            version: { ...curr.version, payload: updatedPayload, editRevision: existing.editRevision },
          }
        : null,
    )
    setNotice(`Borrador de ${groupInfo[key].title} guardado exitosamente.`)
  }

  async function handleApproveGroup(rows: EditableResultRow[]) {
    if (!activeGroupKey || !groupResult) return
    const key = activeGroupKey
    const existing = groupResult.version
    let updatedPayload = adaptTableRowsToPayload(key, rows, existing.payload)
    if (key === 'plans') {
      if (groups?.titles.status !== 'approved') {
        setError('El Estudio de Títulos debe estar aprobado para aprobar los planos.')
        return
      }
      // Tabla resultante = planos + estudio de títulos, con sus alertas, congelada al aprobar.
      updatedPayload = { ...updatedPayload, ...linkageSnapshot(buildPlanTitleLinkage(rows, groupResult.titleRows ?? [])) }
    }
    if (key === 'negotiation') {
      if (groups?.plans.status !== 'approved') {
        setError('Los Planos deben estar aprobados para aprobar la plantilla de negociación.')
        return
      }
      const linkage = buildNegotiationLinkage(rows, groupResult.pairs ?? [])
      if (linkage.summary.missingValues > 0) {
        setError('Cada predio vinculado debe tener su valor negociado en números y letras que coincidan.')
        return
      }
      updatedPayload = { ...updatedPayload, ...negotiationLinkageSnapshot(linkage) }
    }

    if (existing.id) {
      await repo.saveDraft(existing.id, updatedPayload, 'Edición previa a aprobación', existing.editRevision)
      await repo.approveResult(existing.id, 'Aprobado formalmente por revisor jurídico')
    }

    setNotice(`${groupInfo[key].title} quedó formalmente aprobado para consolidación.`)
    setActiveGroupKey(null)
    setGroupResult(null)
    await refresh()
  }

  async function handleReprocessGroup() {
    if (!activeGroupKey || !groups) return
    const group = groups[activeGroupKey]
    try {
      await repo.reprocessGroup(group.id)
      setActiveGroupKey(null)
      setGroupResult(null)
      setNotice(`Se solicitó reanálisis para ${groupInfo[group.key].title}.`)
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible reintentar el análisis.')
    }
  }

  async function handleConsolidate() {
    if (!allGroupsApproved) return
    setConsolidating(true)
    try {
      await repo.consolidate(project.id, undefined, { projectName: project.name })
      const consSnap = await repo.getConsolidatedResultVersion(project.id)
      if (consSnap) {
        setConsolidatedResultVersion(consSnap)
        setConsolidationVersion(consSnap.versionNumber)
        setConsolidationStatus('review_ready')
        const adapted = adaptCanonicalPayloadToTable('consolidated', consSnap.payload)
        setConsolidatedRows(adapted.rows)
        setConsolidatedColumns(adapted.columns)
        setConsolidatedExcluded(Array.isArray(consSnap.payload.excluded) ? (consSnap.payload.excluded as CorrespondenciaExclusion[]) : [])
        setConsolidatedOpen(true)
        const count = Array.isArray(consSnap.payload.correspondencia) ? consSnap.payload.correspondencia.length : 0
        setNotice(`Consolidado CORRESPONDENCIA generado: ${count} predio(s).`)
      }
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error al consolidar el proyecto.')
    } finally {
      setConsolidating(false)
    }
  }

  async function handleSaveConsolidatedDraft(rows: EditableResultRow[]) {
    if (!consolidatedResultVersion) return
    const updatedPayload = adaptTableRowsToPayload('consolidated', rows, consolidatedResultVersion.payload)
    const editRevision = await repo.saveDraft(
      consolidatedResultVersion.id,
      updatedPayload,
      'Edición manual en consolidado',
      consolidatedResultVersion.editRevision,
    )
    setConsolidatedResultVersion((current) => current ? { ...current, payload: updatedPayload, editRevision } : current)
    setConsolidatedRows(rows)
    setNotice('Borrador del registro consolidado guardado exitosamente.')
  }

  async function handleApproveConsolidated(rows: EditableResultRow[]) {
    if (!consolidatedResultVersion) return
    const updatedPayload = adaptTableRowsToPayload('consolidated', rows, consolidatedResultVersion.payload)
    await repo.saveDraft(
      consolidatedResultVersion.id,
      updatedPayload,
      'Guardado antes de aprobar consolidado',
      consolidatedResultVersion.editRevision,
    )
    await repo.approveResult(consolidatedResultVersion.id, 'Consolidado aprobado para generación final')
    setConsolidationStatus('approved')
    setConsolidatedOpen(false)

    // Consolidado aprobado: se pasa a escoger predio y plantilla del documento final.
    setConsolidatedRows(rows)
    setNotice('Consolidado aprobado con éxito. Por favor, escoge el documento oficial que deseas generar.')
    setChooseTemplateOpen(true)
    await refresh()
  }

  async function handleSelectDocumentTemplate(template: ExpedienteDocumentTemplate, predioId?: string) {
    setIsGeneratingDoc(true)
    setError(null)
    try {
      const row = correspondenciaRows.find((item) => item.id === predioId) ?? documentRow
      if (!row) {
        throw new Error('Debes consolidar los resultados antes de generar el documento final.')
      }
      setDocumentPredioId(row.id)
      const metadata = (consolidatedResultVersion?.payload?.metadata ?? {}) as Partial<ConsolidatedMasterRecord['metadata']>
      const master = correspondenciaRowToMasterRecord(row, metadata)

      const compiled = compileConsolidatedToTiptap(master, {
        template,
        projectCode: project.id,
        projectName: project.name,
        compiledBy: responsibleName,
      })

      const document = await repo.saveDocument(
        project.id,
        compiled.content as Record<string, unknown>,
        documentState.id,
        `Documento generado con plantilla: ${template.name}`,
      )
      applyDocumentSnapshot(document)
      setActiveTemplate(template)
      setView('document')
      setChooseTemplateOpen(false)
      setNotice(`Documento oficial generado exitosamente con la plantilla "${template.name}".`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible generar el documento con la plantilla seleccionada.')
    } finally {
      setIsGeneratingDoc(false)
    }
  }

  const documentBaseName = () => (activeTemplate.targetFilename || 'DOCUMENTO_CONSOLIDADO.docx').replace(/\.docx?$/i, '')

  function handleDownloadDocx() {
    if (!documentDocx) {
      setError('El documento aún se está preparando. Intenta de nuevo en un momento.')
      return
    }
    // Se descarga exactamente el mismo archivo que se está visualizando.
    downloadBlob(documentDocx, `${documentBaseName()}.docx`)
    setNotice(`Archivo Word descargado (v${documentState.version}), idéntico al visualizado.`)
  }

  async function handleDownloadExcel() {
    try {
      if (!correspondenciaRows.length) throw new Error('No hay predios consolidados para exportar a CORRESPONDENCIA.')
      const safeName = project.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')
      await downloadCorrespondenciaExcel(correspondenciaRows, `CORRESPONDENCIA_${safeName}_v${consolidationVersion}.xlsx`)
      setNotice(`CORRESPONDENCIA descargado: ${correspondenciaRows.length} predio(s) con las 71 columnas de la plantilla.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error al descargar archivo Excel.')
    }
  }

  async function handleDownloadPdf() {
    const pages = viewerRef.current?.getPages() ?? []
    if (!pages.length) {
      setError('El documento aún se está visualizando. Intenta de nuevo en un momento.')
      return
    }
    setIsExportingPdf(true)
    try {
      // El PDF se arma con las mismas hojas que muestra el visualizador.
      await exportPagesToPdf(pages, `${documentBaseName()}.pdf`)
      setNotice(`Archivo PDF descargado (v${documentState.version}), idéntico al visualizado.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error al generar el PDF.')
    } finally {
      setIsExportingPdf(false)
    }
  }

  async function handleFinalizeDocument() {
    if (!documentState.id) return
    try {
      await repo.finalizeDocument(documentState.id)
      setDocumentState((previous) => ({
        ...previous,
        status: 'final',
        updatedAt: new Intl.DateTimeFormat('es-CO', { timeStyle: 'medium' }).format(new Date()),
      }))
      setNotice('Documento marcado como versión final oficial. Listo para entrega y firma.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible finalizar el documento.')
    }
  }

  if (loading && !groups) return <div className="expediente-remote-loading">Cargando proyecto remoto…</div>
  if (!groups) return <div className="expediente-remote-loading" role="alert">{loadError ?? 'No fue posible cargar el proyecto.'}</div>

  const activeGroup = activeGroupKey ? groups[activeGroupKey] : null

  return (
    <section className="expediente-prototype expediente-remote-workspace" aria-label="Gestión de proyecto predial">
      <div className="expediente-nav-tabs-bar">
        {onBack && (
          <button
            type="button"
            className="expediente-back-icon-btn"
            onClick={onBack}
            aria-label="Volver a proyectos"
            title="Volver a proyectos"
          >
            <ArrowLeft size={16} />
          </button>
        )}

        <div className="expediente-flow-tabs" role="tablist" aria-label="Etapas del proyecto">
          {[
            { id: 'summary' as const, label: 'Resumen', icon: LayoutList },
            { id: 'extraction' as const, label: 'Extracción', icon: Sparkles },
            { id: 'document' as const, label: 'Documento', icon: FileText },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              className={view === id ? 'active' : ''}
              onClick={() => setView(id)}
            >
              <Icon size={16} />
              {label}
              {id === 'extraction' && <span className="expediente-tab-counter">{approvedGroupsCount}/3</span>}
            </button>
          ))}
        </div>
      </div>

      {/* 1. SUMMARY VIEW */}
      {view === 'summary' && (
        <section className="expediente-summary" aria-label="Resumen del proyecto">
          <article className="expediente-identity-card">
            <div className="expediente-section-heading">
              <div>
                <p>Identificación del proyecto</p>
                <h2>{project.name}</h2>
              </div>
              <button type="button" className="expediente-secondary-action" onClick={() => setView('extraction')}>
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
              <div className="expediente-stage-row">
                <span className="expediente-stage-icon">
                  <FileText size={17} />
                </span>
                <div>
                  <strong>Documento final</strong>
                  <small>{documentLabel(documentState.status)}</small>
                </div>
                <StatusText status={documentState.status} label={documentLabel(documentState.status)} />
              </div>
            </div>
          </article>
        </section>
      )}

      {/* 2. EXTRACTION & CONSOLIDATION VIEW */}
      {view === 'extraction' && (
        <section className="expediente-extraction-view" aria-label="Extracción y consolidación">
          <div className="extraction-card-grid">
            {orderedKeys.map((key) => {
              const group = groups[key]
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
              const groupBusy = busyGroup === key

              return (
                <article className={`extraction-card state-${group.status}`} key={key}>
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
                      disabled={groupBusy || active}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        void selectFiles(group, event.target.files)
                        event.target.value = ''
                      }}
                    />
                    <label
                      className="extraction-upload-button"
                      htmlFor={`remote-expediente-${key}`}
                      aria-disabled={groupBusy || active}
                    >
                      {groupBusy ? <LoaderCircle size={17} className="spin" /> : <Upload size={17} />}
                      <span>{groupBusy ? 'Cargando…' : 'Agregar archivos'}</span>
                    </label>
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
                              <FileText size={15} aria-hidden="true" />
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
                                className="extraction-file-remove"
                                title={`Eliminar ${file.name}`}
                                aria-label={`Eliminar ${file.name}`}
                                disabled={groupBusy || active || isDeleting}
                                onClick={() => void handleRemoveFile(group, file.id, file.name)}
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
                      disabled={!canEnqueue || groupBusy}
                      onClick={() => void enqueue(group)}
                    >
                      {active || groupBusy ? (
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
                        disabled={groupBusy || active}
                        onClick={() => void openReviewForGroup(group)}
                      >
                        <PencilLine size={16} />
                        {group.status === 'approved' ? 'Ver resultados' : 'Analizar resultados'}
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>

          {/* Consolidation Section - Single Row */}
          <section className="extraction-consolidation-bar" aria-label="Consolidación predial">
            <div className="extraction-consolidation-left">
              <button
                type="button"
                className="expediente-primary-action"
                disabled={!allGroupsApproved || consolidating}
                onClick={() => void handleConsolidate()}
                title={
                  !allGroupsApproved
                    ? 'Debes aprobar los 3 subconjuntos para consolidar'
                    : 'Consolidar resultados de las fuentes aprobadas'
                }
              >
                {consolidating ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />}
                {consolidating
                  ? 'Consolidando…'
                  : consolidationStatus === 'stale'
                  ? 'Actualizar consolidado'
                  : 'Consolidar resultados'}
              </button>

              <button
                type="button"
                className="expediente-secondary-action choose-document-btn"
                disabled={!isConsolidatedReady}
                onClick={() => setChooseTemplateOpen(true)}
                title={
                  !isConsolidatedReady
                    ? 'Debes consolidar los resultados para habilitar la selección de plantilla'
                    : 'Escoger documento oficial a generar con los datos consolidados'
                }
              >
                <FileText size={16} />
                <span>Escoger documento a generar</span>
              </button>
            </div>

            <div className="extraction-consolidation-right">
              <StatusText status={consolidationStatus} label={consolidationLabel(consolidationStatus)} />
              {(correspondenciaRows.length > 0 || consolidationStatus === 'approved' || consolidationStatus === 'review_ready') && (
                <div className="extraction-consolidation-actions">
                  {consolidationStatus === 'approved' && (
                    <button
                      type="button"
                      className="expediente-secondary-action"
                      onClick={() => void handleDownloadExcel()}
                    >
                      <Download size={16} />
                      <span>Descargar Excel</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="expediente-secondary-action"
                    onClick={() => setConsolidatedOpen(true)}
                  >
                    <PencilLine size={16} />
                    <span>{consolidationStatus === 'approved' ? 'Ver consolidado' : 'Analizar consolidado'}</span>
                  </button>
                </div>
              )}
            </div>
          </section>
        </section>
      )}

      {/* 3. DOCUMENT FINAL VIEW */}
      {view === 'document' && (
        <section className="expediente-document" aria-label="Documento final oficial">
          {documentState.status === 'blocked' ? (
            <div className="expediente-document-empty">
              <FileText size={28} />
              <div>
                <h3>Aún no hay un documento para visualizar</h3>
                <p>Aprueba el consolidado de las 3 fuentes para habilitar la generación de la plantilla.</p>
                <button type="button" className="expediente-primary-action" onClick={() => setView('extraction')}>
                  <ChevronRight size={16} />
                  Ir a extracción y consolidación
                </button>
              </div>
            </div>
          ) : !documentState.id ? (
            <div className="expediente-document-empty">
              <FileText size={32} />
              <div>
                <h3>Paso pendiente: Escoger documento a generar</h3>
                <p>El consolidado está aprobado. Escoge la plantilla oficial para compilar el documento final del predio.</p>
                <button type="button" className="expediente-primary-action" onClick={() => setChooseTemplateOpen(true)}>
                  <FileText size={16} />
                  Escoger documento a generar
                </button>
              </div>
            </div>
          ) : (
            <div className="expediente-document-workspace">
              <div className="document-workspace-meta">
                <div>
                  <span>Versión {documentState.version} • {activeTemplate.name}</span>
                  <small>{documentState.updatedAt ? `Actualizada ${documentState.updatedAt}` : 'Versión oficial'}</small>
                </div>
                <div className="document-workspace-meta-right">
                  <StatusText status={documentState.status} label={documentLabel(documentState.status)} />
                  <span className="document-saved" title="El documento no se edita en la aplicación">
                    <Lock size={12} /> Solo lectura
                  </span>
                </div>
              </div>

              <DocumentDocxViewer ref={viewerRef} docx={documentDocx} ariaLabel={`Documento final: ${activeTemplate.name}`} />

              <div className="document-workspace-actions">
                <div>
                  <button
                    type="button"
                    className="expediente-secondary-action"
                    onClick={() => setChooseTemplateOpen(true)}
                    title="Escoger otra de las 3 plantillas oficiales"
                  >
                    <RefreshCcw size={16} />
                    <span>Cambiar plantilla</span>
                  </button>
                </div>
                <div>
                  <button
                    type="button"
                    className="expediente-secondary-action"
                    disabled={documentState.status === 'final'}
                    onClick={handleFinalizeDocument}
                  >
                    <CheckCircle2 size={16} />
                    Marcar como final
                  </button>
                  <button
                    type="button"
                    className="expediente-primary-action"
                    disabled={!documentDocx}
                    onClick={handleDownloadDocx}
                    title="Descarga el mismo archivo Word (.docx) que se está visualizando"
                  >
                    {!documentDocx ? <LoaderCircle size={16} className="spin" /> : <FileText size={16} />}
                    <span>Descargar Word (.docx)</span>
                  </button>
                  <button
                    type="button"
                    className="expediente-secondary-action"
                    disabled={!documentDocx || isExportingPdf}
                    onClick={() => void handleDownloadPdf()}
                    title="Descarga un PDF con las mismas páginas que se están visualizando"
                  >
                    {isExportingPdf ? <LoaderCircle size={16} className="spin" /> : <Download size={16} />}
                    <span>Descargar PDF</span>
                  </button>
                  <button
                    type="button"
                    className="expediente-secondary-action"
                    disabled={consolidationStatus !== 'approved'}
                    onClick={() => void handleDownloadExcel()}
                  >
                    <FileSpreadsheet size={16} />
                    Descargar Excel
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Review Dialog for Single Group */}
      {activeGroup && groupResult && (
        <ReviewDialog
          open={Boolean(activeGroupKey)}
          title={`Resultados de ${groupInfo[activeGroup.key].title}`}
          description={`Revisa la versión ${groupResult.version.versionNumber} antes de aprobarla para el consolidado del predio.`}
          version={groupResult.version.versionNumber}
          rows={groupResult.rows}
          columns={groupResult.columns}
          groupKey={activeGroup.key}
          isApproved={activeGroup.status === 'approved'}
          validationNotices={groupResult.validationNotices}
          linkedTitleRows={activeGroup.key === 'plans' ? groupResult.titleRows ?? [] : undefined}
          linkedPairs={activeGroup.key === 'negotiation' ? groupResult.pairs ?? [] : undefined}
          approvalBlockedReason={
            activeGroup.key === 'plans' && groups.titles.status !== 'approved'
              ? 'El Estudio de Títulos debe estar aprobado antes de aprobar los planos.'
              : activeGroup.key === 'negotiation' && groups.plans.status !== 'approved'
                ? 'Los Planos deben estar aprobados antes de aprobar la negociación.'
                : null
          }
          approveLabel={`Aprobar ${groupInfo[activeGroup.key].title.toLowerCase()}`}
          onOpenChange={(open) => {
            if (!open) {
              setActiveGroupKey(null)
              setGroupResult(null)
            }
          }}
          onSave={handleSaveGroupDraft}
          onApprove={handleApproveGroup}
          onReprocess={handleReprocessGroup}
        />
      )}

      {/* Review Dialog for Consolidated Master Record */}
      <ReviewDialog
        open={consolidatedOpen}
        title="Resultados consolidados"
        description="Revisa el registro maestro del predio antes de aprobarlo y generar el documento final."
        version={consolidationVersion}
        rows={consolidatedRows}
        columns={consolidatedColumns}
        deriveRow={deriveCorrespondenciaRow}
        validateRows={validateCorrespondenciaRows}
        headerPanel={
          <LinkagePanel
            title="Consolidado CORRESPONDENCIA"
            okLabel="Todos los predios con estudio, plano y negociación quedaron consolidados"
            chips={[
              { label: `${correspondenciaRows.length} predio(s) consolidados`, tone: 'exact' },
              ...(consolidatedExcluded.length ? [{ label: `${consolidatedExcluded.length} excluido(s)`, tone: 'absent' as const }] : []),
            ]}
            findings={consolidatedExcluded.map((item) => ({
              key: `${item.fmi}|${item.reason}`,
              tone: 'absent' as const,
              tag: 'Excluido',
              rowLabel: item.fmi ? `${item.label} · ${item.fmi}` : item.label,
              message: item.reason,
            }))}
          />
        }
        groupKey="consolidated"
        isApproved={consolidationStatus === 'approved'}
        approveLabel="Aprobar consolidado"
        onOpenChange={setConsolidatedOpen}
        onSave={handleSaveConsolidatedDraft}
        onApprove={handleApproveConsolidated}
        onReprocess={() => {
          setConsolidatedOpen(false)
          void handleConsolidate()
        }}
        onDownloadExcel={() => void handleDownloadExcel()}
      />

      {/* Choose Document Template Modal */}
      <ChooseDocumentTemplateModal
        open={chooseTemplateOpen}
        onOpenChange={setChooseTemplateOpen}
        initialTemplateId={activeTemplate.id}
        isGenerating={isGeneratingDoc}
        predios={predioOptions}
        initialPredioId={documentRow?.id ?? null}
        onSelectTemplate={handleSelectDocumentTemplate}
      />
    </section>
  )
}
