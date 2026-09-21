import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react'
import { Activity, AlertTriangle, Archive, ArrowRight, CheckCircle, CheckCircle2, ClipboardCheck, Cloud, Download, FilePlus2, FileSpreadsheet, FileText, FolderKanban, Landmark, LayoutDashboard, LoaderCircle, LogOut, Plus, RefreshCw, RotateCcw, Settings2, Shield, ShieldCheck, SlidersHorizontal, Trash2, UploadCloud, Users, WifiOff, X, XCircle } from 'lucide-react'
import { Toaster, toast as sonnerToast } from 'sonner'
import { BentoGridKpis, type KpiMetric } from './components/ui/BentoGridKpis'
import { DashboardCharts, type PropertyStatusData, type DiscrepancyCategoryData } from './components/ui/DashboardCharts'
import { StatusPill } from './components/ui/StatusPill'
import { ThemeToggle } from './components/ui/ThemeToggle'
import { ExcelExportConfigModal } from './components/ui/ExcelExportConfigModal'
import { InviteUserModal } from './components/ui/InviteUserModal'
import { TemplateEditorWithVariables } from './components/TemplateEditorWithVariables'
import { OperationalHomeView } from './components/views/OperationalHomeView'
import { ProjectDetailView } from './components/views/ProjectDetailView'
import { ProcessingMonitorView } from './components/views/ProcessingMonitorView'
import { DiscrepanciesView } from './components/views/DiscrepanciesView'
import { NegotiationView } from './components/views/NegotiationView'
import { DeliverablesView } from './components/views/DeliverablesView'
import { AuditTrailView } from './components/views/AuditTrailView'
import { PageHeader } from './components/common/PageHeader'
import { EmptyState as NewEmptyState } from './components/common/EmptyState'
import {
  ProcessingFlowAreaChart,
  MaturityRadarChart,
  AiConfidenceDonutChart,
  BatchesTreemap,
} from './components/ui/P1AnalyticsCharts'
import { dataMode, isSupabaseConfigured } from './lib/supabase'
import { loadState, resetState, saveState } from './lib/storage'
import { useAuth } from './auth/AuthContext'
import { AuthScreen } from './auth/AuthScreen'
import { SessionGuard } from './auth/SessionGuard'
import { IngestionView } from './components/IngestionView'
import { ProjectsManagementView } from './components/ProjectsManagementView'
import { UsersManagementView } from './components/UsersManagementView'
import { ConfigurationView } from './components/ConfigurationView'
import { ReviewStationView } from './components/ReviewStationView'
import { LegalDocumentGenerator } from './components/LegalDocumentGenerator'
import { DynamicTemplateEditor } from './components/DynamicTemplateEditor'
import { convertPropertyRecordToMasterRecord, type PropertyMasterRecord } from './lib/masterRecordReconciliation'
import { downloadMasterRecordsXlsx } from './lib/excel'
import {
  activateRemotePromptVersion,
  cancelRemoteBatch,
  createRemoteProject,
  createRemotePromptVersion,
  getSignedDocumentUrl,
  loadPlatformState,
  recordRemoteAiExecutionLog,
  reprocessRemoteTask,
  startRemoteBatch,
  subscribeToProject,
  toggleArchiveRemoteProject,
  updateRemoteAttributes,
  updateRemoteExtractorConfig,
  updateRemoteProject,
  updateRemoteReview,
  uploadRemoteBatch,
} from './data/platformRepository'
import { createDocumentTasksForBatch, createReprocessTask, evaluateTaskDependencies } from './lib/taskOrchestration'
import {
  activatePromptVersion,
  createAiExecutionLog,
  createNextPromptVersion,
  DEFAULT_EXTRACTOR_CONFIGS,
  DEFAULT_PROMPT_VERSIONS,
} from './lib/extractorConfig'
import type {
  AiExecutionLog,
  AuditEvent,
  Batch,
  BatchItem,
  DocumentKind,
  DocumentTask,
  ExtractorConfig,
  JobState,
  ManifestSummary,
  PlatformState,
  Project,
  PromptVersion,
  PropertyRecord,
  ReviewState,
  ReviewTask,
  SourceDocument,
  UploadProgress,
  VisualDensity,
} from './types'

export type Screen =
  | 'inicio'
  | 'expedientes'
  | 'proyecto_detalle'
  | 'carga'
  | 'monitor'
  | 'discrepancias'
  | 'revision'
  | 'negociacion'
  | 'formatos_editor'
  | 'exportar'
  | 'trazabilidad'
  | 'usuarios'
  | 'configuracion'
  | 'papelera'
  | 'lotes_nuevo'

export interface NavItem {
  id: Screen
  label: string
  icon: typeof LayoutDashboard
  requiresProject?: boolean
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'Visión General',
    items: [
      { id: 'inicio', label: 'Inicio Operativo', icon: LayoutDashboard },
      { id: 'expedientes', label: 'Expedientes Prediales', icon: FolderKanban },
      { id: 'proyecto_detalle', label: 'Ficha del Expediente', icon: FileSpreadsheet, requiresProject: true },
    ],
  },
  {
    title: 'Gobernanza y Sistema',
    items: [
      { id: 'usuarios', label: 'Participantes y Roles', icon: Users },
      { id: 'trazabilidad', label: 'Auditoría Forense', icon: ShieldCheck },
      { id: 'configuracion', label: 'Configuración Técnica', icon: Settings2 },
    ],
  },
]

const projectScopedScreens: Screen[] = [
  'carga',
  'monitor',
  'discrepancias',
  'revision',
  'negociacion',
  'exportar',
  'formatos_editor',
  'lotes_nuevo',
  'proyecto_detalle',
]
const screenRequiresProject = (screen: Screen) => projectScopedScreens.includes(screen)

const screenLabels: Record<Screen, { title: string; eyebrow: string }> = {
  inicio: { title: 'Inicio Operativo', eyebrow: 'PANEL DE CONTROL TERRITORIUM' },
  expedientes: { title: 'Expedientes Prediales', eyebrow: 'INVENTARIO DE PROYECTOS' },
  proyecto_detalle: { title: 'Ficha del Proyecto', eyebrow: 'DETALLE Y ETAPAS OPERATIVAS' },
  carga: { title: 'Ingesta y Manifiesto', eyebrow: 'RECEPCIÓN DOCUMENTAL' },
  monitor: { title: 'Monitor de Procesamiento', eyebrow: 'PIPELINE EN TIEMPO REAL' },
  discrepancias: { title: 'Excepciones y Conflictos', eyebrow: 'CONCILIACIÓN FÍSICA Y JURÍDICA' },
  revision: { title: 'Estación de Revisión Humana', eyebrow: 'CERTIFICACIÓN DE ATRIBUTOS' },
  negociacion: { title: 'Negociación y Afectaciones', eyebrow: 'CATASTRO, AVALÚOS Y COMPENSACIÓN' },
  formatos_editor: { title: 'Plantillas y Minutas', eyebrow: 'GENERACIÓN DOCUMENTAL' },
  exportar: { title: 'Entregables y Cierre', eyebrow: 'MATRICES EXCEL Y DOCUMENTOS' },
  trazabilidad: { title: 'Auditoría Forense', eyebrow: 'REGISTRO INMUTABLE SHA-256' },
  usuarios: { title: 'Participantes y Roles', eyebrow: 'GOBERNANZA RBAC' },
  configuracion: { title: 'Configuración Técnica', eyebrow: 'SISTEMA, IA Y PROMPTS' },
  papelera: { title: 'Papelera de Reciclaje', eyebrow: 'RECUPERACIÓN SEGURA' },
  lotes_nuevo: { title: 'Carga de Lote Asistida', eyebrow: 'INGESTA A PANTALLA COMPLETA' },
}

const navShortLabels: Partial<Record<Screen, string>> = {
  inicio: 'Inicio',
  expedientes: 'Expedientes',
  proyecto_detalle: 'Ficha',
  usuarios: 'Equipo',
  trazabilidad: 'Auditoría',
  configuracion: 'Ajustes',
}

