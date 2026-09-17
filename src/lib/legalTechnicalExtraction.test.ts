import { describe, expect, it } from 'vitest'
import {
  classifyLegalConditions,
  formatConsultationFilings,
  parseTechnicalPlan,
  reconcileTitlesAndPlans,
  resolveDocumentFormatPreference,
  segregateOwners,
  sortAcquisitionActs,
  validateLegalBoundaries,
} from './legalTechnicalExtraction'
import type { SourceDocument } from '../types'

describe('Legal & Technical Extraction (E07 & E08 P0)', () => {
  describe('US-075: resolveDocumentFormatPreference', () => {
    it('prefers DOCX over PDF when both document the same title study', () => {
      const docxDoc: SourceDocument = {
        id: 'doc-1',
        projectId: 'p',
        batchId: 'b',
        name: 'ET_PREDIO_01.docx',
        storagePath: '/docs/ET_PREDIO_01.docx',
        size: 15000,
        uploadedAt: new Date().toISOString(),
        kind: 'estudio_titulos',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }
      const pdfDoc: SourceDocument = {
        id: 'doc-2',
        projectId: 'p',
        batchId: 'b',
        name: 'ET_PREDIO_01.pdf',
        storagePath: '/docs/ET_PREDIO_01.pdf',
        size: 85000,
        uploadedAt: new Date().toISOString(),
        kind: 'estudio_titulos',
        mimeType: 'application/pdf',
      }

      const result = resolveDocumentFormatPreference([pdfDoc, docxDoc])
      expect(result).not.toBeNull()
      expect(result?.selectedDoc.id).toBe('doc-1')
      expect(result?.discardedDoc?.id).toBe('doc-2')
      expect(result?.rationale).toContain('US-075')
    })

    it('returns the single doc if only one is present', () => {
      const pdfDoc: SourceDocument = {
        id: 'doc-single',
        projectId: 'p',
        batchId: 'b',
        name: 'ESTUDIO.pdf',
        storagePath: '/docs/ESTUDIO.pdf',
        size: 20000,
        uploadedAt: new Date().toISOString(),
        kind: 'estudio_titulos',
      }
      const res = resolveDocumentFormatPreference([pdfDoc])
      expect(res?.selectedDoc.id).toBe('doc-single')
    })
  })

  describe('US-070 & US-071: validateLegalBoundaries', () => {
    it('approves complete literal boundaries with all 4 cardinal directions and normal length', () => {
      const sample = `NORTE: Con predio La Esperanza en 150 metros. SUR: Con río Bogotá en 140 metros. ORIENTE: Con carretera central en 50 metros. OCCIDENTE: Con predio San José en 60 metros.`
      const res = validateLegalBoundaries(sample)
      expect(res.isIncomplete).toBe(false)
      expect(res.isLong).toBe(false)
      expect(res.isSuspiciouslySummarized).toBe(false)
      expect(res.requiresMandatoryReview).toBe(false)
      expect(res.reviewReason).toBeUndefined()
    })

    it('flags incomplete boundaries missing cardinal points for mandatory review', () => {
      const sample = 'NORTE: Con predio El Mirador en 200m. ORIENTE: Con camino real en 100m.'
      const res = validateLegalBoundaries(sample)
      expect(res.isIncomplete).toBe(true)
      expect(res.requiresMandatoryReview).toBe(true)
      expect(res.reviewReason).toContain('cuatro puntos cardinales')
    })

    it('flags excessively long boundaries (>2000 chars) for mandatory review', () => {
      const longText = 'NORTE: lindero. SUR: lindero. ESTE: lindero. OESTE: lindero. ' + 'X'.repeat(2100)
      const res = validateLegalBoundaries(longText)
      expect(res.isLong).toBe(true)
      expect(res.requiresMandatoryReview).toBe(true)
      expect(res.reviewReason).toContain('2000')
    })

    it('flags suspiciously summarized boundaries with ellipses or summary keywords', () => {
      const sample = `NORTE: Predio San Carlos. SUR: Río Magdalena. ESTE: Vía nacional. OESTE: ...`
      const res = validateLegalBoundaries(sample)
      expect(res.isSuspiciouslySummarized).toBe(true)
      expect(res.requiresMandatoryReview).toBe(true)
    })
  })

  describe('US-069: segregateOwners', () => {
    it('correctly separates current from historical owners', () => {
      const input = [
        { name: 'Juan Perez', isCurrent: true, documentNumber: '12.345.678', percentage: 100 },
        { name: 'Maria Gomez', isCurrent: false, historicalNote: 'Vendió en 2018 mediante Esc 124' },
      ]
      const { current, historical } = segregateOwners(input)
      expect(current.length).toBe(1)
      expect(current[0].name).toBe('JUAN PEREZ')
      expect(current[0].documentNumber).toBe('12345678')
      expect(historical.length).toBe(1)
      expect(historical[0].name).toBe('MARIA GOMEZ')
      expect(historical[0].historicalNote).toContain('Vendió')
    })
  })

  describe('US-068: sortAcquisitionActs', () => {
    it('orders acquisition acts strictly by chronology and sequence', () => {
      const acts = [
        { order: 2, actNumber: 'Escritura 450', date: '2015-05-10', authority: 'Notaría 1', actType: 'Compraventa' },
        { order: 1, actNumber: 'Resolución Incoder 10', date: '2000-01-15', authority: 'Incoder', actType: 'Adjudicación' },
        { order: 3, actNumber: 'Sentencia de Sucesión', date: '2021-11-20', authority: 'Juzgado 3', actType: 'Sucesión' },
      ]
      const sorted = sortAcquisitionActs(acts)
      expect(sorted[0].order).toBe(1)
      expect(sorted[1].order).toBe(2)
      expect(sorted[2].order).toBe(3)
    })
  })

  describe('US-072: classifyLegalConditions', () => {
    it('returns "sin condiciones jurídicas vigentes" when no encumbrances exist', () => {
      const res = classifyLegalConditions([])
      expect(res.hasEncumbrances).toBe(false)
      expect(res.formalStatement).toBe('sin condiciones jurídicas vigentes')
    })

    it('identifies active encumbrances correctly', () => {
      const res = classifyLegalConditions(['Hipoteca abierta a favor de Bancolombia', 'Embargo ejecutivo'])
      expect(res.hasEncumbrances).toBe(true)
      expect(res.items.length).toBe(2)
      expect(res.formalStatement).toBe('con limitaciones o gravámenes vigentes')
    })
  })

  describe('US-073: formatConsultationFilings', () => {
    it('sets "no identificado" when SNR filings or territorial directions are missing', () => {
      const res = formatConsultationFilings(null, '')
      expect(res.snrFiling).toBe('no identificado')
      expect(res.territorialDirection).toBe('no identificado')
      expect(res.isIdentified).toBe(false)
    })

    it('preserves valid SNR filings', () => {
      const res = formatConsultationFilings('SNR-2024-ER-00912', 'Dirección Territorial Central')
      expect(res.snrFiling).toBe('SNR-2024-ER-00912')
      expect(res.territorialDirection).toBe('Dirección Territorial Central')
      expect(res.isIdentified).toBe(true)
    })
  })

  describe('US-078 to US-082: parseTechnicalPlan', () => {
    it('extracts technical plan and preserves physical units', () => {
      const plan = parseTechnicalPlan({
        planName: 'PLANO_TOPOGRAFICO_PR01.dwg',
        totalAreaNumber: 50000,
        totalAreaLetters: 'CINCUENTA MIL METROS CUADRADOS',
        totalAreaUnit: 'm2',
        affectedAreaNumber: 1200,
        affectedAreaLetters: 'MIL DOSCIENTOS METROS CUADRADOS',
        affectedAreaUnit: 'm2',
        servitudeLengthMeters: 120,
        stripWidthMeters: 10,
        infrastructureItems: [
          { identifier: 'T-01', type: 'torre' },
          { identifier: 'T-02', type: 'torre' },
        ],
        scale: '1:1.000',
      })

      expect(plan.infrastructurePostCount).toBe(2)
      expect(plan.isAmbiguousOrInconsistent).toBe(false)
      expect(plan.unitsPreserved).toContain('m2')
    })

    it('detects geometric ambiguity when affected area exceeds total area (US-082)', () => {
      const plan = parseTechnicalPlan({
        planName: 'PLANO_ERRONEO.dwg',
        totalAreaNumber: 1000,
        totalAreaLetters: 'MIL METROS CUADRADOS',
        totalAreaUnit: 'm2',
        affectedAreaNumber: 5000,
        affectedAreaLetters: 'CINCO MIL METROS CUADRADOS',
        affectedAreaUnit: 'm2',
        servitudeLengthMeters: 500,
        stripWidthMeters: 10,
      })

      expect(plan.isAmbiguousOrInconsistent).toBe(true)
      expect(plan.ambiguityReasons[0]).toContain('mayor al área total')
    })
  })

  describe('US-083: reconcileTitlesAndPlans', () => {
    it('pairs titles with plans by property code and identifies orphan plans and missing plans', () => {
      const titleDocs = [
        { id: 't1', name: 'ET_PR-01.docx', storagePath: '/t1', propertyCode: 'PR-01', kind: 'estudio_titulos' },
        { id: 't2', name: 'ET_PR-02.docx', storagePath: '/t2', propertyCode: 'PR-02', kind: 'estudio_titulos' },
      ] as unknown as SourceDocument[]
      const planDocs = [
        { id: 'p1', name: 'PLANO_PR-01.dwg', storagePath: '/p1', propertyCode: 'PR-01', kind: 'plano' },
        { id: 'p3', name: 'PLANO_PR-03_ORPHAN.dwg', storagePath: '/p3', propertyCode: 'PR-03', kind: 'plano' },
      ] as unknown as SourceDocument[]

      const pairings = reconcileTitlesAndPlans(titleDocs, planDocs)
      expect(pairings.length).toBe(3)

      const paired = pairings.find((p) => p.propertyCode === 'PR-01')
      expect(paired?.status).toBe('paired')
      expect(paired?.titleDocument?.id).toBe('t1')
      expect(paired?.planDocument?.id).toBe('p1')

      const titleWithoutPlan = pairings.find((p) => p.propertyCode === 'PR-02')
      expect(titleWithoutPlan?.status).toBe('title_without_plan')

      const orphanPlan = pairings.find((p) => p.propertyCode === 'PR-03')
      expect(orphanPlan?.status).toBe('orphan_plan')
    })
  })
})
