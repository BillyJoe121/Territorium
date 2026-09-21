import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { Bold, Heading2, Italic, List, ListOrdered, Table2 } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

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
        <ToolButton label="Título" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></ToolButton>
        <ToolButton label="Negrita" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} /></ToolButton>
        <ToolButton label="Cursiva" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></ToolButton>
        <span className="document-editor-divider" aria-hidden="true" />
        <ToolButton label="Lista" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></ToolButton>
        <ToolButton label="Lista numerada" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></ToolButton>
        <ToolButton label="Insertar tabla" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run()}><Table2 size={16} /></ToolButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
