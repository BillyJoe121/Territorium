import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.hoisted(() => vi.fn())
const rpc = vi.hoisted(() => vi.fn())

vi.mock('../lib/supabase', () => ({
  requireSupabase: () => ({
    functions: { invoke },
    rpc,
  }),
}))

import { requestExpedienteAnalysis } from './expedienteUpload'

describe('solicitud de análisis del expediente', () => {
  beforeEach(() => {
    invoke.mockReset()
    rpc.mockReset()
  })

  it('utiliza fallback por RPC directo cuando la Edge Function no está disponible', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('Requested function was not found') })
    rpc.mockResolvedValue({ data: 'direct-execution-id', error: null })

    const id = await requestExpedienteAnalysis({
      groupId: '4ee9c8e7-04b7-4395-9c55-d2e59a10f29a',
      idempotencyKey: 'expediente-v2:test-1234567890',
    })

    expect(id).toBe('direct-execution-id')
    expect(rpc).toHaveBeenCalledWith('queue_expediente_group_execution', expect.objectContaining({
      p_group_id: '4ee9c8e7-04b7-4395-9c55-d2e59a10f29a',
      p_idempotency_key: 'expediente-v2:test-1234567890',
    }))
  })

  it('retorna directamente el ID cuando la Edge Function responde con éxito', async () => {
    invoke.mockResolvedValue({ data: { executionId: 'edge-execution-id' }, error: null })

    const id = await requestExpedienteAnalysis({
      groupId: '4ee9c8e7-04b7-4395-9c55-d2e59a10f29a',
      idempotencyKey: 'expediente-v2:test-1234567890',
    })

    expect(id).toBe('edge-execution-id')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('propaga error descriptivo si el RPC también falla', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('Not found') })
    rpc.mockResolvedValue({ data: null, error: new Error('No tienes permiso para procesar este grupo documental.') })

    await expect(requestExpedienteAnalysis({
      groupId: '4ee9c8e7-04b7-4395-9c55-d2e59a10f29a',
      idempotencyKey: 'expediente-v2:test-1234567890',
    })).rejects.toThrow('No tienes permiso para procesar este grupo documental.')
  })
})
