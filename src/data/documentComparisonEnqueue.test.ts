import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.hoisted(() => vi.fn())
const rpc = vi.hoisted(() => vi.fn())

vi.mock('../lib/supabase', () => ({
  requireSupabase: () => ({
    functions: { invoke },
    rpc,
  }),
}))

import { requestComparison } from './documentComparison'

describe('requestComparison fallback strategy', () => {
  beforeEach(() => {
    invoke.mockReset()
    rpc.mockReset()
  })

  it('retorna jobId cuando la Edge Function responde exitosamente', async () => {
    invoke.mockResolvedValue({ data: { jobId: 'job-edge-123' }, error: null })

    const result = await requestComparison('doc-left', 'doc-right')

    expect(result).toBe('job-edge-123')
    expect(invoke).toHaveBeenCalledWith('document-comparison-request', {
      body: { leftDocumentId: 'doc-left', rightDocumentId: 'doc-right' },
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('recurre transparentemente a RPC queue_comparison si la Edge Function falla', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('Edge function 503 processing_not_configured') })
    rpc.mockResolvedValue({ data: 'job-rpc-456', error: null })

    const result = await requestComparison('doc-left', 'doc-right')

    expect(result).toBe('job-rpc-456')
    expect(rpc).toHaveBeenCalledWith('queue_comparison', {
      p_left_document_id: 'doc-left',
      p_right_document_id: 'doc-right',
    })
  })

  it('propaga error de Postgres cuando el RPC directo falla', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('Edge function 503') })
    rpc.mockResolvedValue({ data: null, error: new Error('comparison_queue_full') })

    await expect(requestComparison('doc-left', 'doc-right')).rejects.toThrow('comparison_queue_full')
  })
})