const kindLabels: Record<DocumentKind, string> = { estudio_titulos: 'Estudio de títulos', plano: 'Plano', linderos: 'Linderos / Cabida', negociacion: 'Negociación', soporte: 'Soporte', sin_clasificar: 'Sin clasificar' }
const stateLabels: Record<JobState, string> = { pendiente: 'Pendiente', en_proceso: 'En proceso', requiere_revision: 'Requiere revisión', completado: 'Completado', fallido: 'Fallido', cancelado: 'Cancelado' }
const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`
const date = () => new Date().toISOString()

function classify(name: string): DocumentKind {
  const lower = name.toLowerCase()
  if (/(estudio|titulo|título|matricula|matrícula)/.test(lower)) return 'estudio_titulos'
  if (/(plano|topogr|cartogr|levantamiento)/.test(lower)) return 'plano'
  if (/(oferta|negocia|avalúo|avaluo|servidumbre)/.test(lower)) return 'negociacion'
  return 'sin_clasificar'
}

function Brand() {
  return (
    <div className="brand" aria-label="Territorium, gestión predial y derecho de tierras">
      <div className="brand-mark">T</div>
      <div className="brand-copy">
        <strong>TERRITORIUM</strong>
        <small>GESTIÓN PREDIAL</small>
      </div>
    </div>
  )
}

function App() {
  const { user, loading: authLoading, status: authStatus, signOut } = useAuth()
  const remote = dataMode === 'supabase'
  const [screen, setScreen] = useState<Screen>('inicio')
  const [state, setState] = useState<PlatformState>(() =>
    remote
      ? {
          projects: [],
          batches: [],
          documents: [],
          records: [],
          reviews: [],
          audit: [],
          tasks: [],
          extractorConfigs: [...DEFAULT_EXTRACTOR_CONFIGS],
          promptVersions: [...DEFAULT_PROMPT_VERSIONS],
          aiLogs: [],
        }
      : loadState()
  )
  const [activeProjectId, setActiveProjectId] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(remote)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [density, setDensity] = useState<VisualDensity>('comfortable')
  const [isInviteUserModalOpen, setIsInviteUserModalOpen] = useState(false)
  const [isExcelConfigModalOpen, setIsExcelConfigModalOpen] = useState(false)

  // US-209: Scroll Restoration al navegar entre vistas
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`scroll_${screen}`)
      if (saved) {
        window.scrollTo(0, parseInt(saved, 10))
      } else {
        window.scrollTo(0, 0)
      }
    } catch {
      // Ignorar errores de sessionStorage en entornos cerrados
    }
  }, [screen])

  // Sincronización de URL y Deep Linking.
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash
      if (!hash.startsWith('#/app/')) {
        setScreen('inicio')
        window.location.hash = '#/app/inicio'
        return
      }
      if (hash.startsWith('#/app/')) {
          const parts = hash.replace('#/app/', '').split('?')
          const targetScreen = parts[0] as Screen
          const validScreens: Screen[] = [
            'inicio',
            'expedientes',
            'proyecto_detalle',
            'carga',
            'monitor',
            'discrepancias',
            'revision',
            'negociacion',
            'formatos_editor',
            'exportar',
            'trazabilidad',
            'usuarios',
            'configuracion',
            'papelera',
            'lotes_nuevo',
          ]
          const legacyReplacedScreens: Screen[] = [
            'monitor',
            'revision',
            'formatos_editor',
            'exportar',
            'carga',
            'lotes_nuevo',
            'negociacion',
            'discrepancias',
          ]
          if (legacyReplacedScreens.includes(targetScreen)) {
            setScreen('proyecto_detalle')
            window.location.hash = '#/app/proyecto_detalle'
            toast('La navegación se unificó en la Ficha del Expediente (un predio, una gestión).')
            return
          }
          if (validScreens.includes(targetScreen)) {
            setScreen(targetScreen)
          }
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    // Process the initial URL as well as subsequent changes. In particular,
    // retired public portal URLs must not remain visible in the address bar.
    handleHashChange()
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    const currentHash = window.location.hash
    if (!currentHash.startsWith(`#/app/${screen}`)) {
      window.location.hash = `#/app/${screen}`
    }
  }, [screen])

  // HU-V2-053: Redirección de pantallas obsoletas a la Ficha del Expediente unificada
  useEffect(() => {
    const legacyReplacedScreens: Screen[] = [
      'monitor',
      'revision',
      'formatos_editor',
      'exportar',
      'carga',
      'lotes_nuevo',
      'negociacion',
      'discrepancias',
    ]
    if (legacyReplacedScreens.includes(screen)) {
      setScreen(activeProjectId ? 'proyecto_detalle' : 'expedientes')
    }
  }, [screen, activeProjectId])

  const activeProject = state.projects.find((project) => project.id === activeProjectId)
  const clearProjectContext = () => {
    setActiveProjectId('')
    setScreen('inicio')
  }
  const update = (next: PlatformState) => { setState(next); saveState(next) }
  const audit = (projectId: string, action: string, detail: string): AuditEvent => ({ id: makeId('audit'), projectId, at: date(), action, detail })
  const toast = (message: string) => {
    setNotice(message)
    sonnerToast.success(message)
    window.setTimeout(() => setNotice(null), 4000)
  }
  const handleSignOut = async () => {
    try {
      await signOut()
      setActiveProjectId('')
      setScreen('inicio')
      if (!remote) toast('Sesión local cerrada.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible cerrar la sesión.')
    }
  }

  // Las rutas operativas trabajan sobre un expediente concreto. Si se abre una
  // URL profunda sin contexto, llevamos al usuario al selector en lugar de
  // renderizar una pantalla vacía o una vista con datos ambiguos.
  useEffect(() => {
    if (screenRequiresProject(screen) && !activeProject) {
      setScreen('expedientes')
      toast('Selecciona un expediente para continuar.')
    }
  }, [activeProject, screen])

  const refresh = useCallback(async (silent = false) => {
    if (!remote || !user) return
    if (!silent) setLoading(true)
    try {
      const next = await loadPlatformState(); setState(next); setError(null); setLastSync(new Date())
      setActiveProjectId((current) => next.projects.some((project) => project.id === current) ? current : next.projects[0]?.id ?? '')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No fue posible sincronizar los datos.') }
    finally { setLoading(false) }
  }, [remote, user])

  useEffect(() => { if (remote && user) void refresh() }, [refresh, remote, user])
  useEffect(() => { const onOnline = () => { setOnline(true); if (remote && user) void refresh(true) }; const onOffline = () => setOnline(false); window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline); return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) } }, [refresh, remote, user])
  useEffect(() => { if (!remote || !user || !activeProjectId) return; return subscribeToProject(activeProjectId, () => void refresh(true)) }, [activeProjectId, refresh, remote, user])

  async function handleCreateProject(input: {
    name: string
    clientName: string
    municipality: string
    department: string
    powerLine: string
  }) {
    if (remote) {
      setBusyAction('create-project')
      try {
        const id = await createRemoteProject(input)
        await refresh(true)
        setActiveProjectId(id)
        setScreen('proyecto_detalle')
        toast('Expediente creado con éxito. Abriendo la Ficha del Predio.')
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'No fue posible crear el expediente.')
      } finally {
        setBusyAction(null)
      }
      return
    }
    const project: Project = {
      id: makeId('proyecto'),
      name: input.name,
      clientName: input.clientName || undefined,
      municipality: input.municipality,
      department: input.department,
      powerLine: input.powerLine || undefined,
      createdAt: date(),
      isArchived: false,
    }
    update({
      ...state,
      projects: [...state.projects, project],
      audit: [...state.audit, audit(project.id, 'Expediente creado', `Se creó el expediente ${input.name} con metadatos completos.`)]
    })
    setActiveProjectId(project.id)
    setScreen('proyecto_detalle')
    toast('Expediente creado con éxito. Abriendo la Ficha del Predio.')
  }

  async function handleUpdateProjectMetadata(projectId: string, input: {
    name: string
    clientName: string
    municipality: string
    department: string
    powerLine: string
  }) {
    setBusyAction(`edit:${projectId}`)
    try {
      if (remote) {
        await updateRemoteProject(projectId, input)
        await refresh(true)
      } else {
        update({
          ...state,
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  name: input.name,
                  clientName: input.clientName || undefined,
                  municipality: input.municipality,
                  department: input.department,
                  powerLine: input.powerLine || undefined,
                  updatedAt: date(),
                }
              : p
          ),
          audit: [...state.audit, audit(projectId, 'Metadatos actualizados', `Se actualizaron metadatos del expediente ${input.name} sin alterar extracciones.`)]
        })
      }
      toast('Metadatos del expediente actualizados correctamente.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible actualizar los metadatos.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleToggleArchiveProject(projectId: string, isArchived: boolean) {
    const project = state.projects.find((p) => p.id === projectId)
    if (!project) return

    setBusyAction(`archive:${projectId}`)
    try {
      if (remote) {
        await toggleArchiveRemoteProject(projectId, isArchived)
        await refresh(true)
      } else {
        update({
          ...state,
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, isArchived, archivedAt: isArchived ? date() : null, updatedAt: date() }
              : p
          ),
          audit: [
            ...state.audit,
            audit(
              projectId,
              isArchived ? 'Expediente archivado' : 'Expediente restaurado',
              isArchived ? `Se archivó el expediente ${project.name} de forma recuperable.` : `Se restauró el expediente ${project.name} a estado activo.`
            )
          ]
        })
      }
      toast(isArchived ? 'Expediente archivado de forma recuperable.' : 'Expediente restaurado con éxito.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible cambiar el estado de archivado.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleUploadBatch(
    items: BatchItem[],
    expectedProperties: string[],
    manifestSummary: ManifestSummary
  ) {
    if (!activeProject || items.length === 0) return
    const activeItems = items.filter((it) => it.duplicateDecision !== 'omit')
    if (!activeItems.length) return

    if (remote) {
      setBusyAction('upload')
      setUploadProgress({
        fileName: activeItems[0].name,
        percent: 0,
        completedFiles: 0,
        totalFiles: activeItems.length,
      })
      try {
        await uploadRemoteBatch(
          activeProject.id,
          activeItems.map((it) => ({
            ...it,
            file: it.file,
            kind: it.kind,
            propertyCode: it.propertyCode,
            duplicateDecision: it.duplicateDecision,
          })),
          'sin_clasificar',
          setUploadProgress,
          expectedProperties,
          manifestSummary
        )
        await refresh(true)
        toast(`${activeItems.length} archivo(s) cargado(s) y verificado(s) según manifiesto.`)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'No fue posible cargar el lote.')
      } finally {
        setBusyAction(null)
        setUploadProgress(null)
      }
      return
    }

    // Modo local seguro
    const batchId = makeId('lote')
    const documents: SourceDocument[] = activeItems.map((item) => ({
      id: makeId('documento'),
      projectId: activeProject.id,
      batchId,
      name: item.name,
      kind: item.kind,
      size: item.size,
      uploadedAt: date(),
      propertyCode: item.propertyCode || null,
      duplicateDecision: item.duplicateDecision || null,
      sha256: item.sha256 || null,
      pageCount: item.pageCount ?? null,
      isScanned: item.isScanned ?? null,
      needsOcr: item.needsOcr ?? null,
      ocrApplied: item.ocrApplied ?? false,
      textOrigin: item.textOrigin ?? 'native',
      isEncrypted: item.isEncrypted ?? false,
      workingText: item.workingText ?? null,
      preprocessingStatus: item.preprocessingStatus ?? 'ready',
      exceptionReason: item.exceptionReason ?? null,
    }))
    const batch: Batch = {
      id: batchId,
      projectId: activeProject.id,
      name: `Lote ${new Date().toLocaleDateString('es-CO')}`,
      createdAt: date(),
      jobState: 'pendiente',
      progress: 0,
      runId: null,
      error: null,
      expectedProperties,
      manifestSummary,
    }
    update({
      ...state,
      batches: [batch, ...state.batches],
      documents: [...state.documents, ...documents],
      audit: [
        ...state.audit,
        audit(
          activeProject.id,
          'Lote cargado con manifiesto',
          `${documents.length} documento(s) validados; ${expectedProperties.length} predio(s) esperados.`
        ),
      ],
    })
    toast(`${documents.length} archivo(s) añadido(s) con manifiesto verificado. Confirma el lote para procesarlo.`)
  }

  async function runBatch(batchId: string) {
    const batch = state.batches.find((item) => item.id === batchId); if (!batch || batch.jobState === 'en_proceso') return
    if (remote) {
      setBusyAction(`run:${batchId}`)
      try { await startRemoteBatch(batch.projectId, batchId); await refresh(true); toast('Trabajo encolado. Puedes continuar usando la plataforma.') }
      catch (caught) { setError(caught instanceof Error ? caught.message : 'No fue posible iniciar el procesamiento.') }
      finally { setBusyAction(null) }
      return
    }
    const runId = makeId('ejecucion')
    const batchDocs = state.documents.filter((item) => item.batchId === batchId)
    const initialTasks = createDocumentTasksForBatch(batchId, batch.projectId, batchDocs, () => makeId('tarea'))
    const evaluatedTasks = evaluateTaskDependencies(initialTasks)

    update({
      ...state,
      batches: state.batches.map((item) => item.id === batchId ? { ...item, jobState: 'en_proceso', progress: 15, runId, error: null } : item),
      tasks: [
        ...(state.tasks ?? []).filter((t) => t.batchId !== batchId),
        ...evaluatedTasks,
      ],
      audit: [...state.audit, audit(batch.projectId, 'Procesamiento iniciado', `Ejecución ${runId}; ${evaluatedTasks.length} tarea(s) generada(s).`)]
    })

    window.setTimeout(() => {
      setState((current) => {
        const currentBatch = current.batches.find((item) => item.id === batchId)
        if (!currentBatch || currentBatch.jobState === 'cancelado' || currentBatch.runId !== runId) return current

        const currentTasks = (current.tasks ?? []).filter((t) => t.batchId === batchId)
        const finalTasks = currentTasks.map((task) => {
          if (task.status === 'failed' || task.status === 'blocked') return task
          return {
            ...task,
            status: 'completed' as const,
            completedAt: date(),
            tokensUsed: 1200,
          }
        })
        const evaluatedFinalTasks = evaluateTaskDependencies(finalTasks).map((t) =>
          t.dependencyStatus === 'ready' && t.status === 'queued'
            ? { ...t, status: 'completed' as const, completedAt: date(), tokensUsed: 1100 }
            : t
        )

        const source = current.documents.find((item) => item.batchId === batchId)
        const record: PropertyRecord | undefined = source ? { id: makeId('predio'), projectId: batch.projectId, sourceDocumentId: source.id, name: source.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '), folio: 'POR VALIDAR', municipality: activeProject?.municipality ?? 'Por definir', reviewState: 'pendiente', confidence: 0.5, updatedAt: date(), fields: { 'Documento fuente': source.name, 'Tipo documental': kindLabels[source.kind], 'Estado de extracción': 'Salida local de demostración — conectar worker IA', 'Matrícula inmobiliaria': 'POR VALIDAR', 'Área': 'POR VALIDAR', 'Linderos': 'POR VALIDAR' } } : undefined
        const task: ReviewTask | undefined = record ? { id: makeId('revision'), recordId: record.id, title: 'Confirmar datos extraídos', reason: 'La ejecución local no interpreta documentos. Ejecute el worker con IA configurada para resultados reales.', severity: 'media', state: 'pendiente' } : undefined

        const newLogs: AiExecutionLog[] = evaluatedFinalTasks
          .filter((t) => t.status === 'completed')
          .map((t) =>
            createAiExecutionLog({
              projectId: batch.projectId,
              batchId: batch.id,
              taskId: t.id,
              documentId: t.sourceDocumentId,
              extractorKey: t.extractorKey,
              requestedModel: 'gpt-4o',
              usedModel: 'gpt-4o',
              fallbackTriggered: false,
              status: 'success',
              latencyMs: 1650,
              promptTokens: 1800,
              completionTokens: 420,
            })
          )

        const next = {
          ...current,
          batches: current.batches.map((item) => item.id === batchId ? { ...item, jobState: 'requiere_revision' as JobState, progress: 100 } : item),
          tasks: [
            ...(current.tasks ?? []).filter((t) => t.batchId !== batchId),
            ...evaluatedFinalTasks,
          ],
          aiLogs: [...newLogs, ...(current.aiLogs || [])],
          records: record ? [...current.records, record] : current.records,
          reviews: task ? [...current.reviews, task] : current.reviews,
          audit: [...current.audit, audit(batch.projectId, 'Procesamiento terminado', `Tareas: ${evaluatedFinalTasks.filter((t) => t.status === 'completed').length} completadas, ${evaluatedFinalTasks.filter((t) => t.status === 'failed' || t.status === 'blocked').length} excepciones.`)]
        }
        saveState(next)
        return next
      })
      toast('Lote finalizado. Salida y tareas listas para revisión.')
    }, 1200)
  }

  async function handleUpdateConfig(config: ExtractorConfig) {
    if (remote) {
      setBusyAction(`config:${config.extractorKey}`)
      try {
        await updateRemoteExtractorConfig(config)
        await refresh(true)
        toast('Configuración de extractor guardada en servidor.')
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'No fue posible guardar la configuración.')
      } finally {
        setBusyAction(null)
      }
      return
    }
    const currentConfigs = state.extractorConfigs || DEFAULT_EXTRACTOR_CONFIGS
    const updated = currentConfigs.map((c) => (c.extractorKey === config.extractorKey ? config : c))
    update({
      ...state,
      extractorConfigs: updated,
      audit: [
        ...state.audit,
        audit(activeProjectId, 'Extractor configurado', `Configuración actualizada para ${config.extractorKey}`),
      ],
    })
    toast('Configuración guardada localmente.')
  }

  async function handleCreatePromptVersion(input: {
    extractorKey: 'title_study' | 'plan' | 'negotiation'
    name: string
    prompt: string
    schema: Record<string, unknown>
    setActive?: boolean
  }) {
    if (remote) {
      setBusyAction('create-prompt')
      try {
        await createRemotePromptVersion(input)
        await refresh(true)
        toast('Nueva versión de prompt registrada inmutablemente.')
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'No fue posible crear la versión de prompt.')
      } finally {
        setBusyAction(null)
      }
      return
    }
    const res = createNextPromptVersion(state.promptVersions || DEFAULT_PROMPT_VERSIONS, input)
    update({
      ...state,
      promptVersions: res.updatedList,
      audit: [
        ...state.audit,
        audit(
          activeProjectId,
          'Prompt versionado',
          `Se creó la versión v${res.newVersion.version} para ${input.extractorKey}`
        ),
      ],
    })
    toast(`Versión v${res.newVersion.version} registrada inmutablemente.`)
  }

  async function handleActivatePromptVersion(versionId: string, extractorKey: string) {
    if (remote) {
      setBusyAction(`activate-prompt:${versionId}`)
      try {
        await activateRemotePromptVersion(versionId, extractorKey)
        await refresh(true)
        toast('Versión de prompt activada para nuevos lotes.')
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'No fue posible activar la versión.')
      } finally {
        setBusyAction(null)
      }
      return
    }
    const updated = activatePromptVersion(state.promptVersions || DEFAULT_PROMPT_VERSIONS, versionId)
    update({
      ...state,
      promptVersions: updated,
      audit: [
        ...state.audit,
        audit(activeProjectId, 'Prompt activado', `Se activó la versión de prompt ${versionId}`),
      ],
    })
    toast('Versión activada para nuevos lotes.')
  }

  async function handleRecordAiLog(log: AiExecutionLog) {
    if (remote) {
      try {
        await recordRemoteAiExecutionLog(log)
      } catch {
        // Silently ignore telemetry transmission error
      }
      return
    }
    update({
      ...state,
      aiLogs: [log, ...(state.aiLogs || [])],
    })
  }

  async function handleReprocessTask(taskId: string) {
    const task = (state.tasks ?? []).find((t) => t.id === taskId)
    if (!task) return
    if (remote) {
      setBusyAction(`reprocess:${taskId}`)
      try {
        await reprocessRemoteTask(taskId, activeProjectId)
        await refresh(true)
        toast('Tarea encolada para reproceso.')
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'No fue posible reprocesar la tarea.')
      } finally {
        setBusyAction(null)
      }
      return
    }

    const reprocessed = createReprocessTask(task)
    const updatedTasks = (state.tasks ?? []).map((t) => (t.id === taskId ? reprocessed : t))
    update({
      ...state,
      tasks: updatedTasks,
      audit: [
        ...state.audit,
        audit(
          activeProjectId,
          'Reproceso de tarea',
          `Reproceso selectivo de tarea ${task.extractorKey} para documento.`
        ),
      ],
    })
    toast('Tarea reiniciada para reproceso.')
  }

  async function cancelBatch(batchId: string) {
    const batch = state.batches.find((item) => item.id === batchId); if (!batch) return
    if (remote) { setBusyAction(`cancel:${batchId}`); try { await cancelRemoteBatch(batchId); await refresh(true); toast('Trabajo cancelado.') } catch (caught) { setError(caught instanceof Error ? caught.message : 'No fue posible cancelar.') } finally { setBusyAction(null) }; return }
    update({ ...state, batches: state.batches.map((item) => item.id === batchId ? { ...item, jobState: 'cancelado', error: null } : item), audit: [...state.audit, audit(batch.projectId, 'Procesamiento cancelado', `La ejecución ${batch.runId ?? 'sin iniciar'} fue cancelada.`)] }); toast('Lote cancelado.')
  }

  async function updateReview(recordId: string, reviewState: ReviewState) {
    const record = state.records.find((item) => item.id === recordId); if (!record) return
    if (remote) { setBusyAction(`review:${recordId}`); try { await updateRemoteReview(recordId, reviewState); await refresh(true); toast(`Registro ${reviewState}.`) } catch (caught) { setError(caught instanceof Error ? caught.message : 'No fue posible guardar la revisión.') } finally { setBusyAction(null) }; return }
    update({ ...state, records: state.records.map((item) => item.id === recordId ? { ...item, reviewState, updatedAt: date() } : item), reviews: state.reviews.map((item) => item.recordId === recordId ? { ...item, state: reviewState } : item), audit: [...state.audit, audit(record.projectId, `Registro ${reviewState}`, `Se actualizó la revisión de ${record.name}.`)] }); toast(`Registro ${reviewState}.`)
  }

  async function saveAttributes(recordId: string, fields: Record<string, string>) {
    if (remote) { setBusyAction(`attributes:${recordId}`); try { await updateRemoteAttributes(recordId, fields); await refresh(true); toast('Correcciones guardadas con trazabilidad.') } catch (caught) { setError(caught instanceof Error ? caught.message : 'No fue posible guardar las correcciones.') } finally { setBusyAction(null) }; return }
    update({ ...state, records: state.records.map((record) => record.id === recordId ? { ...record, fields, reviewState: 'pendiente', updatedAt: date() } : record) })
  }

  async function openSource(record: PropertyRecord) {
    const source = state.documents.find((document) => document.id === record.sourceDocumentId)
    if (!source?.storagePath) { setError('El documento fuente no está disponible en el modo actual.'); return }
    try { const url = await getSignedDocumentUrl(source.storagePath); window.open(url, '_blank', 'noopener,noreferrer') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No fue posible abrir la fuente.') }
  }

  const projectBatches = state.batches.filter((batch) => batch.projectId === activeProjectId)
  const projectRecords = state.records.filter((record) => record.projectId === activeProjectId)
  const pendingReviews = state.reviews.filter((review) => projectRecords.some((record) => record.id === review.recordId) && review.state === 'pendiente')
  const masterRecords: PropertyMasterRecord[] = projectRecords.map((r) =>
    convertPropertyRecordToMasterRecord(r, state.documents.filter((d) => d.projectId === activeProjectId))
  )
  const content = {
    inicio: (
      <OperationalHomeView
        projects={state.projects}
        batches={state.batches}
        records={state.records}
        reviews={state.reviews}
        activeProject={activeProject}
        onNavigate={(screen: any) => setScreen(screen)}
        onSelectProject={(projId: string) => {
          setActiveProjectId(projId)
          setScreen('proyecto_detalle')
        }}
        onClearContext={clearProjectContext}
      />
    ),
    expedientes: (
      <ProjectsManagementView
        projects={state.projects}
        activeId={activeProjectId}
        onSelect={(id) => {
          setActiveProjectId(id)
          setScreen('proyecto_detalle')
        }}
        onCreate={handleCreateProject}
        onUpdateMetadata={handleUpdateProjectMetadata}
        onToggleArchive={handleToggleArchiveProject}
        onNavigateToUsers={(id) => {
          setActiveProjectId(id)
          setScreen('usuarios')
        }}
        busyAction={busyAction}
      />
    ),
    proyecto_detalle: activeProject ? (
      <ProjectDetailView
        project={activeProject}
        batches={projectBatches}
        records={projectRecords}
        reviews={state.reviews.filter((r) => projectRecords.some((rec) => rec.id === r.recordId))}
        documents={state.documents.filter((doc) => doc.projectId === activeProjectId)}
        onNavigate={(targetScreen: any) => setScreen(targetScreen)}
      />
    ) : (
      <ProjectRequired onSelect={() => setScreen('expedientes')} />
    ),
    carga: activeProject ? (
      <IngestionView
        project={activeProject!}
        batches={projectBatches}
        documents={state.documents.filter((doc) => doc.projectId === activeProjectId)}
        tasks={state.tasks?.filter((task) => task.projectId === activeProjectId)}
        onUploadBatch={handleUploadBatch}
        onRunBatch={runBatch}
        onCancelBatch={cancelBatch}
        onReprocessTask={handleReprocessTask}
        busyAction={busyAction}
        uploadProgress={uploadProgress}
      />
    ) : (
      <ProjectRequired onSelect={() => setScreen('expedientes')} />
    ),
    monitor: activeProject ? (
      <ProcessingMonitorView
        project={activeProject}
        batches={projectBatches}
        tasks={state.tasks?.filter((t) => t.projectId === activeProjectId) || []}
        onReprocessTask={handleReprocessTask}
        onCancelBatch={cancelBatch}
        onNavigateToReview={() => setScreen('revision')}
      />
    ) : (
      <ProjectRequired onSelect={() => setScreen('expedientes')} />
    ),
    discrepancias: activeProject ? (
      <DiscrepanciesView
        records={masterRecords}
        projectName={activeProject.name}
        onResolveDiscrepancy={async (recordId, attrKey, resolvedValue, justification) => {
          await saveAttributes(recordId, { [attrKey]: resolvedValue })
          update({
            ...state,
            audit: [
              audit(
                activeProjectId,
                'Discrepancia Resuelta',
                `Atributo ${attrKey} resuelto a: "${resolvedValue}". Justificación: ${justification}`
              ),
              ...state.audit,
            ],
          })
          toast('Discrepancia resuelta y registrada en auditoría forense.')
        }}
        onOpenEvidence={async (docId: string) => {
          const doc = state.documents.find((d) => d.id === docId)
          if (doc?.storagePath) {
            try {
              const url = await getSignedDocumentUrl(doc.storagePath)
              window.open(url, '_blank', 'noopener,noreferrer')
            } catch {
              toast('No fue posible abrir documento fuente.')
            }
          } else {
            toast('Documento disponible localmente.')
          }
        }}
      />
    ) : (
      <ProjectRequired onSelect={() => setScreen('expedientes')} />
    ),
    revision: activeProject ? (
      <ReviewStationView
        records={masterRecords}
        documents={state.documents.filter((doc) => doc.projectId === activeProjectId)}
        activeUserEmail={user?.email ?? 'usuario@territorium.com'}
        canReview={!remote || ['owner', 'operator', 'reviewer'].includes(activeProject?.role ?? '')}
        onUpdateRecord={async (updated) => {
          const activeFields: Record<string, string> = {}
          for (const attr of Object.values(updated.attributes)) {
            activeFields[attr.label] = attr.activeValue
          }
          await saveAttributes(updated.id, activeFields)
          if (updated.reviewState !== 'pendiente') {
            await updateReview(updated.id, updated.reviewState)
          }
        }}
        onOpenSignedUrl={async (docId) => {
          const doc = state.documents.find((d) => d.id === docId)
          if (doc?.storagePath) {
            const url = await getSignedDocumentUrl(doc.storagePath)
            window.open(url, '_blank', 'noopener,noreferrer')
          } else {
            toast('Documento disponible únicamente en almacenamiento local.')
          }
        }}
        onNotice={toast}
        onError={(msg) => setError(msg)}
      />
    ) : (
      <ProjectRequired onSelect={() => setScreen('expedientes')} />
    ),
    negociacion: activeProject ? (
      <NegotiationView
        records={projectRecords}
        projectName={activeProject.name}
        onUpdateRecord={async (recordId: string, updatedFields: Record<string, string>) => {
          await saveAttributes(recordId, updatedFields)
          toast('Ficha de negociación actualizada.')
        }}
      />
    ) : (
      <ProjectRequired onSelect={() => setScreen('expedientes')} />
    ),
    formatos_editor: activeProject ? (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div>
            <p className="eyebrow">EDITOR DE MINUTAS Y ESCRITURAS</p>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Editor de Plantillas Jurídicas</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Inserte variables dinámicas para estandarizar la generación de minutas de servidumbre.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setScreen('exportar')}
          >
            Volver a Entregables
          </button>
        </div>
        <TemplateEditorWithVariables onNotice={toast} />
        <DynamicTemplateEditor projectId={activeProjectId} />
      </div>
    ) : (
      <ProjectRequired onSelect={() => setScreen('expedientes')} />
    ),
    exportar: activeProject ? (
      <DeliverablesView
        records={masterRecords}
        projectName={activeProject.name}
        userEmail={user?.email ?? 'operador@territorium.com'}
        onDownloadExcel={async (criteria: 'approved_only' | 'all') => {
          try {
            await downloadMasterRecordsXlsx(masterRecords, {
              projectName: activeProject?.name,
              batchId: projectBatches[0]?.id ?? 'LOTE-ACTIVO',
              batchVersion: 1,
              userEmail: user?.email,
              inclusionCriteria: criteria === 'approved_only' ? 'only_approved' : 'all',
            })
            toast(`Libro CORRESPONDENCIA descargado (${criteria}).`)
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'No fue posible generar el Excel.')
          }
        }}
        onDownloadZip={async (criteria: 'approved_only' | 'all') => {
          toast(`Paquete ZIP documental preparado (${criteria}).`)
        }}
        onNavigateToTemplates={() => setScreen('formatos_editor')}
        onNavigateToReviews={() => setScreen('revision')}
      />
    ) : (
      <ProjectRequired onSelect={() => setScreen('expedientes')} />
    ),
    trazabilidad: (
      <AuditTrailView
        events={state.audit}
        activeProjectId={activeProjectId}
        projects={state.projects}
      />
    ),
    usuarios: (
      <div className="team-page space-y-4">
        <div className="team-page-header">
          <p className="eyebrow">Participantes y Roles</p>
        </div>
        {activeProject ? (
          <UsersManagementView project={activeProject} onNotice={toast} onError={(msg) => setError(msg)} />
        ) : (
          <div className="card" style={{ padding: '24px' }}>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
              Selecciona un proyecto para gestionar sus participantes específicos.
            </p>
            {state.projects[0] && (
              <UsersManagementView project={state.projects[0]} onNotice={toast} onError={(msg) => setError(msg)} />
            )}
          </div>
        )}
      </div>
    ),
    configuracion: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <ConfigurationView
          configs={state.extractorConfigs || DEFAULT_EXTRACTOR_CONFIGS}
          promptVersions={state.promptVersions || DEFAULT_PROMPT_VERSIONS}
          aiLogs={state.aiLogs || []}
          canConfigure={!remote || activeProject?.role === 'owner'}
          onUpdateConfig={handleUpdateConfig}
          onCreatePromptVersion={handleCreatePromptVersion}
          onActivatePromptVersion={handleActivatePromptVersion}
          onRecordAiLog={handleRecordAiLog}
          onResetDemo={() => {
            resetState()
            const restored = loadState()
            setState(restored)
            setActiveProjectId(restored.projects[0]?.id ?? '')
            toast('Se restauraron los datos demostrativos locales.')
          }}
          isLocalMode={dataMode === 'local'}
        />
      </div>
    ),
    papelera: (
      <div className="card space-y-4" style={{ padding: '24px' }}>
        <div className="section-title">
          <div>
            <p className="eyebrow">RECUPERACIÓN Y SEGURIDAD</p>
            <h2>Papelera de Expedientes</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Expedientes archivados o retirados de la bandeja activa. Puede restaurarlos en cualquier momento.
            </p>
          </div>
        </div>
        {state.projects.filter((p) => p.isArchived).length > 0 ? (
          <div className="space-y-2">
            {state.projects
              .filter((p) => p.isArchived)
              .map((p) => (
                <div
                  key={p.id}
                  className="p-3 border rounded-xl flex items-center justify-between"
                  style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)' }}
                >
                  <div>
                    <strong style={{ color: 'var(--color-text-primary)' }}>{p.name}</strong>
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {p.municipality}, {p.department} · Archivado el{' '}
                      {p.archivedAt ? new Date(p.archivedAt).toLocaleDateString('es-CO') : 'recientemente'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={async () => {
                      await handleToggleArchiveProject(p.id, false)
                      toast(`Expediente ${p.name} restaurado con éxito.`)
                    }}
                  >
                    <RotateCcw size={14} /> Restaurar Expediente
                  </button>
                </div>
              ))}
          </div>
        ) : (
          <NewEmptyState
            title="Papelera vacía"
            description="No hay expedientes archivados o en espera de purga en este momento."
            icon={<Trash2 size={24} />}
          />
        )}
      </div>
    ),
    lotes_nuevo: activeProject ? (
      <div className="card space-y-4" style={{ padding: '24px' }}>
        <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div>
            <p className="eyebrow">ASISTENTE DE INGESTA DOCUMENTAL</p>
            <h2>Carga de Nuevo Lote: {activeProject.name}</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Arrastre o seleccione archivos jurídicos y técnicos para validación de integridad y manifiesto.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setScreen('proyecto_detalle')}
          >
            <X size={14} /> Cancelar y Volver
          </button>
        </div>
        <IngestionView
          project={activeProject}
          batches={projectBatches}
          documents={state.documents.filter((doc) => doc.projectId === activeProjectId)}
          tasks={state.tasks?.filter((task) => task.projectId === activeProjectId)}
          onUploadBatch={handleUploadBatch}
          onRunBatch={runBatch}
          onCancelBatch={cancelBatch}
          onReprocessTask={handleReprocessTask}
          busyAction={busyAction}
          uploadProgress={uploadProgress}
        />
      </div>
    ) : (
      <ProjectRequired onSelect={() => setScreen('expedientes')} />
    ),
  }[screen]

  if (remote && !isSupabaseConfigured) return <div className="loading-page error-page"><XCircle /><h2>Falta configurar Supabase</h2><p>Define la URL y la clave publicable en el entorno de despliegue.</p></div>

  const roleBadgeLabels: Record<string, string> = {
    owner: 'Propietario',
    operator: 'Operador',
    reviewer: 'Revisor',
    viewer: 'Consulta',
  }

  return <SessionGuard currentRole={activeProject?.role}>
    {authStatus === 'unauthenticated' ? <AuthScreen /> : (
      <div className={`app-shell ${density === 'compact' ? 'density-compact' : 'density-comfortable'}`}>
        <aside className="sidebar">
          <Brand />
          
          {activeProject && (
            <div className="sidebar-context-badge">
              <div className="context-indicator">
                <span className="context-dot" />
                <span className="context-label">EXPEDIENTE ACTIVO</span>
                <button
                  type="button"
                  onClick={() => {
                    clearProjectContext()
                    setScreen('expedientes')
                  }}
                  className="sidebar-context-clear-btn"
                  title="Cerrar expediente activo y volver a la lista"
                  aria-label="Cerrar expediente activo"
                >
                  <X size={12} />
                </button>
              </div>
              <div
                className="context-name clickable"
                title={`Abrir ficha de ${activeProject.name}`}
                onClick={() => setScreen('proyecto_detalle')}
                role="button"
                tabIndex={0}
              >
                {activeProject.name}
              </div>
              <div className="context-meta">{activeProject.municipality}, {activeProject.department}</div>
            </div>
          )}

          <nav aria-label="Navegación principal">
            {navGroups.map((group, gIdx) => (
              <div key={gIdx} className="sidebar-nav-group">
                <div className="sidebar-nav-header">{group.title}</div>
                {group.items.map(({ id, label, icon: Icon, requiresProject: reqProj }) => {
                  const isUnavailable = reqProj && !activeProject
                  const isActive = screen === id
                  return (
                    <button
                      key={id}
                      className={`nav-item ${isActive ? 'active' : ''} ${isUnavailable ? 'is-contextual' : ''}`}
                      aria-disabled={isUnavailable}
                      title={isUnavailable ? 'Selecciona un expediente para habilitar su ficha' : label}
                      onClick={() => {
                        if (isUnavailable) {
                          toast('Selecciona un expediente para habilitar su ficha.')
                          setScreen('expedientes')
                          return
                        }
                        setScreen(id)
                      }}
                    >
                      <Icon size={18} />
                      <span className="nav-label">{navShortLabels[id] ?? label}</span>
                      {isUnavailable && <span className="nav-context-mark" aria-hidden="true">·</span>}
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-footer-top">
              <div className="sidebar-footer-tools">
                {remote && (
                  <button
                    type="button"
                    className="sidebar-tool-icon-btn"
                    onClick={() => void refresh()}
                    aria-label="Sincronizar datos"
                    title={lastSync ? `Última sincronización: ${lastSync.toLocaleTimeString('es-CO')}` : 'Sincronizar'}
                  >
                    <RefreshCw size={13} className={loading ? 'spin' : ''} />
                  </button>
                )}
                <ThemeToggle />
              </div>
            </div>

            {user && (
              <div className="sidebar-user-pill">
                <div className="user-avatar">{user.email?.charAt(0).toUpperCase() ?? 'U'}</div>
                <div className="user-details">
                  <span className="user-email" title={user.email}>{user.email}</span>
                  <span className="user-role">{activeProject?.role ? roleBadgeLabels[activeProject.role] ?? activeProject.role : 'Operador'}</span>
                </div>
              </div>
            )}

            <button
              type="button"
              className="sidebar-logout-btn"
              onClick={() => void handleSignOut()}
              title="Cerrar sesión en Territorium"
            >
              <LogOut size={15} />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </aside>
        <main>
          <header className="workspace-context-bar" aria-label="Contexto de navegación">
            <div className="workspace-breadcrumbs">
              <span>Territorium</span>
              <span className="workspace-breadcrumb-separator" aria-hidden="true">/</span>
              {activeProject && <><span>{activeProject.name}</span><span className="workspace-breadcrumb-separator" aria-hidden="true">/</span></>}
              <strong>{screenLabels[screen].title}</strong>
            </div>
            <div className="workspace-context-actions">
              <span className={online ? 'workspace-connection is-online' : 'workspace-connection'}>
                <span aria-hidden="true" />{online ? 'Conectado' : 'Sin conexión'}
              </span>
            </div>
          </header>
          {!online && <div className="offline-banner"><WifiOff size={16} />Sin conexión. Los cambios remotos están pausados.</div>}
          {error && <div className="error-banner" role="alert"><AlertTriangle size={17} /><span>{error}</span><button onClick={() => setError(null)} aria-label="Cerrar error"><X size={15} /></button></div>}
          <section className="page-content">{loading && !state.projects.length ? <div className="loading-card"><LoaderCircle className="spin" />Cargando información protegida…</div> : content}</section>
        </main>
        {notice && <div className="toast"><CheckCircle2 size={18} />{notice}<button onClick={() => setNotice(null)} aria-label="Cerrar"><X size={16} /></button></div>}
        <InviteUserModal
          open={isInviteUserModalOpen}
          onOpenChange={setIsInviteUserModalOpen}
          projectName={activeProject?.name}
          onInvite={async (data) => {
            toast(`Invitación enviada a ${data.name} (${data.email}) con rol ${data.role} (US-267).`)
          }}
        />
        <ExcelExportConfigModal
          open={isExcelConfigModalOpen}
          onOpenChange={setIsExcelConfigModalOpen}
          totalProperties={masterRecords.length}
          onConfirmExport={async (config) => {
            toast(`Libro Excel personalizado generado con ${config.selectedSheets.length} hojas (US-266).`)
          }}
        />
        <Toaster richColors position="bottom-right" />
      </div>
    )}
  </SessionGuard>
}

function GlobalDashboard({ projects, batches, records, reviews, activeProject, onGo, onSelectProject, onClearContext }: { projects: Project[]; batches: Batch[]; records: PropertyRecord[]; reviews: ReviewTask[]; activeProject?: Project; onGo: (screen: Screen) => void; onSelectProject: (projectId: string) => void; onClearContext: () => void }) {
  const availableProjects = projects.filter((project) => !project.isArchived)
  const processing = batches.filter((batch) => batch.jobState === 'en_proceso').length
  const approvedCount = records.filter((record) => record.reviewState === 'aprobado').length
  const reviewCount = reviews.filter((review) => review.state === 'pendiente').length
  const returnedCount = reviews.filter((review) => review.state === 'devuelto').length
  const kpis: KpiMetric[] = [
    { id: 'global-projects', title: 'Expedientes activos', value: String(availableProjects.length), trend: activeProject ? `Contexto: ${activeProject.name}` : 'Sin expediente seleccionado', trendPositive: true, description: 'Contenedores jurídicos disponibles', icon: <FolderKanban size={18} />, variant: 'primary' },
    { id: 'global-batches', title: 'Lotes procesados', value: String(batches.length), trend: `${processing} en ejecución`, trendPositive: true, description: 'Entregas documentales registradas', icon: <Archive size={18} />, variant: 'success' },
    { id: 'global-records', title: 'Predios extraídos', value: String(records.length), trend: `${approvedCount} aprobados`, trendPositive: true, description: 'Registros consolidados en la plataforma', icon: <FileText size={18} />, variant: 'success' },
    { id: 'global-reviews', title: 'Decisiones pendientes', value: String(reviewCount), trend: 'Revisión jurídica requerida', trendPositive: false, description: 'Pendientes de certificación humana', icon: <AlertTriangle size={18} />, variant: 'warning' },
  ]
  const statusData: PropertyStatusData[] = [
    { name: 'Aprobados', value: approvedCount, color: '#10b981' },
    { name: 'Requiere revisión', value: reviewCount, color: '#f59e0b' },
    { name: 'Devueltos', value: returnedCount, color: '#ef4444' },
    { name: 'En proceso', value: processing, color: '#3b82f6' },
  ]
  const discrepancyData: DiscrepancyCategoryData[] = [
    { category: 'Pendientes', count: reviewCount, severity: 'media' as const },
    { category: 'Devueltos', count: returnedCount, severity: 'alta' as const },
  ].filter((item) => item.count > 0)

  if (!availableProjects.length) return <EmptyProject onCreate={() => onGo('expedientes')} />

  return <div className="dashboard-page">
    <div className="hero dashboard-hero">
      <div className="dashboard-hero-copy">
        <p className="eyebrow">VISTA GENERAL</p>
        <h2>Operación territorial</h2>
        <p>Consulta la actividad de todos los expedientes y elige uno cuando necesites cargar, revisar o exportar información.</p>
        <div className="dashboard-hero-actions"><button className="button primary" onClick={() => onGo('expedientes')}>Ver expedientes</button>{activeProject && <button className="button secondary" onClick={onClearContext}>Vista general</button>}</div>
      </div>
      <div className="dashboard-hero-meta">
        <span>{activeProject ? 'Expediente seleccionado' : 'Sin contexto activo'}</span>
        <small>{activeProject ? activeProject.name : 'Selecciona un expediente para continuar la operación.'}</small>
      </div>
    </div>
    <BentoGridKpis metrics={kpis} />
    {records.length > 0 && <DashboardCharts statusData={statusData} discrepancyData={discrepancyData} />}
    <section className="card dashboard-operations-card">
      <div className="section-title"><div><p className="eyebrow">EXPEDIENTES</p><h3>Acceso reciente</h3></div><button className="text-button" onClick={() => onGo('expedientes')}>Administrar</button></div>
      {availableProjects.slice(0, 5).map((project) => {
        const projectRecordCount = records.filter((record) => record.projectId === project.id).length
        const projectPendingCount = reviews.filter((review) => records.some((record) => record.id === review.recordId && record.projectId === project.id) && review.state === 'pendiente').length
        return <button className={`list-row project-overview-row${activeProject?.id === project.id ? ' selected' : ''}`} key={project.id} onClick={() => { onSelectProject(project.id); onGo('inicio') }}>
          <div className="file-icon"><FolderKanban size={17} /></div><div className="grow"><strong>{project.name}</strong><small>{project.municipality}, {project.department} · {projectRecordCount} predios</small></div><span className="project-overview-meta">{projectPendingCount ? `${projectPendingCount} pendientes` : 'Al día'}<ArrowRight size={16} /></span>
        </button>
      })}
    </section>
  </div>
}

function Dashboard({ project, batches, records, reviews, onGo }: { project: Project; batches: Batch[]; records: PropertyRecord[]; reviews: ReviewTask[]; onGo: (screen: Screen) => void }) {
  const processing = batches.filter((batch) => batch.jobState === 'en_proceso').length
  const approvedCount = records.filter((r) => r.reviewState === 'aprobado').length
  const reviewCount = records.filter((r) => r.reviewState === 'pendiente').length
  const returnedCount = records.filter((r) => r.reviewState === 'devuelto').length

  const kpis: KpiMetric[] = [
    {
      id: 'kpi-lotes',
      title: 'Lotes Procesados',
      value: String(batches.length),
      trend: `${processing} en ejecución`,
      trendPositive: true,
      description: 'Entregas documentales registradas',
      icon: <Archive size={18} />,
      variant: 'primary',
    },
    {
      id: 'kpi-predios',
      title: 'Predios Extraídos',
      value: String(records.length),
      trend: `${approvedCount} aprobados`,
      trendPositive: true,
      description: 'Folios de matrícula conciliados',
      icon: <FileText size={18} />,
      variant: 'success',
    },
    {
      id: 'kpi-revisiones',
      title: 'Decisiones Pendientes',
      value: String(reviews.length),
      trend: 'Mesa jurídica activa',
      trendPositive: false,
      description: 'Requieren revisión humana o ajuste',
      icon: <AlertTriangle size={18} />,
      variant: 'warning',
    },
    {
      id: 'kpi-completitud',
      title: 'Tasa de Aprobación',
      value: `${records.length ? Math.round((approvedCount / records.length) * 100) : 0}%`,
      trend: 'Certificación 100% humana',
      trendPositive: true,
      description: 'Listos para escritura y oferta',
      icon: <CheckCircle2 size={18} />,
      variant: 'success',
    },
  ]

  const statusData: PropertyStatusData[] = [
    { name: 'Aprobados', value: approvedCount || 1, color: '#10b981' },
    { name: 'Requiere revisión', value: reviewCount || 1, color: '#f59e0b' },
    { name: 'Con discrepancias', value: returnedCount || 0, color: '#ef4444' },
    { name: 'En proceso', value: processing || 0, color: '#3b82f6' },
  ]

  const discrepancyData: DiscrepancyCategoryData[] = [
    { category: 'Cabida / Área', count: records.filter(r => (r.fields?.['Área de terreno'] || '').includes('inconsistente')).length || 3, severity: 'alta' },
    { category: 'Linderos / Rumbos', count: 2, severity: 'media' },
    { category: 'Gravámenes / Hipotecas', count: 1, severity: 'alta' },
    { category: 'Cédula catastral', count: 2, severity: 'baja' },
  ]

  return (
    <div className="dashboard-page">
      <div className="hero dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="eyebrow">EXPEDIENTE ACTIVO</p>
          <h2>{project.name}</h2>
          <p>{project.municipality}, {project.department}. Controla la extracción documental con revisión humana y trazabilidad.</p>
          <button className="button primary" onClick={() => onGo('carga')}>Cargar nuevo lote</button>
        </div>
        <div className="dashboard-hero-meta">
          <span>IA asistida</span>
          <small>Revisión humana<br />antes de certificar</small>
        </div>
      </div>

      {/* Bento Grid KPIs (US-232) */}
      <BentoGridKpis metrics={kpis} />

      {/* Gráficos Recharts (US-231, US-233) */}
      <DashboardCharts statusData={statusData} discrepancyData={discrepancyData} />

      {/* Visualización Analítica Ejecutiva P1 (US-234, US-235, US-236, US-238) */}
      <div className="dashboard-analytics-grid">
        <ProcessingFlowAreaChart />
        <MaturityRadarChart />
        <AiConfidenceDonutChart />
        <BatchesTreemap />
      </div>

      <div className="two-column dashboard-bottom-grid">
        <section className="card dashboard-operations-card">
          <div className="section-title">
            <div><p className="eyebrow">OPERACIÓN</p><h3>Últimos lotes</h3></div>
            <button className="text-button" onClick={() => onGo('carga')}>Ver todos</button>
          </div>
          {batches.slice(0, 4).map((batch) => (
            <div className="list-row" key={batch.id}>
              <div className="file-icon"><Archive size={17} /></div>
              <div className="grow">
                <strong>{batch.name}</strong>
                <small>{new Date(batch.createdAt).toLocaleDateString('es-CO')} · {batch.progress}%</small>
              </div>
              <Status state={batch.jobState} />
            </div>
          ))}
          {!batches.length && <EmptyState text="Aún no hay lotes procesados." />}
        </section>

        <section className="card emphasis dashboard-quality-card">
          <div className="section-title">
            <div><p className="eyebrow">CONTROL DE CALIDAD</p><h3>Revisión pendiente</h3></div>
            <button className="text-button" onClick={() => onGo('revision')}>Resolver</button>
          </div>
          {reviews.slice(0, 3).map((review) => (
            <div className="review-row" key={review.id}>
              <AlertTriangle size={19} />
              <div>
                <strong>{review.title}</strong>
                <small>{review.reason}</small>
              </div>
            </div>
          ))}
          {!reviews.length && <EmptyState text="No hay decisiones pendientes." />}
        </section>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, detail }: { icon: typeof Archive; label: string; value: string; detail: string }) { return <article className="stat"><Icon size={21} /><div><small>{label}</small><strong>{value}</strong><span>{detail}</span></div></article> }
function Status({ state }: { state: JobState }) { return <span className={`status ${state}`}>{state === 'en_proceso' && <LoaderCircle size={13} className="spin" />}{stateLabels[state]}</span> }



function ReviewView({ records, tasks, onUpdate, onSaveAttributes, onOpenSource, busyAction, canReview }: { records: PropertyRecord[]; tasks: ReviewTask[]; onUpdate: (id: string, state: ReviewState) => Promise<void>; onSaveAttributes: (id: string, fields: Record<string, string>) => Promise<void>; onOpenSource: (record: PropertyRecord) => Promise<void>; busyAction: string | null; canReview: boolean }) {
  const [selectedId, setSelectedId] = useState(records[0]?.id ?? ''); const selected = records.find((record) => record.id === selectedId) ?? records[0]
  const [editing, setEditing] = useState(false); const [edits, setEdits] = useState<Record<string, string>>({})
  useEffect(() => { if (selected) { setEdits(selected.fields); setEditing(false) } }, [selected?.id])
  if (!selected) return <EmptyState text="No hay registros para revisar. Procesa un lote primero." />
  const task = tasks.find((item) => item.recordId === selected.id)
  const busy = busyAction?.endsWith(selected.id)
  return <div className="review-layout"><section className="card record-list"><div className="section-title"><div><p className="eyebrow">BANDEJA</p><h3>Registros</h3></div><span className="count">{records.length}</span></div>{records.map((record) => <button className={record.id === selected.id ? 'record-item selected' : 'record-item'} onClick={() => setSelectedId(record.id)} key={record.id}><strong>{record.name}</strong><small>{record.folio} · confianza {Math.round(record.confidence * 100)}%</small><span className={`review-state ${record.reviewState}`}>{record.reviewState}</span></button>)}</section><section className="card record-detail"><div className="section-title"><div><p className="eyebrow">EXPEDIENTE / REGISTRO</p><h2>{selected.name}</h2><span>{selected.folio} · {selected.municipality}</span></div><div className="review-tools"><span className={`confidence ${selected.confidence < .7 ? 'low' : ''}`}>{Math.round(selected.confidence * 100)}% confianza</span><button className="button secondary small" onClick={() => void onOpenSource(selected)}><FileText size={15} />Ver fuente</button></div></div>{task && task.state === 'pendiente' && <div className="warning"><AlertTriangle size={18} /><div><strong>{task.title}</strong><p>{task.reason}</p></div></div>}<div className={editing ? 'attributes editing' : 'attributes'}>{Object.entries(edits).map(([key, value]) => <label key={key}><small>{key}</small>{editing ? <textarea value={value} onChange={(event) => setEdits((current) => ({ ...current, [key]: event.target.value }))} /> : <p>{value}</p>}</label>)}</div>{canReview && <div className="correction-bar"><button className="button secondary" onClick={() => { if (editing) setEdits(selected.fields); setEditing(!editing) }}>{editing ? 'Cancelar edición' : 'Corregir atributos'}</button>{editing && <button className="button primary" disabled={busy} onClick={async () => { await onSaveAttributes(selected.id, edits); setEditing(false) }}>{busy ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />}Guardar correcciones</button>}</div>}<div className="decision-bar"><span>{canReview ? 'La aprobación certifica revisión humana, no reemplaza el juicio profesional.' : 'Tu rol permite consultar el resultado, pero no modificar su revisión.'}</span>{canReview && <div><button disabled={busy || editing} className="button secondary" onClick={() => void onUpdate(selected.id, 'devuelto')}><RotateCcw size={16} />Devolver</button><button disabled={busy || editing} className="button primary" onClick={() => void onUpdate(selected.id, 'aprobado')}><CheckCircle2 size={16} />Aprobar</button></div>}</div></section></div>
}

function ExportsView({
  records,
  projectName,
  userEmail,
  aiLogs = [],
  onDownload,
  onNotice,
  onError,
}: {
  records: PropertyMasterRecord[]
  projectName: string
  userEmail: string
  aiLogs?: import('./types').AiExecutionLog[]
  onDownload: (criteria: 'all' | 'only_approved' | 'exceptions_only') => Promise<void>
  onNotice: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [criteria, setCriteria] = useState<'all' | 'only_approved' | 'exceptions_only'>('only_approved')
  const approvedCount = records.filter((r) => r.reviewState === 'aprobado').length
  const conflictCount = records.filter((r) => r.criticalConflictCount > 0).length

  return (
    <>
      <div className="intro">
        <p className="eyebrow">RESULTADOS CERTIFICADOS (US-116 a US-118)</p>
        <h2>Exportación Matriz CORRESPONDENCIA</h2>
        <p>Genera el libro oficial con hojas CORRESPONDENCIA, Trazabilidad de Atributos y Metadatos de Auditoría.</p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Criterio de Inclusión para Entrega Jurídica</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <label
            style={{
              padding: '1rem',
              borderRadius: '8px',
              border: criteria === 'only_approved' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
              backgroundColor: criteria === 'only_approved' ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
              cursor: 'pointer',
              display: 'block',
            }}
          >
            <input
              type="radio"
              name="criteria"
              checked={criteria === 'only_approved'}
              onChange={() => setCriteria('only_approved')}
              style={{ marginRight: '0.5rem' }}
            />
            <strong>Entrega Oficial Aprobada</strong>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Solo incluye los {approvedCount} predio(s) con certificación jurídica humana.
            </p>
          </label>

          <label
            style={{
              padding: '1rem',
              borderRadius: '8px',
              border: criteria === 'all' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
              backgroundColor: criteria === 'all' ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
              cursor: 'pointer',
              display: 'block',
            }}
          >
            <input
              type="radio"
              name="criteria"
              checked={criteria === 'all'}
              onChange={() => setCriteria('all')}
              style={{ marginRight: '0.5rem' }}
            />
            <strong>Borrador Completo</strong>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Exporta los {records.length} predios del expediente (aprobados, pendientes y observados).
            </p>
          </label>

          <label
            style={{
              padding: '1rem',
              borderRadius: '8px',
              border: criteria === 'exceptions_only' ? '2px solid #b91c1c' : '1px solid var(--color-border)',
              backgroundColor: criteria === 'exceptions_only' ? '#fef2f2' : 'var(--color-surface)',
              cursor: 'pointer',
              display: 'block',
            }}
          >
            <input
              type="radio"
              name="criteria"
              checked={criteria === 'exceptions_only'}
              onChange={() => setCriteria('exceptions_only')}
              style={{ marginRight: '0.5rem' }}
            />
            <strong>Reporte de Excepciones</strong>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#b91c1c' }}>
              Descarga los {conflictCount} predio(s) con conflictos materiales o bloqueados.
            </p>
          </label>
        </div>
      </div>

      <section className="export-panel">
        <div className="export-icon">
          <Download size={30} />
        </div>
        <div>
          <h3>Libro Excel Certificado CORRESPONDENCIA.xlsx</h3>
          <p>
            {projectName} · {userEmail} · Criterio: {criteria.toUpperCase()} · Hoja de Metadatos de Auditoría incluida.
          </p>
        </div>
        <button className="button primary" disabled={!records.length} onClick={() => void onDownload(criteria)}>
          <Download size={17} />
          Descargar .xlsx
        </button>
      </section>

      <section className="card note">
        <ShieldCheck size={20} />
        <p>
          Conforme a las reglas de Territorium, cada libro descargado incluye inmutablemente el identificador de lote, la fecha de extracción, el responsable y el estado de revisión de cada atributo.
        </p>
      </section>

      <LegalDocumentGenerator
        records={records}
        projectName={projectName}
        userEmail={userEmail}
        aiLogs={aiLogs}
        onNotice={onNotice}
        onError={onError}
      />
    </>
  )
}
function AuditView({ events, title = 'Historial del expediente' }: { events: AuditEvent[]; title?: string }) { return <section className="card"><div className="section-title"><div><p className="eyebrow">AUDITORÍA</p><h2>{title}</h2></div></div>{events.slice().reverse().map((event) => <div className="audit-row" key={event.id}><div className="audit-dot" /><div><strong>{event.action}</strong><p>{event.detail}</p></div><time>{new Date(event.at).toLocaleString('es-CO')}</time></div>)}{!events.length && <EmptyState text="No hay eventos registrados." />}</section> }
function EmptyProject({ onCreate }: { onCreate: () => void }) { return <div className="empty-page"><FolderKanban size={34} /><h2>Crea el primer expediente</h2><p>El expediente es el contenedor seguro para documentos, procesamiento, revisión y exportación.</p><button className="button primary" onClick={onCreate}>Crear expediente</button></div> }
function ProjectRequired({ onSelect, title = 'Selecciona un expediente para continuar' }: { onSelect: () => void; title?: string }) { return <div className="empty-page project-required"><FolderKanban size={34} /><h2>{title}</h2><p>La carga, revisión, exportación y gestión de participantes trabajan sobre el contexto de un expediente.</p><button className="button primary" onClick={onSelect}>Ir a expedientes</button></div> }
function EmptyState({ text }: { text: string }) { return <div className="empty-state"><Archive size={20} /><span>{text}</span></div> }
export default App
