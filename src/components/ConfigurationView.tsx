import { useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  Database,
  DollarSign,
  FileCode2,
  FileText,
  History,
  Layers,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Zap,
} from 'lucide-react'
import type {
  AiExecutionLog,
  ExtractorConfig,
  PromptTestRequest,
  PromptTestResult,
  PromptVersion,
} from '../types'
import {
  activatePromptVersion,
  createAiExecutionLog,
  createNextPromptVersion,
  DEFAULT_EXTRACTOR_CONFIGS,
  DEFAULT_PROMPT_VERSIONS,
  testPromptInSandbox,
} from '../lib/extractorConfig'

interface ConfigurationViewProps {
  configs: ExtractorConfig[]
  promptVersions: PromptVersion[]
  aiLogs: AiExecutionLog[]
  canConfigure?: boolean
  onUpdateConfig: (config: ExtractorConfig) => Promise<void> | void
  onCreatePromptVersion: (input: {
    extractorKey: 'title_study' | 'plan' | 'negotiation'
    name: string
    prompt: string
    schema: Record<string, unknown>
    setActive?: boolean
  }) => Promise<void> | void
  onActivatePromptVersion: (versionId: string, extractorKey: string) => Promise<void> | void
  onRecordAiLog?: (log: AiExecutionLog) => Promise<void> | void
  onResetDemo?: () => void
  isLocalMode?: boolean
}

type TabKey = 'extractores' | 'prompts' | 'playground' | 'telemetria'

const extractorLabels: Record<'title_study' | 'plan' | 'negotiation', { label: string; desc: string }> = {
  title_study: {
    label: 'Estudio de títulos',
    desc: 'Extracción de matrícula, propietarios vigentes, linderos, gravámenes y modo de adquisición.',
  },
  plan: {
    label: 'Planos y topografía',
    desc: 'Extracción métrica de área total, afectación, escala, cuadro de coordenadas y linderos gráficos.',
  },
  negotiation: {
    label: 'Negociación y avalúos',
    desc: 'Extracción de ofertas, avalúos comerciales, condiciones suspensivas y compensaciones.',
  },
}

const sampleInputs: Record<'title_study' | 'plan' | 'negotiation', string> = {
  title_study: `OFICINA DE REGISTRO DE INSTRUMENTOS PÚBLICOS DE BOGOTÁ D.C.
MATRÍCULA INMOBILIARIA: 50N-2045587 | CÉDULA CATASTRAL: 01-02-0045-0012-000
PREDIO: LOTE LA ESPERANZA, SECTOR RURAL NORTE
PROPIETARIOS ACTUALES: CARLOS ALBERTO RESTREPO GÓMEZ (C.C. 19.450.880, 100% DE DERECHOS).
CABIDA Y LINDEROS: Por el Norte en 145 metros con predio El Bosque; por el Sur en 120 metros con Quebrada Honda; por el Oriente en 80 metros con Carretera Central; por el Occidente con Predio San José.
ÁREA TOTAL: 12 ha + 4.500 m².
MODO DE ADQUISICIÓN: Escritura Pública No. 1240 del 15 de marzo de 2018, Notaría 25 de Bogotá. Compraventa.
GRAVÁMENES Y MEDIDAS CAUTELARES: Sin condiciones jurídicas vigentes ni hipotecas.`,
  plan: `PLANO TOPOGRÁFICO DE AFECTACIÓN PREDIAL
PROYECTO: LÍNEA DE TRANSMISIÓN ELÉCTRICA 230 KV
PREDIO: LA ESPERANZA | PROPIETARIO: CARLOS ALBERTO RESTREPO GÓMEZ
ÁREA TOTAL DEL PREDIO: 124.500 m² (12 ha + 4.500 m²)
ÁREA DE SERVIDUMBRE REQUERIDA: 14.250 m²
ANCHO DE FRANJA: 32 metros | LONGITUD DEL TRAMO: 445 metros
INFRAESTRUCTURA: Torre T-14 y Torre T-15 proyectadas
ESCALA: 1:1.000 | FECHA DE LEVANTAMIENTO: FEBRERO 2026`,
  negotiation: `ACTA DE CONCERTACIÓN Y OFERTA FORMAL DE INDEMNIZACIÓN
EXPEDIENTE: EXP-PREDIO-001 | PREDIO: LA ESPERANZA
OFERTA COMERCIAL No. 1: Valor determinado según avalúo corporativo: $ 1.245.000.000 COP (MIL DOSCIENTOS CUARENTA Y CINCO MILLONES DE PESOS M/CTE).
OFERTA DE REAJUSTE No. 2: $ 1.260.000.000 COP.
ESTADO DE NEGOCIACIÓN: En proceso de concertación voluntaria directa. Sin oposición prejudicial.`,
}

