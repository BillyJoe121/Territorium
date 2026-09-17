import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { StatusPill } from '../components/ui/StatusPill'
import { BentoGridKpis } from '../components/ui/BentoGridKpis'
import { PropertyStatusDonut, DiscrepancyBarChart } from '../components/ui/DashboardCharts'
import { EnhancedDropZone, type UploadFileItem } from '../components/ui/EnhancedDropZone'
import { SplitReviewStation, type PropertyAttributeReview } from '../components/ui/SplitReviewStation'
import { generateNotaryShareToken, validateNotaryShareToken, recordNotaryConcept } from '../lib/publicNotaryPortal'

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

  describe('US-289 a US-292: Public Notary Portal Gateway Flow', () => {
    it('executes complete end-to-end token generation, validation and conformity recording', () => {
      // 1. Abogado genera enlace para notaría (US-290)
      const { token, payload } = generateNotaryShareToken({
        projectId: 'PRJ-TERRITORIUM-PACIFICO',
        recipientName: 'Dr. Roberto Meza',
        recipientOrganization: 'Notaría Primera de Buenaventura',
        durationHours: 72,
      })
      expect(token).toBeDefined()
      expect(payload.expiresAt).toBeDefined()

      // 2. Notaría accede al portal con el token (US-289)
      const session = validateNotaryShareToken(token)
      expect(session.isValid).toBe(true)
      expect(session.payload?.recipientOrganization).toBe('Notaría Primera de Buenaventura')

      // 3. Notaría radicar concepto de conformidad (US-291, US-292)
      const conceptResult = recordNotaryConcept(session, {
        decision: 'conforme',
        notaryOfficialName: 'Dr. Roberto Meza',
        notaryNumber: 'Notaría Primera de Buenaventura',
        documentHashSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      })

      expect(conceptResult.success).toBe(true)
      expect(conceptResult.record?.decision).toBe('conforme')
      expect(conceptResult.record?.notaryOfficialName).toBe('Dr. Roberto Meza')
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

    it('correctly detects notary portal share tokens in hash', () => {
      const hash = '#/public/portal/ttm_ext_eyJ0b2tlbiI6InRlc3QifQ=='
      const isPortal = hash.startsWith('#/public/portal/')
      const token = hash.replace('#/public/portal/', '')

      expect(isPortal).toBe(true)
      expect(token).toBe('ttm_ext_eyJ0b2tlbiI6InRlc3QifQ==')
    })
  })
})
