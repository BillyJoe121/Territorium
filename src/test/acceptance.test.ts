import { describe, expect, it } from 'vitest'
import { FIXTURE_TECHNICAL_PLAN_COMPLEX, FIXTURE_TITLE_STUDY_COMPLEX } from './fixtures'
import {
  consolidateMasterRecord,
  computeBatchReconciliationSummary,
  updateMasterRecordAttribute,
  chunkLegalDocument,
} from '../lib/masterRecordReconciliation'
import {
  classifyLegalConditions,
  formatConsultationFilings,
  segregateOwners,
  validateLegalBoundaries,
} from '../lib/legalTechnicalExtraction'
import { calculateCompletenessMetrics } from '../lib/operationsObservability'

describe('Territorium Automated Acceptance Suite (E15 P0 - US-146 to US-150)', () => {
  describe('US-150: Acceptance tests for complex legal cases', () => {
    it('handles multiple current and historical owners without confusion (US-069, US-150)', () => {
      const rawOwners = [
        { name: 'Carlos Alberto Jaramillo', documentType: 'CC', documentNumber: '79456123', percentage: 50, isCurrent: true },
        { name: 'Inversiones El Roble S.A.S.', documentType: 'NIT', documentNumber: '900876543-1', percentage: 50, isCurrent: true },
        { name: 'Maria Helena Restrepo', documentType: 'CC', documentNumber: '41567890', percentage: 100, isCurrent: false, historicalNote: 'Vendió en 2018' },
      ]

      const { current, historical } = segregateOwners(rawOwners)

      expect(current.length).toBe(2)
      expect(historical.length).toBe(1)
      expect(current.some((c) => c.name.includes('CARLOS ALBERTO'))).toBe(true)
      expect(current.some((c) => c.name.includes('MARIA HELENA'))).toBe(false)
      expect(historical[0].name).toContain('MARIA HELENA')
    })

    it('processes multiple active encumbrances and marks formal statement (US-072, US-150)', () => {
      const encumbrances = [
        'Anotación 5: Hipoteca abierta a favor de Banco Agrario',
        'Anotación 6: Servidumbre de tránsito',
      ]
      const res = classifyLegalConditions(encumbrances)
      expect(res.hasEncumbrances).toBe(true)
      expect(res.items.length).toBe(2)
      expect(res.formalStatement).toBe('con limitaciones o gravámenes vigentes')
    })

    it('enforces mandatory review for long or truncated boundaries (US-071, US-150)', () => {
      const longBoundary = 'NORTE: lindero norte. SUR: lindero sur. ORIENTE: lindero este. OCCIDENTE: ' + 'A'.repeat(2100)
      const res = validateLegalBoundaries(longBoundary)
      expect(res.isLong).toBe(true)
      expect(res.requiresMandatoryReview).toBe(true)
      expect(res.reviewReason).toContain('2000')
    })

    it('handles unidentified consultation filings without failing (US-073, US-150)', () => {
      const filings = formatConsultationFilings(null, null)
      expect(filings.snrFiling).toBe('no identificado')
      expect(filings.territorialDirection).toBe('no identificado')
      expect(filings.isIdentified).toBe(false)
    })
  })

  describe('US-149: Regression test detecting output count less than expected inputs', () => {
    it('flags an alert and blocks batch export when inputs count exceeds consolidated outputs', () => {
      const expectedCodes = ['SAN-01', 'SAN-02', 'SAN-03', 'SAN-04']
      const receivedCodes = ['SAN-01', 'SAN-02', 'SAN-03', 'SAN-04']

      // Solo se consolidan 3 predios (falta SAN-04)
      const masterRecords = [
        consolidateMasterRecord({
          id: 'rec-1',
          propertyCode: 'SAN-01',
          projectId: 'p',
          batchId: 'b',
          titleExtraction: { folio: '300-1', municipality: 'Cimitarra' },
        }),
        consolidateMasterRecord({
          id: 'rec-2',
          propertyCode: 'SAN-02',
          projectId: 'p',
          batchId: 'b',
          titleExtraction: { folio: '300-2', municipality: 'Cimitarra' },
        }),
        consolidateMasterRecord({
          id: 'rec-3',
          propertyCode: 'SAN-03',
          projectId: 'p',
          batchId: 'b',
          titleExtraction: { folio: '300-3', municipality: 'Cimitarra' },
        }),
      ]

      const summary = computeBatchReconciliationSummary(expectedCodes, masterRecords, receivedCodes)

      expect(summary.expectedCount).toBe(4)
      expect(summary.consolidatedCount).toBe(3)
      expect(summary.missingProperties).toContain('SAN-04')
      expect(summary.isExportReady).toBe(false)
      expect(summary.blockReasons[0]).toContain('Faltan 1 predio(s)')

      const metrics = calculateCompletenessMetrics(4, 4, [], masterRecords)
      expect(metrics.hasDiscrepancy).toBe(true)
      expect(metrics.discrepancyMessage).toContain('Discrepancia detectada')
    })
  })

  describe('End-to-End Consolidated Flow from Complex Fixture', () => {
    it('consolidates complex title and plan fixtures and verifies 3-state traceability', () => {
      const record = consolidateMasterRecord({
        id: 'mr-complex-01',
        propertyCode: FIXTURE_TITLE_STUDY_COMPLEX.propertyCode!,
        projectId: 'proj-santander',
        batchId: 'batch-entrega-01',
        titleExtraction: FIXTURE_TITLE_STUDY_COMPLEX,
        planExtraction: FIXTURE_TECHNICAL_PLAN_COMPLEX,
      })

      expect(record.propertyCode).toBe('SAN-CIM-036A')
      expect(record.attributes['folio_matricula'].activeValue).toBe('300-88492')
      expect(record.attributes['propietarios_actuales'].requiresLegalReview).toBe(true)
      expect(record.attributes['condiciones_juridicas'].requiresLegalReview).toBe(true)
      expect(record.attributes['area_afectada_plano_m2'].activeValue).toBe('8500')

      // Aplicar corrección manual con motivo (US-107)
      const corrected = updateMasterRecordAttribute(record, 'folio_matricula', '300-88492-CORREGIDO', {
        author: 'abogado.revisor@territorium.com',
        changeMotive: 'Se añade sufijo según resolución aclaratoria anexa',
      })

      expect(corrected.attributes['folio_matricula'].activeValue).toBe('300-88492-CORREGIDO')
      expect(corrected.attributes['folio_matricula'].sourceState).toBe('manual')
      expect(corrected.attributes['folio_matricula'].previousValue).toBe('300-88492')
      expect(corrected.attributes['folio_matricula'].lastModifiedBy).toBe('abogado.revisor@territorium.com')

      // Certificar aprobación (US-108, US-110)
      const approved = updateMasterRecordAttribute(corrected, 'folio_matricula', '300-88492-CORREGIDO', {
        author: 'lider.juridico@territorium.com',
        changeMotive: 'Aprobado conforme a certificado de tradición',
        isApproval: true,
      })

      expect(approved.attributes['folio_matricula'].sourceState).toBe('approved')
      expect(approved.attributes['folio_matricula'].approvedValue).toBe('300-88492-CORREGIDO')
    })
  })
})
