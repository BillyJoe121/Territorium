import type { ConsolidatedMasterRecord } from './expedienteConsolidation'

export type TemplateStatus = 'draft' | 'published' | 'deprecated'

export type SectionType = 'structured_header' | 'legal_identity' | 'technical_parameters' | 'economic_offers' | 'narrative_observations' | 'signatures'

export interface TemplateSectionDefinition {
  id: string
  title: string
  type: SectionType
  isProtected: boolean // Protected sections cannot be altered by AI revision proposals
  fields: (keyof ConsolidatedMasterRecord | string)[]
  description?: string
  defaultNarrative?: string
}

export interface ExpedienteDocumentTemplate {
  id: string
  code: string
  name: string
  version: number
  status: TemplateStatus
  publishedAt: string
  publishedBy: string
  requiredFields: (keyof ConsolidatedMasterRecord)[]
  sections: TemplateSectionDefinition[]
  metadata?: {
    legalJurisdiction?: string
    notes?: string
  }
}

/**
 * Official Template Version 1 for Territorium 2.0 (HU-V2-047).
 * Standardized for Colombian Land Legal & Technical property dossiers.
 */
export const OFFICIAL_PREDIAL_TEMPLATE_V1: ExpedienteDocumentTemplate = {
  id: 'tpl-informe-predial-v1',
  code: 'INFORME_PREDIAL_OFICIAL',
  name: 'Informe Técnico-Jurídico y Económico de Adquisición Predial',
  version: 1,
  status: 'published',
  publishedAt: '2026-01-15T08:00:00.000Z',
  publishedBy: 'Dirección Jurídica y Predial - Grupo Territorium',
  requiredFields: [
    'folio',
    'cadastral_id',
    'property_name',
    'municipality',
    'department',
    'owners',
    'boundaries',
    'easement_area',
    'first_offer',
  ],
  sections: [
    {
      id: 'sec-header',
      title: 'Identificación General del Expediente Predial',
      type: 'structured_header',
      isProtected: true,
      fields: ['property_name', 'folio', 'cadastral_id', 'municipality', 'department', 'village'],
      description: 'Identificación institucional y catastral del único predio.',
    },
    {
      id: 'sec-legal',
      title: '1. Diagnóstico Jurídico y Titularidad',
      type: 'legal_identity',
      isProtected: true,
      fields: [
        'owners',
        'acquisition_mode',
        'boundaries',
        'boundaries_document',
        'legal_conditions',
        'justice_ministry_case',
        'urt_case',
        'urt_territorial_direction',
      ],
      description: 'Estudio de títulos, linderos, gravámenes y consultas a víctimas.',
    },
    {
      id: 'sec-technical',
      title: '2. Parámetros Técnicos y Afectación Predial',
      type: 'technical_parameters',
      isProtected: true,
      fields: [
        'easement_area',
        'easement_length',
        'easement_width',
        'infrastructure_count',
        'plan_name',
        'plan_scale',
        'voltage_level',
      ],
      description: 'Cabida superficiaria, franja de servidumbre e infraestructura.',
    },
    {
      id: 'sec-economic',
      title: '3. Valoración Económica y Negociación Directa',
      type: 'economic_offers',
      isProtected: true,
      fields: ['property_code', 'first_offer', 'second_offer', 'third_offer', 'values_match'],
      description: 'Valores indemnizatorios avalados y ofertas notificadas.',
    },
    {
      id: 'sec-narrative',
      title: '4. Consideraciones Jurídicas y Recomendaciones',
      type: 'narrative_observations',
      isProtected: false, // Narrative section editable by user and refined by AI
      fields: [],
      description: 'Análisis cualitativo, viabilidad del saneamiento y próximos pasos procesales.',
      defaultNarrative:
        'Se verificó la cadena de tradición del inmueble sin que se identifiquen medidas cautelares o gravámenes que impidan la protocolización de la enajenación voluntaria. Se recomienda continuar con el trámite de formalización y suscripción de promesa de compraventa conforme al avalúo comercial vigente.',
    },
    {
      id: 'sec-signatures',
      title: '5. Constancia y Trazabilidad de Aprobación',
      type: 'signatures',
      isProtected: true,
      fields: ['metadata'],
      description: 'Firmas institucionales y código de verificación documental.',
    },
  ],
}

/**
 * Historical registry of available templates.
 */
const TEMPLATE_REGISTRY: Record<string, ExpedienteDocumentTemplate> = {
  'tpl-informe-predial-v1': OFFICIAL_PREDIAL_TEMPLATE_V1,
}

export function getActiveDocumentTemplate(): ExpedienteDocumentTemplate {
  return OFFICIAL_PREDIAL_TEMPLATE_V1
}

export function getTemplateById(id: string): ExpedienteDocumentTemplate | null {
  return TEMPLATE_REGISTRY[id] ?? null
}

export function getTemplateByVersion(version: number): ExpedienteDocumentTemplate | null {
  const tpl = Object.values(TEMPLATE_REGISTRY).find((t) => t.version === version && t.status === 'published')
  return tpl ?? null
}

export interface TemplateValidationResult {
  isValid: boolean
  missingFields: (keyof ConsolidatedMasterRecord)[]
  fieldErrors: Partial<Record<keyof ConsolidatedMasterRecord, string>>
}

/**
 * Validates that a ConsolidatedMasterRecord meets all required fields
 * stipulated by the active template before document compilation (HU-V2-047).
 */
export function validateConsolidatedAgainstTemplate(
  record: ConsolidatedMasterRecord | null | undefined,
  template: ExpedienteDocumentTemplate = OFFICIAL_PREDIAL_TEMPLATE_V1,
): TemplateValidationResult {
  if (!record) {
    return {
      isValid: false,
      missingFields: [...template.requiredFields],
      fieldErrors: {
        folio: 'El expediente no tiene registro consolidado disponible.',
      },
    }
  }

  const missingFields: (keyof ConsolidatedMasterRecord)[] = []
  const fieldErrors: Partial<Record<keyof ConsolidatedMasterRecord, string>> = {}

  for (const field of template.requiredFields) {
    const rawVal = record[field]
    const strVal = typeof rawVal === 'string' ? rawVal.trim() : String(rawVal ?? '').trim()

    if (!strVal || strVal === '—' || strVal.toLowerCase() === 'no identificado') {
      missingFields.push(field)
      fieldErrors[field] = `El campo requerido '${String(field)}' no posee un valor válido o consolidado.`
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
    fieldErrors,
  }
}

/**
 * Creates a new published template version without mutating historical templates (HU-V2-047).
 */
export function publishNewTemplateVersion(
  baseTemplate: ExpedienteDocumentTemplate,
  updates: Partial<Omit<ExpedienteDocumentTemplate, 'id' | 'version' | 'status' | 'publishedAt'>>,
  publishedBy: string,
): ExpedienteDocumentTemplate {
  const nextVersion = baseTemplate.version + 1
  const newTemplate: ExpedienteDocumentTemplate = {
    ...baseTemplate,
    ...updates,
    id: `tpl-informe-predial-v${nextVersion}`,
    version: nextVersion,
    status: 'published',
    publishedAt: new Date().toISOString(),
    publishedBy,
    requiredFields: updates.requiredFields ?? [...baseTemplate.requiredFields],
    sections: updates.sections ?? [...baseTemplate.sections],
  }

  TEMPLATE_REGISTRY[newTemplate.id] = newTemplate
  return newTemplate
}
