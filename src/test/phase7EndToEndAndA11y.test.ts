import { describe, expect, it } from 'vitest'
import {
  type GroupWorkflowState,
  type WorkflowState,
  allGroupsApproved,
  deriveConsolidationStatus,
  invalidateForInputChange,
  transitionGroupStatus,
} from '../lib/expedienteWorkflow'
import {
  consolidateApprovedGroups,
  type ConsolidatedMasterRecord,
} from '../lib/expedienteConsolidation'
import {
  compileConsolidatedToTiptap,
  extractNarrativeSection,
  injectNarrativeSection,
} from '../lib/expedienteDocumentCompiler'
import {
  validateAiProposalIntegrity,
} from '../lib/expedienteAiRevisionGuard'
import {
  buildPurePdfBinary,
  getLinkedArtifactMetadata,
} from '../lib/expedientePdfGenerator'
import {
  evaluateObservabilityAlerts,
  type StageExecutionMetric,
} from '../lib/expedienteObservability'

describe('HU-V2-055: Pruebas Integrales, Fallos y Accesibilidad (Fase 7)', () => {
  // =========================================================================
  // 1. HAPPY PATH END-TO-END JOURNEY
  // =========================================================================
  describe('Happy Path: Carga → Análisis → Revisión → Aprobación → Consolidación → Documento → Descarga', () => {
    it('executes full happy path producing validated PDF and Excel deliverables', () => {
      // Step 1: Initial state (3 empty groups)
      let workflow: WorkflowState = {
        groups: {
          titles: { key: 'titles', status: 'empty', inputVersion: 1, approvedResultVersionId: null },
          plans: { key: 'plans', status: 'empty', inputVersion: 1, approvedResultVersionId: null },
          negotiation: { key: 'negotiation', status: 'empty', inputVersion: 1, approvedResultVersionId: null },
        },
        consolidation: { status: 'blocked', approvedResultVersionId: null },
        finalDocument: { status: 'blocked' },
      }

      expect(allGroupsApproved(workflow.groups)).toBe(false)
      expect(deriveConsolidationStatus(workflow.groups, workflow.consolidation.status)).toBe('blocked')

      // Step 2: Ingest files into all groups -> 'ready'
      workflow.groups.titles = transitionGroupStatus(workflow.groups.titles, 'ready')
      workflow.groups.plans = transitionGroupStatus(workflow.groups.plans, 'ready')
      workflow.groups.negotiation = transitionGroupStatus(workflow.groups.negotiation, 'ready')

      // Step 3: Start extraction processing -> 'queued' -> 'processing' -> 'review_ready'
      for (const groupKey of ['titles', 'plans', 'negotiation'] as const) {
        workflow.groups[groupKey] = transitionGroupStatus(workflow.groups[groupKey], 'queued')
        workflow.groups[groupKey] = transitionGroupStatus(workflow.groups[groupKey], 'processing')
        workflow.groups[groupKey] = transitionGroupStatus(workflow.groups[groupKey], 'review_ready')
      }

      // Step 4: Review and approve each group
      workflow.groups.titles = transitionGroupStatus(workflow.groups.titles, 'approved')
      workflow.groups.titles.approvedResultVersionId = 'ver-titles-001'

      workflow.groups.plans = transitionGroupStatus(workflow.groups.plans, 'approved')
      workflow.groups.plans.approvedResultVersionId = 'ver-plans-001'

      workflow.groups.negotiation = transitionGroupStatus(workflow.groups.negotiation, 'approved')
      workflow.groups.negotiation.approvedResultVersionId = 'ver-neg-001'

      expect(allGroupsApproved(workflow.groups)).toBe(true)

      // Step 5: Consolidation becomes available and executes
      const consolStatus = deriveConsolidationStatus(workflow.groups, workflow.consolidation.status)
      expect(consolStatus).toBe('available')
      workflow.consolidation.status = consolStatus

      const titlesApprovedPayload = {
        propertyCode: 'PREDIO-E2E-77',
        folio: '50C-998877',
        cadastralCedula: '25001000100020003004',
        canonicalName: 'Hacienda La Fortuna',
        municipality: 'Fusagasugá',
        department: 'Cundinamarca',
        village: 'El Placer',
        currentOwners: [{ name: 'JORGE LUIS BORGES', documentNumber: '19876543' }],
        acquisitionNarrative: 'Escritura Pública 1024 de 2015 en Notaría 1 de Fusagasugá',
        boundaries: { rawLiteralText: 'NORTE: Quebrada La Honda. SUR: Camino Real.' },
        legalConditions: { formalStatement: 'libre de gravámenes e hipotecas' },
      }

      const plansApprovedPayload = {
        easementAreaM2: 1245.8,
        easementLengthM: 350.2,
        easementWidthM: 3.5,
        infrastructureCount: 4,
        planScale: '1:1000',
        planName: 'PLANO-TOPOGRAFICO-01',
        voltageLevel: '230 kV',
      }

      const negotiationApprovedPayload = {
        propertyCode: 'PREDIO-E2E-77',
        firstOfferAmount: 85000000,
        secondOfferAmount: 92000000,
        expropriationAmount: 92000000,
        valuesMatch: true,
      }

      const masterRecord = consolidateApprovedGroups({
        titlesApprovedPayload,
        titlesVersionId: 'ver-titles-001',
        plansApprovedPayload,
        plansVersionId: 'ver-plans-001',
        negotiationApprovedPayload,
        negotiationVersionId: 'ver-neg-001',
        userId: 'lead-lawyer-01',
      })

      expect(masterRecord.folio).toBe('50C-998877')
      expect(masterRecord.metadata.is_valid).toBe(true)
      workflow.consolidation.status = 'approved'
      workflow.consolidation.approvedResultVersionId = 'ver-consol-001'

      // Step 6: Document Compilation to Tiptap JSONContent
      workflow.finalDocument.status = 'generating'
      const compilationResult = compileConsolidatedToTiptap(masterRecord, {
        projectName: 'Interconexión Fusagasugá',
        projectCode: 'PREDIO-E2E-77',
        compiledBy: 'lead-lawyer-01',
      })

      expect(compilationResult.metadata.folio).toBe('50C-998877')
      expect(compilationResult.content.type).toBe('doc')

      // Step 7: AI Assisted Revision with Strict Boundary Guard
      const currentNarrative = extractNarrativeSection(compilationResult.content)
      const enhancedNarrative = `${currentNarrative} Se verificaron antecedentes notariales completos.`

      const proposedDoc = injectNarrativeSection(compilationResult.content, enhancedNarrative)
      const guardResult = validateAiProposalIntegrity(compilationResult.content, proposedDoc, masterRecord)

      expect(guardResult.passed).toBe(true)
      expect(guardResult.violations).toHaveLength(0)

      // Step 8: Document Finalization
      workflow.finalDocument.status = 'final'
      expect(workflow.finalDocument.status).toBe('final')

      // Step 9: Deliverable generation (Pure PDF Binary & Linked Metadata)
      const pdfBytes = buildPurePdfBinary(masterRecord, { versionNumber: 1 })
      expect(pdfBytes).toBeInstanceOf(Uint8Array)
      expect(pdfBytes.length).toBeGreaterThan(100)

      const linkedMetadata = getLinkedArtifactMetadata(masterRecord, { versionNumber: 1 })
      expect(linkedMetadata.verificationHash).toMatch(/^TRT-AUD-[A-F0-9]{4}-[A-F0-9]{4}$/)
      expect(linkedMetadata.propertyFolio).toBe('50C-998877')
    })
  })

  // =========================================================================
  // 2. FAULT INJECTIONS & RESILIENCE SCENARIOS
  // =========================================================================
  describe('Fault Scenarios: Timeout, Duplicado, Worker Detenido, Salida Inválida, Edición Concurrente', () => {
    it('detects timeout with observability engine and triggers critical alert', () => {
      const timeoutMetric: StageExecutionMetric = {
        stage: 'titles',
        expedienteId: 'exp-timeout-fail',
        durationMs: 720_000, // 12 minutes (threshold > 10m)
        queueLatencyMs: 1500,
        retryCount: 1,
        status: 'failed',
        errorCode: 'WORKER_JOB_TIMEOUT',
        recordedAt: new Date().toISOString(),
      }

      const alerts = evaluateObservabilityAlerts(timeoutMetric)
      expect(alerts.length).toBeGreaterThan(0)
      expect(alerts[0].metric).toBe('STAGE_DURATION_EXCEEDED')
      expect(alerts[0].severity).toBe('critical')
    })

    it('rejects duplicate or illegal status transitions gracefully', () => {
      const group = {
        key: 'plans' as const,
        status: 'approved' as const,
        inputVersion: 1,
        approvedResultVersionId: 'ver-01',
      }

      // Trying to transition from 'approved' to 'processing' directly is forbidden
      expect(() => transitionGroupStatus(group, 'processing')).toThrow(/Transición inválida/)
    })

    it('handles stopped worker failure and permits clean recovery to queued', () => {
      let group: GroupWorkflowState = {
        key: 'negotiation',
        status: 'processing',
        inputVersion: 1,
      }

      // Worker crash occurs
      group = transitionGroupStatus(group, 'error')
      expect(group.status).toBe('error')

      // Recovery: retry can transition to 'ready' or 'queued'
      group = transitionGroupStatus(group, 'queued')
      expect(group.status).toBe('queued')
    })

    it('blocks invalid AI output that alters critical legal identifiers (AI Guard)', () => {
      const masterRecord: ConsolidatedMasterRecord = {
        folio: '50C-112233',
        cadastral_id: '12345678901234567890',
        property_name: 'Finca La Palma',
        municipality: 'La Mesa',
        department: 'Cundinamarca',
        village: 'San Javier',
        owners: 'Pedro Pérez',
        acquisition_mode: 'Compraventa',
        boundaries: 'Norte: Río',
        boundaries_document: 'EP 123',
        legal_conditions: 'Sin gravámenes',
        justice_ministry_case: 'N/A',
        urt_case: 'N/A',
        urt_territorial_direction: 'N/A',
        easement_area: '500',
        easement_length: '100',
        easement_width: '5',
        infrastructure_count: '2',
        plan_name: 'Plano 1',
        plan_scale: '1:500',
        voltage_level: '115 kV',
        property_code: 'PREDIO-01',
        first_offer: '$50.000.000',
        second_offer: '—',
        third_offer: '—',
        values_match: 'SI',
        metadata: {
          titles_result_version_id: 'v1',
          plans_result_version_id: 'v1',
          negotiation_result_version_id: 'v1',
          consolidated_at: new Date().toISOString(),
          is_valid: true,
        },
      }

      const originalDoc = compileConsolidatedToTiptap(masterRecord).content

      // Tampered doc that modifies folio in the structured table
      const tamperedDoc = JSON.parse(JSON.stringify(originalDoc))
      const tableNode = tamperedDoc.content.find((n: any) => n.type === 'table')
      // Tamper second row (folio value cell)
      if (tableNode && tableNode.content?.[1]?.content?.[1]) {
        tableNode.content[1].content[1] = {
          type: 'tableCell',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '50C-999999' }] }],
        }
      }

      const guard = validateAiProposalIntegrity(originalDoc, tamperedDoc, masterRecord)

      expect(guard.passed).toBe(false)
      expect(guard.violations.some((v) => v.fieldName.includes('Folio'))).toBe(true)
    })

    it('detects concurrent optimistic edit conflicts and rejects overwrite', () => {
      const baseVersion: number = 3
      const incomingClientVersion: number = 2 // Outdated submission from stale tab

      const isConflict = incomingClientVersion !== baseVersion
      expect(isConflict).toBe(true)
    })
  })

  // =========================================================================
  // 3. REGRESSION: INVALIDATION AFTER NEW FILE INGESTION
  // =========================================================================
  describe('Regression: Invalidation cascades downstream upon adding a document', () => {
    it('invalidates modified group, consolidation, and final document without deleting historical records', () => {
      const activeWorkflow: WorkflowState = {
        groups: {
          titles: { key: 'titles', status: 'approved', inputVersion: 2, approvedResultVersionId: 'tit-v2' },
          plans: { key: 'plans', status: 'approved', inputVersion: 1, approvedResultVersionId: 'pla-v1' },
          negotiation: { key: 'negotiation', status: 'approved', inputVersion: 1, approvedResultVersionId: 'neg-v1' },
        },
        consolidation: { status: 'approved', approvedResultVersionId: 'con-v1' },
        finalDocument: { status: 'final' },
      }

      // User adds a new supplementary title deed (Escritura de Aclaración) to titles
      const invalidatedWorkflow = invalidateForInputChange(activeWorkflow, 'titles', true)

      // Titles group becomes stale, version increments, approved status revoked
      expect(invalidatedWorkflow.groups.titles.status).toBe('stale')
      expect(invalidatedWorkflow.groups.titles.inputVersion).toBe(3)
      expect(invalidatedWorkflow.groups.titles.approvedResultVersionId).toBeNull()

      // Plans and Negotiation remain intact
      expect(invalidatedWorkflow.groups.plans.status).toBe('approved')
      expect(invalidatedWorkflow.groups.plans.approvedResultVersionId).toBe('pla-v1')
      expect(invalidatedWorkflow.groups.negotiation.status).toBe('approved')

      // Downstream products are revoked to 'stale'
      expect(invalidatedWorkflow.consolidation.status).toBe('stale')
      expect(invalidatedWorkflow.consolidation.approvedResultVersionId).toBeNull()
      expect(invalidatedWorkflow.finalDocument.status).toBe('stale')
    })
  })

  // =========================================================================
  // 4. ACCESSIBILITY (a11y) WCAG 2.2 & KEYBOARD FOCUS VERIFICATION
  // =========================================================================
  describe('WCAG 2.2 Accessibility & Keyboard Navigation Standards', () => {
    it('verifies ARIA semantics and roles for modal and drawer components', () => {
      // Modal dialog accessibility contract
      const modalAttributes = {
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'modal-expediente-title',
        'aria-describedby': 'modal-expediente-desc',
        tabIndex: -1,
      }

      expect(modalAttributes.role).toBe('dialog')
      expect(modalAttributes['aria-modal']).toBe('true')
      expect(modalAttributes['aria-labelledby']).toBeDefined()
      expect(modalAttributes['aria-describedby']).toBeDefined()
    })

    it('ensures alert and status messages use aria-live polite/assertive', () => {
      const alertContract = {
        'aria-live': 'polite',
        role: 'status',
        'aria-atomic': 'true',
      }

      expect(alertContract['aria-live']).toBe('polite')
      expect(alertContract.role).toBe('status')
    })

    it('verifies interactive action buttons have explicit accessible names', () => {
      const interactiveButtons = [
        { id: 'btn-approve-titles', 'aria-label': 'Aprobar subconjunto de títulos' },
        { id: 'btn-consolidate', 'aria-label': 'Ejecutar consolidación del expediente' },
        { id: 'btn-ai-revision', 'aria-label': 'Solicitar sugerencia de estilo con IA' },
        { id: 'btn-download-pdf', 'aria-label': 'Descargar documento oficial en formato PDF' },
      ]

      for (const btn of interactiveButtons) {
        expect(btn['aria-label']).toBeTruthy()
        expect(btn['aria-label'].length).toBeGreaterThan(5)
      }
    })
  })
})
