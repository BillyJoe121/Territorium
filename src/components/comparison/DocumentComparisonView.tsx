import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, CircleAlert, Eye, FilePlus2, Files, LoaderCircle, Scale, Trash2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { dataMode } from '../../lib/supabase'
import type { Project } from '../../types'
import {
  describeComparisonError, listComparisonDocuments, listComparisonJobs, requestComparison, retireComparisonDocument,
  uploadComparisonDocument, type ComparisonDocument, type ComparisonJob, type ComparedField,
} from '../../data/documentComparison'
import { OriginalViewer } from './OriginalViewer'
import './document-comparison.css'

export type VisualStatus = 'exact' | 'near' | 'different' | 'absent'

const SPANISH_MONTHS: Record<string, number> = {
  enero: 1, ene: 1,
  febrero: 2, feb: 2,
  marzo: 3, mar: 3,
  abril: 4, abr: 4,
  mayo: 5, may: 5,
  junio: 6, jun: 6,
  julio: 7, jul: 7,
  agosto: 8, ago: 8,
  septiembre: 9, setiembre: 9, sep: 9,
  octubre: 10, oct: 10,
  noviembre: 11, nov: 11,
  diciembre: 12, dic: 12,
}

export function parseSpanishDate(str: string): { year: number; month: number; day: number } | null {
  if (!str) return null
  const clean = str.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ')

  // Format: "15 de marzo de 2024" or "15 de marzo del 2024" or "15 marzo 2024"
  const textMatch = clean.match(/^(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)(?:\s+(?:de|del))?\s+(\d{4})$/i)
  if (textMatch) {
    const day = parseInt(textMatch[1], 10)
    const monthName = textMatch[2].normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const month = SPANISH_MONTHS[monthName]
    const year = parseInt(textMatch[3], 10)
    if (month && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      return { year, month, day }
    }
  }

  // Format: "15/03/2024" or "15-03-2024" (DD/MM/YYYY)
  const slashMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10)
    const month = parseInt(slashMatch[2], 10)
    const year = parseInt(slashMatch[3], 10)
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      return { year, month, day }
    }
  }

  // ISO Format: "2024-03-15" (YYYY-MM-DD)
  const isoMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10)
    const month = parseInt(isoMatch[2], 10)
    const day = parseInt(isoMatch[3], 10)
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      return { year, month, day }
    }
  }

  return null
}

export function areValuesSemanticallyEqual(a: string, b: string): boolean {
  if (a === b) return true

  const normA = a.trim().replace(/\s+/g, ' ')
  const normB = b.trim().replace(/\s+/g, ' ')

  // 1. Case-insensitive equality (e.g. ALL CAPS vs Title Case)
  if (normA.toLowerCase() === normB.toLowerCase()) {
    return true
  }

  // 2. Date equality (e.g. "15 de marzo de 2024" vs "15/03/2024")
  const dateA = parseSpanishDate(normA)
  const dateB = parseSpanishDate(normB)
  if (dateA && dateB) {
    return dateA.year === dateB.year && dateA.month === dateB.month && dateA.day === dateB.day
  }

  // 3. Monetary / pure number format equality (e.g. "$ 10.000.000" vs "10.000.000")
  const cleanDigitsA = normA.replace(/[$\s,.]/g, '')
  const cleanDigitsB = normB.replace(/[$\s,.]/g, '')
  if (cleanDigitsA && cleanDigitsB && cleanDigitsA === cleanDigitsB && /^\d+$/.test(cleanDigitsA)) {
    return true
  }

  return false
}

export function getFieldVisualStatus(field: ComparedField): VisualStatus {
  const leftVal = field.left?.value?.trim() ?? ''
  const rightVal = field.right?.value?.trim() ?? ''

  if (!leftVal || !rightVal) {
    return 'absent'
  }

  // If semantically equal (case insensitivity, date equivalents, formatting) -> exact
  if (areValuesSemanticallyEqual(leftVal, rightVal)) {
    return 'exact'
  }

  // If both are dates but they differ in day/month/year -> different
  const dateA = parseSpanishDate(leftVal)
  const dateB = parseSpanishDate(rightVal)
  if (dateA && dateB && (dateA.year !== dateB.year || dateA.month !== dateB.month || dateA.day !== dateB.day)) {
    return 'different'
  }

  return field.status
}

