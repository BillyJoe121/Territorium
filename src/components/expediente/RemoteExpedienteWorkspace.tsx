import type { JSONContent } from '@tiptap/react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  LayoutList,
  LoaderCircle,
  Map,
  MapPin,
  PencilLine,
  Play,
  RefreshCcw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
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
import {
  consolidateApprovedGroups,
  type ConsolidatedMasterRecord,
} from '../../lib/expedienteConsolidation'
import { downloadConsolidatedExcel } from '../../lib/consolidatedExcelGenerator'
import {
  compileConsolidatedToTiptap,
  extractNarrativeSection,
} from '../../lib/expedienteDocumentCompiler'
import {
  createAiRevisionProposal,
  type AiRevisionProposal,
} from '../../lib/expedienteAiRevisionGuard'
import { downloadExpedientePdf } from '../../lib/expedientePdfGenerator'
import type { ExpedienteGroupKey } from '../../lib/expedienteWorkflow'
import { AiRevisionDialog } from './AiRevisionDialog'
import { AiRevisionProposalModal } from './AiRevisionProposalModal'
import { DocumentPrototypeEditor } from './DocumentPrototypeEditor'
import { ReviewDialog } from './ReviewDialog'
import {
  consolidatedColumns,
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
    title: 'Títulos',
    description: 'Estudios, certificados y antecedentes jurídicos del mismo predio.',
    accepted: 'PDF o DOCX',
    accept: '.pdf,.docx',
    multiple: true,
    icon: FileText,
  },
  plans: {
    title: 'Planos',
    description: 'Planos y soportes técnicos asociados a la gestión predial.',
    accepted: 'PDF, PNG o JPG',
    accept: '.pdf,.png,.jpg,.jpeg',
    multiple: true,
    icon: Map,
  },
  negotiation: {
    title: 'Negociación',
    description: 'La tabla vigente de ofertas y validaciones económicas.',
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
    editable: 'Listo para editar',
    reprocessing: 'Aplicando cambios solicitados',
    final: 'Versión final lista',
    stale: 'Requiere regeneración',
  })[status]

