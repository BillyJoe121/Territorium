import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, CircleSlash, Download, FileWarning, LoaderCircle, MapPin, X, ZoomIn, ZoomOut } from 'lucide-react'
import * as pdfjs from 'pdfjs-dist'
import { renderAsync } from 'docx-preview'
import type { ComparisonDocument, Evidence, MatchStatus } from '../../data/documentComparison'
import { downloadComparisonOriginal } from '../../data/documentComparison'
import { clearEvidence, highlightEvidence } from './highlight'
import { renderXlsxPreview, XLSX_MIME } from './xlsxPreview'
import './document-comparison.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

/** Lo mínimo que el visor necesita de un archivo del bucket source-documents. */
export type ViewerDocument = Pick<ComparisonDocument, 'id' | 'storage_path' | 'original_name' | 'mime_type'>

interface Props {
  document: ViewerDocument
  evidence?: Evidence | null
  status?: MatchStatus | null
  side?: 'left' | 'right'
  activeFieldLabel?: string
  /** 'preview': solo zoom, páginas y cerrar; sin título, ubicación ni descarga. */
  variant?: 'comparison' | 'preview'
  /** Origen alterno del archivo (p. ej. un File local); por defecto se descarga del bucket. */
  loadBlob?: () => Promise<Blob>
  onClose?: () => void
}

