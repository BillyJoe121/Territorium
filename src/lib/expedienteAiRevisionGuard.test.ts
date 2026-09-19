import { describe, expect, it } from 'vitest'
import type { ConsolidatedMasterRecord } from './expedienteConsolidation'
import {
  compileConsolidatedToTiptap,
} from './expedienteDocumentCompiler'
import {
  createAiRevisionProposal,
  validateAiProposalIntegrity,
} from './expedienteAiRevisionGuard'

describe('HU-V2-050: AI Revision Guard & Protected Fields Integrity', () => {
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

  it('allows clean narrative revisions where structured fields remain completely untouched', () => {
    const compiled = compileConsolidatedToTiptap(sampleRecord)
    const request = {
      id: 'req-01',
      expedienteId: 'exp-01',
      sourceVersion: 1,
      userComment: 'Ajustar el tono formal de las conclusiones jurídicas.',
      requestedBy: 'Analista Jurídico',
      requestedAt: '2026-09-18T12:00:00Z',
      scope: 'narrative_only' as const,
    }

    const proposedNarrative =
      'Se ratifica la procedencia técnica y jurídica de la adquisición del predio La Esperanza.'
    const proposal = createAiRevisionProposal(request, compiled.content, proposedNarrative, sampleRecord)

    expect(proposal.sourceVersion).toBe(1)
    expect(proposal.proposedVersion).toBe(2)
    expect(proposal.guardianResult.passed).toBe(true)
    expect(proposal.guardianResult.violations).toHaveLength(0)
    expect(proposal.guardianResult.summary).toContain('validó exitosamente')
  })

  it('detects and blocks tampering when an AI proposal alters a protected structured field', () => {
    const compiled = compileConsolidatedToTiptap(sampleRecord)

    // Artificially tamper with the proposed document content
    const tamperedDoc = JSON.parse(JSON.stringify(compiled.content))
    // Find table cell containing Folio or Offer and change it
    let tampered = false
    for (const node of tamperedDoc.content) {
      if (node.type === 'table') {
        for (const row of node.content) {
          const keyText = row.content?.[0]?.content?.[0]?.content?.[0]?.text
          if (keyText === 'Folio de Matrícula Inmobiliaria') {
            row.content[1].content[0].content[0].text = '050N-ALTERED-999'
            tampered = true
            break
          }
        }
      }
      if (tampered) break
    }

    expect(tampered).toBe(true)

    const guardResult = validateAiProposalIntegrity(compiled.content, tamperedDoc, sampleRecord)
    expect(guardResult.passed).toBe(false)
    expect(guardResult.violations.length).toBeGreaterThanOrEqual(1)
    expect(guardResult.violations[0].fieldName).toContain('Folio')
    expect(guardResult.violations[0].originalValue).toBe('050N-204581')
    expect(guardResult.violations[0].proposedValue).toBe('050N-ALTERED-999')
  })

  it('detects missing protected fields if an AI proposal deletes structured tables', () => {
    const compiled = compileConsolidatedToTiptap(sampleRecord)

    // Remove tables from content
    const strippedDoc = {
      ...compiled.content,
      content: compiled.content.content?.filter((node: any) => node.type !== 'table'),
    }

    const guardResult = validateAiProposalIntegrity(compiled.content, strippedDoc, sampleRecord)
    expect(guardResult.passed).toBe(false)
    expect(guardResult.missingProtectedFields.length).toBeGreaterThan(0)
  })
})
