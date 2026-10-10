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
  targetFilename: string
  documentType: string
  requiredFields: (keyof ConsolidatedMasterRecord)[]
  sections: TemplateSectionDefinition[]
  metadata?: {
    legalJurisdiction?: string
    notes?: string
    filename?: string
    badge?: string
    category?: string
    description?: string
  }
}

/**
 * 1. Template: Escritura Pública de Adquisición / Servidumbre
 * Based directly on: ESCRITURA TOL-ANZ-045.docx
 */
export const ESCRITURA_TOL_ANZ_045_TEMPLATE: ExpedienteDocumentTemplate = {
  id: 'tpl-escritura-publica',
  code: 'ESCRITURA_TOL_ANZ_045',
  name: 'Escritura Pública de Adquisición / Servidumbre',
  version: 1,
  status: 'published',
  publishedAt: '2026-01-15T08:00:00.000Z',
  publishedBy: 'Dirección Jurídica - Territorium',
  targetFilename: 'ESCRITURA TOL-ANZ-045.docx',
  documentType: 'Escritura Pública de Adquisición / Servidumbre',
  requiredFields: [
    'folio',
    'cadastral_id',
    'property_name',
    'municipality',
    'department',
    'owners',
    'acquisition_mode',
    'boundaries',
    'easement_area',
    'first_offer',
  ],
  metadata: {
    filename: 'ESCRITURA TOL-ANZ-045.docx',
    badge: 'Minuta Notarial',
    category: 'Escritura Notarial',
    description:
      'Protocolización notarial formal con formato de calificación SNR, comparecencia de otorgantes y beneficiaria, 21 cláusulas legales completas, alinderación y poderes.',
  },
  sections: [
    {
      id: 'sec-calificacion-snr',
      title: 'Formato de Calificación SNR',
      type: 'structured_header',
      isProtected: true,
      fields: ['owners', 'folio', 'cadastral_id', 'first_offer'],
      description: 'Acto, comparecientes, cuantía y matrícula inmobiliaria.',
    },
    {
      id: 'sec-comparecencia',
      title: 'Comparecencia y Consideraciones',
      type: 'legal_identity',
      isProtected: true,
      fields: ['municipality', 'department', 'owners', 'property_code', 'voltage_level'],
      description: 'Identificación de otorgantes, apoderados y consideraciones de proyecto.',
    },
    {
      id: 'sec-clausulas-legales',
      title: 'Cláusulas Jurídicas (1 a 21)',
      type: 'narrative_observations',
      isProtected: false,
      fields: ['property_name', 'boundaries', 'easement_area', 'first_offer', 'legal_conditions'],
      description: '21 cláusulas notariales completas con salvaguardas legales y patrimoniales.',
    },
    {
      id: 'sec-firmas',
      title: 'Otorgamiento y Firmas',
      type: 'signatures',
      isProtected: true,
      fields: ['metadata'],
      description: 'Firmas formales de comparecientes, apoderados y constancia notarial.',
    },
  ],
}

/**
 * 2. Template: Ficha Técnica de Descripción de Linderos
 * Based directly on: ID02 descripción de linderos.docx
 */
