import * as Dialog from '@radix-ui/react-dialog'
import type { JSONContent } from '@tiptap/react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Download,
  FilePlus2,
  FileText,
  LayoutList,
  LoaderCircle,
  MapPin,
  PencilLine,
  Play,
  RefreshCcw,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '../common/PageHeader'
import { DocumentPrototypeEditor } from './DocumentPrototypeEditor'
import { ResultDataTable } from './ResultDataTable'
import { ReviewDialog } from './ReviewDialog'
import { AiRevisionDialog } from './AiRevisionDialog'
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
import { AiRevisionProposalModal } from './AiRevisionProposalModal'
import { downloadExpedientePdf } from '../../lib/expedientePdfGenerator'
import {
  consolidatedColumns,
  createDemoConsolidatedRows,
  createDemoGroups,
  formatFileSize,
  statusLabel,
  type DocumentGroup,
  type DocumentGroupKey,
  type EditableResultRow,
  type PrototypeConsolidationStatus,
  type PrototypeDocumentStatus,
  type PrototypeFile,
} from './types'
import type { Project } from '../../types'

type DetailView = 'summary' | 'extraction' | 'document'

interface ConsolidationState {
  status: PrototypeConsolidationStatus
  progress: number
  version: number
  updatedAt?: string
}

interface FinalDocumentState {
  status: PrototypeDocumentStatus
  progress: number
  version: number
  updatedAt?: string
}

const initialDocumentContent: JSONContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Ficha de gestión predial' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Predio La Esperanza · Matrícula inmobiliaria 050N-204581' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Información consolidada' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'El presente documento consolida la información jurídica, técnica y económica aprobada para la gestión predial seleccionada.' }] },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Campo' }] }] },
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Valor aprobado' }] }] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Área de servidumbre' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '4.580 m²' }] }] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Oferta vigente' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '$ 232.800.000' }] }] },
          ],
        },
      ],
    },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Observaciones' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Documento de demostración. La generación real y el llenado de plantillas se conectarán en la siguiente fase.' }] },
  ],
}

const cloneRows = (rows: EditableResultRow[]) => rows.map((row) => ({ ...row }))

const now = () => new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())

const consolidationLabel = (status: PrototypeConsolidationStatus): string => ({
  blocked: 'Pendiente de aprobaciones',
  available: 'Listo para consolidar',
  processing: 'Consolidando',
  review_ready: 'Listo para revisar',
  approved: 'Consolidado aprobado',
  stale: 'Requiere actualización',
})[status]

const documentLabel = (status: PrototypeDocumentStatus): string => ({
  blocked: 'Pendiente de consolidación',
  generating: 'Generando documento',
  editable: 'Listo para editar',
  reprocessing: 'Aplicando cambios solicitados',
  final: 'Versión final lista',
  stale: 'Requiere regeneración',
})[status]

function StatusText({ status, label }: { status: string; label: string }) {
  return <span className={`expediente-status status-${status}`}><span aria-hidden="true" />{label}</span>
}

