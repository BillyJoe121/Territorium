import type { JSONContent } from '@tiptap/react'
import type { ExpedienteDocumentTemplate } from '../expedienteDocumentTemplates'

export interface DocumentCompilationMetadata {
  templateId: string
  templateVersion: number
  consolidatedAt: string
  titlesVersionId: string
  plansVersionId: string
  negotiationVersionId: string
  compiledAt: string
  compiledBy?: string
  folio: string
  cadastralId: string
  verificationHash: string
}

export interface DocumentCompilationResult {
  content: JSONContent
  metadata: DocumentCompilationMetadata
  warnings: string[]
}

export interface DocumentCompilerOptions {
  projectName?: string
  projectCode?: string
  compiledBy?: string
  narrativeOverride?: string
  template?: ExpedienteDocumentTemplate
}
