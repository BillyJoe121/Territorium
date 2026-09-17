import { describe, it, expect } from 'vitest'
import {
  validateSessionPolicy,
  computeProjectOverallStatus,
  createProjectBackupSnapshot
} from '../lib/projectLifecycle'
import {
  validateBatchUploadLimits,
  scanFileForThreats,
  createNewDocumentVersion
} from '../lib/storageSecurity'
import {
  pauseBatch,
  resumeBatch,
  recoverStalledTasks,
  evaluateBudgetCap
} from '../lib/batchOrchestrationP1'
import {
  validateNegotiationTemplate,
  extractNegotiationOffers,
  compareBoundariesVisualDiff
} from '../lib/negotiationExtraction'
import {
  createManualPropertyMasterRecord,
  bulkApproveUncontestedAttributes
} from '../lib/attributeAuditHistory'
import {
  DEFAULT_LEGAL_TEMPLATES,
  renderDocumentTemplate,
  generateLegalDocument,
  createGeneratedDocumentsZip
} from '../lib/documentGeneration'
import {
  computeExecutionMetricsSummary,
  exportOperationalMetricsToCsv
} from '../lib/operationsObservability'
import type {
  Project,
  ProjectConfiguration,
  Batch,
  DocumentTask,
  PropertyRecord,
  SourceDocument,
  AiExecutionLog
} from '../types'

