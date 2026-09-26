import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, FileWarning, LoaderCircle, MapPin, ZoomIn, ZoomOut } from 'lucide-react'
import * as pdfjs from 'pdfjs-dist'
import { renderAsync } from 'docx-preview'
import type { ComparisonDocument, Evidence, MatchStatus } from '../../data/documentComparison'
import { downloadComparisonOriginal } from '../../data/documentComparison'
import { clearEvidence, highlightEvidence } from './highlight'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

interface Props {
  document: ComparisonDocument
  evidence: Evidence | null
  status: MatchStatus | null
  side: 'left' | 'right'
}

export function OriginalViewer({ document: source, evidence, status, side }: Props) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [pdf, setPdf] = useState<pdfjs.PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [rendered, setRendered] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [located, setLocated] = useState<boolean | null>(null)
  const [zoom, setZoom] = useState(0.75)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setBlob(null); setPdf(null); setError(null); setPage(1)
    void downloadComparisonOriginal(source).then((value) => {
      if (!cancelled) setBlob(value)
    }).catch(() => { if (!cancelled) setError('No se pudo abrir el original protegido.') })
    return () => { cancelled = true; clearEvidence(side) }
  }, [source.id, source.storage_path, side])

  useEffect(() => {
    if (!blob || source.mime_type !== 'application/pdf') return
    let cancelled = false
    let loadingTask: pdfjs.PDFDocumentLoadingTask | null = null
    void blob.arrayBuffer().then((buffer) => {
      loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) })
      return loadingTask.promise
    })
      .then((value) => { if (!cancelled) setPdf(value) })
      .catch(() => { if (!cancelled) setError('El PDF no se pudo representar.') })
    return () => { cancelled = true; if (loadingTask) void loadingTask.destroy() }
  }, [blob, source.mime_type])

  useEffect(() => {
    if (evidence?.page && pdf && evidence.page <= pdf.numPages) setPage(evidence.page)
  }, [evidence?.page, pdf])

  useEffect(() => {
    const root = bodyRef.current
    if (!root || !blob) return
    let cancelled = false
    root.replaceChildren()
    clearEvidence(side)
    if (source.mime_type === 'application/pdf') {
      if (!pdf) return
      let renderTask: pdfjs.RenderTask | null = null
      void pdf.getPage(page).then(async (pdfPage) => {
        if (cancelled) return
        const viewport = pdfPage.getViewport({ scale: zoom })
        const sheet = document.createElement('div')
        sheet.className = 'comparison-pdf-sheet'
        sheet.style.width = `${viewport.width}px`
        sheet.style.height = `${viewport.height}px`
        sheet.style.setProperty('--scale-factor', String(viewport.scale))
        sheet.style.setProperty('--total-scale-factor', String(viewport.scale))
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width * devicePixelRatio)
        canvas.height = Math.ceil(viewport.height * devicePixelRatio)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        const textLayer = document.createElement('div')
        textLayer.className = 'textLayer'
        sheet.append(canvas, textLayer)
        root.append(sheet)
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas unavailable')
        renderTask = pdfPage.render({ canvas, canvasContext: context, viewport, transform: [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0] })
        await renderTask.promise
        const layer = new pdfjs.TextLayer({ textContentSource: await pdfPage.getTextContent(), container: textLayer, viewport })
        await layer.render()
        if (!cancelled) setRendered((value) => value + 1)
      }).catch(() => { if (!cancelled) setError('No se pudo representar la página del PDF.') })
      return () => { cancelled = true; renderTask?.cancel(); root.replaceChildren() }
    }
    const wrapper = document.createElement('div')
    wrapper.className = 'comparison-docx-zoom-wrapper'
    wrapper.style.transform = `scale(${zoom})`
    wrapper.style.transformOrigin = 'top center'
    wrapper.style.width = 'fit-content'
    wrapper.style.margin = '0 auto'
    const staging = document.createElement('div')
    void renderAsync(blob, staging, staging, { breakPages: true, renderHeaders: true, renderFooters: true })
      .then(() => {
        if (!cancelled) {
          wrapper.replaceChildren(...Array.from(staging.childNodes))
          root.replaceChildren(wrapper)
          setRendered((value) => value + 1)
        }
      })
      .catch(() => { if (!cancelled) setError('El DOCX no se pudo representar.') })
    return () => { cancelled = true; root.replaceChildren() }
  }, [blob, pdf, page, source.mime_type, side, zoom])

  useEffect(() => {
    if (!bodyRef.current || !status || !evidence) { setLocated(null); clearEvidence(side); return }
    if (source.mime_type === 'application/pdf' && evidence.page !== page) return
    setLocated(highlightEvidence(bodyRef.current, evidence, status, side))
    return () => clearEvidence(side)
  }, [evidence, status, rendered, page, side, source.mime_type])

  const download = () => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = source.original_name; anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const zoomIn = () => setZoom((prev) => Math.min(1.8, Math.round((prev + 0.1) * 10) / 10))
  const zoomOut = () => setZoom((prev) => Math.max(0.4, Math.round((prev - 0.1) * 10) / 10))

  return <section className="comparison-original" aria-label={`Original ${side === 'left' ? 'A' : 'B'}: ${source.original_name}`}>
    <div className="comparison-original-header">
      <div className="comparison-doc-title">
        <span className="comparison-side-tag">DOCUMENTO {side === 'left' ? 'A' : 'B'}</span>
        <strong title={source.original_name}>{source.original_name}</strong>
      </div>
      <div className="comparison-header-actions">
        <div className="comparison-zoom-bar" role="group" aria-label="Controles de zoom">
          <button type="button" onClick={zoomOut} disabled={zoom <= 0.4} title="Alejar (Zoom out)" aria-label="Alejar">
            <ZoomOut size={14} />
          </button>
          <span className="comparison-zoom-label">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={zoomIn} disabled={zoom >= 1.8} title="Acercar (Zoom in)" aria-label="Acercar">
            <ZoomIn size={14} />
          </button>
        </div>
        <button type="button" className="comparison-action-btn" onClick={download} disabled={!blob} aria-label={`Descargar ${source.original_name}`} title="Descargar documento">
          <Download size={14} />
        </button>
      </div>
    </div>

    <div className="comparison-sub-bar">
      <div className="comparison-location-pill" title={evidence?.location ?? 'Vista general'}>
        <MapPin size={12} aria-hidden="true" />
        <span>{evidence?.location ?? 'Vista general'}{located === false ? ' · Cita verificada, no localizada' : ''}</span>
      </div>
      {pdf ? (
        <div className="comparison-page-controls">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} title="Página anterior" aria-label="Página anterior">
            <ChevronLeft size={13} />
          </button>
          <span>Pág. {page} de {pdf.numPages}</span>
          <button type="button" disabled={page >= pdf.numPages} onClick={() => setPage(page + 1)} title="Página siguiente" aria-label="Página siguiente">
            <ChevronRight size={13} />
          </button>
        </div>
      ) : (
        <div className="comparison-format-badge">
          <span>DOCX · Flujo continuo</span>
        </div>
      )}
    </div>

    {error ? (
      <div className="comparison-preview-state" role="alert"><FileWarning size={22} />{error}</div>
    ) : !blob ? (
      <div className="comparison-preview-state"><LoaderCircle size={22} className="spin" />Abriendo original…</div>
    ) : null}
    <div className="comparison-original-body" ref={bodyRef} />
  </section>
}