export function ConfigurationView({
  configs,
  promptVersions,
  aiLogs,
  canConfigure = true,
  onUpdateConfig,
  onCreatePromptVersion,
  onActivatePromptVersion,
  onRecordAiLog,
  onResetDemo,
  isLocalMode = false,
}: ConfigurationViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('extractores')
  const [selectedExtractor, setSelectedExtractor] = useState<'title_study' | 'plan' | 'negotiation'>('title_study')
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  // Estado editable local de extractores
  const [editedConfigs, setEditedConfigs] = useState<Record<string, ExtractorConfig>>(() => {
    const map: Record<string, ExtractorConfig> = {}
    for (const def of DEFAULT_EXTRACTOR_CONFIGS) {
      const match = configs.find((c) => c.extractorKey === def.extractorKey)
      map[def.extractorKey] = match ? { ...match } : { ...def }
    }
    return map
  })

  // Estado para crear nueva versión de prompt (US-057)
  const [isCreatingPrompt, setIsCreatingPrompt] = useState(false)
  const [newPromptName, setNewPromptName] = useState('')
  const [newPromptText, setNewPromptText] = useState('')
  const [newPromptSchema, setNewPromptSchema] = useState('{\n  "type": "object",\n  "required": ["records"]\n}')
  const [newPromptSetActive, setNewPromptSetActive] = useState(true)

  // Estado del Playground / Sandbox (US-062)
  const [playgroundExtractor, setPlaygroundExtractor] = useState<'title_study' | 'plan' | 'negotiation'>('title_study')
  const [playgroundInput, setPlaygroundInput] = useState(sampleInputs.title_study)
  const [playgroundModel, setPlaygroundModel] = useState('gpt-4o')
  const [playgroundRunning, setPlaygroundRunning] = useState(false)
  const [playgroundResult, setPlaygroundResult] = useState<PromptTestResult | null>(null)

  function handleConfigChange<K extends keyof ExtractorConfig>(
    key: 'title_study' | 'plan' | 'negotiation',
    field: K,
    value: ExtractorConfig[K]
  ) {
    setEditedConfigs((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  async function handleSaveExtractor(key: 'title_study' | 'plan' | 'negotiation') {
    setSavingKey(key)
    try {
      const target = editedConfigs[key]
      await onUpdateConfig(target)
      setFeedback(`Configuración para ${extractorLabels[key].label} guardada correctamente.`)
      setTimeout(() => setFeedback(null), 3500)
    } finally {
      setSavingKey(null)
    }
  }

  async function handleSaveNewPromptVersion() {
    if (!newPromptName.trim() || !newPromptText.trim()) return
    let parsedSchema = {}
    try {
      parsedSchema = JSON.parse(newPromptSchema)
    } catch {
      alert('El esquema JSON no tiene un formato válido.')
      return
    }

    setSavingKey('new-prompt')
    try {
      await onCreatePromptVersion({
        extractorKey: selectedExtractor,
        name: newPromptName,
        prompt: newPromptText,
        schema: parsedSchema,
        setActive: newPromptSetActive,
      })
      setIsCreatingPrompt(false)
      setNewPromptName('')
      setNewPromptText('')
      setFeedback('Nueva versión de prompt registrada inmutablemente.')
      setTimeout(() => setFeedback(null), 3500)
    } finally {
      setSavingKey(null)
    }
  }

  function handleRunSandboxTest() {
    setPlaygroundRunning(true)
    const activePrompt =
      promptVersions.find((p) => p.extractorKey === playgroundExtractor && p.active)?.prompt ||
      DEFAULT_PROMPT_VERSIONS.find((p) => p.extractorKey === playgroundExtractor)?.prompt ||
      'Instrucción de prueba'

    setTimeout(() => {
      const res = testPromptInSandbox({
        extractorKey: playgroundExtractor,
        promptText: activePrompt,
        schema: { required: ['records'] },
        sampleInput: playgroundInput,
        modelOverride: playgroundModel,
      })
      setPlaygroundResult(res)
      setPlaygroundRunning(false)

      // Registrar telemetría de prueba
      if (onRecordAiLog) {
        const log = createAiExecutionLog({
          extractorKey: playgroundExtractor,
          requestedModel: playgroundModel,
          usedModel: playgroundModel,
          fallbackTriggered: false,
          status: res.success ? 'success' : 'failed',
          latencyMs: res.latencyMs,
          promptTokens: res.tokens.prompt,
          completionTokens: res.tokens.completion,
          isTestRun: true,
          errorMessage: res.validationErrors.length > 0 ? res.validationErrors.join(', ') : null,
        })
        void onRecordAiLog(log)
      }
    }, 400)
  }

  const currentConfig = editedConfigs[selectedExtractor] || DEFAULT_EXTRACTOR_CONFIGS[0]
  const versionsForSelected = promptVersions.filter((v) => v.extractorKey === selectedExtractor)

  return (
    <div className="config-container">
      <div className="intro">
        <p className="eyebrow">GOBERNANZA & MODELOS DE IA</p>
        <h2>Configuración de Extractores, Prompts y Modelos</h2>
        <p>
          Administra los proveedores de IA, el versionado inmutable de prompts, las políticas de fallback
          ante fallos transitorios y la trazabilidad de tokens por ejecución.
        </p>
      </div>

      {feedback && (
        <div className="alert-banner info" style={{ marginBottom: '1.25rem' }}>
          <CheckCircle2 size={18} />
          <span>{feedback}</span>
        </div>
      )}

      {/* Selector de Pestañas */}
      <div className="config-tabs-nav">
        <button
          className={`config-tab-btn ${activeTab === 'extractores' ? 'active' : ''}`}
          onClick={() => setActiveTab('extractores')}
        >
          <Sliders size={18} />
          <span>Extractores y Modelos (US-056, US-060)</span>
        </button>
        <button
          className={`config-tab-btn ${activeTab === 'prompts' ? 'active' : ''}`}
          onClick={() => setActiveTab('prompts')}
        >
          <Layers size={18} />
          <span>Versiones de Prompts (US-057)</span>
        </button>
        <button
          className={`config-tab-btn ${activeTab === 'playground' ? 'active' : ''}`}
          onClick={() => setActiveTab('playground')}
        >
          <Cpu size={18} />
          <span>Banco de Pruebas / Sandbox (US-062)</span>
        </button>
        <button
          className={`config-tab-btn ${activeTab === 'telemetria' ? 'active' : ''}`}
          onClick={() => setActiveTab('telemetria')}
        >
          <Zap size={18} />
          <span>Telemetría y Trazabilidad IA (US-059)</span>
        </button>
      </div>

      {/* PESTAÑA 1: EXTRACTORES Y MODELOS (US-056, US-060) */}
      {activeTab === 'extractores' && (
        <div className="config-tab-content">
          <div className="extractor-selector-grid">
            {(['title_study', 'plan', 'negotiation'] as const).map((key) => {
              const cfg = editedConfigs[key]
              const isSelected = selectedExtractor === key
              return (
                <button
                  key={key}
                  className={`extractor-card-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedExtractor(key)}
                >
                  <div className="extractor-card-header">
                    <span className="extractor-title">{extractorLabels[key].label}</span>
                    <span className={`status-pill ${cfg?.isEnabled ? 'success' : 'neutral'}`}>
                      {cfg?.isEnabled ? 'Habilitado' : 'Deshabilitado'}
                    </span>
                  </div>
                  <p className="extractor-desc">{extractorLabels[key].desc}</p>
                  <div className="extractor-meta">
                    <span>Primario: <strong>{cfg?.primaryModel}</strong></span>
                    <span>Fallback: <strong>{cfg?.fallbackModel || 'Sin fallback'}</strong></span>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="card config-detail-card">
            <div className="card-header-row">
              <div>
                <h3>Parámetros de {extractorLabels[selectedExtractor].label}</h3>
                <p className="small-muted">
                  Configura proveedor, límites de tokens, timeout y contingencia transitoria.
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={currentConfig.isEnabled}
                  disabled={!canConfigure}
                  onChange={(e) => handleConfigChange(selectedExtractor, 'isEnabled', e.target.checked)}
                />
                <span className="toggle-slider" />
                <span className="toggle-label">{currentConfig.isEnabled ? 'Extractor Activo' : 'Deshabilitado'}</span>
              </label>
            </div>

            <div className="form-grid-2col">
              <div className="form-group">
                <label>Proveedor de IA</label>
                <select
                  value={currentConfig.provider}
                  disabled={!canConfigure}
                  onChange={(e) =>
                    handleConfigChange(selectedExtractor, 'provider', e.target.value as any)
                  }
                >
                  <option value="openai">OpenAI (Oficial)</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="azure_openai">Azure OpenAI Services</option>
                  <option value="deepseek">DeepSeek AI</option>
                </select>
              </div>

              <div className="form-group">
                <label>Modelo Principal (Primary Model)</label>
                <input
                  type="text"
                  value={currentConfig.primaryModel}
                  disabled={!canConfigure}
                  onChange={(e) => handleConfigChange(selectedExtractor, 'primaryModel', e.target.value)}
                  placeholder="ej. gpt-4o, claude-3-5-sonnet"
                />
              </div>

              <div className="form-group">
                <label>
                  Modelo de Contingencia / Fallback (US-060)
                  <span className="help-badge" title="Solo se activa ante fallos transitorios: 429, timeouts, 500, 502, 503">
                    Solo fallos transitorios
                  </span>
                </label>
                <input
                  type="text"
                  value={currentConfig.fallbackModel || ''}
                  disabled={!canConfigure}
                  onChange={(e) => handleConfigChange(selectedExtractor, 'fallbackModel', e.target.value || null)}
                  placeholder="ej. gpt-4o-mini (dejar vacío si no se desea fallback)"
                />
              </div>

              <div className="form-group">
                <label>Proveedor de Contingencia</label>
                <select
                  value={currentConfig.fallbackProvider || currentConfig.provider}
                  disabled={!canConfigure}
                  onChange={(e) =>
                    handleConfigChange(selectedExtractor, 'fallbackProvider', e.target.value as any)
                  }
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="azure_openai">Azure OpenAI</option>
                  <option value="deepseek">DeepSeek</option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  Temperatura: <strong>{currentConfig.temperature.toFixed(2)}</strong>
                  <span className="help-text">Recomendado 0.0 para extracción jurídica estricta</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={currentConfig.temperature}
                  disabled={!canConfigure}
                  onChange={(e) =>
                    handleConfigChange(selectedExtractor, 'temperature', parseFloat(e.target.value))
                  }
                />
              </div>

              <div className="form-group">
                <label>Tope Máximo de Tokens (max_tokens)</label>
                <input
                  type="number"
                  min="512"
                  max="32768"
                  step="256"
                  value={currentConfig.maxTokens}
                  disabled={!canConfigure}
                  onChange={(e) =>
                    handleConfigChange(selectedExtractor, 'maxTokens', parseInt(e.target.value, 10))
                  }
                />
              </div>

              <div className="form-group">
                <label>Timeout de Ejecución (segundos)</label>
                <input
                  type="number"
                  min="15"
                  max="600"
                  step="15"
                  value={currentConfig.timeoutSeconds}
                  disabled={!canConfigure}
                  onChange={(e) =>
                    handleConfigChange(selectedExtractor, 'timeoutSeconds', parseInt(e.target.value, 10))
                  }
                />
              </div>
            </div>

            <div className="fallback-explanation-box">
              <ShieldAlert size={18} />
              <div>
                <strong>Regla de contingencia estricta (US-060):</strong>
                <p>
                  El modelo fallback (<code>{currentConfig.fallbackModel || 'ninguno'}</code>) solo se activará
                  automáticamente ante <em>sobrecargas de servidor (HTTP 502/503)</em>, <em>agotamiento de cuota por segundo (HTTP 429)</em> o <em>timeouts de red</em>.
                  Bajo ninguna circunstancia se desperdiciarán llamadas de contingencia ante fallos permanentes como insumos corruptos o esquemas inválidos.
                </p>
              </div>
            </div>

            {canConfigure && (
              <div className="card-actions-row">
                <button
                  className="button primary"
                  disabled={savingKey === selectedExtractor}
                  onClick={() => handleSaveExtractor(selectedExtractor)}
                >
                  <Save size={16} />
                  {savingKey === selectedExtractor ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 2: VERSIONES DE PROMPTS (US-057) */}
      {activeTab === 'prompts' && (
        <div className="config-tab-content">
          <div className="banner-immutability">
            <History size={20} />
            <div>
              <strong>Inmutabilidad Histórica Garantizada (US-057)</strong>
              <p>
                Cada ejecución aprobada o en revisión queda vinculada permanentemente a la versión de prompt con la que fue extraída.
                Crear una versión nueva incrementa el número secuencial (v2, v3...) sin modificar los expedientes históricos.
              </p>
            </div>
            {canConfigure && !isCreatingPrompt && (
              <button
                className="button primary"
                style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
                onClick={() => {
                  const currentActive = versionsForSelected.find((v) => v.active) || versionsForSelected[0]
                  setNewPromptName(`Estudios de títulos — v${(versionsForSelected[0]?.version || 1) + 1}`)
                  setNewPromptText(currentActive?.prompt || '')
                  setNewPromptSchema(JSON.stringify(currentActive?.schema || {}, null, 2))
                  setIsCreatingPrompt(true)
                }}
              >
                <Plus size={16} />
                Crear Versión v{(versionsForSelected[0]?.version || 1) + 1}
              </button>
            )}
          </div>

          <div className="extractor-pill-tabs">
            {(['title_study', 'plan', 'negotiation'] as const).map((k) => (
              <button
                key={k}
                className={`pill-btn ${selectedExtractor === k ? 'active' : ''}`}
                onClick={() => {
                  setSelectedExtractor(k)
                  setIsCreatingPrompt(false)
                }}
              >
                {extractorLabels[k].label}
              </button>
            ))}
          </div>

          {isCreatingPrompt ? (
            <div className="card new-version-form">
              <h3>Nueva Versión para {extractorLabels[selectedExtractor].label}</h3>
              <p className="small-muted">
                Define el nombre identificador, las directrices jurídicas y el contrato de esquema JSON.
              </p>

              <div className="form-group">
                <label>Nombre de la versión</label>
                <input
                  type="text"
                  value={newPromptName}
                  onChange={(e) => setNewPromptName(e.target.value)}
                  placeholder="ej. Regla estricta de linderos literales v2"
                />
              </div>

              <div className="form-group">
                <label>Instrucciones de Extracción (Prompt del Sistema)</label>
                <textarea
                  rows={8}
                  value={newPromptText}
                  onChange={(e) => setNewPromptText(e.target.value)}
                  placeholder="Instrucciones detalladas de extracción..."
                />
              </div>

              <div className="form-group">
                <label>Contrato de Salida (JSON Schema)</label>
                <textarea
                  rows={6}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                  value={newPromptSchema}
                  onChange={(e) => setNewPromptSchema(e.target.value)}
                />
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={newPromptSetActive}
                  onChange={(e) => setNewPromptSetActive(e.target.checked)}
                />
                <span>Establecer inmediatamente como versión activa para nuevos lotes</span>
              </label>

              <div className="card-actions-row">
                <button
                  className="button secondary"
                  onClick={() => setIsCreatingPrompt(false)}
                >
                  Cancelar
                </button>
                <button
                  className="button primary"
                  disabled={savingKey === 'new-prompt' || !newPromptName.trim() || !newPromptText.trim()}
                  onClick={handleSaveNewPromptVersion}
                >
                  <Save size={16} />
                  {savingKey === 'new-prompt' ? 'Guardando...' : 'Publicar Versión Inmutable'}
                </button>
              </div>
            </div>
          ) : (
            <div className="prompt-versions-list">
              {versionsForSelected.length === 0 ? (
                <div className="card empty-state">
                  <p>No hay versiones registradas para este extractor.</p>
                </div>
              ) : (
                versionsForSelected.map((version) => (
                  <div key={version.id} className={`card version-card ${version.active ? 'active-version' : ''}`}>
                    <div className="version-card-header">
                      <div className="version-badge-group">
                        <span className="version-number-pill">v{version.version}</span>
                        <h4>{version.name}</h4>
                        {version.active ? (
                          <span className="status-pill success">
                            <CheckCircle2 size={13} /> Activa
                          </span>
                        ) : (
                          <span className="status-pill neutral">Histórica (Inmutable)</span>
                        )}
                      </div>
                      <span className="version-date">
                        Creada: {new Date(version.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="prompt-body-preview">
                      <p>{version.prompt}</p>
                    </div>

                    <div className="version-card-footer">
                      <span className="small-muted">
                        Esquema: {Object.keys(version.schema || {}).length ? 'Estricto definido' : 'Genérico'}
                      </span>
                      {canConfigure && !version.active && (
                        <button
                          className="button secondary small"
                          onClick={() => onActivatePromptVersion(version.id, selectedExtractor)}
                        >
                          <Zap size={14} /> Activar para futuros lotes
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 3: BANCO DE PRUEBAS / PLAYGROUND SANDBOX (US-062) */}
      {activeTab === 'playground' && (
        <div className="config-tab-content">
          <div className="sandbox-disclaimer-banner">
            <Cpu size={20} />
            <div>
              <strong>Entorno Sandbox Aislado (US-062)</strong>
              <p>
                Este banco de pruebas valida la capacidad de extracción y la conformidad del contrato JSON
                <strong> sin escribir en bases de datos productivas</strong> (no genera predios ni revisiones en expedientes reales).
              </p>
            </div>
          </div>

          <div className="playground-layout">
            <div className="playground-pane input-pane card">
              <div className="pane-header">
                <h3>Insumo de Prueba</h3>
                <div className="extractor-pill-select">
                  {(['title_study', 'plan', 'negotiation'] as const).map((k) => (
                    <button
                      key={k}
                      className={`pill-btn small ${playgroundExtractor === k ? 'active' : ''}`}
                      onClick={() => {
                        setPlaygroundExtractor(k)
                        setPlaygroundInput(sampleInputs[k])
                        setPlaygroundResult(null)
                      }}
                    >
                      {extractorLabels[k].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <div className="label-with-action">
                  <label>Texto del Documento Fuente (Muestra)</label>
                  <button
                    className="link-button"
                    onClick={() => setPlaygroundInput(sampleInputs[playgroundExtractor])}
                  >
                    Restablecer ejemplo
                  </button>
                </div>
                <textarea
                  rows={11}
                  value={playgroundInput}
                  onChange={(e) => setPlaygroundInput(e.target.value)}
                  placeholder="Pega aquí el extracto de texto a evaluar..."
                />
              </div>

              <div className="playground-controls-bar">
                <div className="model-selector-inline">
                  <label>Modelo a probar:</label>
                  <select
                    value={playgroundModel}
                    onChange={(e) => setPlaygroundModel(e.target.value)}
                  >
                    <option value="gpt-4o">gpt-4o (Recomendado)</option>
                    <option value="gpt-4o-mini">gpt-4o-mini (Rápido / Económico)</option>
                    <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
                  </select>
                </div>
                <button
                  className="button primary"
                  disabled={playgroundRunning || !playgroundInput.trim()}
                  onClick={handleRunSandboxTest}
                >
                  <Play size={16} />
                  {playgroundRunning ? 'Extrayendo en Sandbox...' : 'Probar Extracción'}
                </button>
              </div>
            </div>

            <div className="playground-pane output-pane card">
              <div className="pane-header">
                <h3>Resultado de la Extracción Sandbox</h3>
                {playgroundResult && (
                  <div className="metrics-pill-group">
                    <span className="metric-pill">
                      <Clock size={13} /> {playgroundResult.latencyMs} ms
                    </span>
                    <span className="metric-pill">
                      <Zap size={13} /> {playgroundResult.tokens.total} tokens
                    </span>
                    <span className={`status-pill ${playgroundResult.success ? 'success' : 'error'}`}>
                      {playgroundResult.success ? 'Contrato Válido' : 'Error en Contrato'}
                    </span>
                  </div>
                )}
              </div>

              {!playgroundResult ? (
                <div className="empty-playground-state">
                  <Bot size={36} />
                  <p>Ejecuta una prueba para ver la estructura extraída, tokens y validación de contrato.</p>
                </div>
              ) : (
                <div className="json-viewer-box">
                  {playgroundResult.validationErrors.length > 0 && (
                    <div className="alert-banner warning" style={{ marginBottom: '0.75rem' }}>
                      <AlertTriangle size={16} />
                      <div>
                        <strong>Observaciones de validación:</strong>
                        <ul>
                          {playgroundResult.validationErrors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  <pre className="json-code">
                    {JSON.stringify(playgroundResult.output, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 4: TELEMETRÍA Y TRAZABILIDAD IA (US-059) */}
      {activeTab === 'telemetria' && (
        <div className="config-tab-content">
          <div className="telemetry-summary-cards">
            <div className="card summary-metric-card">
              <span className="metric-label">Total Ejecuciones Registradas</span>
              <span className="metric-value">{aiLogs.length}</span>
              <span className="metric-sub">En lotes y entorno sandbox</span>
            </div>
            <div className="card summary-metric-card">
              <span className="metric-label">Tokens Consumidos</span>
              <span className="metric-value">
                {aiLogs.reduce((sum, l) => sum + (l.totalTokens || 0), 0).toLocaleString()}
              </span>
              <span className="metric-sub">Prompt + Completion</span>
            </div>
            <div className="card summary-metric-card">
              <span className="metric-label">Costo Estimado Acumulado</span>
              <span className="metric-value">
                ${aiLogs.reduce((sum, l) => sum + (l.estimatedCostUsd || 0), 0).toFixed(4)} USD
              </span>
              <span className="metric-sub">Calculado por tarifa de modelo</span>
            </div>
            <div className="card summary-metric-card">
              <span className="metric-label">Fallbacks Activados</span>
              <span className="metric-value">
                {aiLogs.filter((l) => l.fallbackTriggered).length}
              </span>
              <span className="metric-sub">Por fallos transitorios resueltos</span>
            </div>
          </div>

          <div className="card telemetry-table-card">
            <div className="card-header-row">
              <h3>Registro de Auditoría Técnica de IA (US-059)</h3>
              <span className="small-muted">Mostrando las ejecuciones más recientes</span>
            </div>

            {aiLogs.length === 0 ? (
              <p className="empty-state">No hay registros de telemetría disponibles aún.</p>
            ) : (
              <div className="table-responsive">
                <table className="telemetry-table">
                  <thead>
                    <tr>
                      <th>Fecha / Hora</th>
                      <th>Extractor</th>
                      <th>Mod. Solicitado</th>
                      <th>Mod. Usado</th>
                      <th>Fallback</th>
                      <th>Tokens</th>
                      <th>Latencia</th>
                      <th>Costo USD</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiLogs.map((log) => (
                      <tr key={log.id} className={log.isTestRun ? 'test-run-row' : ''}>
                        <td>
                          {new Date(log.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                          {log.isTestRun && <span className="sandbox-badge">Sandbox</span>}
                        </td>
                        <td>
                          <strong>{extractorLabels[log.extractorKey]?.label ?? log.extractorKey}</strong>
                        </td>
                        <td><code>{log.requestedModel}</code></td>
                        <td><code>{log.usedModel}</code></td>
                        <td>
                          {log.fallbackTriggered ? (
                            <span className="fallback-badge-pill" title={log.fallbackReason || 'Fallo transitorio'}>
                              <RefreshCw size={12} /> Sí
                            </span>
                          ) : (
                            <span className="small-muted">—</span>
                          )}
                        </td>
                        <td>{log.totalTokens.toLocaleString()}</td>
                        <td>{log.latencyMs} ms</td>
                        <td>${log.estimatedCostUsd.toFixed(5)}</td>
                        <td>
                          <span
                            className={`status-pill ${
                              log.status === 'success' || log.status === 'fallback_success'
                                ? 'success'
                                : 'error'
                            }`}
                          >
                            {log.status === 'fallback_success'
                              ? 'Fallback Éxito'
                              : log.status === 'success'
                              ? 'Éxito'
                              : 'Fallido'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Zona de Peligro / Reset Demo en modo local */}
      {isLocalMode && onResetDemo && (
        <section className="card danger-zone" style={{ marginTop: '2rem' }}>
          <div>
            <h3>Datos de Demostración Local</h3>
            <p>Restaura los expedientes, tareas y configuraciones demostrativas predeterminadas.</p>
          </div>
          <button className="button secondary" onClick={onResetDemo}>
            <RotateCcw size={16} />
            Restablecer Demo
          </button>
        </section>
      )}
    </div>
  )
}
