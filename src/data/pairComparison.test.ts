import { describe, expect, it } from 'vitest'
import type { ComparisonDocument, ComparisonJob } from './documentComparison'
import { comparableMime, findReusableComparison, startPairComparison, type ComparisonService, type ComparisonSourceFile } from './pairComparison'

const PROJECT = 'p1'
const plan: ComparisonSourceFile = { id: 'f-plan', name: 'Plano_TOL-ANZ-045.pdf', storagePath: 'p1/expediente/a.pdf', mimeType: 'application/pdf', sizeBytes: 100 }
const study: ComparisonSourceFile = { id: 'f-study', name: 'ESTUDIO_TOL-ANZ-045.docx', storagePath: 'p1/expediente/b.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: 200 }

const doc = (id: string, file: ComparisonSourceFile, active = true): ComparisonDocument => ({
  id, project_id: PROJECT, storage_path: `p1/comparison/${id}/${file.name}`, original_name: file.name, mime_type: file.mimeType, size_bytes: file.sizeBytes,
  document_label: null, is_active: active, created_at: '2026-10-08T00:00:00Z',
})
const job = (id: string, left: string, right: string, status: ComparisonJob['status']): ComparisonJob => ({
  id, project_id: PROJECT, left_document_id: left, right_document_id: right, status, result: null, error_code: null, created_at: '2026-10-08T00:00:00Z',
})

function fakeService(documents: ComparisonDocument[], jobs: ComparisonJob[], options: { failRequest?: boolean } = {}) {
  const calls = { registered: [] as string[], requested: [] as string[][], retired: [] as string[] }
  let next = 0
  const service: ComparisonService = {
    listDocuments: async () => documents.map((document) => ({ ...document })),
    listJobs: async () => jobs,
    register: async (_project, file) => {
      calls.registered.push(file.name)
      documents.push(doc(`copy-${++next}`, file))
    },
    request: async (left, right) => {
      if (options.failRequest) throw new Error('comparison_queue_full')
      calls.requested.push([left, right])
      jobs.unshift(job('new-job', left, right, 'queued'))
      return 'new-job'
    },
    retire: async (document) => {
      calls.retired.push(document.id)
      const target = documents.find((item) => item.id === document.id)
      if (target) target.is_active = false
    },
  }
  return { service, calls }
}

describe('comparableMime', () => {
  it('accepts only PDF and DOCX', () => {
    expect(comparableMime('a.PDF')).toBe('application/pdf')
    expect(comparableMime('b.docx')).toMatch(/wordprocessingml/)
    expect(comparableMime('c.xlsx')).toBeNull()
  })
})

describe('findReusableComparison', () => {
  it('reuses the latest completed or running analysis of the same pair, never a failed one', () => {
    const documents = [doc('d1', plan, false), doc('d2', study, false)]
    expect(findReusableComparison(documents, [job('j-failed', 'd1', 'd2', 'failed')], plan, study)).toBeNull()
    expect(findReusableComparison(documents, [job('j-ok', 'd1', 'd2', 'completed')], plan, study)?.id).toBe('j-ok')
    expect(findReusableComparison(documents, [job('j-rev', 'd2', 'd1', 'completed')], plan, study)).toBeNull()
  })
})

describe('startPairComparison', () => {
  it('returns an existing analysis without copying or calling the AI', async () => {
    const { service, calls } = fakeService([doc('d1', plan, false), doc('d2', study, false)], [job('j-ok', 'd1', 'd2', 'completed')])
    expect((await startPairComparison(PROJECT, plan, study, service)).id).toBe('j-ok')
    expect(calls).toEqual({ registered: [], requested: [], retired: [] })
  })

  it('copies both files, queues the analysis and retires its own copies', async () => {
    const { service, calls } = fakeService([], [])
    const result = await startPairComparison(PROJECT, plan, study, service)
    expect(result).toMatchObject({ id: 'new-job', status: 'queued' })
    expect(calls.registered).toEqual([plan.name, study.name])
    expect(calls.requested).toEqual([['copy-1', 'copy-2']])
    expect(calls.retired).toEqual(['copy-1', 'copy-2'])
  })

  it('uses a document already active in the comparator without retiring it', async () => {
    const { service, calls } = fakeService([doc('manual', plan)], [])
    await startPairComparison(PROJECT, plan, study, service)
    expect(calls.registered).toEqual([study.name])
    expect(calls.requested).toEqual([['manual', 'copy-1']])
    expect(calls.retired).toEqual(['copy-1'])
  })

  it('retires its copies even when the analysis cannot be queued', async () => {
    const { service, calls } = fakeService([], [], { failRequest: true })
    await expect(startPairComparison(PROJECT, plan, study, service)).rejects.toThrow('comparison_queue_full')
    expect(calls.retired).toEqual(['copy-1', 'copy-2'])
  })

  it('shares one run when the same pair is opened twice at once', async () => {
    const { service, calls } = fakeService([], [])
    const [a, b] = await Promise.all([startPairComparison(PROJECT, plan, study, service), startPairComparison(PROJECT, plan, study, service)])
    expect(a).toBe(b)
    expect(calls.requested).toHaveLength(1)
  })
})
