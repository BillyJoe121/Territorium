import { describe, expect, it } from 'vitest'
import { buildCorrespondencia, CORRESPONDENCIA_COLUMNS, correspondenciaRowToMasterRecord, correspondenciaTableColumns, defaultProjectConstants, deriveCorrespondenciaRow } from './correspondencia'

const titlesPayload = {
  titles: [
    {
      source_document: 'Estudio La Playa.pdf', folio: '350-108418', cadastral_id: '73043000200020024000',
      owners: [
        { name: 'MARTHA LUCÍA BERNAL DE GARZÓN', document_number: '38.244.519', document_type: 'Cédula de ciudadanía' },
        { name: 'ALEJANDRO MONTOYA CASTELLANOS', document_number: '93.401.226', document_type: 'Cédula de ciudadanía' },
      ],
      antecedents_consultation_date: '07/10/2024', property_name: 'LA PLAYA', municipality: 'Anzoátegui', department: 'Tolima',
      village: 'Verdún', area_numbers: '69524 m2', registry_office: 'Ibagué', acquisition_mode: 'Compraventa',
      boundaries: 'POR EL NORTE…', boundaries_document: 'EP 1702', legal_conditions: 'Servidumbre ISA',
      justice_ministry_case: 'MJD-1', urt_case: 'URT-1', urt_territorial_direction: 'Tolima',
    },
    { source_document: 'Estudio El Refugio.pdf', folio: '350-129805', property_name: 'EL REFUGIO', owners: [] },
    { source_document: 'Estudio sin plano.pdf', folio: '350-1', property_name: 'SIN PLANO', owners: [] },
  ],
}
const plansPayload = {
  plans: [
    { folio: '350-108418', plan_name: 'Plano_TOL-ANZ-045_20241107', easement_area_numbers: '3374,06', easement_length_numbers: '306,43', easement_width_numbers: '11', infrastructure_count_numbers: '3', plan_scale: '1:1.250', plan_date: '2024/11/07' },
    { folio: '350-129805', plan_name: 'TOL-ANZ-103', easement_area_numbers: '810,67', easement_length_numbers: '90,97' },
  ],
}
const negotiationPayload = {
  negotiations: [
    { property_code: 'TOL-ANZ-045', fmi: '350-108418', first_offer_numbers: '$ 7.628.712', first_offer_letters: 'SIETE MILLONES SEISCIENTOS VEINTIOCHO MIL SETECIENTOS DOCE PESOS', second_offer_numbers: '$ 12.205.938', third_offer_numbers: '$ 15.257.423', negotiated_value_numbers: '$ 9.628.712', negotiated_value_letters: 'Nueve millones seiscientos veintiocho mil setecientos doce pesos' },
    { property_code: 'TOL-ANZ-103', fmi: '350-129805', first_offer_numbers: '$ 1.485.142', negotiated_value_numbers: '', negotiated_value_letters: '' },
    { property_code: 'TOL-PIE-098', fmi: '351-2675', negotiated_value_numbers: '$ 1.000.000', negotiated_value_letters: 'un millón de pesos' },
  ],
}

