import { describe, expect, it } from 'vitest'
import {
  consolidateApprovedGroups,
  type ConsolidatedMasterRecord,
} from './expedienteConsolidation'

describe('expedienteConsolidation (HU-V2-045)', () => {
  const titlesApprovedPayload = {
    folio: '050N-204581',
    cadastral_id: '05001010400230012000',
    property_name: 'La Esperanza',
    municipality: 'Rionegro',
    department: 'Antioquia',
    village: 'La Esperanza',
    owners: [{ name: 'María Elena Rojas', document_number: '43.123.456' }],
    acquisition_mode: 'Compraventa',
    boundaries: 'Norte con predio El Roble; Sur con vía pública.',
    boundaries_document: 'Escritura Pública 1240 del 12/06/2012',
    legal_conditions: 'Sin gravámenes ni limitaciones',
    justice_ministry_case: 'MJ-2026-001',
    urt_case: 'URT-ANT-2026-001',
    urt_territorial_direction: 'Antioquia',
  }

  const plansApprovedPayload = {
    plans: [
      {
        plan_name: 'Plano de Servidumbre Tramo 12',
        easement_area_numbers: '4580',
        easement_length_numbers: '458',
        easement_width_numbers: '10',
        infrastructure_count_numbers: '8',
        plan_scale: '1:2000',
        voltage_level: '230 kV',
      },
    ],
  }

  const negotiationApprovedPayload = {
    property_code: 'PREDIO-050N',
    first_offer_numbers: '$ 218.450.000',
    second_offer_numbers: '$ 232.800.000',
    third_offer_numbers: '—',
    values_match: 'Sí, coinciden',
  }

  it('consolida determinísticamente las 3 fuentes aprobadas en un registro maestro', () => {
    const record: ConsolidatedMasterRecord = consolidateApprovedGroups({
      titlesApprovedPayload,
      titlesVersionId: 'ver-titles-01',
      plansApprovedPayload,
      plansVersionId: 'ver-plans-01',
      negotiationApprovedPayload,
      negotiationVersionId: 'ver-neg-01',
      userId: 'user-approver-123',
    })

    // Títulos fields
    expect(record.folio).toBe('050N-204581')
    expect(record.cadastral_id).toBe('05001010400230012000')
    expect(record.property_name).toBe('La Esperanza')
    expect(record.municipality).toBe('Rionegro')
    expect(record.department).toBe('Antioquia')
    expect(record.village).toBe('La Esperanza')
    expect(record.owners).toBe('María Elena Rojas (CC 43.123.456)')
    expect(record.acquisition_mode).toBe('Compraventa')
    expect(record.boundaries).toBe('Norte con predio El Roble; Sur con vía pública.')
    expect(record.boundaries_document).toBe('Escritura Pública 1240 del 12/06/2012')
    expect(record.legal_conditions).toBe('Sin gravámenes ni limitaciones')
    expect(record.justice_ministry_case).toBe('MJ-2026-001')
    expect(record.urt_case).toBe('URT-ANT-2026-001')
    expect(record.urt_territorial_direction).toBe('Antioquia')

    // Planos fields
    expect(record.easement_area).toBe('4580')
    expect(record.easement_length).toBe('458')
    expect(record.easement_width).toBe('10')
    expect(record.infrastructure_count).toBe('8')
    expect(record.plan_name).toBe('Plano de Servidumbre Tramo 12')
    expect(record.plan_scale).toBe('1:2000')
    expect(record.voltage_level).toBe('230 kV')

    // Negociación fields
    expect(record.property_code).toBe('PREDIO-050N')
    expect(record.first_offer).toBe('$ 218.450.000')
    expect(record.second_offer).toBe('$ 232.800.000')
    expect(record.third_offer).toBe('—')
    expect(record.values_match).toBe('Sí, coinciden')

    // Metadata
    expect(record.metadata.titles_result_version_id).toBe('ver-titles-01')
    expect(record.metadata.plans_result_version_id).toBe('ver-plans-01')
    expect(record.metadata.negotiation_result_version_id).toBe('ver-neg-01')
    expect(record.metadata.consolidated_by).toBe('user-approver-123')
    expect(record.metadata.consolidated_at).toBeDefined()
  })

  it('maneja fallbacks limpios cuando faltan campos no críticos', () => {
    const record = consolidateApprovedGroups({
      titlesApprovedPayload: { folio: '050N-999' },
      titlesVersionId: 't-1',
      plansApprovedPayload: {},
      plansVersionId: 'p-1',
      negotiationApprovedPayload: {},
      negotiationVersionId: 'n-1',
    })

    expect(record.folio).toBe('050N-999')
    expect(record.property_name).toBe('no identificado')
    expect(record.easement_area).toBe('—')
    expect(record.first_offer).toBe('—')
    expect(record.values_match).toBe('Sí, coinciden')
  })
})
