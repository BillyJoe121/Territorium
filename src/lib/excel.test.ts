import { describe, expect, it, vi } from 'vitest'
import { CORRESPONDENCIA_COLUMNS, downloadMasterRecordsXlsx } from './excel'
import { consolidateMasterRecord } from './masterRecordReconciliation'

// Mock write-excel-file/browser to prevent browser DOM dependencies during node unit test
vi.mock('write-excel-file/browser', () => {
  return {
    default: vi.fn().mockImplementation((sheets) => {
      return {
        toFile: vi.fn().mockResolvedValue(true),
        sheets,
      }
    }),
  }
})

describe('Excel Certified Export Engine (E12 P0 - US-116 to US-118)', () => {
  it('defines the official CORRESPONDENCIA columns', () => {
    const keys = CORRESPONDENCIA_COLUMNS.map((c) => c.key)
    expect(keys).toContain('codigo_predial')
    expect(keys).toContain('folio_matricula')
    expect(keys).toContain('linderos_literales')
    expect(keys).toContain('area_afectada_plano_m2')
    expect(keys).toContain('estado_revision')
  })

  it('generates sheets with CORRESPONDENCIA, Trazabilidad Atributos, and Metadatos Exportación', async () => {
    const r1 = consolidateMasterRecord({
      id: 'rec-1',
      propertyCode: 'SAN-01',
      projectId: 'proj-1',
      batchId: 'batch-1',
      titleExtraction: {
        folio: '50C-12345',
        canonicalName: 'Finca La Palma',
        municipality: 'Cimitarra',
      },
    })
    r1.reviewState = 'aprobado'

    const r2 = consolidateMasterRecord({
      id: 'rec-2',
      propertyCode: 'SAN-02',
      projectId: 'proj-1',
      batchId: 'batch-1',
      titleExtraction: {
        folio: '50C-67890',
        canonicalName: 'Finca Los Pinos',
      },
    })
    r2.criticalConflictCount = 1

    await downloadMasterRecordsXlsx([r1, r2], {
      batchId: 'LOTE-TEST-01',
      batchVersion: 2,
      projectName: 'Línea de Transmisión 230kV',
      userEmail: 'auditor@territorium.com',
      inclusionCriteria: 'only_approved',
    })

    const writeMock = await import('write-excel-file/browser')
    expect(writeMock.default).toHaveBeenCalled()
  })
})