const statusText: Record<VisualStatus, string> = {
  exact: 'Coincide exactamente',
  near: 'Coincidencia cercana',
  different: 'No coincide (valores distintos)',
  absent: 'No coincide (no encontrado en un documento)',
}
const jobText = { queued: 'En cola', running: 'Analizando', completed: 'Terminado', failed: 'Falló' }
const errorText: Record<string, string> = {
  SOURCE_NOT_FOUND: 'Uno de los originales ya no está disponible. Vuelva a seleccionar los documentos.',
  SOURCE_DOWNLOAD_FAILED: 'No se pudo descargar un original desde el almacenamiento. Vuelva a intentar.',
  UNSUPPORTED_FORMAT: 'Uno de los originales no es PDF ni DOCX.',
  NO_EXTRACTABLE_TEXT: 'No hay texto extraíble. Un PDF escaneado requiere OCR antes de compararse.',
  DOCUMENT_TOO_LONG: 'El texto excede el límite de esta primera versión (60 000 caracteres por documento).',
  NO_VERIFIABLE_FIELDS: 'La IA no encontró atributos con citas comprobables en los originales.',
  INVALID_AI_RESPONSE: 'La IA devolvió una respuesta inválida. Intente de nuevo.',
  AI_NOT_CONFIGURED: 'El proveedor de IA no está configurado en el worker.',
  AI_RATE_LIMITED: 'El proveedor de IA limitó las solicitudes. Espere un momento y vuelva a intentar.',
  AI_AUTH_FAILED: 'El proveedor de IA rechazó la clave del worker. Revise su configuración.',
  AI_MODEL_UNAVAILABLE: 'El modelo de IA configurado no está disponible para esta clave.',
  AI_PROVIDER_UNAVAILABLE: 'El proveedor de IA tuvo un error temporal. Vuelva a intentar.',
  AI_CONNECTION_FAILED: 'El worker no pudo comunicarse con el proveedor de IA. Vuelva a intentar.',
  AI_REQUEST_REJECTED: 'El proveedor de IA rechazó la solicitud. Revise su configuración.',
  WORKER_RETRIES_EXHAUSTED: 'El worker se interrumpió varias veces durante este análisis.',
}

function shortName(document: ComparisonDocument | undefined) {
  return document?.document_label || document?.original_name || 'Archivo retirado'
}

