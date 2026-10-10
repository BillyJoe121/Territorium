import { describe, expect, it } from 'vitest'
import type { ResultColumn } from '../components/expediente/types'
import { missingDataAlerts } from './missingData'
import { READONLY_ROW_FLAG } from './planTitleLinking'

const columns: ResultColumn[] = [
  { key: 'doc', label: 'Documento', editable: false },
  { key: 'owners', label: 'Propietarios' },
  { key: 'offer3', label: 'Oferta 3', optional: true },
  { key: 'value', label: 'Valor negociado', required: true },
]

describe('missingDataAlerts', () => {
  it('flags empty and "no identificado" cells of editable, non-optional columns', () => {
    const alerts = missingDataAlerts([
      { id: 'r1', doc: '', owners: 'No identificado', offer3: '', value: '' },
      { id: 'r2', doc: 'b.pdf', owners: 'ANA', offer3: '', value: '1000' },
    ], columns)
    expect(alerts.map((a) => [a.rowId, a.columnKey, a.message])).toEqual([
      ['r1', 'owners', 'Propietarios: sin dato.'],
      ['r1', 'value', 'Valor negociado: dato obligatorio sin diligenciar.'],
    ])
  })

  it('skips read-only rows', () => {
    expect(missingDataAlerts([{ id: 'x', [READONLY_ROW_FLAG]: 'true', owners: '' }], columns)).toEqual([])
  })
})
