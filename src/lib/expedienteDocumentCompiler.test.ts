import { describe, expect, it } from 'vitest'
import type { ConsolidatedMasterRecord } from './expedienteConsolidation'
import {
  compileConsolidatedToTiptap,
  extractNarrativeSection,
  extractStructuredFieldsFromDocument,
  injectNarrativeSection,
} from './expedienteDocumentCompiler'

describe('HU-V2-048 & HU-V2-049: Deterministic Document Compilation & Tiptap Schema', () => {
  const sampleRecord: ConsolidatedMasterRecord = {
    folio: '050N-204581',
    cadastral_id: '05001010400230012000',
    property_name: 'La Esperanza',
    municipality: 'Medellín',
    department: 'Antioquia',
    village: 'El Salado',
    owners: 'Carlos Gómez (CC 70123456)',
    acquisition_mode: 'Compraventa',
    boundaries: 'Norte: Predio Los Pinos; Sur: Camino Veredal',
    boundaries_document: 'Escritura Pública 1234 de 2010',
    legal_conditions: 'Sin limitaciones ni gravámenes',
    justice_ministry_case: 'RAD-JUS-2024-001',
    urt_case: 'RAD-URT-2024-999',
    urt_territorial_direction: 'Dirección Territorial Antioquia',
    easement_area: '450.00',
    easement_length: '30.00',
    easement_width: '15.00',
    infrastructure_count: '2',
    plan_name: 'PLANO-TOP-01',
    plan_scale: '1:500',
    voltage_level: '230 kV',
    property_code: 'PRED-001',
    first_offer: '$ 232.800.000',
    second_offer: '$ 232.800.000',
    third_offer: '—',
    values_match: 'Sí, coinciden',
    metadata: {
      titles_result_version_id: 'titles-v2',
      plans_result_version_id: 'plans-v1',
      negotiation_result_version_id: 'negotiation-v3',
      consolidated_at: '2026-09-18T10:00:00Z',
      is_valid: true,
    },
  }

  it('compiles an approved ConsolidatedMasterRecord into structured Tiptap JSONContent without AI hallucinations', () => {
    const compiled = compileConsolidatedToTiptap(sampleRecord, {
      projectCode: 'EXP-MED-01',
      projectName: 'Línea de Transmisión 230kV',
      compiledBy: 'Abogado Analista',
    })

    expect(compiled.content.type).toBe('doc')
    expect(Array.isArray(compiled.content.content)).toBe(true)

    // Check compilation metadata
    expect(compiled.metadata.folio).toBe('050N-204581')
    expect(compiled.metadata.cadastralId).toBe('05001010400230012000')
    expect(compiled.metadata.templateVersion).toBe(1)
    expect(compiled.metadata.verificationHash).toMatch(/^TRT-DOC-[0-9A-F]{4}-[0-9A-F]{4}$/)
    expect(compiled.warnings).toHaveLength(0)

    // Check extracted structured fields
    const fields = extractStructuredFieldsFromDocument(compiled.content)
    expect(fields['Folio de Matrícula Inmobiliaria']).toBe('050N-204581')
    expect(fields['Cédula Catastral']).toBe('05001010400230012000')
    expect(fields['Nombre del Predio']).toBe('La Esperanza')
    expect(fields['Propietarios Identificados']).toBe('Carlos Gómez (CC 70123456)')
    expect(fields['Área de Servidumbre Requerida']).toBe('450.00 m²')
    expect(fields['Primera Oferta Formal Notificada']).toBe('$ 232.800.000')
    expect(fields['Código Único de Verificación']).toBe(compiled.metadata.verificationHash)
  })

  it('correctly extracts and replaces the narrative section while preserving structured tables', () => {
    const compiled = compileConsolidatedToTiptap(sampleRecord)
    const initialNarrative = extractNarrativeSection(compiled.content)
    expect(initialNarrative).toContain('Se verificó la cadena de tradición')

    const newNarrativeText = 'Análisis complementario: el predio se encuentra en zona rural suburbana sin traslapes con áreas protegidas.'
    const updatedContent = injectNarrativeSection(compiled.content, newNarrativeText)

    // Extracted narrative matches the new text
    const extractedUpdated = extractNarrativeSection(updatedContent)
    expect(extractedUpdated).toBe(newNarrativeText)

    // Structured fields remain identical
    const origFields = extractStructuredFieldsFromDocument(compiled.content)
    const updatedFields = extractStructuredFieldsFromDocument(updatedContent)
    expect(updatedFields).toEqual(origFields)
  })

  it('flags warnings when required fields are missing in the consolidated record', () => {
    const incompleteRecord: ConsolidatedMasterRecord = {
      ...sampleRecord,
      folio: '',
      easement_area: '',
    }
    const compiled = compileConsolidatedToTiptap(incompleteRecord)
    expect(compiled.warnings.length).toBeGreaterThanOrEqual(1)
  })
})
