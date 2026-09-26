import { beforeEach, describe, expect, it, vi } from 'vitest'

const requestExpedienteAnalysis = vi.hoisted(() => vi.fn())

vi.mock('./expedienteUpload', () => ({ requestExpedienteAnalysis }))

import { SupabaseExpedienteV2Repository } from './expedienteV2Repository'

describe('encolado remoto de expediente v2', () => {
  beforeEach(() => requestExpedienteAnalysis.mockReset())

  it('envía el reproceso por la Edge Function que despierta al worker', async () => {
    requestExpedienteAnalysis.mockResolvedValue('execution-123')
    const repository = new SupabaseExpedienteV2Repository()

    await expect(repository.queueGroupAnalysis({
      groupId: 'group-123',
      idempotencyKey: 'expediente-v2:group-123:request-123',
      extractorSnapshot: { phase: '3-and-4' },
      promptSnapshot: { schema: { phase: '4' } },
      modelSnapshot: { model: 'pipeline-phase4' },
    })).resolves.toBe('execution-123')

    expect(requestExpedienteAnalysis).toHaveBeenCalledWith({
      groupId: 'group-123',
      idempotencyKey: 'expediente-v2:group-123:request-123',
      extractorSnapshot: { phase: '3-and-4' },
      promptSnapshot: { schema: { phase: '4' } },
      modelSnapshot: { model: 'pipeline-phase4' },
    })
  })
})
