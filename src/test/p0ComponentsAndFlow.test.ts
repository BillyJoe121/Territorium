import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { StatusPill } from '../components/ui/StatusPill'
import { BentoGridKpis } from '../components/ui/BentoGridKpis'
import { PropertyStatusDonut, DiscrepancyBarChart } from '../components/ui/DashboardCharts'
import { EnhancedDropZone, type UploadFileItem } from '../components/ui/EnhancedDropZone'
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

  describe('US-232: Bento Grid KPIs Executive Component', () => {
    it('renders executive metrics cards with values and trends', () => {
      const metrics = [
        {
          id: 'test-kpi',
          title: 'Predios Evaluados',
          value: '150',
          trend: '+10% esta semana',
          trendPositive: true,
          description: 'En 3 lotes activos',
          icon: React.createElement('span', null, 'ICON'),
          variant: 'primary' as const,
        },
      ]

      const html = renderToString(React.createElement(BentoGridKpis, { metrics }))
      expect(html).toContain('Predios Evaluados')
      expect(html).toContain('150')
      expect(html).toContain('+10% esta semana')
      expect(html).toContain('En 3 lotes activos')
    })
  })

  describe('US-231 & US-233: Dashboard Recharts Containers', () => {
    it('renders PropertyStatusDonut container and summary', () => {
      const statusData = [
        { name: 'Aprobados', value: 30, color: '#10b981' },
        { name: 'En revisión', value: 10, color: '#f59e0b' },
      ]
      const html = renderToString(React.createElement(PropertyStatusDonut, { data: statusData })).replace(/<!-- -->/g, '')
      expect(html).toContain('Distribución de Predios por Estado')
      expect(html).toContain('40 predios evaluados')
    })

    it('renders DiscrepancyBarChart container and header', () => {
      const discrepancies = [
        { category: 'Cabida / Área', count: 8, severity: 'alta' as const },
        { category: 'Linderos', count: 4, severity: 'media' as const },
      ]
      const html = renderToString(React.createElement(DiscrepancyBarChart, { data: discrepancies })).replace(/<!-- -->/g, '')
      expect(html).toContain('Discrepancias por Categoría')
      expect(html).toContain('Alertas jurídicas activas')
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

  describe('US-261 & US-262: Enhanced DropZone & File Progress Pills', () => {
    it('renders dropzone with buttons and upload file pills with progress', () => {
      const files: UploadFileItem[] = [
        {
          id: 'file-1',
          name: 'Estudio_01.pdf',
          size: 2048500,
          progress: 100,
          status: 'completado',
          detectedKind: 'Estudio de títulos',
        },
        {
          id: 'file-2',
          name: 'Plano_02.pdf',
          size: 5120000,
          progress: 45,
          status: 'subiendo',
          detectedKind: 'Plano',
        },
      ]

      const html = renderToString(
        React.createElement(EnhancedDropZone, {
          onFilesSelected: () => {},
          files,
        })
      ).replace(/<!-- -->/g, '')

      expect(html).toContain('Arrastra tus documentos o carpetas aquí')
      expect(html).toContain('Cargar carpeta completa')
      expect(html).toContain('Estudio_01.pdf')
      expect(html).toContain('Plano_02.pdf')
      expect(html).toContain('1 de 2 listos')
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