export const DESCRIPCION_LINDEROS_TEMPLATE: ExpedienteDocumentTemplate = {
  id: 'tpl-descripcion-linderos',
  code: 'ID02_DESCRIPCION_LINDEROS',
  name: 'Ficha Técnica de Descripción de Linderos',
  version: 1,
  status: 'published',
  publishedAt: '2026-01-15T08:00:00.000Z',
  publishedBy: 'Dirección Técnica y Topográfica - Territorium',
  targetFilename: 'ID02 descripción de linderos.docx',
  documentType: 'Ficha Técnica de Descripción de Linderos',
  requiredFields: [
    'property_name',
    'easement_area',
    'easement_length',
    'easement_width',
    'plan_name',
  ],
  metadata: {
    filename: 'ID02 descripción de linderos.docx',
    badge: 'Ficha Técnica',
    category: 'Topografía y Georreferenciación',
    description:
      'Descripción técnica exhaustiva y georreferenciada de franjas de servidumbre por tramos con límites cardinales y cuadros de coordenadas CTM12.',
  },
  sections: [
    {
      id: 'sec-franja-area',
      title: 'Área y Dimensiones de Franja',
      type: 'technical_parameters',
      isProtected: true,
      fields: ['easement_area', 'easement_length', 'easement_width'],
      description: 'Superficie, longitud y ancho total de la franja de servidumbre.',
    },
    {
      id: 'sec-tramos-linderos',
      title: 'Descripción de Vértices y Rumbos por Tramos',
      type: 'legal_identity',
      isProtected: false,
      fields: ['property_name', 'boundaries'],
      description: 'Alinderación poligonal por tramos (Norte, Este, Sur, Oeste).',
    },
    {
      id: 'sec-coordenadas-ctm12',
      title: 'Cuadros Técnicos de Coordenadas CTM12',
      type: 'technical_parameters',
      isProtected: true,
      fields: ['plan_name', 'plan_scale', 'infrastructure_count'],
      description: 'Tablas de coordenadas geográficas oficiales y referencias de plano.',
    },
  ],
}

/**
 * 3. Template: Minuta Tipo Territorium
 * Based directly on: MINUTA_TIPO_TERRITORIUM.doc
 */
export const MINUTA_TIPO_TERRITORIUM_TEMPLATE: ExpedienteDocumentTemplate = {
  id: 'tpl-minuta-tipo',
  code: 'MINUTA_TIPO_TERRITORIUM',
  name: 'Minuta Tipo Territorium',
  version: 1,
  status: 'published',
  publishedAt: '2026-01-15T08:00:00.000Z',
  publishedBy: 'Dirección Jurídica y Corporativa - Territorium',
  targetFilename: 'MINUTA_TIPO_TERRITORIUM.doc',
  documentType: 'Minuta Tipo Territorium',
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
  metadata: {
    filename: 'MINUTA_TIPO_TERRITORIUM.doc',
    badge: 'Minuta Tipo',
    category: 'Minuta Corporativa',
    description:
      'Minuta contractual integral corporativa con tablas de calificación registral SNR, comparecencia ampliada, 19 cláusulas y constancias notariales.',
  },
  sections: [
    {
      id: 'sec-tablas-snr',
      title: 'Tablas SNR de Calificación y Bienes',
      type: 'structured_header',
      isProtected: true,
      fields: ['folio', 'cadastral_id', 'property_name', 'municipality', 'department', 'first_offer'],
      description: 'Tablas registrales de actos, cuantías, intervinientes e identificación predial.',
    },
    {
      id: 'sec-comparecencia-minuta',
      title: 'Comparecencia y Consideraciones de Proyecto',
      type: 'legal_identity',
      isProtected: true,
      fields: ['owners', 'municipality', 'department', 'folio'],
      description: 'Partes comparecientes, representaciones y antecedentes del proyecto.',
    },
    {
      id: 'sec-clausulas-minuta',
      title: 'Cláusulas Contractuales (1 a 19)',
      type: 'narrative_observations',
      isProtected: false,
      fields: ['property_name', 'boundaries', 'acquisition_mode', 'easement_area', 'first_offer'],
      description: 'Cláusulas 1 a 19 completas con tablas de coordenadas CTM12.',
    },
    {
      id: 'sec-comprobantes-firmas',
      title: 'Comprobantes Legales y Otorgamiento',
      type: 'signatures',
      isProtected: true,
      fields: ['metadata'],
      description: 'Advertencias notariales, notas de cierre y suscripción.',
    },
  ],
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
  targetFilename: 'INFORME_PREDIAL_OFICIAL.docx',
  documentType: 'Informe Técnico-Jurídico y Económico',
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
      isProtected: false,
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
 * The 3 official final document templates matching `plantillas documentos finales`.
 */
export const OFFICIAL_FINAL_DOCUMENT_TEMPLATES: ExpedienteDocumentTemplate[] = [
  ESCRITURA_TOL_ANZ_045_TEMPLATE,
  DESCRIPCION_LINDEROS_TEMPLATE,
  MINUTA_TIPO_TERRITORIUM_TEMPLATE,
]