export function DocumentComparisonView({
  project,
  onActiveComparisonChange,
}: {
  project: Project
  onActiveComparisonChange?: (active: boolean) => void
}) {
  const [screen, setScreen] = useState<'setup' | 'results'>('setup')
  const [documents, setDocuments] = useState<ComparisonDocument[]>([])
  const [jobs, setJobs] = useState<ComparisonJob[]>([])
  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')
  const [activeJobId, setActiveJobId] = useState('')
  const [activeFieldKey, setActiveFieldKey] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const remote = dataMode === 'supabase'

  const refresh = useCallback(async () => {
    if (!remote) { setLoading(false); return }
    const [nextDocuments, nextJobs] = await Promise.all([
      listComparisonDocuments(project.id), listComparisonJobs(project.id),
    ])
    setDocuments(nextDocuments); setJobs(nextJobs); setLoading(false); setLoadError(null)
  }, [project.id, remote])

  useEffect(() => {
    setLoading(true); setLoadError(null); setDocuments([]); setJobs([]); setLeftId(''); setRightId(''); setActiveJobId('')
    void refresh().catch((caught) => {
      setLoading(false); setLoadError(describeComparisonError(caught, 'No se pudo cargar el módulo.'))
    })
  }, [refresh])

  const hasPending = jobs.some((job) => job.status === 'queued' || job.status === 'running')
  useEffect(() => {
    if (!hasPending) return
    const interval = window.setInterval(() => void refresh().catch(() => undefined), 4000)
    return () => window.clearInterval(interval)
  }, [hasPending, refresh])

  const activeJob = jobs.find((job) => job.id === activeJobId) ?? null

  const prevStatusRef = useRef<string | null>(null)
  useEffect(() => {
    if (activeJob) {
      if (prevStatusRef.current && (prevStatusRef.current === 'queued' || prevStatusRef.current === 'running') && activeJob.status === 'completed') {
        toast.success('Cotejo completado exitosamente.')
      }
      prevStatusRef.current = activeJob.status
    } else {
      prevStatusRef.current = null
    }
  }, [activeJob])

  // Notificar al contenedor principal para contraer la sidebar al visualizar la comparación
  useEffect(() => {
    if (screen === 'results' && activeJob) {
      onActiveComparisonChange?.(true)
    } else if (screen === 'setup') {
      onActiveComparisonChange?.(false)
    }
  }, [screen, Boolean(activeJob), onActiveComparisonChange])

  useEffect(() => {
    return () => {
      onActiveComparisonChange?.(false)
    }
  }, [onActiveComparisonChange])
  const activeDocuments = documents.filter((document) => document.is_active)
  const shownLeftId = activeJob?.left_document_id ?? leftId
  const shownRightId = activeJob?.right_document_id ?? rightId
  const left = documents.find((document) => document.id === shownLeftId)
  const right = documents.find((document) => document.id === shownRightId)
  const fields = activeJob?.result?.fields ?? []
  const activeField = fields.find((field) => field.key === activeFieldKey) ?? null
  const canCompare = leftId && rightId && leftId !== rightId && !busy && remote && !loadError
  const recentJobs = useMemo(() => jobs.slice(0, 8), [jobs])

  const visualCounts = useMemo(() => {
    let exact = 0, near = 0, different = 0, absent = 0
    for (const f of fields) {
      const s = getFieldVisualStatus(f)
      if (s === 'exact') exact++
      else if (s === 'near') near++
      else if (s === 'different') different++
      else if (s === 'absent') absent++
    }
    return { exact, near, different, absent }
  }, [fields])

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    if (activeDocuments.length + files.length > 10) {
      setError('Este espacio admite hasta diez documentos activos. Retira uno antes de añadir más.')
      return
    }
    setBusy(true); setError(null)
    try {
      for (const [index, file] of Array.from(files).entries()) {
        await uploadComparisonDocument(project.id, file, '', (percent) => setUploadProgress(`${index + 1}/${files.length} · ${file.name} · ${percent}%`))
      }
      await refresh()
      toast.success(files.length === 1 ? `Archivo "${files[0].name}" cargado exitosamente.` : `${files.length} archivos cargados exitosamente.`)
    } catch (caught) {
      await refresh()
      setError(describeComparisonError(caught, 'Falló la carga del archivo.'))
    } finally { setBusy(false); setUploadProgress(null) }
  }

  const compare = async () => {
    if (!canCompare) return
    setBusy(true); setError(null); setActiveFieldKey('')
    try {
      const jobId = await requestComparison(leftId, rightId)
      setActiveJobId(jobId)
      setScreen('results')
      await refresh()
      toast.success('Cotejo iniciado en el worker.')
    } catch (caught) {
      setError(describeComparisonError(caught, 'No fue posible iniciar la comparación.'))
    } finally { setBusy(false) }
  }

  const retire = async (document: ComparisonDocument) => {
    if (!window.confirm(`¿Retirar ${document.original_name} de la lista activa? Los análisis anteriores se conservarán.`)) return
    setBusy(true); setError(null)
    try {
      await retireComparisonDocument(document)
      if (leftId === document.id) setLeftId('')
      if (rightId === document.id) setRightId('')
      await refresh()
      toast.success(`Archivo "${document.original_name}" retirado exitosamente.`)
    } catch (caught) {
      setError(describeComparisonError(caught, 'No se pudo retirar el archivo.'))
    } finally { setBusy(false) }
  }

  if (screen === 'results' && activeJob) {
    return (
      <div className="comparison-workspace is-results-screen">
        <section className="comparison-results" aria-live="polite">
          <div className="comparison-results-toolbar">
            <div className="comparison-toolbar-left">
              <button
                type="button"
                className="comparison-back-btn"
                onClick={() => setScreen('setup')}
                title="Volver a la selección de documentos"
              >
                <ArrowLeft size={13} />
                <span>Volver al comparador</span>
              </button>
              <div className="comparison-toolbar-separator" aria-hidden="true" />
              <div className="comparison-toolbar-title-group">
                <span className="comparison-kicker-tag"><Scale size={12} /> ANÁLISIS</span>
                <h2 className="comparison-toolbar-title">Lectura paralela</h2>
                <span className={`comparison-job-status is-${activeJob.status}`}>
                  {activeJob.status === 'completed' ? <CheckCircle2 size={13} /> : activeJob.status === 'failed' ? <CircleAlert size={13} /> : <LoaderCircle size={13} className="spin" />}
                  {jobText[activeJob.status]}
                </span>
              </div>
            </div>

            {activeJob.result && (
              <div className="comparison-counts">
                <span className="is-exact">{visualCounts.exact} exactos</span>
                <span className="is-near">{visualCounts.near} cercanos</span>
                {visualCounts.different > 0 && <span className="is-different">{visualCounts.different} distintos</span>}
                {visualCounts.absent > 0 && <span className="is-absent">{visualCounts.absent} no encontrados</span>}
              </div>
            )}
          </div>

          {activeJob.status === 'failed' && <div className="comparison-error" role="alert">{errorText[activeJob.error_code ?? ''] ?? 'No se pudo completar. Intente de nuevo o revise el worker.'}</div>}
          {activeJob.result && Object.values(activeJob.result.documents).some((document) => document.scan_status !== 'textual') && <div className="comparison-notice" role="status"><CircleAlert size={17} />Algunas páginas pueden no tener texto extraíble. El cotejo solo cubre la evidencia que pudo leerse; revise también las páginas escaneadas.</div>}

          <div className="comparison-review-grid">
            <aside className="comparison-findings">
              <div className="comparison-findings-heading">
                <strong>Atributos detectados</strong>
                <span>{fields.length}</span>
              </div>
              {fields.length ? (
                <ul className="comparison-findings-list">
                  {fields.map((field: ComparedField) => {
                    const isSelected = field.key === activeFieldKey
                    const isExpanded = expandedKeys.has(field.key)
                    const visualStatus = getFieldVisualStatus(field)
                    return (
                      <li key={field.key} className={`comparison-finding-item ${isSelected ? 'is-selected' : ''} ${isExpanded ? 'is-expanded' : ''}`}>
                        <div className={`comparison-finding-row ${isSelected ? 'is-selected' : ''}`}>
                          <button
                            type="button"
                            className="comparison-finding-select"
                            onClick={() => setActiveFieldKey(field.key)}
                            aria-pressed={isSelected}
                          >
                            <span className={`comparison-status-dot is-${visualStatus}`} aria-hidden="true" />
                            <span className="comparison-finding-title" title={field.label}>{field.label}</span>
                          </button>
                          <button
                            type="button"
                            className={`comparison-toggle-arrow ${isExpanded ? 'is-open' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedKeys((prev) => {
                                const next = new Set(prev)
                                if (next.has(field.key)) next.delete(field.key)
                                else next.add(field.key)
                                return next
                              })
                            }}
                            title={isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
                            aria-label={isExpanded ? `Ocultar detalles de ${field.label}` : `Ver detalles de ${field.label}`}
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="comparison-finding-details">
                            <div className="comparison-detail-attribute">
                              <span className="comparison-detail-attribute-label">Atributo completo</span>
                              <strong className="comparison-detail-full-name">{field.label}</strong>
                            </div>
                            <div className="comparison-detail-status">
                              <span className={`comparison-status-tag is-${visualStatus}`}>
                                {visualStatus === 'absent'
                                  ? (!field.left?.value ? 'No encontrado en Doc A' : !field.right?.value ? 'No encontrado en Doc B' : statusText.absent)
                                  : statusText[visualStatus]}
                              </span>
                            </div>
                            <div className="comparison-values">
                              <div className="comparison-value-row">
                                <span className="comparison-val-label">Doc A:</span>
                                <span className={`comparison-val-text ${!field.left?.value ? 'is-missing' : ''}`} title={field.left?.value ?? 'No encontrado'}>
                                  {field.left?.value ?? 'No encontrado'}
                                </span>
                              </div>
                              <div className="comparison-value-row">
                                <span className="comparison-val-label">Doc B:</span>
                                <span className={`comparison-val-text ${!field.right?.value ? 'is-missing' : ''}`} title={field.right?.value ?? 'No encontrado'}>
                                  {field.right?.value ?? 'No encontrado'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="comparison-empty">Los atributos aparecerán aquí cuando termine el análisis.</p>
              )}
              {activeJob.result && <p className="comparison-review-note">{activeJob.result.disclaimer}</p>}
            </aside>

            <div className="comparison-originals">
              {left ? (
                <OriginalViewer key={left.id} document={left} evidence={activeField?.left ?? null} status={activeField?.status ?? null} side="left" activeFieldLabel={activeField?.label} />
              ) : (
                <div className="comparison-missing">El documento A ya no está en la lista activa.</div>
              )}
              {right ? (
                <OriginalViewer key={right.id} document={right} evidence={activeField?.right ?? null} status={activeField?.status ?? null} side="right" activeFieldLabel={activeField?.label} />
              ) : (
                <div className="comparison-missing">El documento B ya no está en la lista activa.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="comparison-workspace">
      <header className="comparison-intro">
        <div>
          <p className="comparison-kicker"><Scale size={15} /> COTEJO DOCUMENTAL</p>
          <h1>Compare el dato. Compruebe la fuente.</h1>
          <p>Seleccione dos originales del proyecto, revise cada hallazgo y vuelva al fragmento que lo respalda.</p>
        </div>
        <div className="comparison-capacity">
          <strong>{activeDocuments.length}<span> / 10</span></strong>
          <small>documentos activos</small>
        </div>
      </header>

      {!remote && <div className="comparison-notice" role="status"><CircleAlert size={18} />El cotejo requiere la conexión segura de Supabase y el worker. El modo local no genera resultados simulados.</div>}
      {loadError && <div className="comparison-error" role="alert"><CircleAlert size={18} /><span>{loadError}</span><button type="button" className="comparison-retry" onClick={() => { setLoading(true); void refresh().catch((caught) => { setLoading(false); setLoadError(describeComparisonError(caught, 'No se pudo cargar el módulo.')) }) }}>Reintentar</button></div>}
      {error && <div className="comparison-error" role="alert"><CircleAlert size={18} /><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="Cerrar error">×</button></div>}

      <div className="comparison-setup">
        <section className="comparison-card comparison-files">
          <div className="comparison-card-heading"><div><span className="comparison-step">01</span><h2>Originales disponibles</h2></div><span>PDF y DOCX · 50 MB máx.</span></div>
          <label className={`comparison-upload ${!remote || busy || loading || loadError || activeDocuments.length >= 10 ? 'is-disabled' : ''}`}>
            <UploadCloud size={21} /><span><strong>Añadir documentos</strong><small>Puede seleccionar varios archivos</small></span>
            <input type="file" multiple accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={!remote || busy || loading || !!loadError || activeDocuments.length >= 10} onChange={(event) => { void upload(event.target.files); event.target.value = '' }} />
          </label>
          {uploadProgress && <p className="comparison-subtle" role="status"><LoaderCircle size={16} className="spin" />{uploadProgress}</p>}
          {loading ? <p className="comparison-subtle"><LoaderCircle size={16} className="spin" /> Cargando documentos…</p> : activeDocuments.length === 0 ? <p className="comparison-empty"><FilePlus2 size={20} />Todavía no hay documentos para este proyecto.</p> :
            <ul className="comparison-document-list">{activeDocuments.map((document, index) => <li key={document.id}><span className="comparison-file-index">{String(index + 1).padStart(2, '0')}</span><div><strong title={document.original_name}>{shortName(document)}</strong><small>{document.mime_type === 'application/pdf' ? 'PDF' : 'DOCX'} · {(document.size_bytes / 1024 / 1024).toFixed(1)} MB</small></div><button type="button" disabled={busy} onClick={() => void retire(document)} aria-label={`Retirar ${document.original_name}`} title="Retirar de la lista"><Trash2 size={15} /></button></li>)}</ul>}
        </section>

        <section className="comparison-card comparison-pair">
          <div className="comparison-card-heading"><div><span className="comparison-step">02</span><h2>Elegir el par</h2></div><span>Uno contra uno</span></div>
          <div className="comparison-selects">
            <label>Documento A<select value={leftId} disabled={!remote || busy} onChange={(event) => { setLeftId(event.target.value); setActiveJobId(''); setActiveFieldKey('') }}><option value="">Seleccione el primer archivo</option>{activeDocuments.map((document) => <option key={document.id} value={document.id}>{shortName(document)}</option>)}</select></label>
            <ArrowRight size={18} aria-hidden="true" />
            <label>Documento B<select value={rightId} disabled={!remote || busy} onChange={(event) => { setRightId(event.target.value); setActiveJobId(''); setActiveFieldKey('') }}><option value="">Seleccione el segundo archivo</option>{activeDocuments.filter((document) => document.id !== leftId).map((document) => <option key={document.id} value={document.id}>{shortName(document)}</option>)}</select></label>
          </div>
          {leftId && rightId && leftId === rightId && <p className="comparison-validation">Seleccione dos archivos distintos.</p>}
          <div className="comparison-pair-actions">
            <button className="comparison-run" type="button" disabled={!canCompare} onClick={() => void compare()}>
              {busy ? <LoaderCircle size={17} className="spin" /> : <Scale size={17} />}
              Analizar coincidencias
            </button>
            {activeJob && (
              <button
                type="button"
                className="comparison-view-results-btn"
                onClick={() => setScreen('results')}
              >
                <Eye size={17} />
                Ver resultados
              </button>
            )}
          </div>
          <p className="comparison-footnote">El cotejo se ejecuta en segundo plano. Los archivos originales no se modifican.</p>
          {recentJobs.length > 0 && (
            <div className="comparison-history">
              <h3>Comparaciones recientes</h3>
              <div className="comparison-history-list">
                {recentJobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    className={job.id === activeJobId ? 'is-active' : ''}
                    onClick={() => {
                      setActiveJobId(job.id)
                      setActiveFieldKey('')
                      setScreen('results')
                    }}
                  >
                    <span>
                      <Files size={14} />
                      {shortName(documents.find((item) => item.id === job.left_document_id))} · {shortName(documents.find((item) => item.id === job.right_document_id))}
                    </span>
                    <small>{jobText[job.status]}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
