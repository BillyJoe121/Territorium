import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { Activity, AlertTriangle, ChevronLeft, ChevronRight, FolderKanban, LoaderCircle, LogOut, Scale, WifiOff, X, XCircle } from 'lucide-react'
import { ToastLayer, toast as sonnerToast } from './components/ui/ToastLayer'
import { ThemeToggle } from './components/ui/ThemeToggle'
import { RemoteExpedienteWorkspace } from './components/expediente/RemoteExpedienteWorkspace'
import { TelemetryView } from './components/views/TelemetryView'
import { isSupabaseConfigured } from './lib/supabase'
import { useAuth } from './auth/AuthContext'
import { AuthScreen } from './auth/AuthScreen'
import { SessionGuard } from './auth/SessionGuard'
import { ProjectsManagementView } from './components/ProjectsManagementView'
import {
  createRemoteProject,
  loadPlatformState,
  recordRemoteAiExecutionLog,
  subscribeToProject,
  toggleArchiveRemoteProject,
  updateRemoteProject,
} from './data/platformRepository'
import { DEFAULT_EXTRACTOR_CONFIGS, DEFAULT_PROMPT_VERSIONS } from './lib/extractorConfig'
import type { AiExecutionLog, PlatformState, ProjectMetadataInput } from './types'

export type Screen = 'comparador' | 'expedientes' | 'proyecto_detalle' | 'telemetria'

const DocumentComparisonView = lazy(() => import('./components/comparison/DocumentComparisonView').then((module) => ({ default: module.DocumentComparisonView })))

export interface NavItem {
  id: Screen
  label: string
  icon: typeof FolderKanban
  requiresProject?: boolean
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'Módulos',
    items: [
      { id: 'comparador', label: 'Comparador Documental', icon: Scale },
      { id: 'expedientes', label: 'Proyectos', icon: FolderKanban },
      { id: 'telemetria', label: 'Telemetría de IA', icon: Activity },
    ],
  },
]

const screenRequiresProject = (screen: Screen) => screen === 'proyecto_detalle'

const screenLabels: Record<Screen, { title: string; eyebrow: string }> = {
  comparador: { title: 'Comparador Documental', eyebrow: 'COTEJO DE ORIGINALES' },
  expedientes: { title: 'Proyectos', eyebrow: 'INVENTARIO DE PROYECTOS' },
  proyecto_detalle: { title: 'Ficha del Proyecto', eyebrow: 'DETALLE Y ETAPAS OPERATIVAS' },
  telemetria: { title: 'Telemetría de IA', eyebrow: 'OBSERVABILIDAD Y COSTOS EN TIEMPO REAL' },
}

