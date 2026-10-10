import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CircleAlert, Eye, FilePlus2, Files, LoaderCircle, Scale, Trash2, UploadCloud } from 'lucide-react'
import { toast } from '../ui/ToastLayer'
import { dataMode } from '../../lib/supabase'
import type { Project } from '../../types'
import {
  describeComparisonError, listComparisonDocuments, listComparisonJobs, requestComparison, retireComparisonDocument,
  uploadComparisonDocument, type ComparisonDocument, type ComparisonJob,
} from '../../data/documentComparison'
import { ComparisonResults, jobText } from './ComparisonResults'
import './document-comparison.css'

// Pantalla de resultados compartida con el modal de planos; se reexportan sus utilidades.
export { areValuesSemanticallyEqual, getFieldVisualStatus, parseSpanishDate, type VisualStatus } from './ComparisonResults'

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
  const canCompare = leftId && rightId && leftId !== rightId && !busy && remote && !loadError
  const recentJobs = useMemo(() => jobs.slice(0, 8), [jobs])

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
    setBusy(true); setError(null)
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
    return <ComparisonResults key={activeJob.id} job={activeJob} left={left} right={right} onBack={() => setScreen('setup')} />
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
            <label>Documento A<select value={leftId} disabled={!remote || busy} onChange={(event) => { setLeftId(event.target.value); setActiveJobId('') }}><option value="">Seleccione el primer archivo</option>{activeDocuments.map((document) => <option key={document.id} value={document.id}>{shortName(document)}</option>)}</select></label>
            <ArrowRight size={18} aria-hidden="true" />
            <label>Documento B<select value={rightId} disabled={!remote || busy} onChange={(event) => { setRightId(event.target.value); setActiveJobId('') }}><option value="">Seleccione el segundo archivo</option>{activeDocuments.filter((document) => document.id !== leftId).map((document) => <option key={document.id} value={document.id}>{shortName(document)}</option>)}</select></label>
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
