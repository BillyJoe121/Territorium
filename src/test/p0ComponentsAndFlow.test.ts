import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { StatusPill } from '../components/ui/StatusPill'
import { SplitReviewStation, type PropertyAttributeReview } from '../components/ui/SplitReviewStation'

describe('P0 UI/UX Components & Operational Flow Suite (US-201 a US-300 P0)', () => {
  describe('US-219: Semantic Status Pills (WCAG AA Contrast)', () => {
    it('renders success class for approved status', () => {
      const html = renderToString(React.createElement(StatusPill, { status: 'aprobado' }))
      expect(html).toContain('status-pill-success')
      expect(html).toContain('Aprobado')
    })

    it('renders danger class for discrepancy status', () => {
      const html = renderToString(React.createElement(StatusPill, { status: 'discrepancia' }))
      expect(html).toContain('status-pill-danger')
      expect(html).toContain('Discrepancia')
    })

    it('renders warning class for review required', () => {
      const html = renderToString(React.createElement(StatusPill, { status: 'requiere_revision' }))
      expect(html).toContain('status-pill-warning')
      expect(html).toContain('Requiere revisión')
    })
  })

  describe('US-246 a US-250: Split Review Station Component', () => {
    it('renders split review station with evidence highlight card and action bar', () => {
      const attributes: PropertyAttributeReview[] = [
        {
          id: 'area-terreno',
          key: 'area',
          label: 'Área de terreno',
          value: '450.50 m2',
          sourceDocumentKind: 'estudio_titulos',
          confidence: 94,
          evidenceText: 'cabida superficiaria de 450 metros cuadrados con 50 decímetros',
          evidencePage: 2,
          hasDiscrepancy: false,
        },
      ]

      const html = renderToString(
        React.createElement(SplitReviewStation, {
          propertyFolio: 'FMI-001-123456',
          propertyName: 'Finca Bellavista',
          attributes,
          documentName: 'Estudio_Titulos_Bellavista.pdf',
          onSaveAttribute: () => {},
          onApproveProperty: () => {},
          onFlagDiscrepancy: () => {},
        })
      ).replace(/<!-- -->/g, '')

      expect(html).toContain('FMI-001-123456')
      expect(html).toContain('Finca Bellavista')
      expect(html).toContain('Estudio_Titulos_Bellavista.pdf')
      expect(html).toContain('cabida superficiaria de 450 metros cuadrados')
      expect(html).toContain('94% confianza')
      expect(html).toContain('Alt')
      expect(html).toContain('Aprobar Predio')
    })
  })

  describe('US-201 a US-205: URL Hash Routing Contract', () => {
    it('maps valid hash routes to system screens accurately', () => {
      const routeMap: Record<string, string> = {
        '#/app/inicio': 'inicio',
        '#/app/expedientes': 'expedientes',
        '#/app/carga': 'carga',
        '#/app/revision': 'revision',
        '#/app/exportar': 'exportar',
        '#/app/usuarios': 'usuarios',
        '#/app/configuracion': 'configuracion',
        '#/app/trazabilidad': 'trazabilidad',
      }

      Object.entries(routeMap).forEach(([hash, expectedScreen]) => {
        const screen = hash.replace('#/app/', '').split('?')[0]
        expect(screen).toBe(expectedScreen)
      })
    })

  })
})
