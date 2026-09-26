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

  it('no salta la Edge Function cuando esta no puede aceptar la ejecución', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('function unavailable') })
    rpc.mockResolvedValue({ data: 'direct-execution-id', error: null })

    await expect(requestExpedienteAnalysis({
      groupId: '4ee9c8e7-04b7-4395-9c55-d2e59a10f29a',
      idempotencyKey: 'expediente-v2:test-1234567890',
    })).rejects.toThrow('No fue posible enviar la solicitud de procesamiento')

    expect(rpc).not.toHaveBeenCalled()
  })
})
