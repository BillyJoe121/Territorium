import { renderAsync } from 'docx-preview'
import { LoaderCircle, ZoomIn, ZoomOut } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { paginateRenderedDocx } from '../../lib/docxPreviewPdf'

export interface DocumentDocxViewerHandle {
  /** Hojas renderizadas, en el mismo orden y formato que se ven en pantalla. */
  getPages: () => HTMLElement[]
}

interface DocumentDocxViewerProps {
  docx: Blob | null
  ariaLabel?: string
}

/** Visualizador de solo lectura del .docx que se descarga. */
export const DocumentDocxViewer = forwardRef<DocumentDocxViewerHandle, DocumentDocxViewerProps>(
  function DocumentDocxViewer({ docx, ariaLabel = 'Documento final' }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const pagesRef = useRef<HTMLElement[]>([])
    const [status, setStatus] = useState<'idle' | 'rendering' | 'ready' | 'error'>('idle')
    const [pageCount, setPageCount] = useState(0)
    const [zoom, setZoom] = useState(100)

    useImperativeHandle(ref, () => ({ getPages: () => pagesRef.current }), [])

    useEffect(() => {
      const container = containerRef.current
      if (!container || !docx) return
      let cancelled = false
      setStatus('rendering')
      pagesRef.current = []
      // Cada render escribe en su propio escenario: un render cancelado nunca
      // mezcla su salida con la del documento vigente.
      const stage = document.createElement('div')
      container.replaceChildren(stage)
      renderAsync(docx, stage, stage, {
        className: 'docx',
        inWrapper: true,
        breakPages: true,
        ignoreLastRenderedPageBreak: true,
        renderHeaders: true,
        renderFooters: true,
      })
        .then(() => {
          if (cancelled) return
          pagesRef.current = paginateRenderedDocx(stage)
          setPageCount(pagesRef.current.length)
          setStatus('ready')
        })
        .catch(() => {
          if (!cancelled) setStatus('error')
        })
      return () => {
        cancelled = true
      }
    }, [docx])

    return (
      <div className="document-docx-viewer">
        <div className="document-editor-toolbar" aria-label="Controles del visualizador">
          <span className="document-docx-pages">
            {status === 'ready' ? `${pageCount} página(s) · solo lectura` : status === 'error' ? 'No fue posible visualizar el documento' : 'Preparando vista previa…'}
          </span>
          <div className="document-editor-zoom-tools" aria-label="Controles de zoom">
            <button type="button" className="document-editor-tool" onClick={() => setZoom((z) => Math.max(40, z - 10))} disabled={zoom <= 40} aria-label="Alejar documento">
              <ZoomOut size={15} />
            </button>
            <button type="button" className="document-zoom-indicator-btn" onClick={() => setZoom(100)} aria-label="Restablecer zoom">
              {zoom}%
            </button>
            <button type="button" className="document-editor-tool" onClick={() => setZoom((z) => Math.min(200, z + 10))} disabled={zoom >= 200} aria-label="Acercar documento">
              <ZoomIn size={15} />
            </button>
          </div>
        </div>
        <div className="document-docx-viewport" role="region" aria-label={ariaLabel} tabIndex={0}>
          {status === 'rendering' && (
            <div className="document-docx-loading"><LoaderCircle size={18} className="spin" /> Generando vista previa…</div>
          )}
          <div className="document-docx-scaler" style={{ zoom: `${zoom}%` }}>
            <div ref={containerRef} className="document-docx-container" />
          </div>
        </div>
      </div>
    )
  },
)
