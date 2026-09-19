import type { JSONContent } from '@tiptap/react'
import type { ConsolidatedMasterRecord } from './expedienteConsolidation'
import {
  extractNarrativeSection,
  extractStructuredFieldsFromDocument,
  injectNarrativeSection,
} from './expedienteDocumentCompiler'

export interface AiRevisionRequest {
  id: string
  expedienteId: string
  sourceVersion: number
  userComment: string
  requestedBy: string
  requestedAt: string
  scope: 'narrative_only'
}

export interface ProtectedFieldViolation {
  fieldName: string
  originalValue: string
  proposedValue: string
}

export interface GuardCheckResult {
  passed: boolean
  violations: ProtectedFieldViolation[]
  missingProtectedFields: string[]
  summary: string
}

export interface AiRevisionProposal {
  id: string
  requestId: string
  sourceVersion: number
  proposedVersion: number
  proposedContent: JSONContent
  previousNarrative: string
  proposedNarrative: string
  guardianResult: GuardCheckResult
  createdAt: string
  author: string
}

/**
 * List of critical protected key labels that MUST NOT be altered by any AI revision.
 */
export const PROTECTED_DOCUMENT_LABELS = [
  'Nombre del Predio',
  'Folio de Matrícula Inmobiliaria',
  'Cédula Catastral',
  'Ubicación Territorial',
  'Propietarios Identificados',
  'Modo de Adquisición',
  'Linderos Registrados',
  'Documento de Linderos',
  'Condiciones Jurídicas y Gravámenes',
  'Radicado Ministerio de Justicia',
  'Radicado Unidad de Restitución de Tierras (URT)',
  'Área de Servidumbre Requerida',
  'Longitud de Servidumbre',
  'Ancho de Servidumbre',
  'Infraestructuras Afectadas (Postes / Torres)',
  'Primera Oferta Formal Notificada',
  'Segunda Oferta Formal',
  'Tercera Oferta Formal',
  'Código Único de Verificación',
  'Versiones de Origen Aprobadas',
]

/**
 * Validates that an AI-generated proposal does NOT tamper with or delete
 * any approved structured legal, technical, or economic property values (HU-V2-050).
 */
export function validateAiProposalIntegrity(
  currentDoc: JSONContent,
  proposedDoc: JSONContent,
  masterRecord?: ConsolidatedMasterRecord,
): GuardCheckResult {
  const currentFields = extractStructuredFieldsFromDocument(currentDoc)
  const proposedFields = extractStructuredFieldsFromDocument(proposedDoc)

  const violations: ProtectedFieldViolation[] = []
  const missingProtectedFields: string[] = []

  // 1. Verify every current protected field is preserved exactly
  for (const [key, origVal] of Object.entries(currentFields)) {
    const isProtected = PROTECTED_DOCUMENT_LABELS.some((l) => key.toLowerCase().includes(l.toLowerCase()))
    if (!isProtected) continue

    if (!(key in proposedFields)) {
      missingProtectedFields.push(key)
      violations.push({
        fieldName: key,
        originalValue: origVal,
        proposedValue: 'ELIMINADO / AUSENTE',
      })
      continue
    }

    const proposedVal = proposedFields[key]
    if (origVal.trim() !== proposedVal.trim()) {
      violations.push({
        fieldName: key,
        originalValue: origVal,
        proposedValue: proposedVal,
      })
    }
  }

  // 2. If masterRecord is provided, cross-check critical values directly
  if (masterRecord) {
    const folioKey = Object.keys(proposedFields).find((k) => k.includes('Folio'))
    if (folioKey && proposedFields[folioKey] !== masterRecord.folio) {
      if (!violations.some((v) => v.fieldName === folioKey)) {
        violations.push({
          fieldName: folioKey,
          originalValue: masterRecord.folio,
          proposedValue: proposedFields[folioKey],
        })
      }
    }

    const cedulaKey = Object.keys(proposedFields).find((k) => k.includes('Cédula'))
    if (cedulaKey && proposedFields[cedulaKey] !== masterRecord.cadastral_id) {
      if (!violations.some((v) => v.fieldName === cedulaKey)) {
        violations.push({
          fieldName: cedulaKey,
          originalValue: masterRecord.cadastral_id,
          proposedValue: proposedFields[cedulaKey],
        })
      }
    }
  }

  const passed = violations.length === 0 && missingProtectedFields.length === 0
  const summary = passed
    ? 'El guardián de campos protegidos validó exitosamente la propuesta: todos los datos estructurados aprobados se conservan intactos.'
    : `Se detectaron ${violations.length} alteración(es) no autorizada(s) en campos estructurados aprobados. La propuesta no puede ser aplicada automáticamente.`

  return {
    passed,
    violations,
    missingProtectedFields,
    summary,
  }
}

/**
 * Creates an immutable AI revision proposal from a user prompt, ensuring
 * that the source version is preserved and only narrative is touched (HU-V2-050).
 */
export function createAiRevisionProposal(
  request: AiRevisionRequest,
  currentDoc: JSONContent,
  simulatedOrGeneratedNarrative: string,
  masterRecord?: ConsolidatedMasterRecord,
): AiRevisionProposal {
  const previousNarrative = extractNarrativeSection(currentDoc)
  const proposedContent = injectNarrativeSection(currentDoc, simulatedOrGeneratedNarrative)

  const guardianResult = validateAiProposalIntegrity(currentDoc, proposedContent, masterRecord)

  return {
    id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    requestId: request.id,
    sourceVersion: request.sourceVersion,
    proposedVersion: request.sourceVersion + 1,
    proposedContent,
    previousNarrative,
    proposedNarrative: simulatedOrGeneratedNarrative,
    guardianResult,
    createdAt: new Date().toISOString(),
    author: 'Asistente IA Territorium (Revisión Narrativa)',
  }
}
