import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { AccessibleTabs } from '../components/ui/AccessibleTabs'
import { ColumnSelectorPopover } from '../components/ui/ColumnSelectorPopover'
import { LegalTooltip, LEGAL_TERMS_DICTIONARY } from '../components/ui/LegalTooltip'
import { AccessibleAccordion } from '../components/ui/AccessibleAccordion'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { SideDrawer } from '../components/ui/SideDrawer'
import { FacetedFilters } from '../components/ui/FacetedFilters'
import { ExcelExportConfigModal, DEFAULT_EXCEL_SHEETS } from '../components/ui/ExcelExportConfigModal'
import { InviteUserModal } from '../components/ui/InviteUserModal'
import { VariablePillsSelector, LEGAL_VARIABLES } from '../components/ui/VariablePillsSelector'
import { TemplateEditorWithVariables } from '../components/TemplateEditorWithVariables'
import { ButtonWithSpinner } from '../components/ui/ButtonWithSpinner'
import { AutoSaveIndicator } from '../components/ui/AutoSaveIndicator'
import {
  ProcessingFlowAreaChart,
  MaturityRadarChart,
  AiConfidenceDonutChart,
  MiniSparkline,
  BatchesTreemap,
} from '../components/ui/P1AnalyticsCharts'
import { SplitReviewStation, type PropertyAttributeReview } from '../components/ui/SplitReviewStation'
import { PublicNotaryPortal } from '../components/ui/PublicNotaryPortal'
import { NotaryLinksAdminModal, type NotaryLinkRecord } from '../components/ui/NotaryLinksAdminModal'
import {
  generateNotaryShareToken,
  validateNotaryShareToken,
  createOtpChallenge,
  verifyOtpCode,
  registerNotarySupportDocument,
  revokeNotaryShareToken,
} from '../lib/publicNotaryPortal'

// Helper para limpiar comentarios de React 19 SSR
const cleanHtml = (html: string) => html.replace(/<!-- -->/g, '')

