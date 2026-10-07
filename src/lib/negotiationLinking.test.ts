import { describe, expect, it } from 'vitest'
import type { EditableResultRow } from '../components/expediente/types'
import { buildNegotiationLinkage, negotiationAlertCount, NEGOTIATION_STATUS, type LinkedPair } from './negotiationLinking'
import { LINK_STATUS_KEY, READONLY_ROW_FLAG } from './planTitleLinking'

const pairs: LinkedPair[] = [
  { fmi: '350-108418', propertyName: 'LA PLAYA', owners: 'MARTHA LUCÍA BERNAL DE GARZÓN', cadastralId: '73043000200020024000', planName: 'Plano_TOL-ANZ-045_20241107' },
  { fmi: '350-129805', propertyName: 'EL REFUGIO', owners: 'HERNANDO CASTAÑO RUIZ', cadastralId: '73043000200060049000', planName: 'TOL-ANZ-103' },
  { fmi: '350-95520', propertyName: 'LA ARGENTINA', owners: 'ANA BEATRIZ HOYOS SALAZAR', cadastralId: '73043000200060046000', planName: 'TOL-ANZ-116' },
]

const neg = (overrides: Partial<EditableResultRow>): EditableResultRow => ({
  id: 'neg-row-1', propertyCode: 'TOL-ANZ-045', negFolio: '350-108418', negCadastralId: '73043000200020024000',
  firstOfferNumbers: '$ 7.628.712', valuesMatch: 'Sí, coinciden',
  negotiatedValueNumbers: '$ 9.628.712', negotiatedValueLetters: 'Nueve millones seiscientos veintiocho mil setecientos doce pesos',
  ...overrides,
})

describe('buildNegotiationLinkage', () => {
  it('links negotiation rows to title/plan pairs by FMI', () => {
    const linkage = buildNegotiationLinkage([neg({})], pairs.slice(0, 1))
    expect(linkage.summary.linked).toBe(1)
    expect(linkage.rows[0][LINK_STATUS_KEY]).toBe(NEGOTIATION_STATUS.linked)
    expect(linkage.rows[0].p_owners).toBe('MARTHA LUCÍA BERNAL DE GARZÓN')
    expect(negotiationAlertCount(linkage.summary)).toBe(0)
  })

  it('lists pairs without negotiation and negotiations without pair', () => {
    const linkage = buildNegotiationLinkage(
      [neg({}), neg({ id: 'neg-row-2', propertyCode: 'TOL-PIE-098', negFolio: '351-2675', negCadastralId: '' })],
      pairs,
    )
    expect(linkage.summary.pairsWithoutNegotiation).toBe(2)
    expect(linkage.summary.negotiationsWithoutPair).toBe(1)
    const pairOnly = linkage.rows.filter((r) => r[READONLY_ROW_FLAG] === 'true')
    expect(pairOnly.map((r) => r.negFolio)).toEqual(['350-129805', '350-95520'])
    expect(linkage.rows.at(-1)?.[LINK_STATUS_KEY]).toBe(NEGOTIATION_STATUS.withoutPair)
    // La negociación ajena no exige valor negociado.
    expect(linkage.alerts.some((a) => a.rowId === 'neg-row-2' && a.kind === 'missing_value')).toBe(false)
  })

  it('requires a matching negotiated value on every linked row', () => {
    const missing = buildNegotiationLinkage([neg({ negotiatedValueNumbers: '', negotiatedValueLetters: '' })], pairs.slice(0, 1))
    expect(missing.summary.missingValues).toBe(1)
    expect(missing.alerts.filter((a) => a.kind === 'missing_value').map((a) => a.columnKey)).toEqual(['negotiatedValueNumbers', 'negotiatedValueLetters'])

    const wrong = buildNegotiationLinkage([neg({ negotiatedValueLetters: 'nueve millones de pesos' })], pairs.slice(0, 1))
    expect(wrong.summary.missingValues).toBe(1)
    expect(wrong.alerts.find((a) => a.columnKey === 'negotiatedValueLetters')?.message).toMatch(/9\.000\.000/)
  })

  it('flags cadastral id and folder/plan mismatches, accepting NPN vs legacy code', () => {
    const ok = buildNegotiationLinkage([neg({ negCadastralId: '730430002000000020024000000000' })], pairs.slice(0, 1))
    expect(ok.summary.mismatches).toBe(0)
    const bad = buildNegotiationLinkage([neg({ negCadastralId: '73043000200020099000', propertyCode: 'TOL-ANZ-046' })], pairs.slice(0, 1))
    expect(bad.summary.mismatches).toBe(2)
    expect(bad.alerts.map((a) => a.columnKey)).toEqual(expect.arrayContaining(['negCadastralId', 'p_cadastralId', 'propertyCode', 'p_planName']))
  })

  it('flags offers whose numbers and letters do not match', () => {
    const linkage = buildNegotiationLinkage([neg({ valuesMatch: 'No coinciden: Oferta 2' })], pairs.slice(0, 1))
    expect(linkage.alerts.find((a) => a.columnKey === 'valuesMatch')?.severity).toBe('error')
  })
})
