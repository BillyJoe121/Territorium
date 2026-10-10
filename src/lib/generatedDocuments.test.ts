import { describe, expect, it } from 'vitest'
import type { EditableResultRow } from '../components/expediente/types'
import { GENERATED_DOCUMENT_TYPES, generateButtonLabel, generatedDocumentName, templateForDocumentType } from './generatedDocuments'

const [escritura, linderos, minuta] = GENERATED_DOCUMENT_TYPES
const row = (id: string, A: string, B: string): EditableResultRow => ({ id, A, B })

describe('generated document types', () => {
  it('map to the three official templates', () => {
    expect(GENERATED_DOCUMENT_TYPES.filter((type) => type.source === 'official').map((type) => templateForDocumentType(type).id)).toEqual(['tpl-escritura-publica', 'tpl-descripcion-linderos', 'tpl-minuta-tipo'])
  })

  it('label the buttons for everyone or for the selection', () => {
    expect(generateButtonLabel(escritura, 0)).toBe('Generar escritura pública para todos')
    expect(generateButtonLabel(linderos, 1)).toBe('Generar descripción de linderos para 1 seleccionado')
    expect(generateButtonLabel(minuta, 4)).toBe('Generar minuta tipo para 4 seleccionados')
  })
})

describe('generatedDocumentName', () => {
  const rows = [row('corr-1', 'TOL-ANZ-045', '350-108418'), row('corr-2', 'TOL-ANZ-046', '350-1'), row('corr-3', 'TOL-ANZ-046', '350-2'), row('corr-4', '—', '350-9')]

  it('names each document after the property folder', () => {
    expect(generatedDocumentName(escritura, rows[0], rows)).toBe('ESCRITURA TOL-ANZ-045.docx')
    expect(generatedDocumentName(linderos, rows[0], rows)).toBe('DESCRIPCION LINDEROS TOL-ANZ-045.docx')
  })

  it('adds the FMI when the folder repeats and falls back to it without folder', () => {
    expect(generatedDocumentName(minuta, rows[1], rows)).toBe('MINUTA TOL-ANZ-046 (FMI 350-1).docx')
    expect(generatedDocumentName(minuta, rows[2], rows)).toBe('MINUTA TOL-ANZ-046 (FMI 350-2).docx')
    expect(generatedDocumentName(minuta, rows[3], rows)).toBe('MINUTA FMI 350-9.docx')
  })

  it('keeps only characters Storage accepts', () => {
    expect(generatedDocumentName(escritura, row('x', 'Peñón / Lote #3', ''), [])).toBe('ESCRITURA Penon - Lote -3.docx')
  })
})
