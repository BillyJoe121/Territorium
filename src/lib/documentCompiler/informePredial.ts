import type { JSONContent } from '@tiptap/react'
import type { ConsolidatedMasterRecord } from '../expedienteConsolidation'
import type { ExpedienteDocumentTemplate } from '../expedienteDocumentTemplates'
import { createParagraph, createHeading, createKeyValueTable } from './nodes'
import type { DocumentCompilerOptions } from './types'

/**
 * Standard predial diagnostic report (V1)
 */
export function compileStandardPredialReportNodes(
  record: ConsolidatedMasterRecord,
  template: ExpedienteDocumentTemplate,
  _options: DocumentCompilerOptions,
  verificationCode: string,
  compiledAt: string,
  narrativeText: string,
): JSONContent[] {
  return [
    // Header
    createHeading(1, template.name.toUpperCase()),
    createParagraph(
      `Expediente Predial Oficial — Territorium Grupo Jurídico | Generación Determinística (Plantilla ${template.code} v${template.version})`,
    ),

    // 1. Identificación Predial
    createHeading(2, '1. Identificación Predial y Catastral'),
    createKeyValueTable([
      ['Nombre del Predio', record.property_name],
      ['Folio de Matrícula Inmobiliaria', record.folio],
      ['Cédula Catastral', record.cadastral_id],
      ['Ubicación Territorial', `${record.municipality}, ${record.department}`],
      ['Vereda / Sector', record.village || 'No especificada'],
      ['Código Interno de Gestión', record.property_code || '—'],
    ]),

    // 2. Diagnóstico Jurídico y Titularidad
    createHeading(2, '2. Diagnóstico Jurídico y Titularidad'),
    createKeyValueTable([
      ['Propietarios Identificados', record.owners],
      ['Modo de Adquisición', record.acquisition_mode],
      ['Linderos Registrados', record.boundaries],
      ['Documento de Linderos', record.boundaries_document],
      ['Condiciones Jurídicas y Gravámenes', record.legal_conditions],
      ['Radicado Ministerio de Justicia', record.justice_ministry_case],
      ['Radicado Unidad de Restitución de Tierras (URT)', record.urt_case],
      ['Dirección Territorial URT', record.urt_territorial_direction],
    ]),

    // 3. Parámetros Técnicos y Afectación
    createHeading(2, '3. Parámetros Técnicos y Franja de Servidumbre'),
    createKeyValueTable([
      ['Área de Servidumbre Requerida', `${record.easement_area} m²`],
      ['Longitud de Servidumbre', `${record.easement_length} m`],
      ['Ancho de Servidumbre', `${record.easement_width} m`],
      ['Infraestructuras Afectadas (Postes / Torres)', record.infrastructure_count],
      ['Plano Topográfico Referenciado', record.plan_name],
      ['Escala del Plano', record.plan_scale],
      ['Nivel de Tensión / Servidumbre', record.voltage_level],
    ]),

    // 4. Valoración Económica y Negociación
    createHeading(2, '4. Valoración Económica y Negociación Directa'),
    createKeyValueTable([
      ['Primera Oferta Formal Notificada', record.first_offer],
      ['Segunda Oferta Formal', record.second_offer],
      ['Tercera Oferta Formal', record.third_offer],
      ['Coincidencia de Valores Números/Letras', record.values_match],
      ['Valor Negociado', record.negotiated_value ? `${record.negotiated_value} (${record.negotiated_value_letters ?? ''})` : '—'],
    ]),

    // 5. Consideraciones Jurídicas (Sección Narrativa para IA / usuario)
    createHeading(2, '5. Consideraciones Jurídicas y Recomendaciones'),
    createParagraph(narrativeText),

    // 6. Trazabilidad y Firmas
    createHeading(2, '6. Constancia y Trazabilidad de Aprobación'),
    createKeyValueTable([
      ['Código Único de Verificación', verificationCode],
      ['Plantilla Utilizada', `${template.name} (${template.code} v${template.version})`],
      ['Versión Consolidado Maestro', `Consolidado v${record.metadata.is_valid ? '1' : '0'}`],
      ['Fecha y Hora de Consolidación', record.metadata.consolidated_at],
      [
        'Versiones de Origen Aprobadas',
        `Títulos: ${record.metadata.titles_result_version_id} | Planos: ${record.metadata.plans_result_version_id} | Negociación: ${record.metadata.negotiation_result_version_id}`,
      ],
      ['Fecha de Compilación Documental', compiledAt],
    ]),
  ]
}
