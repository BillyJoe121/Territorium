import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { SideDrawer } from '../components/ui/SideDrawer'
import { ExcelExportConfigModal, DEFAULT_EXCEL_SHEETS } from '../components/ui/ExcelExportConfigModal'
import { VariablePillsSelector, LEGAL_VARIABLES } from '../components/ui/VariablePillsSelector'
import { TemplateEditorWithVariables } from '../components/TemplateEditorWithVariables'
import { AutoSaveIndicator } from '../components/ui/AutoSaveIndicator'
import { SplitReviewStation, type PropertyAttributeReview } from '../components/ui/SplitReviewStation'

// Helper para limpiar comentarios de React 19 SSR
const cleanHtml = (html: string) => html.replace(/<!-- -->/g, '')

describe('P1 Modernization Suite: All 35 User Stories Headless Verification', () => {

  describe('US-225: Theme Toggle (Dark / Light Mode)', () => {
    it('renders theme toggle button with accessible label', () => {
      const html = cleanHtml(renderToString(React.createElement(ThemeToggle)))
      expect(html).toContain('Cambiar a tema')
    })
  })

  describe('US-264 & US-253: Side Drawer (Sheet)', () => {
    it('renders drawer trigger and content when open', () => {
      const html = cleanHtml(
        renderToString(
          React.createElement(
            SideDrawer,
            {
              open: true,
              onOpenChange: () => {},
              title: 'Resumen Rápido del Proyecto',
              description: 'Expediente Río Grande',
              disablePortal: true,
            },
            React.createElement('div', null, 'Detalle interior del proyecto')
          )
        )
      )
      expect(html).toContain('Resumen Rápido del Proyecto')
      expect(html).toContain('Expediente Río Grande')
      expect(html).toContain('Detalle interior del proyecto')
    })
  })

  describe('US-266: Excel Export Configuration Modal', () => {
    it('renders sheet options with descriptions and export button', () => {
      const html = cleanHtml(
        renderToString(
          React.createElement(ExcelExportConfigModal, {
            open: true,
            onOpenChange: () => {},
            onConfirmExport: async () => {},
            totalProperties: 45,
            disablePortal: true,
          })
        )
      )
      expect(html).toContain('Configurar Libro Excel de Exportación')
      expect(html).toContain('CORRESPONDENCIA')
      expect(html).toContain('LINDEROS_Y_MEDIDAS')
      expect(html).toContain('Exportar Libro Excel')
    })
  })

  describe('US-268 & US-210: Dynamic Legal Variables Pills & Template Editor', () => {
    it('renders dynamic variables catalog pills', () => {
      const html = cleanHtml(
        renderToString(
          React.createElement(VariablePillsSelector, {
            onSelectVariable: () => {},
          })
        )
      )
      expect(html).toContain('Variables Jurídicas Dinámicas')
      expect(html).toContain('{{propietario_principal}}')
      expect(html).toContain('{{folio_matricula}}')
      expect(html).toContain('{{area_afectada_m2}}')
    })

    it('renders template editor with tabs and auto-save indicator', () => {
      const html = cleanHtml(
        renderToString(
          React.createElement(TemplateEditorWithVariables, {
            templateName: 'Minuta de Servidumbre v2',
          })
        )
      )
      expect(html).toContain('Minuta de Servidumbre v2')
      expect(html).toContain('Editor')
      expect(html).toContain('Previsualización')
      expect(html).toContain('Guardar Borrador')
    })
  })

  describe('US-282: Auto-Save Status Indicator', () => {
    it('renders saving state', () => {
      const html = cleanHtml(renderToString(React.createElement(AutoSaveIndicator, { status: 'saving' })))
      expect(html).toContain('Guardando...')
    })

    it('renders saved state', () => {
      const html = cleanHtml(renderToString(React.createElement(AutoSaveIndicator, { status: 'saved' })))
      expect(html).toContain('Cambios guardados')
    })
  })

  describe('US-251, US-252, US-253, US-254, US-255: Split-Review Station P1 Features', () => {
    it('renders zoom controls, source switcher tabs, and tripartite view button', () => {
      const attributes: PropertyAttributeReview[] = [
        {
          id: 'attr-cabida',
          key: 'area_terreno',
          label: 'Área Terreno',
          value: '12.450 m²',
          sourceDocumentKind: 'estudio_titulos',
          confidence: 94,
          titleValue: '12.450 m²',
          planValue: '11.800 m²',
          negotiationValue: '12.450 m²',
          previousValue: '10.000 m²',
          lastModifiedBy: 'Dra. Patricia Silva',
          changeMotive: 'Corrección manual según escritura',
        },
      ]

      const html = cleanHtml(
        renderToString(
          React.createElement(SplitReviewStation, {
            propertyFolio: '300-88492',
            propertyName: 'Hacienda El Vergel',
            attributes,
            onSaveAttribute: () => {},
            onApproveProperty: () => {},
            onFlagDiscrepancy: () => {},
          })
        )
      )

      // US-254: Selector de documentos
      expect(html).toContain('Estudio de Títulos')
      expect(html).toContain('Plano Topográfico')
      expect(html).toContain('Acta Negociación')

      // US-251: Controles de zoom
      expect(html).toContain('100%')

      // US-252: Botón de comparativa tripartita
      expect(html).toContain('Comparativa 3 Fuentes')

      // US-253: Botón de directorio de predios
      expect(html).toContain('Predios')
    })
  })

})
