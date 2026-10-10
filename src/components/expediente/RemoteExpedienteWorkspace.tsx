import { ArrowLeft, LayoutList, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { createExpedienteV2Repository, type ExpedienteV2Repository } from '../../data/expedienteV2Repository'
import type { ConsolidatedMasterRecord } from '../../lib/expedienteConsolidation'
import { deriveCorrespondenciaRow, validateCorrespondenciaRows } from '../../lib/correspondencia'
import type { ExpedienteGroupKey } from '../../lib/expedienteWorkflow'
import { analysisEngineNotice } from '../../lib/analysisEngineNotice'
import { downloadComparisonOriginal } from '../../data/documentComparison'
import { buildZip, downloadBlob } from '../../lib/download'
import { LinkagePanel } from './LinkagePanel'
import { ReviewDialog } from './ReviewDialog'
import { useGeneratedDocuments } from './useGeneratedDocuments'
import { FilePreviewDialog, type FilePreviewTarget } from './FilePreviewDialog'
import { groupInfo, orderedKeys } from './expedienteGroups'
import { useConsolidatedResult } from './useConsolidatedResult'
import { useGroupReview } from './useGroupReview'
import { ProjectSummaryView } from './ProjectSummaryView'
import { ExtractionGroupCard } from './ExtractionGroupCard'
import { ConsolidationBar } from './ConsolidationBar'
import type { DetailView } from './types'

const setError = (msg: string | null) => {
  if (msg) toast.error(msg)
}
const setNotice = (msg: string) => {
  if (msg) toast.success(msg)
}

export function RemoteExpedienteWorkspace({ project, onBack }: { project: Project; onBack?: () => void }) {
  const [view, setView] = useState<DetailView>('extraction')
  const [groups, setGroups] = useState<Record<ExpedienteGroupKey, RemoteExpedienteGroup> | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyGroup, setBusyGroup] = useState<ExpedienteGroupKey | null>(null)
  const [progress, setProgress] = useState<ExpedienteUploadProgress | null>(null)
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null)
  const [zippingGroup, setZippingGroup] = useState<ExpedienteGroupKey | null>(null)
  const [previewTarget, setPreviewTarget] = useState<FilePreviewTarget | null>(null)

  const responsibleName = project.responsibleName || project.clientName || 'Equipo jurídico territorial'
  const mounted = useRef(true)
  const repo: ExpedienteV2Repository = useMemo(() => createExpedienteV2Repository(), [])

  const approvedGroupsCount = useMemo(
    () => (groups ? orderedKeys.filter((key) => groups[key].status === 'approved').length : 0),
    [groups],
  )
  const allGroupsApproved = approvedGroupsCount === 3
  const consolidated = useConsolidatedResult({ project, repo, allGroupsApproved })

  // Documentos generados por predio desde el modal del consolidado.
  const consolidationMetadata = useMemo(
    () => (consolidated.resultVersion?.payload?.metadata ?? {}) as Partial<ConsolidatedMasterRecord['metadata']>,
    [consolidated.resultVersion],
  )
  const generatedDocuments = useGeneratedDocuments({
    projectId: project.id,
    projectName: project.name,
    responsibleName,
    consolidationVersion: consolidated.versionNumber,
    consolidationMetadata,
    active: consolidated.open || view === 'summary',
    onPreview: setPreviewTarget,
  })

  const reloadConsolidated = consolidated.reload
  const refresh = useCallback(async () => {
    try {
      const next = await loadRemoteExpedienteProcessing(project.id)
      if (mounted.current) setGroups(next)
      await reloadConsolidated()
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : 'No fue posible sincronizar el proyecto.'
      if (mounted.current) {
        setLoadError(msg)
        setError(msg)
      }
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [project.id, reloadConsolidated])

  const review = useGroupReview({ project, repo, groups, setBusyGroup, refresh })

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

  async function handleRemoveFile(group: RemoteExpedienteGroup, file: RemoteExpedienteFile) {
    if (group.status === 'queued' || group.status === 'processing') {
      setError('No es posible eliminar archivos mientras el grupo se encuentra en análisis.')
      return
    }
    const confirmed = window.confirm(`¿Deseas retirar el archivo "${file.name}" de este grupo?`)
    if (!confirmed) return

    setDeletingFileId(file.id)
    try {
      await deleteExpedienteFile(file.id)
      setNotice(`Archivo "${file.name}" retirado exitosamente.`)
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
      const safeProject = project.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 _-]+/g, ' ').trim()
      downloadBlob(await buildZip(files), `${groupInfo[group.key].title} - ${safeProject}.zip`)
      if (failed) setError(`${failed} archivo(s) no se pudieron descargar y no están en el .zip.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo preparar el .zip.')
    } finally {
      setZippingGroup(null)
    }
  }

  if (loading && !groups) return <div className="expediente-remote-loading">Cargando proyecto remoto…</div>
  if (!groups) return <div className="expediente-remote-loading" role="alert">{loadError ?? 'No fue posible cargar el proyecto.'}</div>

  const activeGroup = review.activeGroupKey ? groups[review.activeGroupKey] : null
  const groupResult = review.groupResult

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

      {view === 'summary' && (
        <ProjectSummaryView
          project={project}
          groups={groups}
          responsibleName={responsibleName}
          correspondenciaRows={consolidated.correspondenciaRows}
          approvedGroupsCount={approvedGroupsCount}
          consolidationStatus={consolidated.status}
          generatedDocuments={generatedDocuments}
          onContinue={() => setView('extraction')}
        />
      )}

      {view === 'extraction' && (
        <section className="expediente-extraction-view" aria-label="Extracción y consolidación">
          <div className="extraction-card-grid">
            {orderedKeys.map((key) => {
              const group = groups[key]
              return (
                <ExtractionGroupCard
                  key={key}
                  group={group}
                  groups={groups}
                  busy={busyGroup === key}
                  progress={progress}
                  deletingFileId={deletingFileId}
                  downloadingFileId={downloadingFileId}
                  zippingGroup={zippingGroup}
                  onSelectFiles={(files) => void selectFiles(group, files)}
                  onDownloadGroup={() => void handleDownloadGroup(group)}
                  onPreviewFile={(file) => setPreviewTarget({
                    document: { id: file.id, storage_path: file.storagePath, original_name: file.name, mime_type: file.mimeType },
                  })}
                  onDownloadFile={(file) => void handleDownloadFile(file)}
                  onRemoveFile={(file) => void handleRemoveFile(group, file)}
                  onEnqueue={() => void enqueue(group)}
                  onReview={() => void review.openReview(group)}
                />
              )
            })}
          </div>

          <ConsolidationBar
            status={consolidated.status}
            canOpen={consolidated.canOpen}
            allGroupsApproved={allGroupsApproved}
            consolidating={consolidated.consolidating}
            onOpen={() => consolidated.setOpen(true)}
            onConsolidate={() => void consolidated.consolidate().then(refresh)}
            onDownloadExcel={() => void consolidated.downloadExcel()}
          />
        </section>
      )}

      {activeGroup && groupResult && (
        <ReviewDialog
          open={Boolean(review.activeGroupKey)}
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
            if (!open) review.close()
          }}
          onSave={review.saveDraft}
          onApprove={review.approve}
          onReprocess={review.reprocess}
          spreadsheet={review.spreadsheet}
          rowAction={review.rowAction}
        />
      )}

      <ReviewDialog
        // Una versión nueva del consolidado (p. ej. al reabrir una aprobada) usa su propia hoja.
        key={consolidated.resultVersion?.id ?? 'consolidated'}
        open={consolidated.open}
        title="Resultados consolidados"
        description="Revisa el registro maestro del predio antes de aprobarlo y generar el documento final."
        version={consolidated.versionNumber}
        rows={consolidated.rows}
        columns={consolidated.columns}
        deriveRow={deriveCorrespondenciaRow}
        validateRows={validateCorrespondenciaRows}
        headerMeta={
          <LinkagePanel
            variant="inline"
            title="Consolidado CORRESPONDENCIA"
            okLabel="Todos los predios con estudio, plano y negociación quedaron consolidados"
            chips={[
              { label: `${consolidated.correspondenciaRows.length} predio(s) consolidados`, tone: 'exact' },
              ...(consolidated.excluded.length ? [{ label: `${consolidated.excluded.length} excluido(s)`, tone: 'absent' as const }] : []),
            ]}
            findings={consolidated.excluded.map((item) => ({
              key: `${item.fmi}|${item.reason}`,
              tone: 'absent' as const,
              tag: 'Excluido',
              rowLabel: item.fmi ? `${item.label} · ${item.fmi}` : item.label,
              message: item.reason,
            }))}
          />
        }
        groupKey="consolidated"
        isApproved={consolidated.resultVersion?.status === 'approved'}
        editLock={{
          locked: consolidated.resultVersion?.payload?.edit_locked === true,
          onSave: consolidated.saveAndLock,
          onEdit: consolidated.unlock,
        }}
        onOpenChange={consolidated.setOpen}
        onSave={consolidated.saveDraft}
        onDownloadExcel={(rows) => void consolidated.downloadExcel(rows)}
        autosaveOnly
        spreadsheet={consolidated.spreadsheet}
        selectable
        renderToolbar={generatedDocuments.toolbar}
        sidePanel={generatedDocuments.panel}
        sidePanelLabel="documentos generados"
      />

      <FilePreviewDialog target={previewTarget} onClose={() => setPreviewTarget(null)} />
    </section>
  )
}
