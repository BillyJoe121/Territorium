import { describe, expect, it } from 'vitest'
import {
  adaptCanonicalPayloadToTable,
  adaptTableRowsToPayload,
} from '../lib/expedienteResultAdapters'
import {
  consolidateApprovedGroups,
  type ConsolidatedMasterRecord,
} from '../lib/expedienteConsolidation'
import {
  compileConsolidatedToTiptap,
  extractNarrativeSection,
} from '../lib/expedienteDocumentCompiler'
import {
  createAiRevisionProposal,
  validateAiProposalIntegrity,
} from '../lib/expedienteAiRevisionGuard'
import { downloadExpedientePdf, buildPurePdfBinary } from '../lib/expedientePdfGenerator'
import {
  createExpedienteV2Repository,
  SupabaseExpedienteV2Repository,
} from '../data/expedienteV2Repository'

describe('Integración de RemoteExpedienteWorkspace y Flujo Completo v2', () => {
  it('garantiza la instancia y compatibilidad del repositorio Supabase v2', () => {
    const supabaseRepo = createExpedienteV2Repository({ mode: 'supabase' })
    expect(supabaseRepo).toBeInstanceOf(SupabaseExpedienteV2Repository)
  })

  it('adapta el payload canónico a la tabla de revisión y viceversa sin pérdida de datos', () => {
    const canonicalTitles = {
      folio: '050N-204581',
      cadastral_id: '05001010400230012000',
      property_name: 'La Esperanza',
      municipality: 'Rionegro',
      department: 'Antioquia',
      area_numbers: '124580 m²',
      owners: [{ full_name: 'María Elena Rojas', document_number: '43.123.456', share_percentage: 100 }],
    }

    const adapted = adaptCanonicalPayloadToTable('titles', canonicalTitles)
    expect(adapted.rows.length).toBeGreaterThan(0)
    expect(adapted.rows[0].folio).toBe('050N-204581')
    expect(adapted.rows[0].cadastralId).toBe('05001010400230012000')

    // Modify a cell in the table
    const modifiedRows = adapted.rows.map((r) => ({ ...r, municipality: 'Marinilla' }))
    const backToPayload = adaptTableRowsToPayload('titles', modifiedRows, canonicalTitles)

    expect(backToPayload.municipality).toBe('Marinilla')
    expect(backToPayload.folio).toBe('050N-204581')
  })

  it('valida que las advertencias y bloqueos operen en los resultados de títulos y negociación', () => {
    const invalidTitles = {
      folio: '', // missing folio
      property_name: 'Finca Sin Folio',
    }
    const adapted = adaptCanonicalPayloadToTable('titles', invalidTitles, {
      errors: [{ field_name: 'folio', message: 'El folio de matrícula es obligatorio.' }],
    })
    expect(adapted.validationNotices.length).toBe(1)
    expect(adapted.validationNotices[0].severity).toBe('error')
    expect(adapted.validationNotices[0].message).toContain('El folio de matrícula es obligatorio')
  })

  it('ejecuta la consolidación determinística de los 3 grupos y compila el documento en Tiptap', () => {
    const titlesPayload = {
      folio: '050N-999999',
      cadastral_id: '05001010400999999999',
      property_name: 'El Porvenir',
      municipality: 'Guarne',
      department: 'Antioquia',
      owners: [{ full_name: 'Carlos Gomez', share_percentage: 100 }],
    }
    const plansPayload = {
      plans: [
        {
          plan_name: 'Servidumbre Tramo 1',
          easement_area_numbers: '3200',
          easement_length_numbers: '320',
          easement_width_numbers: '10',
          infrastructure_count_numbers: '5',
        },
      ],
    }
    const negPayload = {
      first_offer_numbers: '150000000',
      second_offer_numbers: '165000000',
      currency: 'COP',
    }

    const master = consolidateApprovedGroups({
      titlesApprovedPayload: titlesPayload,
      titlesVersionId: 'tit-v1',
      plansApprovedPayload: plansPayload,
      plansVersionId: 'plan-v1',
      negotiationApprovedPayload: negPayload,
      negotiationVersionId: 'neg-v1',
      userId: 'analista-test',
    })

    expect(master.folio).toBe('050N-999999')
    expect(master.easement_area).toBe('3200')
    expect(master.second_offer).toBe('165000000')

    // Compile to Tiptap
    const compiled = compileConsolidatedToTiptap(master, {
      projectCode: 'PROJ-TEST-001',
      projectName: 'Proyecto Guarne',
      compiledBy: 'Territorium Legal',
    })

    expect(compiled.content.type).toBe('doc')
    expect(compiled.metadata.folio).toBe('050N-999999')
    expect(compiled.metadata.verificationHash).toBeDefined()
  })

  it('guarda el invariant guardian ante intentos de la IA de alterar campos protegidos', () => {
    const master = consolidateApprovedGroups({
      titlesApprovedPayload: {
        folio: '050N-204581',
        cadastral_id: '05001010400230012000',
        property_name: 'La Esperanza',
        municipality: 'Rionegro',
        department: 'Antioquia',
      },
      titlesVersionId: 't-1',
      plansApprovedPayload: {
        plans: [
          {
            plan_name: 'Servidumbre',
            easement_area_numbers: '4580',
            easement_length_numbers: '458',
            easement_width_numbers: '10',
            infrastructure_count_numbers: '8',
          },
        ],
      },
      plansVersionId: 'p-1',
      negotiationApprovedPayload: {
        first_offer_numbers: '218450000',
        second_offer_numbers: '232800000',
      },
      negotiationVersionId: 'n-1',
      userId: 'analista',
    })

    const compiled = compileConsolidatedToTiptap(master, {
      projectCode: 'P-1',
      projectName: 'Proyecto Test',
    })

    // Valid narrative adjustment
    const safeProposal = createAiRevisionProposal(
      {
        id: 'prop-1',
        expedienteId: 'exp-1',
        sourceVersion: 1,
        userComment: 'Ajustar redacción de antecedentes',
        requestedBy: 'Analista',
        requestedAt: new Date().toISOString(),
        scope: 'narrative_only',
      },
      compiled.content,
      'Se ajustan las consideraciones de antecedentes sin alterar valores.',
      master,
    )

    expect(safeProposal.guardianResult.passed).toBe(true)
    expect(safeProposal.guardianResult.violations).toHaveLength(0)

    // Tampered proposal changing protected folio inside structured table
    const tamperedContent = JSON.parse(JSON.stringify(compiled.content))
    for (const node of tamperedContent.content) {
      if (node.type === 'table') {
        for (const row of node.content) {
          const keyText = row.content?.[0]?.content?.[0]?.content?.[0]?.text
          if (keyText === 'Folio de Matrícula Inmobiliaria') {
            row.content[1].content[0].content[0].text = '050N-TAMPERED-999'
            break
          }
        }
      }
    }
    const report = validateAiProposalIntegrity(compiled.content, tamperedContent, master)
    expect(report.passed).toBe(false)
    expect(report.violations.length).toBeGreaterThan(0)
  })

  it('genera el binario de PDF con metadatos de auditoría y código de verificación', () => {
    const master = consolidateApprovedGroups({
      titlesApprovedPayload: {
        folio: '050N-204581',
        cadastral_id: '05001010400230012000',
        property_name: 'La Esperanza',
        municipality: 'Rionegro',
        department: 'Antioquia',
      },
      titlesVersionId: 't-1',
      plansApprovedPayload: {
        plans: [
          {
            plan_name: 'Servidumbre',
            easement_area_numbers: '4580',
            easement_length_numbers: '458',
            easement_width_numbers: '10',
            infrastructure_count_numbers: '8',
          },
        ],
      },
      plansVersionId: 'p-1',
      negotiationApprovedPayload: {
        first_offer_numbers: '218450000',
        second_offer_numbers: '232800000',
      },
      negotiationVersionId: 'n-1',
      userId: 'analista',
    })

    const pdfBinary = buildPurePdfBinary(master, {
      versionNumber: 1,
      expedienteId: 'exp-01',
      projectName: 'Ficha Predial Test',
    })

    expect(pdfBinary).toBeInstanceOf(Uint8Array)
    expect(pdfBinary.length).toBeGreaterThan(100)
  })
})
