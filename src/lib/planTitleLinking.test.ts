import { describe, expect, it } from 'vitest'
import type { EditableResultRow } from '../components/expediente/types'
import {
  buildPlanTitleLinkage,
  cadastralKey,
  LINK_STATUS_KEY,
  linkageAlertCount,
  linkageSnapshot,
  normalizeFmi,
  parseAreaSquareMeters,
  READONLY_ROW_FLAG,
  TITLE_PREFIX,
} from './planTitleLinking'

const title = (overrides: Partial<EditableResultRow> = {}): EditableResultRow => ({
  id: 'title-row-1',
  sourceDocument: 'Estudio La Playa.docx',
  folio: '350-108418',
  cadastralId: '73043000200020024000',
  owners: 'Rosa Elena Roncancio de García; Alejo Moreno Castellanos',
  propertyName: 'La Playa',
  municipality: 'Anzoátegui',
  department: 'Tolima',
  village: 'Palomar',
  areaNumbers: '12 ha 4580 m²',
  ...overrides,
})

const plan = (overrides: Partial<EditableResultRow> = {}): EditableResultRow => ({
  id: 'plan-row-1',
  planSourceDocument: 'Plano_TOL-ANZ-045.pdf',
  planFolio: 'FMI 350 – 108418',
  planCadastralId: '73-043-00-02-00-02-0024-000',
  planPropertyName: 'Predio La Playa',
  planOwners: 'ROSA ELENA RONCANCIO DE GARCIA y ALEJO MORENO CASTELLANOS',
  planMunicipality: 'ANZOATEGUI - TOLIMA',
  planVillage: 'Vereda Palomar',
  planPropertyArea: '124.580 m2',
  planName: 'Plano_TOL-ANZ-045',
  easementAreaNumbers: '3374,06',
  easementAreaLetters: 'Tres mil trescientos setenta y cuatro punto cero seis',
  easementLengthNumbers: '306,43',
  easementLengthLetters: 'Trescientos seis punto cuarenta y tres',
  easementWidthNumbers: '11',
  easementWidthLetters: 'Once',
  infrastructureCountNumbers: '3',
  infrastructureCountLetters: 'Tres',
  planScale: '1:1.500',
  voltageLevel: '34,5 kV',
  ...overrides,
})

describe('normalizeFmi', () => {
  it.each([
    ['350-108418', '350-108418'],
    ['FMI 350 – 108418', '350-108418'],
    ['Folio de matrícula inmobiliaria No. 350-108418', '350-108418'],
    ['N° 050N-204581', '050N-204581'],
    ['no identificado', ''],
    ['—', ''],
  ])('%s → %s', (input, expected) => {
    expect(normalizeFmi(input)).toBe(expected)
  })
})

describe('cadastralKey', () => {
  it('treats the 30-digit NPN and the 20-digit legacy code of the same predio as equal', () => {
    expect(cadastralKey('730430002000000060049000000000')).toBe(cadastralKey('73043000200060049000'))
    expect(cadastralKey('730430002000000060049000000000')).not.toBe(cadastralKey('73043000200060050000'))
  })
})

describe('parseAreaSquareMeters', () => {
  it('handles hectares, thousands separators and decimals', () => {
    expect(parseAreaSquareMeters('12 ha 4580 m²')).toBe(124_580)
    expect(parseAreaSquareMeters('124.580 m2')).toBe(124_580)
    expect(parseAreaSquareMeters('3.374,06 m²')).toBeCloseTo(3374.06)
    expect(parseAreaSquareMeters('no identificado')).toBeNull()
  })
})

describe('buildPlanTitleLinkage', () => {
  it('links plan and title by FMI and finds no alerts when everything agrees', () => {
    const linkage = buildPlanTitleLinkage([plan()], [title()])
    expect(linkage.rows).toHaveLength(1)
    expect(linkage.rows[0][LINK_STATUS_KEY]).toBe('Vinculado por FMI')
    expect(linkage.rows[0][`${TITLE_PREFIX}folio`]).toBe('350-108418')
    expect(linkage.rows[0][`${TITLE_PREFIX}owners`]).toContain('Rosa Elena')
    expect(linkage.alerts).toEqual([])
    expect(linkage.summary.linked).toBe(1)
    expect(linkageAlertCount(linkage.summary)).toBe(0)
  })

  it('flags mismatching cells on both the plan and title columns', () => {
    const linkage = buildPlanTitleLinkage(
      [plan({ planCadastralId: '73043000200020099999', planPropertyArea: '98.000 m2' })],
      [title()],
    )
    const mismatchColumns = linkage.alerts.filter((a) => a.kind === 'mismatch').map((a) => a.columnKey)
    expect(mismatchColumns).toEqual(expect.arrayContaining([
      'planCadastralId', `${TITLE_PREFIX}cadastralId`, 'planPropertyArea', `${TITLE_PREFIX}areaNumbers`,
    ]))
    expect(linkage.summary.mismatches).toBe(2)
  })

  it('flags owners that differ', () => {
    const linkage = buildPlanTitleLinkage([plan({ planOwners: 'Pedro Pérez Gómez' })], [title()])
    expect(linkage.alerts.some((a) => a.columnKey === 'planOwners' && a.kind === 'mismatch')).toBe(true)
  })

  it('flags empty cells as warnings', () => {
    const linkage = buildPlanTitleLinkage([plan({ planVillage: 'no identificado', planScale: '—' })], [title({ municipality: '' })])
    const empties = linkage.alerts.filter((a) => a.kind === 'empty')
    expect(empties.map((a) => a.columnKey)).toEqual(expect.arrayContaining(['planVillage', 'planScale', `${TITLE_PREFIX}municipality`]))
    expect(empties.every((a) => a.severity === 'warning')).toBe(true)
  })

  it('reports plans without title and titles without plan', () => {
    const linkage = buildPlanTitleLinkage(
      [plan({ id: 'plan-row-1', planFolio: '999-1' }), plan({ id: 'plan-row-2', planFolio: '' })],
      [title(), title({ id: 'title-row-2', folio: '350-2222' })],
    )
    expect(linkage.summary.plansWithoutTitle).toBe(2)
    expect(linkage.summary.titlesWithoutPlan).toBe(2)
    const orphanTitleRows = linkage.rows.filter((row) => row[READONLY_ROW_FLAG] === 'true')
    expect(orphanTitleRows).toHaveLength(2)
    expect(orphanTitleRows[0][LINK_STATUS_KEY]).toBe('Estudio de títulos sin plano')
    expect(linkage.alerts.some((a) => a.rowId === 'plan-row-2' && a.columnKey === 'planFolio')).toBe(true)
  })

  it('warns when more than one plan shares an FMI', () => {
    const linkage = buildPlanTitleLinkage([plan({ id: 'a' }), plan({ id: 'b' })], [title()])
    expect(linkage.summary.duplicates).toBe(2)
    expect(linkage.summary.titlesWithoutPlan).toBe(0)
  })

  it('builds a persistable snapshot without internal flags', () => {
    const snapshot = linkageSnapshot(buildPlanTitleLinkage([], [title()]))
    const records = snapshot.linked_records as Record<string, string>[]
    expect(records[0][READONLY_ROW_FLAG]).toBeUndefined()
    expect(snapshot.linkage_summary).toMatchObject({ titlesWithoutPlan: 1 })
  })
})
