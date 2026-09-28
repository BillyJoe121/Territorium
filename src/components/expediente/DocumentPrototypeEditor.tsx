import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { Bold, Heading2, Italic, List, ListOrdered, Table2, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

interface DocumentPrototypeEditorProps {
  content: JSONContent
  onChange: (content: JSONContent) => void
  disabled?: boolean
}

const ToolButton = ({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    className={`document-editor-tool${active ? ' active' : ''}`}
    aria-label={label}
    aria-pressed={active}
    title={label}
    onClick={onClick}
  >
    {children}
  </button>
)

export function DocumentPrototypeEditor({ content, onChange, disabled = false }: DocumentPrototypeEditorProps) {
  const isInternalUpdateRef = useRef(false)
  const lastEmittedJSONRef = useRef<string>('')
  const viewportRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(100)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'document-prototype-content',
        'aria-label': 'Documento final editable',
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      const json = activeEditor.getJSON()
      lastEmittedJSONRef.current = JSON.stringify(json)
      isInternalUpdateRef.current = true
      onChange(json)
    },
  })

  // Wheel & touchpad pinch gesture support
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      // Touchpad pinch-to-zoom emits wheel event with ctrlKey: true in modern browsers.
      // Ctrl + mouse wheel also triggers this.
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const zoomDelta = e.deltaY < 0 ? 5 : -5
        setZoom((prev) => Math.min(200, Math.max(40, prev + zoomDelta)))
      }
    }

    // Passive: false is essential so e.preventDefault() stops the whole page from zooming
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', handleWheel)
    }
  }, [])

  // WebKit touch gesture pinch support
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    let startZoom = 100
    const handleGestureStart = (e: Event) => {
      e.preventDefault()
      startZoom = zoom
    }
    const handleGestureChange = (e: any) => {
      e.preventDefault()
      if (e.scale) {
        const next = Math.round(startZoom * e.scale)
        setZoom(Math.min(200, Math.max(40, next)))
      }
    }

    el.addEventListener('gesturestart', handleGestureStart, { passive: false })
    el.addEventListener('gesturechange', handleGestureChange, { passive: false })
    return () => {
      el.removeEventListener('gesturestart', handleGestureStart)
      el.removeEventListener('gesturechange', handleGestureChange)
    }
  }, [zoom])

  useEffect(() => {
    if (!editor) return

    // If the update was triggered internally by user typing, skip calling setContent
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false
      return
    }

    // If the editor is focused, the user is actively typing; do not disrupt cursor/selection
    if (editor.isFocused) {
      return
    }

    const nextStr = JSON.stringify(content)
    if (nextStr === lastEmittedJSONRef.current) {
      return
    }

    const currentStr = JSON.stringify(editor.getJSON())
    if (currentStr !== nextStr) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
  }, [content, editor])

  if (!editor) return <div className="document-editor-loading">Preparando el editor…</div>

  return (
    <div className={`document-prototype-editor${disabled ? ' disabled' : ''}`}>
      <div className="document-editor-toolbar" aria-label="Herramientas de edición">
        <div className="document-editor-formatting-tools">
          <ToolButton label="Título" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></ToolButton>
          <ToolButton label="Negrita" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} /></ToolButton>
          <ToolButton label="Cursiva" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></ToolButton>
          <span className="document-editor-divider" aria-hidden="true" />
          <ToolButton label="Lista" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></ToolButton>
          <ToolButton label="Lista numerada" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></ToolButton>
          <ToolButton label="Insertar tabla" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run()}><Table2 size={16} /></ToolButton>
        </div>

        <div className="document-editor-zoom-tools" aria-label="Controles de zoom">
          <button
            type="button"
            className="document-editor-tool"
            onClick={() => setZoom((prev) => Math.max(40, prev - 10))}
            disabled={zoom <= 40}
            title="Alejar documento (o pellizcar en touchpad)"
            aria-label="Alejar documento"
          >
            <ZoomOut size={15} />
          </button>
          <button
            type="button"
            className="document-zoom-indicator-btn"
            onClick={() => setZoom(100)}
            title="Restablecer zoom al 100%"
            aria-label="Restablecer zoom"
          >
            {zoom}%
          </button>
          <button
            type="button"
            className="document-editor-tool"
            onClick={() => setZoom((prev) => Math.min(200, prev + 10))}
            disabled={zoom >= 200}
            title="Acercar documento (o pellizcar en touchpad)"
            aria-label="Acercar documento"
          >
            <ZoomIn size={15} />
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="document-editor-viewport"
        tabIndex={0}
        role="region"
        aria-label="Visualizador con desplazamiento vertical"
      >
        <div
          className="document-page-scaler"
          style={{ zoom: `${zoom}%` }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
