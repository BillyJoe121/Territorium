import { describe, expect, it } from 'vitest'
import type { ConsolidatedMasterRecord } from './expedienteConsolidation'
import {
  buildPurePdfBinary,
  computeArtifactVerificationHash,
  generateExpedientePrintableHtml,
  getLinkedArtifactMetadata,
} from './expedientePdfGenerator'

describe('HU-V2-051: Official PDF Generator & Linked Artifacts', () => {
  const sampleRecord: ConsolidatedMasterRecord = {
    folio: '050N-204581',
    cadastral_id: '05001010400230012000',
    property_name: 'La Esperanza',
    municipality: 'Medellín',
    department: 'Antioquia',
    village: 'El Salado',
    owners: 'Carlos Gómez (CC 70123456)',
    acquisition_mode: 'Compraventa',
    boundaries: 'Norte: Los Pinos; Sur: Camino',
    boundaries_document: 'Escritura 1234 de 2010',
    legal_conditions: 'Sin gravámenes',
    justice_ministry_case: 'RAD-JUS-2024-001',
    urt_case: 'RAD-URT-2024-999',
    urt_territorial_direction: 'DT Antioquia',
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

  it('computes a deterministic verification hash for the artifact', () => {
    const hash1 = computeArtifactVerificationHash(sampleRecord, 1)
    const hash2 = computeArtifactVerificationHash(sampleRecord, 1)
    expect(hash1).toBe(hash2)
    expect(hash1).toMatch(/^TRT-AUD-[0-9A-F]{4}-[0-9A-F]{4}$/)
  })

  it('produces linked metadata matching the Excel format standards', () => {
    const meta = getLinkedArtifactMetadata(sampleRecord, {
      versionNumber: 1,
      expedienteId: 'EXP-001',
    })

    expect(meta.expedienteId).toBe('EXP-001')
    expect(meta.propertyFolio).toBe('050N-204581')
    expect(meta.cadastralId).toBe('05001010400230012000')
    expect(meta.documentVersion).toBe(1)
    expect(meta.titlesVersion).toBe('titles-v2')
    expect(meta.plansVersion).toBe('plans-v1')
    expect(meta.negotiationVersion).toBe('negotiation-v3')
    expect(meta.verificationHash).toMatch(/^TRT-AUD-/)
  })

  it('generates high-fidelity printable HTML with corporate styling and metadata', () => {
    const html = generateExpedientePrintableHtml(sampleRecord, { versionNumber: 1 })
    expect(html).toContain('GRUPO JURÍDICO TERRITORIUM')
    expect(html).toContain('#1E3A2B') // Territorium green banner
    expect(html).toContain('050N-204581')
    expect(html).toContain('Carlos Gómez')
    expect(html).toContain('450.00 m²')
    expect(html).toContain('TRT-AUD-')
    expect(html).toContain('Sincronizado con CORRESPONDENCIA.xlsx')
  })

  it('builds a valid binary PDF with standard header and %%EOF trailer', () => {
    const pdfBytes = buildPurePdfBinary(sampleRecord, { versionNumber: 1 })
    expect(pdfBytes).toBeInstanceOf(Uint8Array)
    expect(pdfBytes.length).toBeGreaterThan(500)

    // Decode to ASCII string to check PDF format compliance
    const text = String.fromCharCode(...pdfBytes)
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text.trim().endsWith('%%EOF')).toBe(true)
    expect(text).toContain('/Root 1 0 R')
    expect(text).toContain('TRT-AUD-')
  })
})
