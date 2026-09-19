import { describe, expect, it } from 'vitest'
import {
  adaptCanonicalPayloadToTable,
  adaptTableRowsToPayload,
  TITLE_COLUMNS_CONTRACT,
  PLAN_COLUMNS_CONTRACT,
  NEGOTIATION_COLUMNS_CONTRACT,
  CONSOLIDATED_COLUMNS_CONTRACT,
} from './expedienteResultAdapters'

describe('expedienteResultAdapters (HU-V2-042)', () => {
  it('adapta el payload de títulos al contrato de tabla con 20 campos y validaciones', () => {
    const payload = {
      folio: '050N-204581',
      cadastral_id: '05001010400230012000',
      owners: [{ name: 'María Elena Rojas', document_number: '43.123.456', document_type: 'Cédula de ciudadanía' }],
      antecedents_consultation_date: '18/09/2026',
      property_name: 'La Esperanza',
      municipality: 'Rionegro',
      department: 'Antioquia',
      village: 'La Esperanza',
      area_numbers: '124580',
      area_letters: 'Doce hectáreas y cuatro mil quinientos ochenta metros cuadrados',
      registry_office: 'ORIP Rionegro',
      acquisition_mode: 'Compraventa',
      boundaries: 'Norte: El Roble; Sur: vía veredal',
      boundaries_document: 'Escritura 1240',
      legal_conditions: 'Sin gravámenes',
      justice_ministry_case: 'MJ-2026-001',
      urt_case: 'URT-ANT-2026-001',
      urt_territorial_direction: 'Antioquia',
    }

    const report = {
      errors: [{ field_name: 'folio', message: 'Folio verificado' }],
      warnings: [{ field_name: 'area_numbers', message: 'Verificar equivalencia de área' }],
    }

    const adapted = adaptCanonicalPayloadToTable('titles', payload, report)
    expect(adapted.columns).toEqual(TITLE_COLUMNS_CONTRACT)
    expect(adapted.rows).toHaveLength(1)
    expect(adapted.rows[0].folio).toBe('050N-204581')
    expect(adapted.rows[0].owners).toBe('María Elena Rojas')
    expect(adapted.rows[0].documentNumber).toBe('43.123.456')
    expect(adapted.validationNotices).toHaveLength(2)
    expect(adapted.validationNotices[0].severity).toBe('error')
    expect(adapted.validationNotices[1].severity).toBe('warning')

    // Round-trip conversion
    const backToPayload = adaptTableRowsToPayload('titles', adapted.rows, payload)
    expect(backToPayload.folio).toBe('050N-204581')
    expect(backToPayload.property_name).toBe('La Esperanza')
  })

  it('adapta el payload de planos soportando colecciones de planos', () => {
    const payload = {
      plans: [
        {
          plan_name: 'Plano Servidumbre Tramo 1',
          easement_area_numbers: '4580',
          easement_area_letters: 'Cuatro mil quinientos ochenta metros cuadrados',
          easement_length_numbers: '458',
          easement_length_letters: 'Cuatrocientos cincuenta y ocho metros',
          easement_width_numbers: '10',
          easement_width_letters: 'Diez metros',
          infrastructure_count_numbers: '8',
          infrastructure_count_letters: 'ocho',
          plan_scale: '1:2000',
          voltage_level: '230 kV',
        },
        {
          plan_name: 'Levantamiento Topográfico General',
          easement_area_numbers: '124580',
          easement_area_letters: 'Ciento veinticuatro mil quinientos ochenta metros cuadrados',
          plan_scale: '1:1000',
        },
      ],
    }

    const adapted = adaptCanonicalPayloadToTable('plans', payload)
    expect(adapted.columns).toEqual(PLAN_COLUMNS_CONTRACT)
    expect(adapted.rows).toHaveLength(2)
    expect(adapted.rows[0].planName).toBe('Plano Servidumbre Tramo 1')
    expect(adapted.rows[1].planName).toBe('Levantamiento Topográfico General')

    const backToPayload = adaptTableRowsToPayload('plans', adapted.rows)
    expect((backToPayload.plans as any[])).toHaveLength(2)
    expect((backToPayload.plans as any[])[0].plan_name).toBe('Plano Servidumbre Tramo 1')
  })

  it('adapta el payload de negociación con comparación números vs letras', () => {
    const payload = {
      property_code: 'PREDIO-001',
      first_offer_numbers: '$ 218.450.000',
      first_offer_letters: 'Doscientos dieciocho millones cuatrocientos cincuenta mil pesos',
      second_offer_numbers: '$ 232.800.000',
      second_offer_letters: 'Doscientos treinta y dos millones ochocientos mil pesos',
      third_offer_numbers: '—',
      third_offer_letters: '—',
      values_match: 'Sí, coinciden',
    }

    const adapted = adaptCanonicalPayloadToTable('negotiation', payload)
    expect(adapted.columns).toEqual(NEGOTIATION_COLUMNS_CONTRACT)
    expect(adapted.rows).toHaveLength(1)
    expect(adapted.rows[0].firstOfferNumbers).toBe('$ 218.450.000')
    expect(adapted.rows[0].valuesMatch).toBe('Sí, coinciden')

    const backToPayload = adaptTableRowsToPayload('negotiation', adapted.rows)
    expect(backToPayload.first_offer_numbers).toBe('$ 218.450.000')
    expect(backToPayload.values_match).toBe('Sí, coinciden')
  })

  it('adapta el registro consolidado a la vista de tabla maestra', () => {
    const payload = {
      folio: '050N-204581',
      cadastral_id: '05001010400230012000',
      property_name: 'La Esperanza',
      municipality: 'Rionegro',
      department: 'Antioquia',
      owners: 'María Elena Rojas',
      acquisition_mode: 'Compraventa',
      boundaries: 'Norte: El Roble',
      legal_conditions: 'Sin anotaciones',
      easement_area: '4.580 m²',
      easement_length: '458 m',
      easement_width: '10 m',
      infrastructure_count: '8',
      first_offer: '$ 218.450.000',
      second_offer: '$ 232.800.000',
    }

    const adapted = adaptCanonicalPayloadToTable('consolidated', payload)
    expect(adapted.columns).toEqual(CONSOLIDATED_COLUMNS_CONTRACT)
    expect(adapted.rows.length).toBeGreaterThan(5)
    expect(adapted.rows.find((r) => r.field === 'Matrícula inmobiliaria')?.value).toBe('050N-204581')
    expect(adapted.rows.find((r) => r.field === 'Área de servidumbre')?.value).toBe('4.580 m²')

    const backToPayload = adaptTableRowsToPayload('consolidated', adapted.rows)
    expect(backToPayload.folio).toBe('050N-204581')
    expect(backToPayload.easement_area).toBe('4.580 m²')
  })
})