describe('US-154: E2E Pipeline Workflow P1 (Headless)', () => {
  it('ejecuta el ciclo de vida completo de un expediente predial empresarial de extremo a extremo', async () => {
    // 1. Configuración de Proyecto y Seguridad (E01, US-008, US-017)
    const mockProjectConfig: ProjectConfiguration = {
      projectId: 'proj-transmision-2026',
      sessionTimeoutMinutes: 30,
      mfaRequired: true,
      allowedWebOrigins: ['https://app.territorium.co'],
      maxFilesPerBatch: 20,
      maxBatchSizeMb: 50,
      allowedMimeTypes: ['application/pdf'],
      retentionDaysRaw: 365,
      retentionDaysDerivatives: 180,
      retentionDaysExports: 90,
      autoPurgeEnabled: true,
      budgetCapUsd: 100,
      budgetAlertThresholdPercent: 80
    }

    const sessionCheck = validateSessionPolicy(mockProjectConfig, 15, true, 'https://app.territorium.co')
    expect(sessionCheck.valid).toBe(true)

    const mockProject: Project = {
      id: 'proj-transmision-2026',
      name: 'Línea de Transmisión 500kV',
      clientName: 'Interconexión Eléctrica S.A.',
      department: 'Antioquia',
      municipality: 'Medellín',
      createdAt: '2026-09-17T10:00:00Z',
      budgetCapUsd: 100,
      totalSpentUsd: 25.5
    }

    const overallStatus = computeProjectOverallStatus(mockProject, [], [])
    expect(overallStatus).toBe('sin_lotes')

    // 2. Ingesta y Seguridad de Almacenamiento (E03, US-030, US-031, US-041)
    const batchFiles = [
      { name: 'plano_topografico.pdf', size: 1024 * 1024 },
      { name: 'estudio_titulos.pdf', size: 500 * 1024 }
    ]
    const limitsCheck = validateBatchUploadLimits(batchFiles, mockProjectConfig)
    expect(limitsCheck.valid).toBe(true)

    const sampleBuffer = new TextEncoder().encode('%PDF-1.7 Documento predial verificado')
    const scanResult = scanFileForThreats('plano_topografico.pdf', sampleBuffer)
    expect(scanResult.scanStatus).toBe('clean')

    const sourceDoc: SourceDocument = {
      id: 'doc-001',
      projectId: 'proj-transmision-2026',
      batchId: 'batch-01',
      name: 'plano_topografico.pdf',
      kind: 'plano',
      size: 1024 * 1024,
      uploadedAt: '2026-09-17T10:00:00Z'
    }

    const { version: docVersion } = createNewDocumentVersion(
      sourceDoc,
      'storage/plano_topografico.pdf',
      'plano_topografico.pdf',
      1024 * 1024,
      'hash-plano-v1',
      [],
      'Versión inicial aprobada'
    )
    expect(docVersion.versionNumber).toBe(1)
    expect(docVersion.isCurrent).toBe(true)

    // 3. Orquestación y Control de Costos (E05, E06, US-053, US-055, US-064)
    const budgetStatus = evaluateBudgetCap(mockProject, mockProjectConfig, 5.0)
    expect(budgetStatus.allowed).toBe(true)

    const mockBatch: Batch = {
      id: 'batch-01',
      projectId: 'proj-transmision-2026',
      name: 'Lote Predios Prioritarios',
      createdAt: new Date().toISOString(),
      jobState: 'en_proceso',
      progress: 40,
      runId: 'run-01',
      error: null,
      isPaused: false
    }

    const mockTasks: DocumentTask[] = [
      {
        id: 'task-1',
        batchId: 'batch-01',
        projectId: 'proj-transmision-2026',
        sourceDocumentId: 'doc-001',
        extractorKey: 'title_study',
        status: 'running',
        dependencyStatus: 'ready',
        dependsOnExtractors: [],
        attemptCount: 1,
        maxAttempts: 3,
        tokensUsed: 450,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        leaseExpiresAt: '2026-01-01T12:00:00Z',
        startedAt: '2026-01-01T11:00:00Z'
      }
    ]

    const paused = pauseBatch(mockBatch, mockTasks)
    expect(paused.batch.isPaused).toBe(true)

    const resumed = resumeBatch(paused.batch, paused.queuedTasksPaused)
    expect(resumed.batch.isPaused).toBe(false)

    const nowRecover = new Date('2026-01-01T12:30:00Z')
    const { recoveredCount, updatedTasks } = recoverStalledTasks(mockTasks, nowRecover, 10)
    expect(recoveredCount).toBe(1)
    expect(updatedTasks[0].status).toBe('queued')

    // 4. Extracción de Negociación y Validación de Linderos (E07, E08, US-076, US-087, US-088)
    const templateValidation = validateNegotiationTemplate([
      'Codigo_Predial',
      'Oferta_Inicial_Num',
      'Oferta_Inicial_Letras',
      'Oferta_Definitiva_Num',
      'Oferta_Definitiva_Letras'
    ])
    expect(templateValidation.isValid).toBe(true)

    const extractedOffers = extractNegotiationOffers(
      {
        propertyCode: 'PREDIO-001',
        initialOfferNum: 75000000,
        initialOfferText: 'setenta y cinco millones de pesos',
        negotiatedOfferNum: 78000000,
        negotiatedOfferText: 'setenta y ocho millones de pesos',
        finalOfferNum: 80000000,
        finalOfferText: 'ochenta millones de pesos',
        rowIndex: 11
      },
      'proj-transmision-2026',
      'batch-01'
    )
    expect(extractedOffers.offersMatchStatus).toBe('coinciden')
    expect(extractedOffers.finalOfferNum).toBe(80000000)

    const boundaryDiff = compareBoundariesVisualDiff(
      'Norte con Predio Las Acacias; Sur con Rio Negro; Oriente con Via Principal; Occidente con Quebrada El Salto',
      'Norte con Predio Las Acacias; Sur con Rio Negro; Oriente con Via Principal; Occidente con Quebrada El Salto'
    )
    expect(boundaryDiff.similarityRatio).toBeGreaterThan(0.9)
    expect(boundaryDiff.isCloseMatch).toBe(true)

    // 5. Auditoría de Atributos y Aprobación en Bloque (E11, US-113, US-114)
    const { record: masterRecord, history: initialHistory } = createManualPropertyMasterRecord(
      'PREDIO-001',
      'proj-transmision-2026',
      'batch-01',
      'Creación manual verificada',
      {
        municipio: 'Medellín',
        propietario: 'CARLOS ALBERTO RAMIREZ'
      },
      'usr-analyst'
    )
    expect(initialHistory.length).toBe(2)
    expect(masterRecord.attributes['municipio'].manualValue).toBe('Medellín')

    const { updatedRecord, approvedCount } = bulkApproveUncontestedAttributes(
      masterRecord,
      'usr-supervisor'
    )
    expect(approvedCount).toBe(2)
    expect(updatedRecord.attributes['municipio'].sourceState).toBe('approved')

    // 6. Generación Documental Jurídica y Empaque Masivo (E12, US-119, US-126)
    const propertyPayload = {
      codigo_predial: 'PREDIO-001',
      propietario_actual: 'CARLOS ALBERTO RAMIREZ',
      cedula_propietario: '19.876.543',
      matricula_inmobiliaria: '050-123456',
      municipio: 'Medellín',
      linderos: 'Norte con Predio Las Acacias...',
      area_afectada_m2: '1200.00',
      oferta_definitiva_num: '80000000',
      oferta_definitiva_letras: 'ochenta millones de pesos'
    }

    const tmpl = DEFAULT_LEGAL_TEMPLATES['oferta_economica']
    const renderedText = renderDocumentTemplate(tmpl, propertyPayload)
    expect(renderedText).toContain('CARLOS ALBERTO RAMIREZ')
    expect(renderedText).toContain('80000000')

    const generatedDoc = generateLegalDocument(
      tmpl,
      'proj-transmision-2026',
      'PREDIO-001',
      propertyPayload,
      [],
      'usr-lawyer'
    )
    expect(generatedDoc.status).toBe('generated')
    expect(generatedDoc.templateVersion).toBe(1)

    const zipBytes = await createGeneratedDocumentsZip([
      { document: generatedDoc, content: renderedText }
    ])
    expect(zipBytes.length).toBeGreaterThan(50)

    // 7. Observabilidad Operativa y Exportación de Métricas (E13, US-133, US-135)
    const executionLogs: AiExecutionLog[] = [
      {
        id: 'log-1',
        projectId: 'proj-transmision-2026',
        taskId: 'task-1',
        extractorKey: 'negotiation',
        requestedModel: 'gemini-2.5-pro',
        usedModel: 'gemini-2.5-pro',
        fallbackTriggered: false,
        isTestRun: false,
        promptTokens: 3500,
        completionTokens: 600,
        totalTokens: 4100,
        estimatedCostUsd: 0.0095,
        latencyMs: 4200,
        status: 'success',
        createdAt: new Date().toISOString()
      }
    ]

    const metricsSummary = computeExecutionMetricsSummary(executionLogs)
    expect(metricsSummary.totalCostUsd).toBe(0.01) // Math.round(0.0095 * 1000) / 1000 = 0.01
    expect(metricsSummary.byExtractor['negotiation'].count).toBe(1)

    const csvData = exportOperationalMetricsToCsv(executionLogs)
    expect(csvData).toContain('extractor_key,requested_model,used_model')
    expect(csvData).toContain('negotiation')

    // 8. Snapshot y Respaldo del Expediente (E14, US-142)
    const snapshot = createProjectBackupSnapshot(
      mockProject,
      mockProjectConfig,
      [],
      [],
      'Cierre satisfactorio hito P1'
    )
    expect(snapshot.id.startsWith('snap-')).toBe(true)
    expect(snapshot.label).toBe('Cierre satisfactorio hito P1')
    expect((snapshot.payload as any).project.name).toBe('Línea de Transmisión 500kV')
  })
})