function GroupCard({
  group,
  onFilesSelected,
  onRemoveFile,
  onStart,
  onReview,
}: {
  group: DocumentGroup
  onFilesSelected: (key: DocumentGroupKey, files: FileList | null) => void
  onRemoveFile: (key: DocumentGroupKey, fileId: string) => void
  onStart: (key: DocumentGroupKey) => void
  onReview: (key: DocumentGroupKey) => void
}) {
  const Icon = group.icon
  const inputId = `prototype-files-${group.key}`
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const isWorking = group.status === 'queued' || group.status === 'processing'
  const canStart = group.files.length > 0 && !isWorking
  const canReview = group.status === 'review_ready' || group.status === 'approved'
  const primaryLabel = group.status === 'queued'
    ? 'En cola…'
    : group.status === 'processing'
    ? 'Procesando…'
    : group.status === 'stale'
      ? 'Actualizar análisis'
      : group.status === 'error'
        ? 'Reintentar análisis'
        : 'Enviar para análisis'

  return (
    <article className={`extraction-card state-${group.status}`}>
      <header className="extraction-card-header">
        <div className="extraction-card-title">
          <span className="extraction-card-icon"><Icon size={19} /></span>
          <div>
            <h3>{group.label}</h3>
            <p>{group.description}</p>
          </div>
        </div>
        <StatusText status={group.status} label={statusLabel(group.status)} />
      </header>

      <div
        className={`extraction-upload-row${isDraggingFiles ? ' is-dragging' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setIsDraggingFiles(true) }}
        onDragLeave={() => setIsDraggingFiles(false)}
        onDrop={(event) => { event.preventDefault(); setIsDraggingFiles(false); onFilesSelected(group.key, event.dataTransfer.files) }}
      >
        <input
          id={inputId}
          className="sr-only"
          type="file"
          multiple={group.key !== 'negotiation'}
          accept={group.key === 'titles' ? '.pdf,.docx' : group.key === 'plans' ? '.pdf,.png,.jpg,.jpeg' : '.xlsx'}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onFilesSelected(group.key, event.target.files)
            event.target.value = ''
          }}
        />
        <label className="extraction-upload-button" htmlFor={inputId}>
          <FilePlus2 size={17} />
          <span>{isDraggingFiles ? 'Suelta los archivos aquí' : 'Agregar archivos'}</span>
        </label>
      </div>

      <p className="extraction-helper">{group.helper}</p>

      <div className="extraction-file-list" aria-label={`Archivos de ${group.label}`}>
        {group.files.length === 0 ? (
          <div className="extraction-empty-files">
            <Upload size={17} aria-hidden="true" />
            <span>Aún no hay archivos cargados.</span>
          </div>
        ) : (
          <ul>
            {group.files.map((file) => (
              <li key={file.id}>
                <FileText size={15} aria-hidden="true" />
                <span className="extraction-file-name" title={file.name}>{file.name}</span>
                <span className="extraction-file-meta">{formatFileSize(file.size)}</span>
                <button type="button" className="extraction-file-remove" aria-label={`Retirar ${file.name}`} onClick={() => onRemoveFile(group.key, file.id)}>
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isWorking && (
        <div className="extraction-progress" aria-live="polite">
          <div className="extraction-progress-label"><span>{group.status === 'queued' ? `Enviando ${group.singularLabel} a la cola` : `Analizando ${group.singularLabel}`}</span><strong>{group.progress}%</strong></div>
          <div className="extraction-progress-track"><span style={{ width: `${group.progress}%` }} /></div>
        </div>
      )}

      {group.status === 'approved' && <p className="extraction-approved-note"><CheckCircle2 size={15} />Versión {group.resultVersion} aprobada {group.updatedAt ? `· ${group.updatedAt}` : ''}</p>}
      {group.status === 'stale' && <p className="extraction-stale-note"><CircleAlert size={15} />Los archivos cambiaron; se requiere una nueva aprobación.</p>}
      {group.status === 'error' && <p className="extraction-error-note"><AlertTriangle size={15} />{group.error ?? 'No fue posible completar el análisis.'}</p>}

      <div className="extraction-card-actions">
        <button type="button" className="expediente-primary-action" disabled={!canStart} onClick={() => onStart(group.key)}>
          {isWorking ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
          {primaryLabel}
        </button>
        {canReview && (
          <button type="button" className="expediente-secondary-action" onClick={() => onReview(group.key)}>
            <PencilLine size={16} />
            {group.status === 'approved' ? 'Ver resultados' : 'Analizar resultados'}
          </button>
        )}
      </div>
    </article>
  )
}

export function ExpedientePrototype({ project }: { project: Project }) {
  const [view, setView] = useState<DetailView>('summary')
  const [groups, setGroups] = useState(createDemoGroups)
  const [activeGroup, setActiveGroup] = useState<DocumentGroupKey | null>(null)
  const [consolidation, setConsolidation] = useState<ConsolidationState>({ status: 'blocked', progress: 0, version: 1 })
  const [masterRecord, setMasterRecord] = useState<ConsolidatedMasterRecord | null>(null)
  const [consolidatedRows, setConsolidatedRows] = useState(createDemoConsolidatedRows)
  const [consolidatedOpen, setConsolidatedOpen] = useState(false)
  const [documentState, setDocumentState] = useState<FinalDocumentState>({ status: 'blocked', progress: 0, version: 1 })
  const [documentContent, setDocumentContent] = useState<JSONContent>(initialDocumentContent)
  const [documentDirty, setDocumentDirty] = useState(false)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [currentProposal, setCurrentProposal] = useState<AiRevisionProposal | null>(null)
  const [proposalModalOpen, setProposalModalOpen] = useState(false)
  const [lastUserComment, setLastUserComment] = useState('')
  const [notice, setNotice] = useState('')

  const approvedGroups = useMemo(() => Object.values(groups).filter((group) => group.status === 'approved').length, [groups])
  const allGroupsApproved = approvedGroups === 3
  const selectedGroup = activeGroup ? groups[activeGroup] : null

  useEffect(() => {
    const timer = window.setInterval(() => {
      setGroups((current) => {
        let changed = false
        const next = { ...current }
        for (const key of Object.keys(current) as DocumentGroupKey[]) {
          const group = current[key]
          if (group.status === 'queued') {
            changed = true
            next[key] = { ...group, status: 'processing', progress: 8 }
            continue
          }
          if (group.status !== 'processing') continue
          changed = true
          const progress = Math.min(100, group.progress + 16)
          next[key] = progress === 100
            ? { ...group, progress, status: 'review_ready', updatedAt: now() }
            : { ...group, progress }
        }
        return changed ? next : current
      })

      setConsolidation((current) => {
        if (current.status !== 'processing') return current
        const progress = Math.min(100, current.progress + 20)
        return progress === 100
          ? { ...current, progress, status: 'review_ready', updatedAt: now() }
          : { ...current, progress }
      })

      setDocumentState((current) => {
        if (current.status !== 'generating' && current.status !== 'reprocessing') return current
        const progress = Math.min(100, current.progress + 14)
        if (progress !== 100) return { ...current, progress }
        return {
          ...current,
          progress,
          status: 'editable',
          version: current.status === 'reprocessing' ? current.version + 1 : current.version,
          updatedAt: now(),
        }
      })
    }, 480)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    setConsolidation((current) => {
      if (allGroupsApproved && current.status === 'blocked') return { ...current, status: 'available' }
      if (!allGroupsApproved && ['available', 'processing', 'review_ready', 'approved'].includes(current.status)) return { ...current, status: 'stale' }
      return current
    })
  }, [allGroupsApproved])

  useEffect(() => {
    if (consolidation.status !== 'stale') return
    setDocumentState((current) => current.status === 'blocked' ? current : { ...current, status: 'blocked', progress: 0 })
  }, [consolidation.status])

  const invalidateDownstream = () => {
    setConsolidation((current) => ['approved', 'review_ready', 'processing', 'available'].includes(current.status)
      ? { ...current, status: 'stale', progress: 0 }
      : current)
    setDocumentState((current) => current.status === 'blocked' ? current : { ...current, status: 'blocked', progress: 0 })
  }

  const changeGroupFiles = (key: DocumentGroupKey, updater: (files: PrototypeFile[]) => PrototypeFile[]) => {
    setGroups((current) => {
      const group = current[key]
      const mustReapprove = ['queued', 'processing', 'review_ready', 'approved', 'stale'].includes(group.status)
      const nextStatus = mustReapprove ? 'stale' : 'ready'
      return {
        ...current,
        [key]: { ...group, files: updater(group.files), status: nextStatus, progress: 0, updatedAt: now() },
      }
    })
    invalidateDownstream()
  }

  const addFiles = (key: DocumentGroupKey, fileList: FileList | null) => {
    if (!fileList?.length) return
    const additions = Array.from(fileList).map((file, index) => ({
      id: `${key}-${file.name}-${Date.now()}-${index}`,
      name: file.name,
      size: file.size,
      extension: file.name.split('.').pop()?.toUpperCase() ?? 'ARCHIVO',
    }))
    changeGroupFiles(key, (files) => key === 'negotiation' ? additions : [...files, ...additions])
    setNotice(key === 'negotiation' ? 'Se actualizó la tabla vigente de negociación en el prototipo.' : `Se agregaron ${additions.length} archivo(s) a ${groups[key].label}.`)
  }

  const removeFile = (key: DocumentGroupKey, fileId: string) => {
    changeGroupFiles(key, (files) => files.filter((file) => file.id !== fileId))
    setNotice(`El archivo se retiró de ${groups[key].label}. El resultado requiere actualización.`)
  }

  const startAnalysis = (key: DocumentGroupKey) => {
    if (!groups[key].files.length) return
    setGroups((current) => {
      const group = current[key]
      const nextVersion = ['approved', 'stale', 'review_ready'].includes(group.status) ? group.resultVersion + 1 : group.resultVersion
      return { ...current, [key]: { ...group, status: 'queued', progress: 0, resultVersion: nextVersion, error: undefined } }
    })
    setNotice(`Análisis de ${groups[key].label.toLowerCase()} iniciado en modo demostración.`)
  }

  const saveGroupRows = (key: DocumentGroupKey, rows: EditableResultRow[]) => {
    setGroups((current) => ({ ...current, [key]: { ...current[key], rows: cloneRows(rows), updatedAt: now() } }))
    setNotice(`Borrador de ${groups[key].label.toLowerCase()} guardado.`)
  }

  const approveGroup = (key: DocumentGroupKey, rows: EditableResultRow[]) => {
    setGroups((current) => ({ ...current, [key]: { ...current[key], rows: cloneRows(rows), status: 'approved', progress: 100, updatedAt: now() } }))
    setActiveGroup(null)
    setNotice(`${groups[key].label} quedó aprobado para consolidación.`)
  }

  const getGroupValidationNotices = (key: DocumentGroupKey, groupRows: EditableResultRow[]): ValidationNotice[] => {
    const notices: ValidationNotice[] = []
    if (key === 'titles' && groupRows[0]) {
      if (!groupRows[0].folio?.trim()) {
        notices.push({ fieldName: 'folio', severity: 'error', message: 'El folio de matrícula es obligatorio.' })
      }
    } else if (key === 'negotiation' && groupRows[0]) {
      if (groupRows[0].valuesMatch === 'Requiere revisión') {
        notices.push({ fieldName: 'valuesMatch', severity: 'warning', message: 'Los valores numéricos y en letras difieren.' })
      }
    }
    return notices
  }

  const handleDownloadExcel = async () => {
    try {
      let recordToExport = masterRecord
      if (!recordToExport) {
        const titlesPayload = adaptTableRowsToPayload('titles', groups.titles.rows)
        const plansPayload = adaptTableRowsToPayload('plans', groups.plans.rows)
        const negPayload = adaptTableRowsToPayload('negotiation', groups.negotiation.rows)
        recordToExport = consolidateApprovedGroups({
          titlesApprovedPayload: titlesPayload,
          titlesVersionId: `titles-v${groups.titles.resultVersion}`,
          plansApprovedPayload: plansPayload,
          plansVersionId: `plans-v${groups.plans.resultVersion}`,
          negotiationApprovedPayload: negPayload,
          negotiationVersionId: `negotiation-v${groups.negotiation.resultVersion}`,
        })
        setMasterRecord(recordToExport)
      }
      await downloadConsolidatedExcel(recordToExport, {
        projectId: project.id,
        projectName: project.name,
        versionNumber: consolidation.version,
      })
      setNotice('Archivo Excel oficial (CORRESPONDENCIA) generado y descargado.')
    } catch (err: any) {
      setNotice(`Error al descargar Excel: ${err?.message || err}`)
    }
  }

  const startConsolidation = () => {
    if (!allGroupsApproved) return
    const titlesPayload = adaptTableRowsToPayload('titles', groups.titles.rows)
    const plansPayload = adaptTableRowsToPayload('plans', groups.plans.rows)
    const negPayload = adaptTableRowsToPayload('negotiation', groups.negotiation.rows)
    const master = consolidateApprovedGroups({
      titlesApprovedPayload: titlesPayload,
      titlesVersionId: `titles-v${groups.titles.resultVersion}`,
      plansApprovedPayload: plansPayload,
      plansVersionId: `plans-v${groups.plans.resultVersion}`,
      negotiationApprovedPayload: negPayload,
      negotiationVersionId: `negotiation-v${groups.negotiation.resultVersion}`,
    })
    setMasterRecord(master)
    const adapted = adaptCanonicalPayloadToTable('consolidated', master as unknown as Record<string, unknown>)
    setConsolidatedRows(adapted.rows)

    setConsolidation((current) => ({ ...current, status: 'processing', progress: 10, version: current.status === 'stale' ? current.version + 1 : current.version }))
    setNotice('Consolidación determinística iniciada en el predio.')
  }

  const approveConsolidation = (rows: EditableResultRow[]) => {
    setConsolidatedRows(cloneRows(rows))
    setConsolidation((current) => ({ ...current, status: 'approved', progress: 100, updatedAt: now() }))
    setConsolidatedOpen(false)

    // Retrieve or compute the consolidated master record
    let master = masterRecord
    if (!master) {
      const titlesPayload = adaptTableRowsToPayload('titles', groups.titles.rows)
      const plansPayload = adaptTableRowsToPayload('plans', groups.plans.rows)
      const negPayload = adaptTableRowsToPayload('negotiation', groups.negotiation.rows)
      master = consolidateApprovedGroups({
        titlesApprovedPayload: titlesPayload,
        titlesVersionId: `titles-v${groups.titles.resultVersion}`,
        plansApprovedPayload: plansPayload,
        plansVersionId: `plans-v${groups.plans.resultVersion}`,
        negotiationApprovedPayload: negPayload,
        negotiationVersionId: `negotiation-v${groups.negotiation.resultVersion}`,
      })
      setMasterRecord(master)
    }

    // Compile deterministic document from template
    const compiled = compileConsolidatedToTiptap(master, {
      projectCode: project.id,
      projectName: project.name,
      compiledBy: project.clientName,
    })
    setDocumentContent(compiled.content)
    setDocumentDirty(false)

    setDocumentState({ status: 'generating', progress: 10, version: 1, updatedAt: now() })
    setView('document')
    setNotice('Consolidado aprobado. Se compiló el documento final desde la plantilla oficial.')
  }

  const saveDocument = () => {
    setDocumentDirty(false)
    setDocumentState((current) => ({
      ...current,
      version: current.version + 1,
      updatedAt: now(),
    }))
    setNotice(`Versión ${documentState.version + 1} del documento guardada exitosamente.`)
  }

  const requestAiRevision = (comment: string) => {
    setAiDialogOpen(false)
    setLastUserComment(comment)

    const currentNarrative = extractNarrativeSection(documentContent)
    const simulatedNarrative = `${currentNarrative}\n\n[Consideración incorporada por sugerencia de analista: "${comment}"]\nSe ratifica que los linderos registrales y la cabida superficiaria de la franja de servidumbre concuerdan plenamente con los levantamientos topográficos y catastrales sin afectación a terceros.`

    const proposal = createAiRevisionProposal(
      {
        id: `req-${Date.now()}`,
        expedienteId: project.id,
        sourceVersion: documentState.version,
        userComment: comment,
        requestedBy: project.clientName || 'Analista Jurídico Territorium',
        requestedAt: new Date().toISOString(),
        scope: 'narrative_only',
      },
      documentContent,
      simulatedNarrative,
      masterRecord || undefined,
    )

    setCurrentProposal(proposal)
    setProposalModalOpen(true)
  }

  const acceptAiProposal = (proposal: AiRevisionProposal) => {
    setDocumentContent(proposal.proposedContent)
    setDocumentState((current) => ({
      ...current,
      status: 'editable',
      version: proposal.proposedVersion,
      updatedAt: now(),
    }))
    setDocumentDirty(true)
    setNotice(`Propuesta v${proposal.proposedVersion} adoptada. Todos los campos estructurados protegidos permanecen intactos.`)
  }

  const discardAiProposal = () => {
    setCurrentProposal(null)
    setNotice('Propuesta de IA descartada. El documento actual no sufrió modificaciones.')
  }

  const handleDownloadPdf = () => {
    let record = masterRecord
    if (!record) {
      const titlesPayload = adaptTableRowsToPayload('titles', groups.titles.rows)
      const plansPayload = adaptTableRowsToPayload('plans', groups.plans.rows)
      const negPayload = adaptTableRowsToPayload('negotiation', groups.negotiation.rows)
      record = consolidateApprovedGroups({
        titlesApprovedPayload: titlesPayload,
        titlesVersionId: `titles-v${groups.titles.resultVersion}`,
        plansApprovedPayload: plansPayload,
        plansVersionId: `plans-v${groups.plans.resultVersion}`,
        negotiationApprovedPayload: negPayload,
        negotiationVersionId: `negotiation-v${groups.negotiation.resultVersion}`,
      })
      setMasterRecord(record)
    }

    downloadExpedientePdf(record, {
      versionNumber: documentState.version,
      expedienteId: project.id,
      projectCode: project.id,
      projectName: project.name,
      generatedBy: project.clientName,
    })
    setNotice(`Archivo PDF oficial generado y descargado (v${documentState.version} con código de verificación).`)
  }

  const finalizeDocument = () => {
    setDocumentState((current) => ({ ...current, status: 'final', progress: 100, updatedAt: now() }))
    setDocumentDirty(false)
    setNotice('Documento marcado como versión final oficial. Listo para entrega y descarga.')
  }

  const resetDemo = () => {
    setGroups(createDemoGroups())
    setConsolidation({ status: 'blocked', progress: 0, version: 1 })
    setConsolidatedRows(createDemoConsolidatedRows())
    setDocumentState({ status: 'blocked', progress: 0, version: 1 })
    setDocumentContent(initialDocumentContent)
    setDocumentDirty(false)
    setActiveGroup(null)
    setConsolidatedOpen(false)
    setAiDialogOpen(false)
    setView('summary')
    setNotice('El recorrido de demostración se reinició.')
  }

  const isDocumentWorking = documentState.status === 'generating' || documentState.status === 'reprocessing'

  return (
    <div className="expediente-prototype">
      <PageHeader
        className="expediente-header-compact"
        eyebrow="FICHA DE EXPEDIENTE · UN PREDIO"
        title={undefined}
        description={undefined}
        meta={<div className="expediente-header-meta"><span><MapPin size={14} />{project.municipality}, {project.department}</span><span>Prototipo funcional</span></div>}
        actions={<button type="button" className="expediente-header-reset" onClick={resetDemo}><RotateCcw size={15} />Reiniciar demo</button>}
      />

      <div className="expediente-flow-tabs" role="tablist" aria-label="Etapas de la ficha de expediente">
        {[
          { id: 'summary' as const, label: 'Resumen', icon: LayoutList },
          { id: 'extraction' as const, label: 'Extracción y consolidación', icon: Sparkles },
          { id: 'document' as const, label: 'Documento final', icon: FileText },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>
            <Icon size={16} />{label}
            {id === 'extraction' && <span className="expediente-tab-counter">{approvedGroups}/3</span>}
          </button>
        ))}
      </div>

      {notice && <div className="expediente-notice" role="status"><CheckCircle2 size={16} /><span>{notice}</span><button type="button" aria-label="Cerrar aviso" onClick={() => setNotice('')}><X size={15} /></button></div>}

      {view === 'summary' && (
        <section className="expediente-summary" aria-label="Resumen del expediente">
          <article className="expediente-identity-card">
            <div className="expediente-section-heading">
              <div><p>Identificación predial</p><h2>Un predio, una gestión</h2></div>
              <button type="button" className="expediente-secondary-action" onClick={() => setView('extraction')}><ChevronRight size={16} />Continuar extracción</button>
            </div>
            <dl className="expediente-identity-grid">
              <div><dt>Matrícula inmobiliaria</dt><dd>050N-204581</dd></div>
              <div><dt>Cédula catastral</dt><dd>05001010400230012000</dd></div>
              <div><dt>Predio</dt><dd>La Esperanza</dd></div>
              <div><dt>Ubicación</dt><dd>{project.municipality}, {project.department}</dd></div>
              <div><dt>Responsable</dt><dd>{project.clientName || 'Equipo jurídico territorial'}</dd></div>
              <div><dt>Estado general</dt><dd>{approvedGroups === 3 && consolidation.status === 'approved' ? 'Listo para documento' : 'En preparación documental'}</dd></div>
            </dl>
          </article>

          <article className="expediente-overview-card">
            <div className="expediente-section-heading"><div><p>Avance del expediente</p><h2>Fuentes y entregable</h2></div><span>{approvedGroups}/3 aprobaciones</span></div>
            <div className="expediente-stage-list">
              {Object.values(groups).map((group) => <div className="expediente-stage-row" key={group.key}><span className="expediente-stage-icon"><group.icon size={17} /></span><div><strong>{group.label}</strong><small>{group.files.length} archivo(s) · {statusLabel(group.status)}</small></div><StatusText status={group.status} label={statusLabel(group.status)} /></div>)}
              <div className="expediente-stage-row"><span className="expediente-stage-icon"><ClipboardCheck size={17} /></span><div><strong>Consolidado</strong><small>{consolidationLabel(consolidation.status)}</small></div><StatusText status={consolidation.status} label={consolidationLabel(consolidation.status)} /></div>
              <div className="expediente-stage-row"><span className="expediente-stage-icon"><FileText size={17} /></span><div><strong>Documento final</strong><small>{documentLabel(documentState.status)}</small></div><StatusText status={documentState.status} label={documentLabel(documentState.status)} /></div>
            </div>
          </article>
        </section>
      )}

      {view === 'extraction' && (
        <section className="expediente-extraction" aria-label="Extracción y consolidación">
          <div className="expediente-section-heading extraction-heading">
            <div><p>Fuentes del expediente</p><h2>Extracción independiente por subconjunto</h2><span>Carga, analiza y aprueba cada fuente. Los resultados se consolidan solo cuando las tres versiones están aprobadas.</span></div>
          </div>
          <div className="extraction-card-grid">
            {(Object.keys(groups) as DocumentGroupKey[]).map((key) => <GroupCard key={key} group={groups[key]} onFilesSelected={addFiles} onRemoveFile={removeFile} onStart={startAnalysis} onReview={setActiveGroup} />)}
          </div>

          <section className={`consolidation-panel state-${consolidation.status}`} aria-label="Consolidación de resultados">
            <div className="consolidation-panel-copy"><span className="consolidation-icon"><ClipboardCheck size={19} /></span><div><p>Registro maestro del predio</p><h3>Consolidar resultados aprobados</h3><span>{allGroupsApproved ? 'Las tres fuentes están aprobadas y pueden consolidarse.' : `Faltan ${3 - approvedGroups} aprobación(es) para habilitar la consolidación.`}</span></div></div>
            <div className="consolidation-panel-actions">
              {consolidation.status === 'processing' && <div className="consolidation-progress" aria-live="polite"><strong>{consolidation.progress}%</strong><div><span style={{ width: `${consolidation.progress}%` }} /></div></div>}
              {consolidation.status === 'review_ready' || consolidation.status === 'approved' ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {consolidation.status === 'approved' && (
                    <button type="button" className="expediente-secondary-action" onClick={() => void handleDownloadExcel()}>
                      <Download size={16} />
                      Descargar Excel
                    </button>
                  )}
                  <button type="button" className="expediente-secondary-action" onClick={() => setConsolidatedOpen(true)}>
                    <PencilLine size={16} />
                    {consolidation.status === 'approved' ? 'Ver consolidado' : 'Analizar consolidado'}
                  </button>
                </div>
              ) : (
                <button type="button" className="expediente-primary-action" disabled={!allGroupsApproved || consolidation.status === 'processing'} onClick={startConsolidation}>
                  <Play size={16} />
                  {consolidation.status === 'stale' ? 'Actualizar consolidado' : 'Consolidar resultados'}
                </button>
              )}
            </div>
          </section>
        </section>
      )}

      {view === 'document' && (
        <section className="expediente-document" aria-label="Documento final">
          <div className="expediente-section-heading document-heading">
            <div><p>Documento final</p><h2>Plantilla consolidada y editable</h2><span>La versión del documento se genera únicamente después de aprobar el consolidado.</span></div>
            <StatusText status={documentState.status} label={documentLabel(documentState.status)} />
          </div>

          {documentState.status === 'blocked' ? (
            <div className="expediente-document-empty"><FileText size={28} /><div><h3>Aún no hay un documento para editar</h3><p>Aprueba el consolidado para habilitar la generación de la plantilla.</p><button type="button" className="expediente-primary-action" onClick={() => setView('extraction')}><ChevronRight size={16} />Ir a extracción y consolidación</button></div></div>
          ) : isDocumentWorking ? (
            <div className="expediente-document-progress"><div className="document-progress-icon"><LoaderCircle size={24} className="spin" /></div><div><h3>{documentLabel(documentState.status)}</h3><p>{documentState.status === 'generating' ? 'Combinando el consolidado aprobado con la plantilla.' : 'Preparando una nueva propuesta a partir de los comentarios.'}</p><div className="document-progress-track"><span style={{ width: `${documentState.progress}%` }} /></div><strong>{documentState.progress}%</strong></div></div>
          ) : (
            <div className="expediente-document-workspace">
              {documentState.status === 'stale' && (
                <div style={{ backgroundColor: '#FFF3CD', border: '1px solid #FFEBAA', color: '#856404', padding: '10px 14px', borderRadius: '6px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                  <AlertTriangle size={18} />
                  <span>El consolidado aguas arriba fue modificado. El documento y los artefactos finales requieren regeneración para mantener la vigencia jurídica.</span>
                </div>
              )}
              <div className="document-workspace-meta"><div><span>Versión {documentState.version}</span><small>{documentState.updatedAt ? `Actualizada ${documentState.updatedAt}` : 'Versión oficial'}</small></div><span className={documentDirty ? 'document-dirty' : 'document-saved'}>{documentDirty ? 'Cambios sin guardar' : 'Guardado'}</span></div>
              <DocumentPrototypeEditor content={documentContent} onChange={(next) => { setDocumentContent(next); setDocumentDirty(true); setDocumentState((current) => current.status === 'final' ? { ...current, status: 'editable' } : current) }} />
              <div className="document-workspace-actions">
                <div><button type="button" className="expediente-secondary-action" disabled={!documentDirty} onClick={saveDocument}><Check size={16} />Guardar versión</button><button type="button" className="expediente-secondary-action" onClick={() => setAiDialogOpen(true)}><Sparkles size={16} />Solicitar cambios a IA</button></div>
                <div><button type="button" className="expediente-secondary-action" disabled={documentDirty} onClick={finalizeDocument}><CheckCircle2 size={16} />Marcar como final</button><button type="button" className="expediente-primary-action" disabled={documentDirty} onClick={handleDownloadPdf}><Download size={16} />Descargar PDF</button><button type="button" className="expediente-primary-action" disabled={consolidation.status !== 'approved'} onClick={() => void handleDownloadExcel()}><Download size={16} />Descargar Excel</button></div>
              </div>
            </div>
          )}
        </section>
      )}

      {selectedGroup && (
        <ReviewDialog
          open={Boolean(selectedGroup)}
          title={`Resultados de ${selectedGroup.label}`}
          description={`Revisa la versión ${selectedGroup.resultVersion} antes de aprobarla para el consolidado del predio.`}
          version={selectedGroup.resultVersion}
          rows={selectedGroup.rows}
          columns={selectedGroup.columns}
          groupKey={selectedGroup.key}
          isApproved={selectedGroup.status === 'approved'}
          validationNotices={getGroupValidationNotices(selectedGroup.key, selectedGroup.rows)}
          approveLabel={`Aprobar ${selectedGroup.label.toLowerCase()}`}
          onOpenChange={(open) => { if (!open) setActiveGroup(null) }}
          onSave={(rows) => saveGroupRows(selectedGroup.key, rows)}
          onApprove={(rows) => approveGroup(selectedGroup.key, rows)}
          onReprocess={() => { const key = selectedGroup.key; setActiveGroup(null); startAnalysis(key) }}
        />
      )}
      <ReviewDialog
        open={consolidatedOpen}
        title="Resultados consolidados"
        description="Revisa el registro maestro antes de aprobarlo y generar el documento final."
        version={consolidation.version}
        rows={consolidatedRows}
        columns={consolidatedColumns}
        groupKey="consolidated"
        isApproved={consolidation.status === 'approved'}
        approveLabel="Aprobar consolidado"
        onOpenChange={setConsolidatedOpen}
        onSave={(rows) => { setConsolidatedRows(cloneRows(rows)); setNotice('Borrador del consolidado guardado.') }}
        onApprove={approveConsolidation}
        onReprocess={() => { setConsolidatedOpen(false); startConsolidation() }}
        onDownloadExcel={handleDownloadExcel}
      />
      <AiRevisionDialog open={aiDialogOpen} onOpenChange={setAiDialogOpen} onConfirm={requestAiRevision} />
      <AiRevisionProposalModal
        open={proposalModalOpen}
        proposal={currentProposal}
        userComment={lastUserComment}
        onOpenChange={setProposalModalOpen}
        onAccept={acceptAiProposal}
        onDiscard={discardAiProposal}
      />
    </div>
  )
}
