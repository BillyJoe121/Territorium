import { describe, expect, it } from 'vitest'
import {
  chunkLegalDocument,
  computeBatchReconciliationSummary,
  consolidateMasterRecord,
  FIELD_ALIASES_CATALOG_V1,
  resolveFieldAlias,
  updateMasterRecordAttribute,
  validateNumberWordsCoherence,
} from './masterRecordReconciliation'

describe('Master Record Reconciliation & Semantic AI Quality (E10 & E18 P0)', () => {
  describe('US-179: resolveFieldAlias', () => {
    it('maps known aliases to standard schema keys', () => {
      expect(resolveFieldAlias('matricula')).toBe('folio')
      expect(resolveFieldAlias('Matricula Inmobiliaria')).toBe('folio')
      expect(resolveFieldAlias('referencia_catastral')).toBe('cadastralCedula')
      expect(resolveFieldAlias('Area Total del Predio')).toBe('areaTotalM2')
      expect(resolveFieldAlias('zona de servidumbre')).toBe('areaAfectadaM2')
    })

    it('returns null for unknown or ambiguous aliases to force exception', () => {
      expect(resolveFieldAlias('campo_inventado_xyz')).toBeNull()
      expect(resolveFieldAlias('colindancia_imprecisa')).toBeNull()
    })
  })

  describe('US-178: validateNumberWordsCoherence', () => {
    it('validates coherence between numbers and spanish text', () => {
      expect(validateNumberWordsCoherence(1000, 'MIL METROS CUADRADOS')).toBe(true)
      expect(validateNumberWordsCoherence(1000, 'DOS MIL METROS CUADRADOS')).toBe(true) // Still contains MIL
      expect(validateNumberWordsCoherence(1000, 'QUINIENTOS METROS')).toBe(false)
      expect(validateNumberWordsCoherence(2000000, 'DOS MILLONES DE PESOS')).toBe(true)
      expect(validateNumberWordsCoherence(2000000, 'DOSCIENTOS MIL PESOS')).toBe(false)
    })
  })

  describe('US-094 & US-095: consolidateMasterRecord', () => {
    it('consolidates title and plan into versioned master record in CORRESPONDENCIA schema', () => {
      const record = consolidateMasterRecord({
        id: 'mr-01',
        propertyCode: 'SAN-CIM-036A',
        projectId: 'proj-01',
        batchId: 'batch-01',
        batchVersion: 1,
        titleExtraction: {
          folio: '300-123456',
          cadastralCedula: '25001000100020003000',
          canonicalName: 'PREDIO SAN CARLOS',
          municipality: 'Cimitarra',
          department: 'Santander',
          registryOffice: 'Vélez',
          areaNumbers: 50000,
          currentOwners: [
            { name: 'PEDRO GOMEZ', documentType: 'CC', documentNumber: '80123456', percentage: 100, isCurrent: true },
          ],
          boundaries: {
            rawLiteralText: 'NORTE: 100m. SUR: 100m. ESTE: 500m. OESTE: 500m.',
            isLong: false,
            isIncomplete: false,
            isSuspiciouslySummarized: false,
            requiresMandatoryReview: false,
          },
          legalConditions: {
            hasEncumbrances: false,
            items: [],
            formalStatement: 'sin condiciones jurídicas vigentes',
          },
        },
        planExtraction: {
          totalArea: { numbers: 50000, letters: 'CINCUENTA MIL', unit: 'm2' },
          affectedArea: { numbers: 1200, letters: 'MIL DOSCIENTOS', unit: 'm2' },
          servitudeLengthMeters: 120,
          stripWidthMeters: 10,
          infrastructurePostCount: 2,
          scale: '1:1.000',
          isAmbiguousOrInconsistent: false,
          ambiguityReasons: [],
        },
      })

      expect(record.propertyCode).toBe('SAN-CIM-036A')
      expect(record.attributes['folio_matricula'].activeValue).toBe('300-123456')
      expect(record.attributes['area_afectada_plano_m2'].activeValue).toBe('1200')
      expect(record.criticalConflictCount).toBe(0)
      expect(record.isBlockedForExport).toBe(false)
      expect(record.semanticQualityScore).toBe(1)
    })

    it('detects material conflict when title area differs significantly from plan area (US-097)', () => {
      const record = consolidateMasterRecord({
        id: 'mr-conflict',
        propertyCode: 'SAN-CIM-037',
        projectId: 'proj-01',
        batchId: 'batch-01',
        titleExtraction: {
          folio: '300-999',
          municipality: 'Cimitarra',
          areaNumbers: 10000, // 10,000 m2
        },
        planExtraction: {
          totalArea: { numbers: 25000, letters: 'VEINTICINCO MIL', unit: 'm2' }, // 25,000 m2 -> 150% divergence
          affectedArea: { numbers: 1200, letters: 'MIL DOSCIENTOS', unit: 'm2' },
        },
      })

      expect(record.criticalConflictCount).toBeGreaterThan(0)
      expect(record.isBlockedForExport).toBe(true)
      expect(record.attributes['area_titulo_m2'].hasConflict).toBe(true)
      expect(record.attributes['area_total_plano_m2'].hasConflict).toBe(true)
      expect(record.semanticQualityScore).toBeLessThan(1)
    })
  })

  describe('US-101, US-107 & US-110: updateMasterRecordAttribute', () => {
    it('tracks manual changes preserving previous value, author, motive, and updates source state', () => {
      const initial = consolidateMasterRecord({
        id: 'mr-02',
        propertyCode: 'PR-02',
        projectId: 'p1',
        batchId: 'b1',
        titleExtraction: { folio: '123-456' },
      })

      const updated = updateMasterRecordAttribute(initial, 'folio_matricula', '123-999-CORREGIDO', {
        author: 'revisor.juridico@territorium.com',
        changeMotive: 'Corrección de error de transcripción en folio según certificado anexo',
      })

      const attr = updated.attributes['folio_matricula']
      expect(attr.activeValue).toBe('123-999-CORREGIDO')
      expect(attr.sourceState).toBe('manual')
      expect(attr.previousValue).toBe('123-456')
      expect(attr.lastModifiedBy).toBe('revisor.juridico@territorium.com')
      expect(attr.changeMotive).toContain('error de transcripción')
    })

    it('approves an attribute setting sourceState to approved and blocks accidental overwrites (US-110)', () => {
      const initial = consolidateMasterRecord({
        id: 'mr-03',
        propertyCode: 'PR-03',
        projectId: 'p1',
        batchId: 'b1',
        titleExtraction: { folio: '123-456' },
      })

      const approved = updateMasterRecordAttribute(initial, 'folio_matricula', '123-456', {
        author: 'abogado.aprobador@territorium.com',
        changeMotive: 'Aprobación jurídica certificada',
        isApproval: true,
      })

      expect(approved.attributes['folio_matricula'].sourceState).toBe('approved')
      expect(approved.attributes['folio_matricula'].approvedValue).toBe('123-456')

      // Should throw when attempting overwrite without change motive
      expect(() => {
        updateMasterRecordAttribute(approved, 'folio_matricula', 'SOBRESCRITURA_INDEBIDA', {
          author: 'sistema',
          changeMotive: '',
        })
      }).toThrow(/ya está aprobado/)
    })
  })

  describe('US-098 & US-132: computeBatchReconciliationSummary', () => {
    it('detects discrepancies between expected, received, and consolidated properties', () => {
      const expected = ['PR-01', 'PR-02', 'PR-03']
      const received = ['PR-01', 'PR-02', 'PR-04_EXTRA']

      const r1 = consolidateMasterRecord({
        id: '1',
        propertyCode: 'PR-01',
        projectId: 'p',
        batchId: 'b',
        titleExtraction: { folio: '111', municipality: 'Muni' },
      })
      const r2 = consolidateMasterRecord({
        id: '2',
        propertyCode: 'PR-02',
        projectId: 'p',
        batchId: 'b',
        titleExtraction: { folio: '222', municipality: 'Muni' },
      })

      const summary = computeBatchReconciliationSummary(expected, [r1, r2], received)

      expect(summary.expectedCount).toBe(3)
      expect(summary.consolidatedCount).toBe(2)
      expect(summary.missingProperties).toContain('PR-03')
      expect(summary.orphanSources).toContain('PR-04_EXTRA')
      expect(summary.isExportReady).toBe(false)
      expect(summary.blockReasons[0]).toContain('Faltan 1 predio(s)')
    })
  })

  describe('US-180: chunkLegalDocument', () => {
    it('returns single chunk for short documents', () => {
      const short = 'Estudio de títulos corto del predio San Pedro.'
      const chunks = chunkLegalDocument(short, 1)
      expect(chunks.length).toBe(1)
      expect(chunks[0].sectionType).toBe('otro')
    })

    it('splits long legal documents into logical chapters preserving page references', () => {
      const longDoc = `
        CARATULA Y DATOS GENERALES
        Matrícula: 300-1234
        ${'x'.repeat(1500)}
        TRADICIÓN Y MODO DE ADQUISICIÓN
        Anotación 1: Escritura 100 de 2010
        ${'x'.repeat(1500)}
        LINDEROS Y CABIDA
        Norte: Con camino real
        ${'x'.repeat(1500)}
        GRAVÁMENES Y MEDIDAS CAUTELARES
        Anotación 5: Hipoteca
        ${'x'.repeat(1000)}
      `
      const chunks = chunkLegalDocument(longDoc, 12)
      expect(chunks.length).toBeGreaterThanOrEqual(3)
      expect(chunks.some((c) => c.sectionType === 'tradicion_actos')).toBe(true)
      expect(chunks.some((c) => c.sectionType === 'linderos_cabida')).toBe(true)
    })
  })
})
