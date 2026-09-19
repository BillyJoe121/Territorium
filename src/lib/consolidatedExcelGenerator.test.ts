import { describe, expect, it } from 'vitest'
import {
  generateConsolidatedExcelData,
  CONSOLIDATED_EXCEL_HEADERS,
} from './consolidatedExcelGenerator'
import type { ConsolidatedMasterRecord } from './expedienteConsolidation'

describe('consolidatedExcelGenerator (HU-V2-046)', () => {
  const masterRecord: ConsolidatedMasterRecord = {
    property_code: 'PREDIO-050N',
    folio: '050N-204581',
    cadastral_id: '05001010400230012000',
    owners: 'María Elena Rojas',
    property_name: 'La Esperanza',
    municipality: 'Rionegro',
    department: 'Antioquia',
    village: 'La Esperanza',
    acquisition_mode: 'Compraventa',
    boundaries: 'Norte: El Roble',
    boundaries_document: 'Escritura 1240',
    legal_conditions: 'Sin gravámenes',
    justice_ministry_case: 'MJ-2026-001',
    urt_case: 'URT-ANT-2026-001',
    urt_territorial_direction: 'Antioquia',
    easement_area: '4580',
    easement_length: '458',
    easement_width: '10',
    infrastructure_count: '8',
    plan_name: 'Plano Servidumbre Tramo 12',
    plan_scale: '1:2000',
    voltage_level: '230 kV',
    first_offer: '$ 218.450.000',
    second_offer: '$ 232.800.000',
    third_offer: '—',
    values_match: 'Sí, coinciden',
    metadata: {
      titles_result_version_id: 'ver-t-1',
      plans_result_version_id: 'ver-p-1',
      negotiation_result_version_id: 'ver-n-1',
      consolidated_at: '2026-09-18T22:00:00Z',
      consolidated_by: 'approver-01',
      is_valid: true,
    },
  }

  it('genera exactamente las 2 hojas oficiales: Consolidado Predial y Metadatos y Auditoría', async () => {
    const { sheets } = await generateConsolidatedExcelData(masterRecord, {
      projectId: 'proj-101',
      projectName: 'Proyecto Línea 230kV',
      versionNumber: 1,
    })

    expect(sheets).toHaveLength(2)
    expect(sheets[0].sheet).toBe('Consolidado Predial')
    expect(sheets[1].sheet).toBe('Metadatos y Auditoría')
  })

  it('la hoja 1 contiene exactamente los 26 encabezados y las celdas correspondientes', async () => {
    const { sheets } = await generateConsolidatedExcelData(masterRecord, {
      projectId: 'proj-101',
      projectName: 'Proyecto Línea 230kV',
      versionNumber: 1,
    })

    const sheet1Rows = sheets[0].data
    expect(sheet1Rows).toHaveLength(2) // header row + data row

    const headers = sheet1Rows[0].map((cell: any) => cell.value)
    expect(headers).toEqual(CONSOLIDATED_EXCEL_HEADERS)
    expect(headers).toHaveLength(26)

    const dataValues = sheet1Rows[1].map((cell: any) => cell.value)
    expect(dataValues[0]).toBe('PREDIO-050N')
    expect(dataValues[1]).toBe('050N-204581')
    expect(dataValues[2]).toBe('05001010400230012000')
    expect(dataValues[3]).toBe('María Elena Rojas')
    expect(dataValues[4]).toBe('La Esperanza')
    expect(dataValues[5]).toBe('Rionegro')
    expect(dataValues[6]).toBe('Antioquia')
    expect(dataValues[15]).toBe('4580')
    expect(dataValues[22]).toBe('$ 218.450.000')
    expect(dataValues[23]).toBe('$ 232.800.000')
    expect(dataValues[25]).toBe('Sí, coinciden')
  })

  it('escapa contra inyección de fórmulas de Excel (=, +, -, @)', async () => {
    const maliciousRecord: ConsolidatedMasterRecord = {
      ...masterRecord,
      property_name: '=cmd|’ /C calc’!A0',
      boundaries: '+2+5',
      owners: '@SUM(1,2)',
    }

    const { sheets } = await generateConsolidatedExcelData(maliciousRecord, {
      projectId: 'proj-101',
      projectName: 'Proyecto Línea 230kV',
      versionNumber: 1,
    })

    const dataValues = sheets[0].data[1].map((cell: any) => cell.value)
    expect(dataValues[4]).toBe("'=cmd|’ /C calc’!A0")
    expect(dataValues[9]).toBe("'+2+5")
    expect(dataValues[3]).toBe("'@SUM(1,2)")
  })

  it('la hoja de metadatos contiene trazabilidad de las versiones fuente aprobadas', async () => {
    const { sheets } = await generateConsolidatedExcelData(masterRecord, {
      projectId: 'proj-101',
      projectName: 'Proyecto Línea 230kV',
      versionNumber: 2,
    })

    const metaRows = sheets[1].data
    const metaMap = new Map(metaRows.slice(1).map((r: any[]) => [r[0].value, r[1].value]))

    expect(metaMap.get('Proyecto')).toBe('Proyecto Línea 230kV')
    expect(metaMap.get('ID Expediente')).toBe('proj-101')
    expect(metaMap.get('Versión Consolidada')).toBe('v2')
    expect(metaMap.get('Estado de Aprobación')).toBe('APROBADO')
    expect(metaMap.get('Versión Aprobada Títulos')).toBe('ver-t-1')
    expect(metaMap.get('Versión Aprobada Planos')).toBe('ver-p-1')
    expect(metaMap.get('Versión Aprobada Negociación')).toBe('ver-n-1')
  })
})