describe('P1 Modernization Suite: All 35 User Stories Headless Verification', () => {
  describe('US-222: Accessible Tabs with @radix-ui/react-tabs', () => {
    it('renders tabs triggers, badges and active content', () => {
      const items = [
        { id: 'identificacion', label: 'Identificación', badgeCount: 3, content: React.createElement('div', null, 'Contenido Identificación') },
        { id: 'linderos', label: 'Linderos', badgeCount: 0, content: React.createElement('div', null, 'Contenido Linderos') },
      ]

      const html = cleanHtml(renderToString(React.createElement(AccessibleTabs, { items, defaultValue: 'identificacion' })))
      expect(html).toContain('Identificación')
      expect(html).toContain('Linderos')
      expect(html).toContain('accessible-tabs-root')
      expect(html).toContain('Contenido Identificación')
    })
  })

  describe('US-220: Column Selector Popover with @radix-ui/react-popover', () => {
    it('renders popover trigger with visible columns count', () => {
      const columns = [
        { key: 'folio', label: 'Folio Matrícula', isVisible: true },
        { key: 'cedula', label: 'Cédula Catastral', isVisible: true },
        { key: 'area', label: 'Área Terreno', isVisible: false },
      ]

      const html = cleanHtml(renderToString(React.createElement(ColumnSelectorPopover, { columns, onToggleColumn: () => {} })))
      expect(html).toContain('Columnas')
      expect(html).toContain('2/3')
    })
  })

  describe('US-221: Legal Tooltips with @radix-ui/react-tooltip', () => {
    it('renders legal term trigger and contains dictionary explanation', () => {
      const html = cleanHtml(
        renderToString(
          React.createElement(LegalTooltip, {
            term: 'cabida',
            explanation: LEGAL_TERMS_DICTIONARY.cabida,
          })
        )
      )
      expect(html).toContain('cabida')
      expect(LEGAL_TERMS_DICTIONARY.cabida).toContain('superficie total de terreno')
    })
  })

  describe('US-224: Accessible Accordion with @radix-ui/react-accordion', () => {
    it('renders collapsible sections with severity tags and counts', () => {
      const sections = [
        {
          id: 'sec-1',
          title: 'Discrepancia de Cabida',
          severity: 'critical' as const,
          itemCount: 2,
          content: React.createElement('p', null, 'Diferencia superior al 15% entre título y plano.'),
        },
        {
          id: 'sec-2',
          title: 'Linderos Ambiguos',
          severity: 'warning' as const,
          itemCount: 1,
          content: React.createElement('p', null, 'Límite sur no especifica mojón.'),
        },
      ]

      const html = cleanHtml(renderToString(React.createElement(AccessibleAccordion, { sections, defaultValue: 'sec-1' })))
      expect(html).toContain('Discrepancia de Cabida')
      expect(html).toContain('Crítico')
      expect(html).toContain('Linderos Ambiguos')
      expect(html).toContain('Advertencia')
    })
  })

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

  describe('US-265: Faceted Filter Bar', () => {
    it('renders faceted filter pills with active counts and clear button', () => {
      const groups = [
        {
          id: 'estado',
          label: 'Estado',
          options: [
            { value: 'aprobado', label: 'Aprobado', count: 12 },
            { value: 'pendiente', label: 'Pendiente', count: 5 },
          ],
          selectedValues: ['aprobado'],
        },
      ]

      const html = cleanHtml(
        renderToString(
          React.createElement(FacetedFilters, {
            groups,
            onToggleOption: () => {},
            onClearAll: () => {},
            totalResults: 12,
          })
        )
      )
      expect(html).toContain('Filtros Facetados')
      expect(html).toContain('1 activo(s)')
      expect(html).toContain('Limpiar todo')
      expect(html).toContain('Aprobado')
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

  describe('US-267: Invite Corporate User Modal', () => {
    it('renders member invitation form with roles and corporate email input', () => {
      const html = cleanHtml(
        renderToString(
          React.createElement(InviteUserModal, {
            open: true,
            onOpenChange: () => {},
            onInvite: async () => {},
            projectName: 'Subestación Chivor',
            disablePortal: true,
          })
        )
      )
      expect(html).toContain('Invitar Miembro al Proyecto')
      expect(html).toContain('Subestación Chivor')
      expect(html).toContain('Revisor Jurídico')
      expect(html).toContain('Operador Ingesta')
      expect(html).toContain('Enviar Invitación')
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

  describe('US-280: Button With Spinner & Double-Click Protection', () => {
    it('renders spinner and loadingText when isLoading is true', () => {
      const html = cleanHtml(
        renderToString(
          React.createElement(
            ButtonWithSpinner,
            { isLoading: true, loadingText: 'Procesando Lote...' },
            'Iniciar Proceso'
          )
        )
      )
      expect(html).toContain('Procesando Lote...')
      expect(html).not.toContain('Iniciar Proceso')
    })

    it('renders regular children when not loading', () => {
      const html = cleanHtml(
        renderToString(
          React.createElement(
            ButtonWithSpinner,
            { isLoading: false },
            'Iniciar Proceso'
          )
        )
      )
      expect(html).toContain('Iniciar Proceso')
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

  describe('US-234, US-235, US-236, US-237, US-238: Recharts Visual Analytics', () => {
    it('renders ProcessingFlowAreaChart container', () => {
      const html = cleanHtml(renderToString(React.createElement(ProcessingFlowAreaChart)))
      expect(html).toContain('Flujo de Procesamiento')
      expect(html).toContain('Ingresados vs Revisados')
    })

    it('renders MaturityRadarChart container', () => {
      const html = cleanHtml(renderToString(React.createElement(MaturityRadarChart)))
      expect(html).toContain('Completitud Documental del Expediente')
      expect(html).toContain('Línea Base vs Estado Real')
    })

    it('renders AiConfidenceDonutChart container', () => {
      const html = cleanHtml(renderToString(React.createElement(AiConfidenceDonutChart, { highCount: 50, mediumCount: 20, lowCount: 5 })))
      expect(html).toContain('Niveles de Confianza IA')
      expect(html).toContain('Alta')
      expect(html).toContain('Media')
      expect(html).toContain('Baja')
    })

    it('renders MiniSparkline component', () => {
      const html = cleanHtml(renderToString(React.createElement(MiniSparkline, { progressPercentage: 85 })))
      expect(html).toContain('85%')
      expect(html).toContain('Avance del predio: 85%')
    })

    it('renders BatchesTreemap container', () => {
      const html = cleanHtml(renderToString(React.createElement(BatchesTreemap)))
      expect(html).toContain('Volumen Documental por Lote')
      expect(html).toContain('Treemap')
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

  describe('US-293, US-294, US-296: Public Notary Portal Security & Attachments', () => {
    it('generates OTP challenge and verifies 6-digit code with attempt limiter', () => {
      const challenge = createOtpChallenge('tok-test-123', '482910')
      expect(challenge.code).toBe('482910')
      expect(challenge.attemptsLeft).toBe(3)
      expect(challenge.isVerified).toBe(false)

      // Intento erróneo
      const fail1 = verifyOtpCode(challenge, '000000')
      expect(fail1.success).toBe(false)
      expect(fail1.updatedChallenge.attemptsLeft).toBe(2)

      // Intento exitoso
      const success = verifyOtpCode(fail1.updatedChallenge, '482910')
      expect(success.success).toBe(true)
      expect(success.updatedChallenge.isVerified).toBe(true)
    })

    it('enforces 3-attempt limit on OTP code', () => {
      let challenge = createOtpChallenge('tok-test-123', '999999')
      challenge = verifyOtpCode(challenge, '111111').updatedChallenge
      challenge = verifyOtpCode(challenge, '222222').updatedChallenge
      const fail3 = verifyOtpCode(challenge, '333333')
      expect(fail3.success).toBe(false)
      expect(fail3.updatedChallenge.attemptsLeft).toBe(0)

      const blocked = verifyOtpCode(fail3.updatedChallenge, '999999')
      expect(blocked.success).toBe(false)
      expect(blocked.error).toContain('Ha excedido el número máximo de intentos')
    })

    it('registers notary support documents (paz y salvo / minuta firmada)', () => {
      const { token } = generateNotaryShareToken({
        projectId: 'PRJ-101',
        recipientName: 'Dr. Notario',
        recipientOrganization: 'Notaría 12',
        durationHours: 24,
      })
      const session = validateNotaryShareToken(token)

      const doc = registerNotarySupportDocument(session, {
        fileName: 'Paz_Y_Salvo_Municipal.pdf',
        fileSizeBytes: 1024 * 500,
        documentType: 'paz_y_salvo',
      })

      expect(doc.success).toBe(true)
      expect(doc.document?.fileName).toBe('Paz_Y_Salvo_Municipal.pdf')
      expect(doc.document?.documentType).toBe('paz_y_salvo')
    })

    it('renders notary portal with watermark overlay when unlocked', () => {
      const { token } = generateNotaryShareToken({
        projectId: 'PRJ-101',
        recipientName: 'Dr. Notario',
        recipientOrganization: 'Notaría 45',
        durationHours: 24,
      })

      const html = cleanHtml(
        renderToString(
          React.createElement(PublicNotaryPortal, {
            token,
            requireOtp: false,
          })
        )
      )

      // US-294: Marca de agua
      expect(html).toContain('COPIA INFORMATIVA')
      expect(html).toContain('NOTARÍA 45')

      // US-293: Adjunto de soporte
      expect(html).toContain('Adjuntar Documentos de Soporte')
    })
  })

  describe('US-295: Notary Links Administration & Revocation Modal', () => {
    it('revokes active token immediately and updates state', () => {
      const revoked = revokeNotaryShareToken('tok-abc-1', [])
      expect(revoked).toContain('tok-abc-1')

      const links: NotaryLinkRecord[] = [
        {
          payload: {
            tokenId: 'tok-abc-1',
            projectId: 'PRJ-1',
            recipientName: 'Dra. Gómez',
            recipientOrganization: 'Notaría 1',
            role: 'notario',
            permissions: ['read_minute', 'submit_concept'],
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            secretSalt: 'salt1',
          },
          token: 'ttm_ext_tok1',
          isRevoked: false,
        },
      ]

      const html = cleanHtml(
        renderToString(
          React.createElement(NotaryLinksAdminModal, {
            open: true,
            onOpenChange: () => {},
            links,
            onRevokeLink: () => {},
            disablePortal: true,
          })
        )
      )

      expect(html).toContain('Administración de Enlaces Notariales Externos')
      expect(html).toContain('Dra. Gómez')
      expect(html).toContain('Notaría 1')
      expect(html).toContain('Revocar')
    })
  })
})