export function OriginalViewer({
  document: source,
  evidence = null,
  status = null,
  side = 'left',
  activeFieldLabel,
  variant = 'comparison',
  loadBlob,
  onClose,
}: Props) {
  const isPreview = variant === 'preview'
  const loadBlobRef = useRef(loadBlob)
  loadBlobRef.current = loadBlob
  const [blob, setBlob] = useState<Blob | null>(null)
  const [pdf, setPdf] = useState<pdfjs.PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [rendered, setRendered] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [located, setLocated] = useState<boolean | null>(null)
  const [zoom, setZoom] = useState(1.0)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setBlob(null); setPdf(null); setError(null); setPage(1)
    void (loadBlobRef.current ? loadBlobRef.current() : downloadComparisonOriginal(source)).then((value) => {
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
        textLayer.style.setProperty('--scale-factor', String(viewport.scale))
        textLayer.style.setProperty('--total-scale-factor', String(viewport.scale))
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
    if (source.mime_type.startsWith('image/')) {
      // Con zoom 100 % la imagen ocupa el ancho del visor; los planos escaneados suelen ser enormes.
      const url = URL.createObjectURL(blob)
      const image = document.createElement('img')
      image.className = 'comparison-image-sheet'
      image.alt = source.original_name
      image.style.width = `${zoom * 100}%`
      image.onload = () => { if (!cancelled) setRendered((value) => value + 1) }
      image.onerror = () => { if (!cancelled) setError('La imagen no se pudo representar.') }
      image.src = url
      root.append(image)
      return () => { cancelled = true; URL.revokeObjectURL(url); root.replaceChildren() }
    }
    const wrapper = document.createElement('div')
    wrapper.className = 'comparison-docx-zoom-wrapper'
    wrapper.style.transform = `scale(${zoom})`
    wrapper.style.transformOrigin = 'top center'
    wrapper.style.width = 'fit-content'
    wrapper.style.margin = '0 auto'
    const staging = document.createElement('div')
    const isXlsx = source.mime_type === XLSX_MIME
    const rendering = isXlsx
      ? renderXlsxPreview(blob, staging)
      : renderAsync(blob, staging, staging, { breakPages: true, renderHeaders: true, renderFooters: true })
    void rendering
      .then(() => {
        if (!cancelled) {
          wrapper.replaceChildren(...Array.from(staging.childNodes))
          root.replaceChildren(wrapper)
          setRendered((value) => value + 1)
        }
      })
      .catch(() => { if (!cancelled) setError(isXlsx ? 'El XLSX no se pudo representar.' : 'El DOCX no se pudo representar.') })
    return () => { cancelled = true; root.replaceChildren() }
  }, [blob, pdf, page, source.mime_type, side, zoom])

  useEffect(() => {
    if (!bodyRef.current || !status || !evidence) { setLocated(null); clearEvidence(side); return }
    if (source.mime_type === 'application/pdf' && evidence.page !== page) return
    setLocated(highlightEvidence(bodyRef.current, evidence, status, side))
    return () => clearEvidence(side)
  }, [evidence, status, rendered, page, side, source.mime_type])

  const containerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // 1. Wheel listener: on trackpads (Windows Precision, Mac trackpad), pinch-to-zoom emits wheel with ctrlKey=true
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        e.stopPropagation()
        const zoomDelta = -e.deltaY * 0.003
        setZoom((prev) => {
          const next = Math.round((prev + zoomDelta) * 100) / 100
          return Math.min(2.5, Math.max(0.3, next))
        })
      }
    }

    // 2. Touch gesture listener: for touchscreens / tablets / 2-in-1 laptops
    let touchDistance = 0
    let touchStartZoom = zoom

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        touchDistance = Math.hypot(dx, dy)
        touchStartZoom = zoom
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchDistance > 0) {
        e.preventDefault()
        e.stopPropagation()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const currentDist = Math.hypot(dx, dy)
        const factor = currentDist / touchDistance
        const next = Math.round(touchStartZoom * factor * 100) / 100
        setZoom(Math.min(2.5, Math.max(0.3, next)))
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        touchDistance = 0
      }
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchmove', onTouchMove, { passive: false })
    container.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('wheel', onWheel)
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
    }
  }, [zoom])

  const download = () => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = source.original_name; anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const zoomIn = () => setZoom((prev) => Math.min(2.5, Math.round((prev + 0.1) * 10) / 10))
  const zoomOut = () => setZoom((prev) => Math.max(0.3, Math.round((prev - 0.1) * 10) / 10))

  const zoomBar = (
    <div className="comparison-zoom-bar" role="group" aria-label="Controles de zoom">
      <button type="button" onClick={zoomOut} disabled={zoom <= 0.3} title="Alejar (Zoom out)" aria-label="Alejar">
        <ZoomOut size={14} />
      </button>
      <span className="comparison-zoom-label">{Math.round(zoom * 100)}%</span>
      <button type="button" onClick={zoomIn} disabled={zoom >= 2.5} title="Acercar (Zoom in)" aria-label="Acercar">
        <ZoomIn size={14} />
      </button>
    </div>
  )

  const pageControls = pdf ? (
    <div className="comparison-page-controls">
      <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} title="Página anterior" aria-label="Página anterior">
        <ChevronLeft size={13} />
      </button>
      <span>Pág. {page} de {pdf.numPages}</span>
      <button type="button" disabled={page >= pdf.numPages} onClick={() => setPage(page + 1)} title="Página siguiente" aria-label="Página siguiente">
        <ChevronRight size={13} />
      </button>
    </div>
  ) : null

  const previewState = error ? (
    <div className="comparison-preview-state" role="alert"><FileWarning size={22} />{error}</div>
  ) : !blob ? (
    <div className="comparison-preview-state"><LoaderCircle size={22} className="spin" />Abriendo original…</div>
  ) : null

  if (isPreview) {
    return <section className="comparison-original is-preview" ref={containerRef} aria-label={`Vista previa: ${source.original_name}`}>
      <div className="comparison-original-header">
        <div>{pageControls}</div>
        <div className="comparison-header-actions">
          {zoomBar}
          {onClose && (
            <button type="button" className="comparison-action-btn" onClick={onClose} title="Cerrar" aria-label="Cerrar visualizador">
              <X size={15} />
            </button>
          )}
        </div>
      </div>
      {previewState}
      <div className="comparison-original-body" ref={bodyRef} />
    </section>
  }

  return <section className="comparison-original" ref={containerRef} aria-label={`Original ${side === 'left' ? 'A' : 'B'}: ${source.original_name}`}>
    <div className="comparison-original-header">
      <div className="comparison-doc-title">
        <span className="comparison-side-tag">DOCUMENTO {side === 'left' ? 'A' : 'B'}</span>
        <strong title={source.original_name}>{source.original_name}</strong>
      </div>
      <div className="comparison-header-actions">
        {zoomBar}
        <button type="button" className="comparison-action-btn" onClick={download} disabled={!blob} aria-label={`Descargar ${source.original_name}`} title="Descargar documento">
          <Download size={14} />
        </button>
      </div>
    </div>

    <div className="comparison-sub-bar">
      {activeFieldLabel && (!evidence || !evidence.value) ? (
        <div className="comparison-location-pill is-absent" title={`No encontrado en ${side === 'left' ? 'Documento A' : 'Documento B'}`}>
          <CircleSlash size={12} aria-hidden="true" />
          <span>No encontrado en este documento</span>
        </div>
      ) : (
        <div className="comparison-location-pill" title={evidence?.location ?? 'Vista general'}>
          <MapPin size={12} aria-hidden="true" />
          <span>{evidence?.location ?? 'Vista general'}{located === false ? ' · Cita verificada, no localizada' : ''}</span>
        </div>
      )}
      {pageControls ?? (
        <div className="comparison-format-badge">
          <span>DOCX · Flujo continuo</span>
        </div>
      )}
    </div>

    {activeFieldLabel && (!evidence || !evidence.value) ? (
      <div className="comparison-absent-notice" role="status">
        <CircleSlash size={14} aria-hidden="true" />
        <span>
          El atributo <strong>{activeFieldLabel}</strong> no fue localizado en este documento (disponible en el otro).
        </span>
      </div>
    ) : null}

    {previewState}
    <div className="comparison-original-body" ref={bodyRef} />
  </section>
}
