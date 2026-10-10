import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { OriginalViewer, type ViewerDocument } from '../comparison/OriginalViewer'
import { clampRect, resizeRect, type FloatingRect, type ResizeEdge } from '../../lib/floatingRect'

export interface FilePreviewTarget {
  document: ViewerDocument
  /** Para archivos que aún no están en el bucket (p. ej. el modo prototipo). */
  loadBlob?: () => Promise<Blob>
}

interface Props {
  target: FilePreviewTarget | null
  onClose: () => void
}

const EDGES: ResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
/** La barra superior del visor; sus botones conservan su propio clic. */
const isGrip = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest('.comparison-original-header')) && !target.closest('button, input, select, a')

/**
 * Visor de archivos en un modal casi del alto de la pantalla. Se mueve sujetando la barra superior,
 * se redimensiona desde bordes y esquinas, y con doble clic en la barra vuelve a su posición. Cada
 * vez que se abre empieza en la posición y el tamaño por defecto.
 */
export function FilePreviewDialog({ target, onClose }: Props) {
  const contentRef = useRef<HTMLDivElement>(null)
  // null: posición y tamaño por defecto (centrado por CSS).
  const [rect, setRect] = useState<FloatingRect | null>(null)
  const [dragging, setDragging] = useState(false)
  // Al sujetar la barra el puntero queda capturado por el modal: el doble clic ya no llega a la
  // barra, así que se recuerda dónde empezó la última pulsación.
  const pressedGripRef = useRef(false)

  useEffect(() => {
    if (!target) setRect(null)
  }, [target])

  const startGesture = (event: ReactPointerEvent<HTMLElement>, gesture: ResizeEdge | 'move') => {
    const content = contentRef.current
    if (!content || event.button !== 0) return
    event.preventDefault()
    const box = content.getBoundingClientRect()
    const start: FloatingRect = { x: box.left, y: box.top, width: box.width, height: box.height }
    const origin = { x: event.clientX, y: event.clientY }
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    setDragging(true)
    const move = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - origin.x
      const dy = moveEvent.clientY - origin.y
      const next = gesture === 'move' ? { ...start, x: start.x + dx, y: start.y + dy } : resizeRect(start, gesture, dx, dy)
      setRect(clampRect(next, { width: window.innerWidth, height: window.innerHeight }))
    }
    const end = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', end)
      handle.removeEventListener('pointercancel', end)
      setDragging(false)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
  }

  return (
    <Dialog.Root open={Boolean(target)} onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="expediente-modal-overlay" />
        <Dialog.Content
          ref={contentRef}
          className={`expediente-file-preview-modal${rect ? ' is-floating' : ''}${dragging ? ' is-dragging' : ''}`}
          style={rect ? { left: rect.x, top: rect.y, width: rect.width, height: rect.height } : undefined}
          aria-describedby={undefined}
          onPointerDown={(event) => {
            pressedGripRef.current = isGrip(event.target)
            if (pressedGripRef.current) startGesture(event, 'move')
          }}
          onDoubleClick={() => { if (pressedGripRef.current) setRect(null) }}
        >
          {/* Solo para lectores de pantalla: el modal muestra únicamente el visor. */}
          <Dialog.Title className="sr-only">{target ? `Vista previa de ${target.document.original_name}` : 'Vista previa'}</Dialog.Title>
          {target && (
            <OriginalViewer
              key={target.document.id}
              document={target.document}
              loadBlob={target.loadBlob}
              variant="preview"
              onClose={onClose}
            />
          )}
          {EDGES.map((edge) => (
            <div key={edge} className={`preview-resize-handle is-${edge}`} aria-hidden="true" onPointerDown={(event) => startGesture(event, edge)} />
          ))}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
