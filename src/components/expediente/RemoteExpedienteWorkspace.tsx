import {
  ArrowLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  Eye,
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
import { toast } from '../ui/ToastLayer'
import type { Project } from '../../types'
import {
  loadRemoteExpedienteProcessing,
  subscribeRemoteExpedienteProcessing,
  type RemoteExpedienteFile,
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
  CORRESPONDENCIA_COLUMNS,
  deriveCorrespondenciaRow,
  validateCorrespondenciaRows,
  type CorrespondenciaExclusion,
} from '../../lib/correspondencia'
import { LinkagePanel } from './LinkagePanel'
import type { ExpedienteGroupKey } from '../../lib/expedienteWorkflow'
import { buildPlanTitleLinkage, linkageSnapshot } from '../../lib/planTitleLinking'
import {
  buildNegotiationLinkage,
  negotiationLinkageSnapshot,
  pairsFromPlanRecords,
  type LinkedPair,
} from '../../lib/negotiationLinking'
import { analysisEngineNotice } from '../../lib/analysisEngineNotice'
import { GENERATED_DOCUMENT_TYPES } from '../../lib/generatedDocuments'
import { ReviewDialog, type ReviewRowAction } from './ReviewDialog'
import { PairComparisonPanel } from '../comparison/PairComparisonPanel'
import { comparableMime } from '../../data/pairComparison'
import { downloadComparisonOriginal } from '../../data/documentComparison'
import { buildZip, downloadBlob } from '../../lib/download'
import { useGeneratedDocuments } from './useGeneratedDocuments'
import type { ResultSpreadsheetSource } from './ResultSpreadsheet'
import { downloadResultSheet, resultSheetPath, uploadResultSheet } from '../../data/resultSheetStorage'
import { FilePreviewDialog, type FilePreviewTarget } from './FilePreviewDialog'
import {
  formatFileSize,
  statusLabel,
  type DetailView,
  type EditableResultRow,
  type PrototypeConsolidationStatus,
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

  // Hoja de cálculo (Univer) en los modales de resultados: un .xlsx por versión de resultado.
  const sheetSource = useCallback((groupKey: ExpedienteGroupKey | 'consolidated', resultVersionId: string, sheetName: string): ResultSpreadsheetSource | undefined => {
    let path: string
    try {
      path = resultSheetPath(project.id, resultVersionId, groupKey)
    } catch {
      return undefined // Identificadores no remotos: se mantiene la tabla.
    }
    return {
      sheetName,
      fileName: `${sheetName} - ${project.name}.xlsx`,
      // Títulos se identifica por su documento fuente (archivos ya guardados); el resto, por ID oculto.
      keyColumn: groupKey === 'titles' ? 'sourceDocument' : undefined,
      load: () => downloadResultSheet(path),
      save: (file) => uploadResultSheet(path, file),
    }
  }, [project.id, project.name])
  const resultVersionId = groupResult?.version.id
  const groupSpreadsheet = useMemo(
    () => (activeGroupKey && resultVersionId ? sheetSource(activeGroupKey, resultVersionId, groupInfo[activeGroupKey].title) : undefined),
    [activeGroupKey, resultVersionId, sheetSource],
  )

  // Planos: columna "Comparador" con el comparador de archivos (plano ↔ su estudio de títulos).
  const plansRowAction = useMemo<ReviewRowAction | undefined>(() => {
    if (activeGroupKey !== 'plans' || !groups) return undefined
    const sameName = (a: string, b: string) => a.normalize('NFC').trim().toLowerCase() === b.normalize('NFC').trim().toLowerCase()
    const filesFor = (row: EditableResultRow) => ({
      plan: row.planSourceDocument ? groups.plans.files.find((file) => sameName(file.name, row.planSourceDocument)) : undefined,
      study: row.t_sourceDocument ? groups.titles.files.find((file) => sameName(file.name, row.t_sourceDocument)) : undefined,
    })
    return {
      columnLabel: 'Comparador',
      buttonLabel: 'Comparar',
      unavailableReason: (row) => {
        if (!row.t_sourceDocument) return 'Este plano no está vinculado por FMI a un estudio de títulos: no hay con qué compararlo.'
        const { plan, study } = filesFor(row)
        if (!plan) return `No se encontró el archivo del plano "${row.planSourceDocument}" entre los insumos cargados.`
        if (!study) return `No se encontró el estudio de títulos "${row.t_sourceDocument}" entre los insumos cargados.`
        if (!comparableMime(plan.name) || !comparableMime(study.name)) return 'El comparador solo admite archivos PDF o DOCX.'
        return null
      },
      renderPanel: (row) => {
        const { plan, study } = filesFor(row)
        return {
          title: `Comparador · ${row.planName || row.planSourceDocument}`,
          content: plan && study ? <PairComparisonPanel projectId={project.id} left={plan} right={study} /> : null,
        }
      },
    }
  }, [activeGroupKey, groups, project.id])

  // Consolidation state
  const [consolidationStatus, setConsolidationStatus] = useState<PrototypeConsolidationStatus>('blocked')
  const [consolidationVersion, setConsolidationVersion] = useState<number>(1)
  const [consolidating, setConsolidating] = useState(false)
  const [consolidatedOpen, setConsolidatedOpen] = useState(false)
  // Consolidado CORRESPONDENCIA: una fila por predio (estudio + plano + negociación).
  const [consolidatedRows, setConsolidatedRows] = useState<EditableResultRow[]>([])
  const [consolidatedColumns, setConsolidatedColumns] = useState<ResultColumn[]>([])
  const [consolidatedExcluded, setConsolidatedExcluded] = useState<CorrespondenciaExclusion[]>([])
  const [consolidatedResultVersion, setConsolidatedResultVersion] = useState<ExpedienteResultVersionSnapshot | null>(null)
  const consolidatedVersionId = consolidatedResultVersion?.id
  const consolidatedSpreadsheet = useMemo(
    () => (consolidatedVersionId ? sheetSource('consolidated', consolidatedVersionId, 'Consolidado CORRESPONDENCIA') : undefined),
    [consolidatedVersionId, sheetSource],
  )

  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null)
  const [zippingGroup, setZippingGroup] = useState<ExpedienteGroupKey | null>(null)
  const [previewTarget, setPreviewTarget] = useState<FilePreviewTarget | null>(null)

  const responsibleName = project.responsibleName || project.clientName || 'Equipo jurídico territorial'

  // Documentos generados por predio desde el modal del consolidado.
  const consolidationMetadata = useMemo(
    () => (consolidatedResultVersion?.payload?.metadata ?? {}) as Partial<ConsolidatedMasterRecord['metadata']>,
    [consolidatedResultVersion],
  )
  const generatedDocuments = useGeneratedDocuments({
    projectId: project.id,
    projectName: project.name,
    responsibleName,
    consolidationVersion,
    consolidationMetadata,
    active: consolidatedOpen || view === 'summary',
    onPreview: setPreviewTarget,
  })
  const generatedTotal = Object.values(generatedDocuments.documents).reduce((sum, files) => sum + files.length, 0)
  const mounted = useRef(true)
  const repo: ExpedienteV2Repository = useMemo(() => createExpedienteV2Repository({ mode: 'supabase' }), [])

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
          setConsolidationStatus(consSnap.status === 'approved' ? 'approved' : 'review_ready')
        }
      } catch {
        // Non-blocking if table not populated yet
      }
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : 'No fue posible sincronizar el proyecto.'
      if (mounted.current) {
        setLoadError(msg)
        setError(msg)
      }
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [project.id, repo])

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

  // Al terminar un análisis se avisa si el resultado se generó CON o SIN IA.
  const lastStatuses = useRef<Partial<Record<ExpedienteGroupKey, string>>>({})
  useEffect(() => {
    if (!groups) return
    const previous = lastStatuses.current
    lastStatuses.current = Object.fromEntries(orderedKeys.map((key) => [key, groups[key].status]))
    for (const key of orderedKeys) {
      const before = previous[key]
      if ((before !== 'queued' && before !== 'processing') || groups[key].status !== 'review_ready') continue
      const group = groups[key]
      void repo.getResultVersion(group.id).then((snap) => {
        const notice = analysisEngineNotice(groupInfo[key].title, snap?.payload?.analysis_engine)
        if (!notice || !mounted.current) return
        toast[notice.tone](notice.message, { duration: notice.tone === 'success' ? 6000 : 15000 })
      }).catch(() => {
        // El aviso es informativo: si no se puede leer el resultado, no se muestra.
      })
    }
  }, [groups, repo])

  const approvedGroupsCount = useMemo(
    () => (groups ? orderedKeys.filter((key) => groups[key].status === 'approved').length : 0),
    [groups],
  )
  const allGroupsApproved = approvedGroupsCount === 3
  const canOpenConsolidated = Boolean(consolidatedResultVersion) && (consolidationStatus === 'review_ready' || consolidationStatus === 'approved')
  const correspondenciaRows = useMemo(() => consolidatedRows.filter((row) => 'B' in row && 'BE' in row), [consolidatedRows])
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

  // Revisión vigente del consolidado: el autoguardado la actualiza antes de que el estado se
  // vuelva a dibujar, así aprobar justo después de un guardado no choca con un conflicto.
  const consolidatedRevisionRef = useRef<{ id: string; editRevision: number } | null>(null)
  useEffect(() => {
    if (consolidatedResultVersion) consolidatedRevisionRef.current = { id: consolidatedResultVersion.id, editRevision: consolidatedResultVersion.editRevision }
  }, [consolidatedResultVersion])
  const currentConsolidatedRevision = (version: ExpedienteResultVersionSnapshot) =>
    consolidatedRevisionRef.current?.id === version.id ? consolidatedRevisionRef.current.editRevision : version.editRevision

  // Autoguardado del modal: el pie del modal muestra la hora del último guardado (sin avisos emergentes).
  async function handleSaveConsolidatedDraft(rows: EditableResultRow[]) {
    if (!consolidatedResultVersion) return
    const updatedPayload = adaptTableRowsToPayload('consolidated', rows, consolidatedResultVersion.payload)
    const editRevision = await repo.saveDraft(
      consolidatedResultVersion.id,
      updatedPayload,
      'Edición manual en consolidado',
      currentConsolidatedRevision(consolidatedResultVersion),
    )
    consolidatedRevisionRef.current = { id: consolidatedResultVersion.id, editRevision }
    setConsolidatedResultVersion((current) => current ? { ...current, payload: updatedPayload, editRevision } : current)
    setConsolidatedRows(rows)
  }

  /** Guarda el consolidado con la edición bloqueada o habilitada (`edit_locked` en el payload). */
  async function saveConsolidatedLock(rows: EditableResultRow[], locked: boolean, summary: string) {
    if (!consolidatedResultVersion) return
    const updatedPayload = { ...adaptTableRowsToPayload('consolidated', rows, consolidatedResultVersion.payload), edit_locked: locked }
    const editRevision = await repo.saveDraft(
      consolidatedResultVersion.id,
      updatedPayload,
      summary,
      currentConsolidatedRevision(consolidatedResultVersion),
    )
    consolidatedRevisionRef.current = { id: consolidatedResultVersion.id, editRevision }
    setConsolidatedResultVersion((current) => current ? { ...current, payload: updatedPayload, editRevision } : current)
    setConsolidatedRows(rows)
  }

  async function handleSaveAndLockConsolidated(rows: EditableResultRow[]) {
    try {
      await saveConsolidatedLock(rows, true, 'Cambios guardados; edición bloqueada')
      setNotice('Cambios guardados. La edición quedó bloqueada; usa "Editar" para modificar el consolidado.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible guardar el consolidado.')
    }
  }

  async function handleEditConsolidated() {
    if (!consolidatedResultVersion) return
    try {
      if (consolidatedResultVersion.status === 'approved') {
        // Versión aprobada con el flujo anterior: se reabre como borrador con el mismo contenido.
        await repo.reopenConsolidatedVersion(project.id, { ...consolidatedResultVersion.payload, edit_locked: false })
        await refresh()
      } else {
        await saveConsolidatedLock(consolidatedRows, false, 'Edición habilitada')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible habilitar la edición del consolidado.')
    }
  }

  /** Descarga un archivo cargado tal como está en el almacenamiento privado. */
  async function handleDownloadFile(file: RemoteExpedienteFile) {
    setDownloadingFileId(file.id)
    try {
      downloadBlob(await downloadComparisonOriginal({ storage_path: file.storagePath }), file.name)
    } catch {
      setError(`No se pudo descargar "${file.name}". Verifica tu conexión y tus permisos en el proyecto.`)
    } finally {
      setDownloadingFileId(null)
    }
  }

  /** Todos los archivos cargados de un grupo en un .zip (p. ej. para revisar un proyecto antiguo). */
  async function handleDownloadGroup(group: RemoteExpedienteGroup) {
    setZippingGroup(group.key)
    try {
      const results = await Promise.allSettled(group.files.map(async (file) => ({
        name: file.name,
        blob: await downloadComparisonOriginal({ storage_path: file.storagePath }),
      })))
      const files = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
      const failed = results.length - files.length
      if (!files.length) throw new Error('No se pudo descargar ningún archivo.')
      const safeProject = project.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 _-]+/g, ' ').trim()
      downloadBlob(await buildZip(files), `${groupInfo[group.key].title} - ${safeProject}.zip`)
      if (failed) setError(`${failed} archivo(s) no se pudieron descargar y no están en el .zip.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo preparar el .zip.')
    } finally {
      setZippingGroup(null)
    }
  }

  /** Desde el modal llegan las filas recién guardadas; desde la Ficha, las del último guardado. */
  async function handleDownloadExcel(sourceRows: EditableResultRow[] = correspondenciaRows) {
    try {
      const rows = sourceRows.filter((row) => 'B' in row && 'BE' in row)
      if (!rows.length) throw new Error('No hay predios consolidados para exportar a CORRESPONDENCIA.')
      const safeName = project.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')
      await downloadCorrespondenciaExcel(rows, `CORRESPONDENCIA_${safeName}_v${consolidationVersion}.xlsx`)
      setNotice(`CORRESPONDENCIA descargado: ${rows.length} predio(s) con las ${CORRESPONDENCIA_COLUMNS.length} columnas de la plantilla.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error al descargar archivo Excel.')
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
                    <button
                      type="button"
                      className="extraction-upload-button is-download"
                      disabled={group.files.length === 0 || zippingGroup !== null}
                      onClick={() => void handleDownloadGroup(group)}
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
                                onClick={() => setPreviewTarget({
                                  document: { id: file.id, storage_path: file.storagePath, original_name: file.name, mime_type: file.mimeType },
                                })}
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
                                onClick={() => void handleDownloadFile(file)}
                              >
                                {downloadingFileId === file.id ? <LoaderCircle size={14} className="spin" /> : <Download size={14} />}
                              </button>
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
              {canOpenConsolidated ? (
                <button type="button" className="expediente-primary-action" onClick={() => setConsolidatedOpen(true)}>
                  <PencilLine size={16} />
                  Analizar consolidado
                </button>
              ) : (
                <button
                  type="button"
                  className="expediente-primary-action"
                  disabled={!allGroupsApproved || consolidating}
                  onClick={() => void handleConsolidate()}
                  title={
                    !allGroupsApproved
                      ? 'Debes aprobar los 3 subconjuntos para consolidar'
                      : consolidationStatus === 'stale'
                      ? 'Las fuentes cambiaron: vuelve a consolidar con los resultados aprobados'
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
              )}
            </div>

            <div className="extraction-consolidation-right">
              <StatusText status={consolidationStatus} label={consolidationLabel(consolidationStatus)} />
              {canOpenConsolidated && (
                <div className="extraction-consolidation-actions">
                  <button
                    type="button"
                    className="expediente-secondary-action"
                    onClick={() => void handleDownloadExcel()}
                  >
                    <Download size={16} />
                    <span>Descargar Excel</span>
                  </button>
                </div>
              )}
            </div>
          </section>
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
          spreadsheet={groupSpreadsheet}
          rowAction={plansRowAction}
        />
      )}

      {/* Review Dialog for Consolidated Master Record */}
      <ReviewDialog
        // Una versión nueva del consolidado (p. ej. al reabrir una aprobada) usa su propia hoja.
        key={consolidatedResultVersion?.id ?? 'consolidated'}
        open={consolidatedOpen}
        title="Resultados consolidados"
        description="Revisa el registro maestro del predio antes de aprobarlo y generar el documento final."
        version={consolidationVersion}
        rows={consolidatedRows}
        columns={consolidatedColumns}
        deriveRow={deriveCorrespondenciaRow}
        validateRows={validateCorrespondenciaRows}
        headerMeta={
          <LinkagePanel
            variant="inline"
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
        isApproved={consolidatedResultVersion?.status === 'approved'}
        editLock={{
          locked: consolidatedResultVersion?.payload?.edit_locked === true,
          onSave: handleSaveAndLockConsolidated,
          onEdit: handleEditConsolidated,
        }}
        onOpenChange={setConsolidatedOpen}
        onSave={handleSaveConsolidatedDraft}
        onDownloadExcel={(rows) => void handleDownloadExcel(rows)}
        autosaveOnly
        spreadsheet={consolidatedSpreadsheet}
        selectable
        renderToolbar={generatedDocuments.toolbar}
        sidePanel={generatedDocuments.panel}
        sidePanelLabel="documentos generados"
      />

      <FilePreviewDialog target={previewTarget} onClose={() => setPreviewTarget(null)} />
    </section>
  )
}
