import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { Bold, Heading2, Italic, List, ListOrdered, Table2 } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

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
    onUpdate: ({ editor: activeEditor }) => onChange(activeEditor.getJSON()),
  })

  useEffect(() => {
    if (!editor) return
    const current = JSON.stringify(editor.getJSON())
    const next = JSON.stringify(content)
    if (current !== next) editor.commands.setContent(content, { emitUpdate: false })
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
