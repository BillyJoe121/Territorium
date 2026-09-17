import { describe, it, expect } from 'vitest'
import {
  createManualPropertyMasterRecord,
  bulkApproveUncontestedAttributes,
  restoreAttributeValueFromHistory,
  compareMasterRecordVersions,
  mapExternalMasterDataToRecord,
  createWordAnnotation
} from './attributeAuditHistory'
import type { PropertyMasterRecord } from './masterRecordReconciliation'

describe('attributeAuditHistory (US-102, US-103, US-104, US-113, US-114, US-163, US-164, US-167)', () => {
  it('US-102: crea registro maestro manual para predio sin fuente procesable con auditoría', () => {
    const { record, history } = createManualPropertyMasterRecord(
      'PREDIO-MANUAL-001',
      'proj-1',
      'batch-1',
      'Predio con litigio histórico sin títulos digitales',
      {
        nombre_predio: 'El Mirador',
        municipio: 'Yumbo',
        propietario: 'Herederos de Pedro Gómez'
      },
      'Abogado Revisor 1'
    )

    expect(record.propertyCode).toBe('PREDIO-MANUAL-001')
    expect(record.attributes['nombre_predio'].manualValue).toBe('El Mirador')
    expect(record.attributes['nombre_predio'].sourceState).toBe('manual')
    expect(history.length).toBe(3)
    expect(history[0].reason).toContain('sin fuente procesable')
  })

  it('US-113: aprueba en bloque atributos sin conflicto ni revisión obligatoria pendiente', () => {
    const baseRecord: PropertyMasterRecord = {
      id: 'rec-1',
      propertyCode: 'P-100',
      projectId: 'proj-1',
      batchId: 'b-1',
      batchVersion: 1,
      canonicalName: 'P-100',
      folio: '',
      cadastralCedula: '',
      municipality: 'Yumbo',
      department: 'Valle',
      attributes: {
        municipio: {
          fieldKey: 'municipio',
          label: 'Municipio',
          category: 'juridico',
          sourceState: 'ai',
          aiValue: 'Yumbo',
          manualValue: null,
          approvedValue: null,
          activeValue: 'Yumbo',
          confidence: 0.95,
          hasConflict: false,
          isMandatory: true,
          requiresLegalReview: false
        },
        linderos: {
          fieldKey: 'linderos',
          label: 'Linderos',
          category: 'juridico',
          sourceState: 'ai',
          aiValue: 'Norte con predio vecino...',
          manualValue: null,
          approvedValue: null,
          activeValue: 'Norte con predio vecino...',
          confidence: 0.85,
          hasConflict: false,
          isMandatory: true,
          requiresLegalReview: true // Exige revisión jurídica
        },
        area: {
          fieldKey: 'area',
          label: 'Área',
          category: 'tecnico',
          sourceState: 'ai',
          aiValue: '5000',
          manualValue: null,
          approvedValue: null,
          activeValue: '5000',
          confidence: 0.70,
          hasConflict: true, // Tiene conflicto
          isMandatory: true,
          requiresLegalReview: false
        }
      },
      criticalConflictCount: 1,
      semanticQualityScore: 90,
      qualityWarnings: [],
      reviewState: 'pendiente',
      isBlockedForExport: false,
      exportBlockReasons: [],
      updatedAt: '2026-01-01T00:00:00Z'
    }

    const { updatedRecord, approvedCount, skippedDueToConflictCount, historyItems } =
      bulkApproveUncontestedAttributes(baseRecord, 'Revisor Legal')

    expect(approvedCount).toBe(1) // Solo municipio debe aprobarse
    expect(skippedDueToConflictCount).toBe(2) // Linderos (revisión obligatoria) y Área (conflicto)
    expect(updatedRecord.attributes['municipio'].sourceState).toBe('approved')
    expect(updatedRecord.attributes['municipio'].approvedValue).toBe('Yumbo')
    expect(updatedRecord.attributes['linderos'].sourceState).toBe('ai')
    expect(historyItems.length).toBe(1)
  })

  it('US-114 & US-163: restaura valor de atributo desde historial de auditoría y compara versiones', () => {
    const record: PropertyMasterRecord = {
      id: 'rec-1',
      propertyCode: 'P-100',
      projectId: 'proj-1',
      batchId: 'b-1',
      batchVersion: 1,
      canonicalName: 'P-100',
      folio: '370-99999',
      cadastralCedula: '',
      municipality: 'Yumbo',
      department: 'Valle',
      attributes: {
        folio: {
          fieldKey: 'folio',
          label: 'Folio Matrícula',
          category: 'juridico',
          sourceState: 'manual',
          aiValue: '370-12345',
          manualValue: '370-99999', // Editado con error
          approvedValue: null,
          activeValue: '370-99999',
          confidence: 1.0,
          hasConflict: false,
          isMandatory: true,
          requiresLegalReview: false
        }
      },
      criticalConflictCount: 0,
      semanticQualityScore: 95,
      qualityWarnings: [],
      reviewState: 'pendiente',
      isBlockedForExport: false,
      exportBlockReasons: [],
      updatedAt: '2026-01-01T00:00:00Z'
    }

    const historyItem = {
      id: 'hist-old',
      projectId: 'proj-1',
      propertyCode: 'P-100',
      attributeKey: 'folio',
      previousValue: null,
      newValue: '370-99999',
      authorName: 'Operador',
      reason: 'Error tipográfico',
      changeType: 'manual_edit' as const,
      createdAt: '2026-01-01T10:00:00Z'
    }

    const { updatedRecord, historyItem: newHist } = restoreAttributeValueFromHistory(
      record,
      'folio',
      { ...historyItem, newValue: '370-12345' },
      'Supervisor'
    )

    expect(updatedRecord.attributes['folio'].manualValue).toBe('370-12345')
    expect(newHist.changeType).toBe('restored')
    expect(newHist.newValue).toBe('370-12345')

    // US-104: Comparación entre versiones
    const diff = compareMasterRecordVersions(record, updatedRecord)
    expect(diff.hasMaterialChanges).toBe(true)
    expect(diff.changedAttributes[0].key).toBe('folio')
  })

  it('US-103 & US-164: mapea e importa datos externos a la mesa maestra', () => {
    const record: PropertyMasterRecord = {
      id: 'rec-1',
      propertyCode: 'P-100',
      projectId: 'proj-1',
      batchId: 'b-1',
      batchVersion: 1,
      canonicalName: 'P-100',
      folio: '',
      cadastralCedula: '',
      municipality: '',
      department: '',
      attributes: {},
      criticalConflictCount: 0,
      semanticQualityScore: 100,
      qualityWarnings: [],
      reviewState: 'pendiente',
      isBlockedForExport: false,
      exportBlockReasons: [],
      updatedAt: '2026-01-01T00:00:00Z'
    }

    const externalData = {
      'Cedula Catastral': '76892000100020003000',
      'Municipio DANE': 'Yumbo'
    }

    const mapping = [
      { sourceColumn: 'Cedula Catastral', targetAttributeKey: 'cedula_catastral' },
      { sourceColumn: 'Municipio DANE', targetAttributeKey: 'municipio' }
    ]

    const { updatedRecord, history } = mapExternalMasterDataToRecord(
      record,
      externalData,
      mapping,
      'Analista GIS'
    )

    expect(updatedRecord.attributes['cedula_catastral'].manualValue).toBe('76892000100020003000')
    expect(updatedRecord.attributes['municipio'].manualValue).toBe('Yumbo')
    expect(history.length).toBe(2)
  })

  it('US-167: crea anotaciones y propuestas de corrección sobre visor Word', () => {
    const annot = createWordAnnotation(
      'P-100',
      'linderos',
      'Linda por el norte con predio El Roble',
      'Falta precisar la quebrada divisoria',
      'Linda por el norte con predio El Roble, quebrada El Tigre al medio',
      'Dra. Claudia Jurídica'
    )

    expect(annot.status).toBe('pending')
    expect(annot.proposedValue).toContain('quebrada El Tigre')
  })
})
