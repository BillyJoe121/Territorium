import { describe, expect, it } from 'vitest'
import type { ConsolidatedMasterRecord } from './expedienteConsolidation'
import { compileConsolidatedToTiptap } from './expedienteDocumentCompiler'
import { OFFICIAL_FINAL_DOCUMENT_TEMPLATES } from './expedienteDocumentTemplates'
import { buildDocumentXml } from './tiptapToDocx'

const record: ConsolidatedMasterRecord = {
  folio: '350-108418',
  cadastral_id: '73043000200020024000',
  property_name: 'La Playa',
  municipality: 'Anzoátegui',
  department: 'Tolima',
  village: 'Palomar',
  owners: 'Rosa Elena Roncancio de García (CC 28.000.001) & Alejo <Moreno>',
  acquisition_mode: 'Compraventa',
  boundaries: 'Norte: Predio Los Pinos; Sur: Camino Veredal',
  boundaries_document: 'Escritura Pública 1234 de 2010',
  legal_conditions: 'Sin limitaciones',
  justice_ministry_case: 'RAD-JUS-1',
  urt_case: 'RAD-URT-1',
  urt_territorial_direction: 'Tolima',
  easement_area: '3374,06',
  easement_length: '306,43',
  easement_width: '11',
  infrastructure_count: '3',
  plan_name: 'Plano_TOL-ANZ-045',
  plan_scale: '1:1.500',
  voltage_level: '34,5 kV',
  property_code: 'TOL-ANZ-045',
  first_offer: '$ 9.000.000',
  second_offer: '—',
  third_offer: '—',
  values_match: 'Sí, coinciden',
  negotiated_value: '$ 9.628.712',
  negotiated_value_letters: 'Nueve millones seiscientos veintiocho mil setecientos doce pesos',
  metadata: {
    titles_result_version_id: 't1',
    plans_result_version_id: 'p1',
    negotiation_result_version_id: 'n1',
    consolidated_at: '2026-10-04T00:00:00.000Z',
    is_valid: true,
  },
}

/** Comprobación mínima de buena formación: etiquetas abiertas y cerradas en orden. */
function assertBalancedXml(xml: string) {
  const stack: string[] = []
  for (const match of xml.replace(/<\?xml[^>]*\?>/, '').matchAll(/<(\/?)([\w:]+)[^>]*?(\/?)>/g)) {
    const [, closing, name, selfClosing] = match
    if (selfClosing) continue
    if (closing) expect(stack.pop()).toBe(name)
    else stack.push(name)
  }
  expect(stack).toEqual([])
}

describe('tiptapToDocx', () => {
  it('uses the negotiated value in the generated deed', () => {
    const compiled = compileConsolidatedToTiptap(record, { template: OFFICIAL_FINAL_DOCUMENT_TEMPLATES[0] })
    const xml = buildDocumentXml(compiled.content)
    expect(xml).toContain('NUEVE MILLONES SEISCIENTOS VEINTIOCHO MIL SETECIENTOS DOCE PESOS ($ 9.628.712)')
    expect(xml).not.toContain('$ $')
  })

  it('renders headings, marks, lists and tables', () => {
    const xml = buildDocumentXml({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Título' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'negrita', marks: [{ type: 'bold' }, { type: 'italic' }] }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item' }] }] }] },
        {
          type: 'table',
          content: [{
            type: 'tableRow',
            content: [
              { type: 'tableHeader', attrs: { colwidth: [220] }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Campo' }] }] },
              { type: 'tableCell', attrs: { colwidth: [460] }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Valor' }] }] },
            ],
          }],
        },
      ],
    })
    assertBalancedXml(xml)
    expect(xml).toContain('<w:pStyle w:val="Heading2"/>')
    expect(xml).toContain('<w:b/><w:i/>')
    expect(xml).toContain('• ')
    expect(xml).toMatch(/<w:gridCol w:w="\d+"\/><w:gridCol w:w="\d+"\/>/)
    expect(xml).toContain('w:fill="F2F2F2"')
  })
})
