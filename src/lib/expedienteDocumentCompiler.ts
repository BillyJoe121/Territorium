import type { JSONContent } from '@tiptap/react'
import type { ConsolidatedMasterRecord } from './expedienteConsolidation'
import { OFFICIAL_PREDIAL_TEMPLATE_V1 } from './expedienteDocumentTemplates'
import { computeDeterministicVerificationCode } from './documentCompiler/nodes'
import { compileEscrituraPublicaNodes } from './documentCompiler/escrituraPublica'
import { compileDescripcionLinderosNodes } from './documentCompiler/descripcionLinderos'
import { compileMinutaTipoTerritoriumNodes } from './documentCompiler/minutaTipo'
import { compileStandardPredialReportNodes } from './documentCompiler/informePredial'
import type { DocumentCompilationMetadata, DocumentCompilationResult, DocumentCompilerOptions } from './documentCompiler/types'

export type { DocumentCompilationMetadata, DocumentCompilationResult, DocumentCompilerOptions } from './documentCompiler/types'

/**
 * Deterministically compiles an approved ConsolidatedMasterRecord into
 * structured Tiptap JSONContent (HU-V2-048).
 *
 * Rules:
 * - Structured fields (Folio, Cédula, Propietarios, Linderos, Ofertas, Áreas) are injected
 *   verbatim without AI hallucinations.
 * - Missing values are highlighted with warning indicators.
 * - Supports the 3 official templates from plantillas documentos finales.
 */
export function compileConsolidatedToTiptap(
  record: ConsolidatedMasterRecord,
  options: DocumentCompilerOptions = {},
): DocumentCompilationResult {
  const template = options.template ?? OFFICIAL_PREDIAL_TEMPLATE_V1
  const warnings: string[] = []

  // Check required fields
  for (const field of template.requiredFields) {
    const val = record[field]
    if (!val || val === '—' || String(val).trim() === '') {
      warnings.push(`Campo requerido '${String(field)}' no cuenta con información en el consolidado.`)
    }
  }

  const verificationCode = computeDeterministicVerificationCode(record, template.version)
  const compiledAt = new Date().toISOString()

  const narrativeText =
    options.narrativeOverride ??
    template.sections.find((s) => s.type === 'narrative_observations')?.defaultNarrative ??
    'Se verificó la cadena de tradición del predio sin hallazgos impeditivos para el saneamiento.'

  let docNodes: JSONContent[]

  if (template.id === 'tpl-escritura-publica' || template.code === 'ESCRITURA_TOL_ANZ_045') {
    docNodes = compileEscrituraPublicaNodes(record, options)
  } else if (template.id === 'tpl-descripcion-linderos' || template.code === 'ID02_DESCRIPCION_LINDEROS') {
    docNodes = compileDescripcionLinderosNodes(record, options)
  } else if (template.id === 'tpl-minuta-tipo' || template.code === 'MINUTA_TIPO_TERRITORIUM') {
    docNodes = compileMinutaTipoTerritoriumNodes(record, options)
  } else {
    docNodes = compileStandardPredialReportNodes(
      record,
      template,
      options,
      verificationCode,
      compiledAt,
      narrativeText,
    )
  }

  const content: JSONContent = {
    type: 'doc',
    content: docNodes,
  }

  const metadata: DocumentCompilationMetadata = {
    templateId: template.id,
    templateVersion: template.version,
    consolidatedAt: record.metadata.consolidated_at,
    titlesVersionId: record.metadata.titles_result_version_id,
    plansVersionId: record.metadata.plans_result_version_id,
    negotiationVersionId: record.metadata.negotiation_result_version_id,
    compiledAt,
    compiledBy: options.compiledBy,
    folio: record.folio,
    cadastralId: record.cadastral_id,
    verificationHash: verificationCode,
  }

  return {
    content,
    metadata,
    warnings,
  }
}
