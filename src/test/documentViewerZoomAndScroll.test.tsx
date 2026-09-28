import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'

// Mock @tiptap/react so useEditor returns an active mock instance in SSR/Node tests
vi.mock('@tiptap/react', () => ({
  EditorContent: ({ editor }: { editor: any }) => (
    <div className="mock-editor-content" data-testid="editor-content">
      {editor?.name || 'editor-inner'}
    </div>
  ),
  useEditor: () => ({
    name: 'tiptap-mock-editor',
    isActive: () => false,
    chain: () => ({
      focus: () => ({
        toggleHeading: () => ({ run: () => {} }),
        toggleBold: () => ({ run: () => {} }),
        toggleItalic: () => ({ run: () => {} }),
        toggleBulletList: () => ({ run: () => {} }),
        toggleOrderedList: () => ({ run: () => {} }),
        insertTable: () => ({ run: () => {} }),
      }),
    }),
    getJSON: () => ({ type: 'doc', content: [] }),
    commands: { setContent: () => {} },
    isFocused: false,
  }),
}))

import { DocumentPrototypeEditor } from '../components/expediente/DocumentPrototypeEditor'

const cleanHtml = (html: string) => html.replace(/<!-- -->/g, '')

describe('Document Viewer Zoom & Scroll Specifications', () => {
  it('renders DocumentPrototypeEditor with complete zoom controls toolbar and indicator', () => {
    const initialContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Documento Predial de Prueba' }] }],
    }

    const html = cleanHtml(
      renderToString(
        <DocumentPrototypeEditor content={initialContent} onChange={() => {}} />
      )
    )

    // Zoom toolbar container
    expect(html).toContain('document-editor-zoom-tools')
    // Reset zoom indicator showing 100%
    expect(html).toContain('document-zoom-indicator-btn')
    expect(html).toContain('100%')
    // Zoom Out button with accessible label
    expect(html).toContain('Alejar documento')
    // Zoom In button with accessible label
    expect(html).toContain('Acercar documento')
    // Dedicated scrollable viewport
    expect(html).toContain('document-editor-viewport')
    expect(html).toContain('document-page-scaler')
  })

  it('renders the scrollable viewport containing the document canvas', () => {
    const initialContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Informe Oficial' }] }],
    }

    const html = cleanHtml(
      renderToString(
        <DocumentPrototypeEditor content={initialContent} onChange={() => {}} />
      )
    )

    expect(html).toContain('role="region"')
    expect(html).toContain('Visualizador con desplazamiento vertical')
    expect(html).toContain('style="zoom:100%"')
    expect(html).toContain('mock-editor-content')
  })
})
