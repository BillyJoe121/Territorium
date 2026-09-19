import { describe, expect, it } from 'vitest'
import {
  consolidatedColumns,
  createDemoConsolidatedRows,
  createDemoGroups,
} from './types'

describe('contrato de datos del prototipo de expediente', () => {
  it('separa los tres subconjuntos documentales de una única gestión predial', () => {
    const groups = createDemoGroups()

    expect(Object.keys(groups)).toEqual(['titles', 'plans', 'negotiation'])
    expect(groups.titles.files).toHaveLength(2)
    expect(groups.plans.files).toHaveLength(2)
    expect(groups.negotiation.files).toHaveLength(1)
  })

  it('usa las columnas operativas solicitadas para títulos, planos y negociación', () => {
    const groups = createDemoGroups()

    expect(groups.titles.columns).toHaveLength(20)
    expect(groups.titles.columns.map((column) => column.label)).toContain('Folio de matrícula')
    expect(groups.titles.columns.map((column) => column.label)).toContain('Dirección territorial de la URT')

    expect(groups.plans.columns.map((column) => column.key)).toEqual([
      'planName',
      'easementAreaNumbers',
      'easementAreaLetters',
      'easementLengthNumbers',
      'easementLengthLetters',
      'easementWidthNumbers',
      'easementWidthLetters',
      'infrastructureCountNumbers',
      'infrastructureCountLetters',
      'planScale',
    ])

    expect(groups.negotiation.columns.map((column) => column.key)).toEqual([
      'firstOfferNumbers',
      'firstOfferLetters',
      'secondOfferNumbers',
      'secondOfferLetters',
      'valuesMatch',
    ])
    expect(groups.negotiation.rows[0].valuesMatch).toBe('Sí, coinciden')
  })

  it('produce un consolidado visible con columnas de origen y valor', () => {
    const rows = createDemoConsolidatedRows()

    expect(consolidatedColumns.map((column) => column.key)).toEqual(['field', 'value', 'source'])
    expect(new Set(rows.map((row) => row.source))).toEqual(new Set(['Títulos', 'Planos', 'Negociación']))
  })
})
