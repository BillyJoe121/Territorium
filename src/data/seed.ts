import type { PlatformState } from '../types'
import { DEFAULT_EXTRACTOR_CONFIGS, DEFAULT_PROMPT_VERSIONS } from '../lib/extractorConfig'

const now = new Date().toISOString()

export const seedState: PlatformState = {
  projects: [{ id: 'proyecto-demo', name: 'Corredor territorial — Demo', municipality: 'Bogotá D.C.', department: 'Cundinamarca', createdAt: now }],
  batches: [{ id: 'lote-demo', projectId: 'proyecto-demo', name: 'Lote de validación', createdAt: now, jobState: 'requiere_revision', progress: 100, runId: 'demo-run-001', error: null }],
  documents: [
    { id: 'doc-estudio-demo', projectId: 'proyecto-demo', batchId: 'lote-demo', name: 'Estudio de títulos — Predio La Esperanza.pdf', kind: 'estudio_titulos', size: 1442033, uploadedAt: now },
    { id: 'doc-plano-demo', projectId: 'proyecto-demo', batchId: 'lote-demo', name: 'Plano topográfico — La Esperanza.pdf', kind: 'plano', size: 983004, uploadedAt: now },
    { id: 'doc-negociacion-demo', projectId: 'proyecto-demo', batchId: 'lote-demo', name: 'Oferta de compra — La Esperanza.pdf', kind: 'negociacion', size: 312006, uploadedAt: now },
  ],
  records: [{
    id: 'predio-demo', projectId: 'proyecto-demo', sourceDocumentId: 'doc-estudio-demo', name: 'Predio La Esperanza', folio: '50N-2045587', municipality: 'Bogotá D.C.', reviewState: 'pendiente', confidence: 0.86, updatedAt: now,
    fields: {
      'Matrícula inmobiliaria': '50N-2045587', 'Dirección': 'Vereda La Esperanza, sector norte', 'Titular registrado': 'Pendiente de validación documental',
      'Área jurídica': '12 ha + 4.500 m²', 'Área según plano': '124.500 m²', 'Linderos': 'Requiere validación profesional',
      'Oferta 1': '$ 1.245.000.000', 'Oferta 2': '$ 1.260.000.000', 'Oferta 3': 'No identificada'
    }
  }],
  reviews: [{ id: 'revision-demo', recordId: 'predio-demo', title: 'Validar linderos', reason: 'La fuente no permite confirmar coincidencia entre el estudio y el plano.', severity: 'alta', state: 'pendiente' }],
  audit: [{ id: 'audit-demo', projectId: 'proyecto-demo', at: now, action: 'Demo preparada', detail: 'Datos de muestra: no corresponden a un concepto jurídico ni a una extracción de IA.' }],
  tasks: [],
  extractorConfigs: [...DEFAULT_EXTRACTOR_CONFIGS],
  promptVersions: [...DEFAULT_PROMPT_VERSIONS],
  aiLogs: [
    {
      id: 'log-demo-01',
      projectId: 'proyecto-demo',
      batchId: 'lote-demo',
      extractorKey: 'title_study',
      promptVersionId: 'prompt-title-v1',
      promptVersionNumber: 1,
      requestedModel: 'gpt-4o',
      usedModel: 'gpt-4o',
      fallbackTriggered: false,
      status: 'success',
      latencyMs: 1820,
      promptTokens: 2450,
      completionTokens: 610,
      totalTokens: 3060,
      estimatedCostUsd: 0.012225,
      isTestRun: false,
      createdAt: now,
    },
  ],
}

