import { describe, expect, it } from 'vitest'
import type { ConsolidatedMasterRecord } from './expedienteConsolidation'
import {
  getActiveDocumentTemplate,
  getTemplateById,
  getTemplateByVersion,
  publishNewTemplateVersion,
  validateConsolidatedAgainstTemplate,
  OFFICIAL_PREDIAL_TEMPLATE_V1,
} from './expedienteDocumentTemplates'

describe('HU-V2-047: Versioned Document Templates', () => {
  const mockMasterRecord: ConsolidatedMasterRecord = {
    folio: '050N-204581',
    cadastral_id: '05001010400230012000',
    property_name: 'La Esperanza',
    municipality: 'Medellín',
    department: 'Antioquia',
    village: 'El Salado',
    owners: 'Carlos Gómez (CC 70123456)',
    acquisition_mode: 'Compraventa',
    boundaries: 'Norte: Quebrada; Sur: Camino',
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

  it('provides the official template with version 1, published status, and required fields', () => {
    const template = getActiveDocumentTemplate()
    expect(template.id).toBe('tpl-informe-predial-v1')
    expect(template.code).toBe('INFORME_PREDIAL_OFICIAL')
    expect(template.version).toBe(1)
    expect(template.status).toBe('published')
    expect(template.requiredFields).toContain('folio')
    expect(template.requiredFields).toContain('cadastral_id')
    expect(template.requiredFields).toContain('property_name')
    expect(template.requiredFields).toContain('owners')
    expect(template.requiredFields).toContain('easement_area')
    expect(template.requiredFields).toContain('first_offer')
  })

  it('retrieves templates by ID and by version number', () => {
    const tplById = getTemplateById('tpl-informe-predial-v1')
    expect(tplById).toBeDefined()
    expect(tplById?.version).toBe(1)

    const tplByVer = getTemplateByVersion(1)
    expect(tplByVer).toBeDefined()
    expect(tplByVer?.id).toBe('tpl-informe-predial-v1')
  })

  it('validates a complete ConsolidatedMasterRecord successfully', () => {
    const result = validateConsolidatedAgainstTemplate(mockMasterRecord)
    expect(result.isValid).toBe(true)
    expect(result.missingFields).toHaveLength(0)
    expect(Object.keys(result.fieldErrors)).toHaveLength(0)
  })

  it('blocks validation and flags missing required fields when property data is incomplete', () => {
    const incompleteRecord: ConsolidatedMasterRecord = {
      ...mockMasterRecord,
      folio: '',
      owners: 'no identificado',
      easement_area: '—',
    }

    const result = validateConsolidatedAgainstTemplate(incompleteRecord)
    expect(result.isValid).toBe(false)
    expect(result.missingFields).toContain('folio')
    expect(result.missingFields).toContain('owners')
    expect(result.missingFields).toContain('easement_area')
    expect(result.fieldErrors.folio).toContain("El campo requerido 'folio'")
  })

  it('publishing a new template version creates an immutable next version without mutating previous templates', () => {
    const base = getActiveDocumentTemplate()
    const newVersion = publishNewTemplateVersion(
      base,
      {
        name: 'Informe Predial Version 2 Actualizado',
      },
      'Comité Jurídico Territorium',
    )

    expect(newVersion.version).toBe(2)
    expect(newVersion.id).toBe('tpl-informe-predial-v2')
    expect(newVersion.publishedBy).toBe('Comité Jurídico Territorium')

    // Historical v1 remains intact
    const originalV1 = getTemplateById('tpl-informe-predial-v1')
    expect(originalV1?.version).toBe(1)
    expect(originalV1?.name).toBe('Informe Técnico-Jurídico y Económico de Adquisición Predial')
  })
})
