import { describe, expect, it } from 'vitest'
import {
  adaptCanonicalPayloadToTable,
  adaptTableRowsToPayload,
} from '../lib/expedienteResultAdapters'
import {
  createExpedienteV2Repository,
  SupabaseExpedienteV2Repository,
} from '../data/expedienteV2Repository'

describe('Integración de RemoteExpedienteWorkspace y Flujo Completo v2', () => {
  it('garantiza la instancia y compatibilidad del repositorio Supabase v2', () => {
    const supabaseRepo = createExpedienteV2Repository()
    expect(supabaseRepo).toBeInstanceOf(SupabaseExpedienteV2Repository)
  })

  it('adapta el payload canónico a la tabla de revisión y viceversa sin pérdida de datos', () => {
    const canonicalTitles = {
      folio: '050N-204581',
      cadastral_id: '05001010400230012000',
      property_name: 'La Esperanza',
      municipality: 'Rionegro',
      department: 'Antioquia',
      area_numbers: '124580 m²',
      owners: [{ full_name: 'María Elena Rojas', document_number: '43.123.456', share_percentage: 100 }],
    }

    const adapted = adaptCanonicalPayloadToTable('titles', canonicalTitles)
    expect(adapted.rows.length).toBeGreaterThan(0)
    expect(adapted.rows[0].folio).toBe('050N-204581')
    expect(adapted.rows[0].cadastralId).toBe('05001010400230012000')

    // Modify a cell in the table
    const modifiedRows = adapted.rows.map((r) => ({ ...r, municipality: 'Marinilla' }))
    const backToPayload = adaptTableRowsToPayload('titles', modifiedRows, canonicalTitles)

    expect(backToPayload.municipality).toBe('Marinilla')
    expect(backToPayload.folio).toBe('050N-204581')
  })

  it('valida que las advertencias y bloqueos operen en los resultados de títulos y negociación', () => {
    const invalidTitles = {
      folio: '', // missing folio
      property_name: 'Finca Sin Folio',
    }
    const adapted = adaptCanonicalPayloadToTable('titles', invalidTitles, {
      errors: [{ field_name: 'folio', message: 'El folio de matrícula es obligatorio.' }],
    })
    expect(adapted.validationNotices.length).toBe(1)
    expect(adapted.validationNotices[0].severity).toBe('error')
    expect(adapted.validationNotices[0].message).toContain('El folio de matrícula es obligatorio')
  })

})
