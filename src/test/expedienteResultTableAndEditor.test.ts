import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { ResultDataTable } from '../components/expediente/ResultDataTable'
import { PLAN_COLUMNS_CONTRACT, adaptCanonicalPayloadToTable } from '../lib/expedienteResultAdapters'

const cleanHtml = (html: string) => html.replace(/<!-- -->/g, '')

describe('Territorium Expediente Modals & Result Table Verification', () => {
  it('renders ResultDataTable with zoom toolbar, lateral navigation, and editable inputs for Titles flow', () => {
    const mockPayload = {
      folio: '50C-123456',
      cadastral_id: '01020000000100020000',
      property_name: 'Hacienda La Esperanza',
      municipality: 'Fusagasugá',
      department: 'Cundinamarca',
    }

    const adapted = adaptCanonicalPayloadToTable('titles', mockPayload)
    const onChange = vi.fn()

    const element = React.createElement(ResultDataTable, {
      caption: 'Resultados de Tätulos',
      columns: adapted.columns,
      rows: adapted.rows,
      validationNotices: adapted.validationNotices,
      onChange,
    })

    const html = cleanHtml(renderToString(element))

    expect(html).toContain('Controles de zoom de la tabla')
    expect(html).toContain('100%')
    expect(html).toContain('Reducir zoom de tabla')
    expect(html).toContain('Aumentar zoom de tabla')
    expect(html).toContain('result-table-zoom-container')

    expect(html).toContain('Navegación horizontal de la tabla')
    expect(html).toContain('Desplazar tabla a la izquierda')
    expect(html).toContain('Desplazar tabla a la derecha')

    expect(html).toContain('result-table-scroll')
    expect(html).toContain('Resultados de Tätulos')

    expect(html).toContain('50C-123456')
    expect(html).toContain('Hacienda La Esperanza')
    expect(html).toContain('result-table-input')
  })

  it('renders ResultDataTable for Plans flow with 11 columns and numeric fields', () => {
    const mockPlanPayload = {
      plan_name: 'Plano Topográfico 01',
      easement_area_numbers: '1450.50',
      easement_length_numbers: '230.00',
      voltage_level: '230 kV',
    }

    const adapted = adaptCanonicalPayloadToTable('plans', mockPlanPayload)
    expect(adapted.columns.length).toBe(PLAN_COLUMNS_CONTRACT.length)

    const html = cleanHtml(
      renderToString(
        React.createElement(ResultDataTable, {
          caption: 'Resultados de Planos',
          columns: adapted.columns,
          rows: adapted.rows,
          onChange: () => {},
        }),
      ),
    )

    expect(html).toContain('Plano Topográfico 01')
    expect(html).toContain('1450.50')
    expect(html).toContain('result-table-zoom-toolbar')
  })
})