describe('CORRESPONDENCIA', () => {
  it('has the template columns A–BS in order, without F, H and AK', () => {
    expect(CORRESPONDENCIA_COLUMNS).toHaveLength(68)
    expect(CORRESPONDENCIA_COLUMNS[0]).toMatchObject({ letter: 'A', header: 'CARPETA' })
    expect(CORRESPONDENCIA_COLUMNS[67]).toMatchObject({ letter: 'BS', header: 'CIUDAD DE DOMICILIO PROPIETARIO' })
    expect(CORRESPONDENCIA_COLUMNS.map((c) => c.letter)).not.toContain('F')
    expect(CORRESPONDENCIA_COLUMNS.map((c) => c.letter)).not.toContain('H')
    expect(CORRESPONDENCIA_COLUMNS.map((c) => c.letter)).not.toContain('AK')
    expect(CORRESPONDENCIA_COLUMNS.find((c) => c.letter === 'BE')?.header).toBe('VALOR NEGOCIADO (NUMEROS)')
  })

  it('builds one row per title/plan pair with negotiation, mapping every source', () => {
    const { rows, excluded } = buildCorrespondencia({ titlesPayload, plansPayload, negotiationPayload, constants: defaultProjectConstants('SUPLENCIAS ARREBOLES ETAPA-2') })
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.A).toBe('TOL-ANZ-045')
    expect(row.B).toBe('350-108418')
    expect(row.D).toBe('MARTHA LUCÍA BERNAL DE GARZÓN / ALEJANDRO MONTOYA CASTELLANOS')
    expect(row.E).toBe('38.244.519 / 93.401.226')
    expect(row.G).toBe('CC / CC')
    expect(row.M).toBe('6 ha 9524 m2')
    expect(row.N).toBe('SEIS HECTÁREAS CON NUEVE MIL QUINIENTOS VEINTICUATRO METROS CUADRADOS')
    expect(row.W).toBe('3374.06')
    expect(row.X).toBe('TRES MIL TRESCIENTOS SETENTA Y CUATRO CON SEIS METROS CUADRADOS')
    expect(row.Z).toBe('TRESCIENTOS SEIS CON CUARENTA Y TRES')
    expect(row.AB).toBe('ONCE METROS')
    expect(row.AC).toBe('5.5')
    expect(row.AD).toBe('CINCO METROS Y MEDIO')
    expect(row.AF).toBe('TRES')
    expect(row.AK).toBeUndefined()
    expect(row.AN).toBe('CELSIA COLOMBIA S.A E.S.P.')
    expect(row.AY).toBe('7628712')
    expect(row.BE).toBe('9628712')
    expect(row.BF).toBe('NUEVE MILLONES SEISCIENTOS VEINTIOCHO MIL SETECIENTOS DOCE PESOS')
    expect(row.BG).toBe('5777227')
    expect(row.BI).toBe('3851485')
    expect(row.BH).toBe('CINCO MILLONES SETECIENTOS SETENTA Y SIETE MIL DOSCIENTOS VEINTISIETE PESOS')
    expect(Number(row.BG) + Number(row.BI)).toBe(9628712)

    const reasons = Object.fromEntries(excluded.map((e) => [e.fmi, e.reason]))
    expect(reasons['350-129805']).toMatch(/valor negociado/)
    expect(reasons['350-1']).toMatch(/plano/)
    expect(reasons['351-2675']).toMatch(/estudio de títulos/)
  })

  it('recomputes payments when the negotiated value is edited', () => {
    const row = deriveCorrespondenciaRow({ id: 'x', BE: '2000000', AA: '32 m' })
    expect(row.BG).toBe('1200000')
    expect(row.BJ).toBe('OCHOCIENTOS MIL PESOS')
    expect(row.AD).toBe('DIECISÉIS METROS')
  })

  it('maps a row to the master record used by the final documents', () => {
    const { rows } = buildCorrespondencia({ titlesPayload, plansPayload, negotiationPayload, constants: defaultProjectConstants() })
    const record = correspondenciaRowToMasterRecord(rows[0])
    expect(record.folio).toBe('350-108418')
    expect(record.negotiated_value).toBe('$ 9.628.712')
    expect(record.owners).toContain('MARTHA LUCÍA BERNAL DE GARZÓN (CC 38.244.519)')
    expect(record.easement_area).toBe('3374,06')
  })
})

describe('correspondenciaTableColumns', () => {
  it('gives every column a distinct header (the sheet matches columns by header)', () => {
    const labels = correspondenciaTableColumns().map((column) => column.label)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels[0]).toBe('CARPETA')
    expect(correspondenciaTableColumns()[0].hint).toMatch(/^Columna A del Excel CORRESPONDENCIA/)
  })
})