export function RemoteExpedienteWorkspace({ project, onBack }: { project: Project; onBack?: () => void }) {
  const [view, setView] = useState<DetailView>('extraction')
  const [groups, setGroups] = useState<Record<ExpedienteGroupKey, RemoteExpedienteGroup> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [busyGroup, setBusyGroup] = useState<ExpedienteGroupKey | null>(null)
  const [progress, setProgress] = useState<ExpedienteUploadProgress | null>(null)

  // Review Dialog state for individual groups
  const [activeGroupKey, setActiveGroupKey] = useState<ExpedienteGroupKey | null>(null)
  const [groupResult, setGroupResult] = useState<{
    version: ExpedienteResultVersionSnapshot
    rows: EditableResultRow[]
    columns: ResultColumn[]
    validationNotices: ValidationNotice[]
  } | null>(null)

  // Consolidation state
  const [consolidationStatus, setConsolidationStatus] = useState<PrototypeConsolidationStatus>('blocked')
  const [consolidationVersion, setConsolidationVersion] = useState<number>(1)
  const [consolidating, setConsolidating] = useState(false)
  const [consolidatedOpen, setConsolidatedOpen] = useState(false)
  const [consolidatedRows, setConsolidatedRows] = useState<EditableResultRow[]>([])
  const [consolidatedMasterRecord, setConsolidatedMasterRecord] = useState<ConsolidatedMasterRecord | null>(null)
  const [consolidatedResultVersion, setConsolidatedResultVersion] = useState<ExpedienteResultVersionSnapshot | null>(null)

  // Document workspace state
  const [documentState, setDocumentState] = useState<{
    status: PrototypeDocumentStatus
    version: number
    id: string | null
    updatedAt?: string
  }>({ status: 'blocked', version: 1, id: null })
  const [documentContent, setDocumentContent] = useState<JSONContent>(initialDocumentContent)
  const [documentDirty, setDocumentDirty] = useState(false)

  // AI revision modal state
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [currentProposal, setCurrentProposal] = useState<AiRevisionProposal | null>(null)
  const [proposalModalOpen, setProposalModalOpen] = useState(false)
  const [lastUserComment, setLastUserComment] = useState('')
  const [activeAiRevisionId, setActiveAiRevisionId] = useState<string | null>(null)
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)

  const mounted = useRef(true)
  const repo: ExpedienteV2Repository = useMemo(() => createExpedienteV2Repository({ mode: 'supabase' }), [])

  const applyDocumentSnapshot = useCallback((document: ExpedienteDocumentVersionSnapshot) => {
    setDocumentContent(document.content as JSONContent)
    setDocumentDirty(false)
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
          setConsolidatedMasterRecord(consSnap.payload as unknown as ConsolidatedMasterRecord)
          const adapted = adaptCanonicalPayloadToTable('consolidated', consSnap.payload)
          setConsolidatedRows(adapted.rows)
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
      if (mounted.current) setError(caught instanceof Error ? caught.message : 'No fue posible sincronizar el expediente.')
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
    if (!activeAiRevisionId) return
    let cancelled = false
    const poll = async () => {
      try {
        const revision = await repo.getDocumentAiRevision(activeAiRevisionId)
        if (cancelled || !revision) return
        if (revision.status === 'completed' && revision.proposedContent) {
          const proposal = createAiRevisionProposal(
            {
              id: revision.id,
              expedienteId: project.id,
              sourceVersion: documentState.version,
              userComment: revision.userComment,
              requestedBy: project.clientName || 'Analista Jurídico Territorium',
              requestedAt: revision.createdAt,
              scope: 'narrative_only',
            },
            documentContent,
            extractNarrativeSection(revision.proposedContent as JSONContent),
            consolidatedMasterRecord || undefined,
          )
          setLastUserComment(revision.userComment)
          setCurrentProposal({ ...proposal, id: revision.id, requestId: revision.id, proposedContent: revision.proposedContent as JSONContent })
          setProposalModalOpen(true)
          setActiveAiRevisionId(null)
          setDocumentState((previous) => ({ ...previous, status: 'editable' }))
          return
        }
        if (revision.status === 'failed') {
          setActiveAiRevisionId(null)
          setDocumentState((previous) => ({ ...previous, status: 'editable' }))
          setError('La revisión de IA no pudo completarse tras los reintentos. Inténtalo de nuevo.')
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'No fue posible consultar la revisión de IA.')
      }
    }
    void poll()
    const timer = window.setInterval(() => void poll(), 2000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeAiRevisionId, consolidatedMasterRecord, documentContent, documentState.version, project.clientName, project.id, repo])

  const approvedGroupsCount = useMemo(
    () => (groups ? orderedKeys.filter((key) => groups[key].status === 'approved').length : 0),
    [groups],
  )
  const allGroupsApproved = approvedGroupsCount === 3

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
      setGroupResult({
        version: snap,
        rows: adapted.rows,
        columns: adapted.columns,
        validationNotices: adapted.validationNotices,
      })
      setActiveGroupKey(group.key)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible cargar los resultados para revisión.')
    } finally {
      setBusyGroup(null)
    }
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
    const updatedPayload = adaptTableRowsToPayload(key, rows, existing.payload)

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
      await repo.consolidate(project.id)
      const consSnap = await repo.getConsolidatedResultVersion(project.id)
      if (consSnap) {
        setConsolidatedResultVersion(consSnap)
        setConsolidationVersion(consSnap.versionNumber)
        setConsolidationStatus('review_ready')
        const master = consSnap.payload as unknown as ConsolidatedMasterRecord
        setConsolidatedMasterRecord(master)
        const adapted = adaptCanonicalPayloadToTable('consolidated', consSnap.payload)
        setConsolidatedRows(adapted.rows)
        setConsolidatedOpen(true)
        setNotice('Consolidación determinística ejecutada exitosamente.')
      }
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error al consolidar el expediente.')
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

    // Compile into official Tiptap document
    const master = updatedPayload as unknown as ConsolidatedMasterRecord
    setConsolidatedMasterRecord(master)
    const compiled = compileConsolidatedToTiptap(master, {
      projectCode: project.id,
      projectName: project.name,
      compiledBy: project.clientName,
    })
    const document = await repo.saveDocument(
      project.id,
      compiled.content as Record<string, unknown>,
      documentState.id,
      'Documento inicial desde consolidado aprobado',
    )
    applyDocumentSnapshot(document)
    setView('document')
    setNotice('Consolidado aprobado. Se compiló el documento oficial en el editor Tiptap.')
    await refresh()
  }

  async function handleDownloadExcel() {
    try {
      let record = consolidatedMasterRecord
      if (!record && groups) {
        const titlesVersion = await repo.getResultVersion(groups.titles.id)
        const plansVersion = await repo.getResultVersion(groups.plans.id)
        const negVersion = await repo.getResultVersion(groups.negotiation.id)
        record = consolidateApprovedGroups({
          titlesApprovedPayload: titlesVersion?.payload ?? {},
          titlesVersionId: titlesVersion?.id ?? 'v1',
          plansApprovedPayload: plansVersion?.payload ?? {},
          plansVersionId: plansVersion?.id ?? 'v1',
          negotiationApprovedPayload: negVersion?.payload ?? {},
          negotiationVersionId: negVersion?.id ?? 'v1',
        })
        setConsolidatedMasterRecord(record)
      }
      if (!record) throw new Error('No hay datos consolidados disponibles para exportar.')
      await downloadConsolidatedExcel(record, {
        projectId: project.id,
        projectName: project.name,
        versionNumber: consolidationVersion,
      })
      setNotice('Archivo Excel oficial (CORRESPONDENCIA) generado y descargado.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error al descargar archivo Excel.')
    }
  }

  function handleDownloadPdf() {
    try {
      if (!consolidatedMasterRecord) {
        throw new Error('Debes aprobar el consolidado antes de generar el PDF oficial.')
      }
      downloadExpedientePdf(consolidatedMasterRecord, {
        versionNumber: documentState.version,
        expedienteId: project.id,
        projectCode: project.id,
        projectName: project.name,
        generatedBy: project.clientName,
      })
      setNotice(`Archivo PDF oficial generado y descargado (v${documentState.version} con código de verificación).`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error al generar el PDF.')
    }
  }

  async function handleRequestAiRevision(comment: string) {
    setAiDialogOpen(false)
    setLastUserComment(comment)
    if (documentDirty || !documentState.id) {
      setError('Guarda la versión actual antes de solicitar una revisión a IA.')
      return
    }
    try {
      const revisionId = await repo.queueDocumentAiRevision(documentState.id, comment)
      setActiveAiRevisionId(revisionId)
      setDocumentState((previous) => ({ ...previous, status: 'reprocessing' }))
      setNotice('Solicitud enviada a IA. La propuesta aparecerá cuando el worker finalice el procesamiento.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible solicitar la revisión de IA.')
    }
  }

  async function handleAcceptAiProposal(proposal: AiRevisionProposal) {
    try {
      const document = await repo.acceptDocumentAiRevision(proposal.requestId)
      applyDocumentSnapshot(document)
      setCurrentProposal(null)
      setProposalModalOpen(false)
      setActiveAiRevisionId(null)
      setNotice(`Propuesta v${document.versionNumber} adoptada y guardada en Supabase.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible adoptar la propuesta de IA.')
    }
  }

  async function handleDiscardAiProposal() {
    try {
      if (currentProposal) await repo.discardDocumentAiRevision(currentProposal.requestId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible descartar la propuesta de IA.')
      return
    }
    setCurrentProposal(null)
    setProposalModalOpen(false)
    setActiveAiRevisionId(null)
    setDocumentState((previous) => ({ ...previous, status: 'editable' }))
    setNotice('Propuesta de IA descartada. El documento actual no sufrió modificaciones.')
  }

  async function handleSaveDocument() {
    try {
      const document = await repo.saveDocument(
        project.id,
        documentContent as Record<string, unknown>,
        documentState.id,
        'Edición manual del documento',
      )
      applyDocumentSnapshot(document)
      setNotice(`Versión ${document.versionNumber} del documento guardada en Supabase.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible guardar el documento.')
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
      setDocumentDirty(false)
      setNotice('Documento marcado como versión final oficial. Listo para entrega y firma.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible finalizar el documento.')
    }
  }

  if (loading && !groups) return <div className="expediente-remote-loading">Cargando expediente remoto…</div>
  if (!groups) return <div className="expediente-remote-loading" role="alert">{error ?? 'No fue posible cargar el expediente.'}</div>

  const activeGroup = activeGroupKey ? groups[activeGroupKey] : null

  return (
    <section className="expediente-prototype expediente-remote-workspace" aria-label="Gestión de expediente predial">
      <div className="expediente-nav-tabs-bar">
        {onBack && (
          <button
            type="button"
            className="expediente-back-icon-btn"
            onClick={onBack}
            aria-label="Volver a expedientes"
            title="Volver a expedientes"
          >
            <ArrowLeft size={16} />
          </button>
        )}

        <div className="expediente-flow-tabs" role="tablist" aria-label="Etapas del expediente">
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

      {notice && (
        <div className="expediente-notice" role="status">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
          <button type="button" aria-label="Cerrar aviso" onClick={() => setNotice('')}>
            <X size={15} />
          </button>
        </div>
      )}

      {error && (
        <p className="expediente-inline-error" role="alert" style={{ margin: '12px 0' }}>
          {error}
        </p>
      )}

      {/* 1. SUMMARY VIEW */}
      {view === 'summary' && (
        <section className="expediente-summary" aria-label="Resumen del expediente">
          <article className="expediente-identity-card">
            <div className="expediente-section-heading">
              <div>
                <p>Identificación predial</p>
                <h2>Un predio, una gestión</h2>
              </div>
              <button type="button" className="expediente-secondary-action" onClick={() => setView('extraction')}>
                <ChevronRight size={16} />
                Continuar a extracción
              </button>
            </div>
            <dl className="expediente-identity-grid">
              <div>
                <dt>Matrícula inmobiliaria</dt>
                <dd>{consolidatedMasterRecord?.folio || 'Pendiente de extracción'}</dd>
              </div>
              <div>
                <dt>Cédula catastral</dt>
                <dd>{consolidatedMasterRecord?.cadastral_id || 'Pendiente de extracción'}</dd>
              </div>
              <div>
                <dt>Predio</dt>
                <dd>{project.name}</dd>
              </div>
              <div>
                <dt>Ubicación</dt>
                <dd>
                  {project.municipality}, {project.department}
                </dd>
              </div>
              <div>
                <dt>Responsable</dt>
                <dd>{project.clientName || 'Equipo jurídico territorial'}</dd>
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
                <p>Avance del expediente</p>
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
              const canEnqueue = group.files.length > 0 && !active && group.status !== 'review_ready' && group.status !== 'approved'
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
            </div>

            <div className="extraction-consolidation-right">
              <StatusText status={consolidationStatus} label={consolidationLabel(consolidationStatus)} />
              {(consolidatedMasterRecord || consolidationStatus === 'approved' || consolidationStatus === 'review_ready') && (
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
          <div className="expediente-section-heading document-heading">
            <div>
              <p>Documento final</p>
              <h2>Plantilla oficial estructurada y editable</h2>
              <span>La versión final se compila a partir del consolidado aprobado sin contradicciones.</span>
            </div>
            <StatusText status={documentState.status} label={documentLabel(documentState.status)} />
          </div>

          {documentState.status === 'blocked' ? (
            <div className="expediente-document-empty">
              <FileText size={28} />
              <div>
                <h3>Aún no hay un documento para editar</h3>
                <p>Aprueba el consolidado de las 3 fuentes para habilitar la generación de la plantilla.</p>
                <button type="button" className="expediente-primary-action" onClick={() => setView('extraction')}>
                  <ChevronRight size={16} />
                  Ir a extracción y consolidación
                </button>
              </div>
            </div>
          ) : (
            <div className="expediente-document-workspace">
              <div className="document-workspace-meta">
                <div>
                  <span>Versión {documentState.version}</span>
                  <small>{documentState.updatedAt ? `Actualizada ${documentState.updatedAt}` : 'Versión oficial'}</small>
                </div>
                <span className={documentDirty ? 'document-dirty' : 'document-saved'}>
                  {documentDirty ? 'Cambios sin guardar' : 'Guardado'}
                </span>
              </div>

              <DocumentPrototypeEditor
                content={documentContent}
                onChange={(next) => {
                  setDocumentContent(next)
                  setDocumentDirty(true)
                }}
              />

              <div className="document-workspace-actions">
                <div>
                  <button
                    type="button"
                    className="expediente-secondary-action"
                    disabled={!documentDirty}
                    onClick={handleSaveDocument}
                  >
                    <Check size={16} />
                    Guardar versión
                  </button>
                  <button
                    type="button"
                    className="expediente-secondary-action"
                    onClick={() => setAiDialogOpen(true)}
                  >
                    <Sparkles size={16} />
                    Solicitar cambios a IA
                  </button>
                </div>
                <div>
                  <button
                    type="button"
                    className="expediente-secondary-action"
                    disabled={documentDirty}
                    onClick={handleFinalizeDocument}
                  >
                    <CheckCircle2 size={16} />
                    Marcar como final
                  </button>
                  <button
                    type="button"
                    className="expediente-primary-action"
                    disabled={documentDirty}
                    onClick={handleDownloadPdf}
                  >
                    <Download size={16} />
                    Descargar PDF
                  </button>
                  <button
                    type="button"
                    className="expediente-primary-action"
                    disabled={consolidationStatus !== 'approved'}
                    onClick={() => void handleDownloadExcel()}
                  >
                    <Download size={16} />
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

      {/* AI Revision Dialog */}
      <AiRevisionDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        onConfirm={handleRequestAiRevision}
      />

      {/* AI Revision Proposal Modal (Guardian) */}
      <AiRevisionProposalModal
        open={proposalModalOpen}
        proposal={currentProposal}
        userComment={lastUserComment}
        onOpenChange={setProposalModalOpen}
        onAccept={handleAcceptAiProposal}
        onDiscard={handleDiscardAiProposal}
      />
    </section>
  )
}
