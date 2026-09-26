import { useState } from 'react'
import { Activity, Play, RefreshCw, SlidersHorizontal, Sparkles } from 'lucide-react'
import type { AiExecutionLog, ExtractorConfig, PromptVersion } from '../../types'
import {
  DEFAULT_EXTRACTOR_CONFIGS,
  DEFAULT_PROMPT_VERSIONS,
  createAiExecutionLog,
  testPromptInSandbox,
} from '../../lib/extractorConfig'
import { PageHeader } from '../common/PageHeader'

export interface TelemetryViewProps {
  aiLogs: AiExecutionLog[]
  onRecordAiLog?: (log: AiExecutionLog) => Promise<void> | void
  configs?: ExtractorConfig[]
  promptVersions?: PromptVersion[]
  isLocalMode?: boolean
}

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

export function TelemetryView({
  aiLogs,
  onRecordAiLog,
  configs = DEFAULT_EXTRACTOR_CONFIGS,
  promptVersions = DEFAULT_PROMPT_VERSIONS,
  isLocalMode = false,
}: TelemetryViewProps) {
  const [isTestingTelemetry, setIsTestingTelemetry] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const totalTokens = aiLogs.reduce((sum, l) => sum + (l.totalTokens || 0), 0)
  const totalCost = aiLogs.reduce((sum, l) => sum + (l.estimatedCostUsd || 0), 0)
  const fallbacksCount = aiLogs.filter((l) => l.fallbackTriggered).length

  async function handleRunTelemetryTest() {
    if (!onRecordAiLog) return
    setIsTestingTelemetry(true)
    try {
      const activePrompt =
        promptVersions.find((v) => v.extractorKey === 'title_study' && v.active) ||
        DEFAULT_PROMPT_VERSIONS[0]
      const currentConfig =
        configs.find((c) => c.extractorKey === 'title_study') || DEFAULT_EXTRACTOR_CONFIGS[0]

      const sampleText = `OFICINA DE REGISTRO DE INSTRUMENTOS PÚBLICOS
MATRÍCULA INMOBILIARIA: 350-108418
PREDIO: LA PLAYA, Cédula catastral: 73043000200020024000
MUNICIPIO: ANZOÁTEGUI, TOLIMA. ÁREA: 6 ha 9524 m2
PROPIETARIO: ROSA ELENA RONCANCIO DE GARCÍA con C.C. 28.586.080`

      const testResult = testPromptInSandbox(
        {
          extractorKey: 'title_study',
          promptText: activePrompt.prompt,
          schema: activePrompt.schema,
          sampleInput: sampleText,
          modelOverride: currentConfig.primaryModel || 'gemini-flash-latest',
        },
        currentConfig
      )

      const promptTok = testResult.tokens?.prompt || 140
      const compTok = testResult.tokens?.completion || 85
      const newLog = createAiExecutionLog({
        extractorKey: 'title_study',
        promptVersionId: activePrompt.id,
        promptVersionNumber: activePrompt.version,
        requestedModel: currentConfig.primaryModel || 'gemini-flash-latest',
        usedModel: testResult.modelUsed || currentConfig.primaryModel || 'gemini-flash-latest',
        fallbackTriggered: false,
        status: 'success',
        latencyMs: testResult.latencyMs || 280,
        promptTokens: promptTok,
        completionTokens: compTok,
        isTestRun: true,
      })

      await onRecordAiLog(newLog)
      setFeedback('Diagnóstico de telemetría ejecutado y registrado exitosamente.')
      setTimeout(() => setFeedback(null), 4000)
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      alert(`Error al registrar prueba de telemetría: ${errorMsg}`)
    } finally {
      setIsTestingTelemetry(false)
    }
  }

  return (
    <div className="telemetry-view-container space-y-6">
      <PageHeader
        title="Telemetría de IA"
        eyebrow="OBSERVABILIDAD Y COSTOS EN TIEMPO REAL"
        description="Auditoría forense de modelos de lenguaje, consumo de tokens, latencia por llamada y costos acumulados en el pipeline de extracción."
        actions={
          <button
            type="button"
            className="btn btn-primary btn-sm inline-flex items-center gap-2"
            disabled={isTestingTelemetry}
            onClick={handleRunTelemetryTest}
            title="Ejecuta una evaluación en sandbox y registra la telemetría"
          >
            <Play size={14} />
            {isTestingTelemetry ? 'Ejecutando diagnóstico…' : 'Probar Telemetría'}
          </button>
        }
      />

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center gap-2 animate-in fade-in">
          <Sparkles size={16} className="text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="telemetry-summary-cards">
        <div className="card summary-metric-card">
          <span className="metric-label">Total Ejecuciones Registradas</span>
          <span className="metric-value">{aiLogs.length}</span>
          <span className="metric-sub">{isLocalMode ? 'Modo local activo' : 'En lotes procesados'}</span>
        </div>
        <div className="card summary-metric-card">
          <span className="metric-label">Tokens Consumidos</span>
          <span className="metric-value">{totalTokens.toLocaleString()}</span>
          <span className="metric-sub">Prompt + Completion</span>
        </div>
        <div className="card summary-metric-card">
          <span className="metric-label">Costo Estimado Acumulado</span>
          <span className="metric-value">${totalCost.toFixed(4)} USD</span>
          <span className="metric-sub">Tarifa oficial Gemini</span>
        </div>
        <div className="card summary-metric-card">
          <span className="metric-label">Fallbacks Activados</span>
          <span className="metric-value">{fallbacksCount}</span>
          <span className="metric-sub">Recuperaciones automáticas</span>
        </div>
      </div>

      {/* Tabla de registros */}
      <div className="card telemetry-table-card">
        <div className="card-header-row">
          <div>
            <h3>Registro de Auditoría Técnica de IA (US-059)</h3>
            <span className="small-muted">
              Monitoreo continuo de ejecuciones, modelos utilizados, latencia en ms y costos
            </span>
          </div>
          <button
            type="button"
            className="button secondary small"
            disabled={isTestingTelemetry}
            onClick={handleRunTelemetryTest}
          >
            <Play size={13} /> {isTestingTelemetry ? 'Probando...' : 'Probar Telemetría'}
          </button>
        </div>

        {aiLogs.length === 0 ? (
          <div className="empty-state" style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
            <Activity size={36} style={{ opacity: 0.4, margin: '0 auto 0.75rem auto', display: 'block' }} />
            <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No hay registros de telemetría disponibles aún.</p>
            <p
              className="small-muted"
              style={{ marginBottom: '1.25rem', maxWidth: '420px', margin: '0 auto 1.25rem auto' }}
            >
              Los registros se generan automáticamente al procesar documentos con IA o al pulsar el botón de diagnóstico.
            </p>
            <button
              type="button"
              className="button primary small"
              disabled={isTestingTelemetry}
              onClick={handleRunTelemetryTest}
            >
              <Play size={13} /> {isTestingTelemetry ? 'Ejecutando diagnóstico...' : 'Ejecutar Diagnóstico de Telemetría'}
            </button>
          </div>
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
                      {log.isTestRun && <span className="test-run-badge">Prueba diagnóstica</span>}
                    </td>
                    <td>
                      <strong>
                        {extractorLabels[log.extractorKey as 'title_study' | 'plan' | 'negotiation']?.label ??
                          log.extractorKey}
                      </strong>
                    </td>
                    <td>
                      <code>{log.requestedModel}</code>
                    </td>
                    <td>
                      <code>{log.usedModel}</code>
                    </td>
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
  )
}
