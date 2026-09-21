import { describe, expect, it } from 'vitest'
import {
  createExpedienteV2Repository,
  DemoExpedienteV2Repository,
  SupabaseExpedienteV2Repository,
  EditConflictError,
} from './expedienteV2Repository'

const snapshot = {
  identity: {
    id: 'identity-1', projectId: 'project-1', version: 1, folio: '050N-204581', cadastralId: null,
    propertyName: 'La Esperanza', municipality: 'Rionegro', department: 'Antioquia', village: null,
  },
  groups: {
    titles: { id: 'titles-1', projectId: 'project-1', key: 'titles' as const, status: 'ready' as const, inputVersion: 1, approvedResultVersionId: null, currentNegotiationFileId: null },
    plans: { id: 'plans-1', projectId: 'project-1', key: 'plans' as const, status: 'empty' as const, inputVersion: 1, approvedResultVersionId: null, currentNegotiationFileId: null },
    negotiation: { id: 'negotiation-1', projectId: 'project-1', key: 'negotiation' as const, status: 'empty' as const, inputVersion: 1, approvedResultVersionId: null, currentNegotiationFileId: null },
  },
  consolidation: { status: 'blocked' as const, approvedResultVersionId: null },
  finalDocument: { status: 'blocked' as const },
}

describe('contrato de repositorio del expediente v2', () => {
  it('mantiene el escenario demo aislado y devuelve copias seguras', async () => {
    const repository = new DemoExpedienteV2Repository(new Map([['project-1', snapshot]]))
    const first = await repository.load('project-1')
    first.groups.titles.status = 'approved'
    const second = await repository.load('project-1')

    expect(second.groups.titles.status).toBe('ready')
    await expect(repository.queueGroupAnalysis({ groupId: 'titles-1', idempotencyKey: 'short' })).rejects.toThrow('idempotencia')
    await expect(repository.queueGroupAnalysis({ groupId: 'titles-1', idempotencyKey: 'idempotency-key-0001' })).resolves.toBe('demo-execution-titles-1')
  })

  it('cambia el adaptador sin cambiar el contrato que consume la ficha', () => {
    const demo = createExpedienteV2Repository({ mode: 'demo', demoSnapshots: new Map([['project-1', snapshot]]) })
    const remote = createExpedienteV2Repository({ mode: 'supabase' })

    expect(demo).toBeInstanceOf(DemoExpedienteV2Repository)
    expect(remote).toBeInstanceOf(SupabaseExpedienteV2Repository)
  })

  it('permite persistir borrador con control de concurrencia optimista (HU-V2-043)', async () => {
    const repository = new DemoExpedienteV2Repository(new Map([['project-1', snapshot]]))
    await repository.saveDraft('ver-1', { folio: '050N-204581' }, 'Cambio inicial', 1)

    const saved = await repository.getResultVersion('titles-1')
    expect(saved).toBeDefined()
    expect(saved?.payload.folio).toBe('050N-204581')

    // Detect conflict when expectedVersionNumber doesn't match
    await expect(
      repository.saveDraft('ver-1', { folio: 'OTRO-VALOR' }, 'Conflicto', 99),
    ).rejects.toThrow(EditConflictError)
  })

  it('permite formalizar aprobación y congelar versión (HU-V2-044)', async () => {
    const repository = new DemoExpedienteV2Repository(new Map([['project-1', snapshot]]))
    await repository.saveDraft('ver-1', { folio: '050N-204581' }, 'Listo para aprobar', 1)

    const res = await repository.approveResult('ver-1')
    expect(res).toBe('demo-approval-ver-1')

    const approved = await repository.getResultVersion('titles-1')
    expect(approved?.status).toBe('approved')
  })

  it('permite re-procesamiento de grupo y consolidación determinística (HU-V2-044, HU-V2-045)', async () => {
    const repository = new DemoExpedienteV2Repository(new Map([['project-1', snapshot]]))
    const reprocessRes = await repository.reprocessGroup('titles-1')
    expect(reprocessRes).toBe('demo-reprocess-titles-1')

    const consId = await repository.consolidate('project-1')
    expect(consId).toBe('demo-cons-project-1')

    const consVer = await repository.getConsolidatedResultVersion('project-1')
    expect(consVer).toBeDefined()
    expect(consVer?.scope).toBe('consolidated')
  })

  it('versiona el documento y rechaza un guardado concurrente obsoleto', async () => {
    const repository = new DemoExpedienteV2Repository(new Map([['project-1', snapshot]]))
    const first = await repository.saveDocument('project-1', { type: 'doc', content: [] }, null, 'Versión inicial')
    const second = await repository.saveDocument('project-1', { type: 'doc', content: [{ type: 'paragraph' }] }, first.id, 'Edición manual')

    expect(second.versionNumber).toBe(2)
    expect(second.parentDocumentVersionId).toBe(first.id)
    await expect(
      repository.saveDocument('project-1', { type: 'doc', content: [] }, first.id, 'Intento obsoleto'),
    ).rejects.toThrow(EditConflictError)
  })
})
