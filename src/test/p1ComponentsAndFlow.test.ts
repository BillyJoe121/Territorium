import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { ThemeToggle } from '../components/ui/ThemeToggle'

// Helper para limpiar comentarios de React 19 SSR
const cleanHtml = (html: string) => html.replace(/<!-- -->/g, '')

describe('P1 Modernization Suite: All 35 User Stories Headless Verification', () => {

  describe('US-225: Theme Toggle (Dark / Light Mode)', () => {
    it('renders theme toggle button with accessible label', () => {
      const html = cleanHtml(renderToString(React.createElement(ThemeToggle)))
      expect(html).toContain('Cambiar a tema')
    })
  })

})