const navShortLabels: Partial<Record<Screen, string>> = {
  comparador: 'Comparador',
  expedientes: 'Proyectos',
  telemetria: 'Telemetría',
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
  const { user, status: authStatus, signOut, isRecovery } = useAuth()
  const [screen, setScreen] = useState<Screen>('comparador')
  const [state, setState] = useState<PlatformState>(() => ({
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
  }))
  const [activeProjectId, setActiveProjectId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
        setScreen('comparador')
        window.location.hash = '#/app/comparador'
        return
      }
      const parts = hash.replace('#/app/', '').split('?')
      const targetScreen = parts[0] as Screen
      const validScreens: Screen[] = ['comparador', 'expedientes', 'proyecto_detalle', 'telemetria']

      if (parts[0] === 'inicio') {
        setScreen('comparador')
        window.location.hash = '#/app/comparador'
        return
      }
      if (parts[0] === 'configuracion' || parts[0] === 'ajustes') {
        setScreen('telemetria')
        window.location.hash = '#/app/telemetria'
        return
      }
      if (parts[0] === 'usuarios' || parts[0] === 'trazabilidad') {
        setScreen('expedientes')
        window.location.hash = '#/app/expedientes'
        return
      }
      if (validScreens.includes(targetScreen)) {
        setScreen(targetScreen)
      } else {
        setScreen('comparador')
        window.location.hash = '#/app/comparador'
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    handleHashChange()
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    const currentHash = window.location.hash
    if (!currentHash.startsWith(`#/app/${screen}`)) {
      window.location.hash = `#/app/${screen}`
    }
  }, [screen])

  const activeProject = state.projects.find((project) => project.id === activeProjectId)
  const clearProjectContext = () => {
    setActiveProjectId('')
    setScreen('expedientes')
  }
  const toast = (message: string) => {
    sonnerToast.success(message)
  }
  const handleSignOut = async () => {
    try {
      await signOut()
      setActiveProjectId('')
      setScreen('comparador')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible cerrar la sesión.')
    }
  }

  // Las rutas operativas trabajan sobre un proyecto concreto. Si se abre una
  // URL profunda sin contexto, llevamos al usuario al selector en lugar de
  // renderizar una pantalla vacía o una vista con datos ambiguos.
  useEffect(() => {
    if (screenRequiresProject(screen) && !activeProject) {
      setScreen('expedientes')
      toast('Selecciona un proyecto para continuar.')
    }
  }, [activeProject, screen])

  const refresh = useCallback(async (silent = false) => {
    if (!user) return
    if (!silent) setLoading(true)
    try {
      const next = await loadPlatformState(); setState(next); setError(null)
      setActiveProjectId((current) => next.projects.some((project) => project.id === current) ? current : next.projects[0]?.id ?? '')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No fue posible sincronizar los datos.') }
    finally { setLoading(false) }
  }, [user])

  useEffect(() => { if (user) void refresh() }, [refresh, user])
  useEffect(() => { const onOnline = () => { setOnline(true); if (user) void refresh(true) }; const onOffline = () => setOnline(false); window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline); return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) } }, [refresh, user])
  useEffect(() => { if (!user || !activeProjectId) return; return subscribeToProject(activeProjectId, () => void refresh(true)) }, [activeProjectId, refresh, user])

  async function handleCreateProject(input: ProjectMetadataInput) {
    setBusyAction('create-project')
    try {
      const id = await createRemoteProject(input)
      await refresh(true)
      setActiveProjectId(id)
      setScreen('proyecto_detalle')
      toast('Proyecto creado con éxito. Abriendo la ficha del proyecto.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible crear el proyecto.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleUpdateProjectMetadata(projectId: string, input: ProjectMetadataInput) {
    setBusyAction(`edit:${projectId}`)
    try {
      await updateRemoteProject(projectId, input)
      await refresh(true)
      toast('Metadatos del proyecto actualizados correctamente.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible actualizar los metadatos.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleToggleArchiveProject(projectId: string, isArchived: boolean) {
    if (!state.projects.some((p) => p.id === projectId)) return
    setBusyAction(`archive:${projectId}`)
    try {
      await toggleArchiveRemoteProject(projectId, isArchived)
      await refresh(true)
      toast(isArchived ? 'Proyecto archivado de forma recuperable.' : 'Proyecto restaurado con éxito.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible cambiar el estado de archivado.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleRecordAiLog(log: AiExecutionLog) {
    const enrichedLog: AiExecutionLog = {
      ...log,
      projectId: log.projectId || activeProjectId || null,
    }
    setState((current) => ({ ...current, aiLogs: [enrichedLog, ...(current.aiLogs || [])] }))
    try {
      await recordRemoteAiExecutionLog(enrichedLog)
    } catch (err) {
      console.error('Error al registrar telemetría de IA en Supabase:', err)
    }
  }

  const content = {
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
        busyAction={busyAction}
      />
    ),
    proyecto_detalle: activeProject ? (
      <div className="project-detail-layout" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        <RemoteExpedienteWorkspace project={activeProject} onBack={() => setScreen('expedientes')} />
      </div>
    ) : (
      <ProjectRequired onSelect={() => setScreen('expedientes')} />
    ),
    comparador: (
      <Suspense fallback={<div className="loading-card"><LoaderCircle className="spin" />Cargando comparador…</div>}>
        {(() => {
          const comparisonProject = activeProject || state.projects.find((p) => !p.isArchived) || state.projects[0];
          return comparisonProject ? (
            <DocumentComparisonView
              project={comparisonProject}
              onActiveComparisonChange={(inComparison) => {
                setSidebarCollapsed(inComparison)
              }}
            />
          ) : (
            <div className="empty-page">
              <Scale size={34} />
              <h2>Comparador Documental</h2>
              <p>El comparador funciona de manera independiente para cotejar pares de documentos (PDF o DOCX).</p>
              <button
                className="button primary"
                onClick={() => void handleCreateProject({
                  name: 'Espacio de Cotejo',
                  clientName: 'Territorium',
                  municipality: 'General',
                  department: 'Cundinamarca',
                  responsibleName: user?.email ?? 'Equipo Territorium',
                })}
              >
                Habilitar comparador
              </button>
            </div>
          );
        })()}
      </Suspense>
    ),
    telemetria: (
      <TelemetryView
        aiLogs={state.aiLogs || []}
        onRecordAiLog={handleRecordAiLog}
        configs={state.extractorConfigs || DEFAULT_EXTRACTOR_CONFIGS}
        promptVersions={state.promptVersions || DEFAULT_PROMPT_VERSIONS}
      />
    ),
  }[screen]

  if (!isSupabaseConfigured) return <div className="loading-page error-page"><XCircle /><h2>Falta configurar Supabase</h2><p>Define la URL y la clave publicable en el entorno de despliegue.</p></div>

  const roleBadgeLabels: Record<string, string> = {
    owner: 'Propietario',
    operator: 'Operador',
    reviewer: 'Revisor',
    viewer: 'Consulta',
  }

  return <SessionGuard currentRole={activeProject?.role}>
    {authStatus === 'unauthenticated' || isRecovery ? (
      <AuthScreen initialMode={isRecovery ? 'update_password' : 'signin'} />
    ) : (
      <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <aside className="sidebar">
          <div className="sidebar-header">
            <Brand />
            <button
              type="button"
              className="sidebar-collapse-btn"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              title={sidebarCollapsed ? 'Expandir barra lateral ( > )' : 'Contraer barra lateral ( < )'}
              aria-label={sidebarCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
            >
              {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>
          </div>
          
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
                  title="Cerrar proyecto activo y volver a la lista"
                  aria-label="Cerrar proyecto activo"
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
                      title={isUnavailable ? 'Selecciona un proyecto para abrir este módulo' : label}
                      onClick={() => {
                        if (isUnavailable) {
                          toast('Selecciona un proyecto para abrir este módulo.')
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
                <ThemeToggle className="sidebar-theme-toggle" />
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
              {activeProject && screen !== 'comparador' && <><span>{activeProject.name}</span><span className="workspace-breadcrumb-separator" aria-hidden="true">/</span></>}
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
        <ToastLayer />
      </div>
    )}
  </SessionGuard>
}

function ProjectRequired({ onSelect, title = 'Selecciona un proyecto para continuar' }: { onSelect: () => void; title?: string }) { return <div className="empty-page project-required"><FolderKanban size={34} /><h2>{title}</h2><p>La extracción, los resultados y los documentos finales trabajan sobre el contexto de un proyecto.</p><button className="button primary" onClick={onSelect}>Ir a proyectos</button></div> }
export default App
