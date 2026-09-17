import { createClient } from 'jsr:@supabase/supabase-js@2'

const allowedOrigins = (Deno.env.get('APP_ORIGINS') ?? 'http://127.0.0.1:5173,http://localhost:5173').split(',').map((origin) => origin.trim())
function cors(request: Request) { const origin = request.headers.get('origin') ?? ''; return { 'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0], 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' } }
const json = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors(request), 'Content-Type': 'application/json' } })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors(request) })
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405)
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json(request, { error: 'missing_authorization' }, 401)
  const publicKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')
  if (!publicKey) return json(request, { error: 'server_key_not_configured' }, 503)
  const client = createClient(Deno.env.get('SUPABASE_URL')!, publicKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
  const { data: { user }, error: authError } = await client.auth.getUser(token)
  if (authError || !user) return json(request, { error: 'invalid_token' }, 401)
  let payload: { projectId?: string; batchId?: string }
  try { payload = await request.json() } catch { return json(request, { error: 'invalid_json' }, 400) }
  if (!payload.projectId || !payload.batchId) return json(request, { error: 'projectId_and_batchId_required' }, 400)
  const { data: batch, error: batchError } = await client.from('batches').select('id, project_id, status').eq('id', payload.batchId).eq('project_id', payload.projectId).single()
  if (batchError || !batch) return json(request, { error: 'batch_not_found_or_forbidden' }, 404)
  const existing = await client.from('jobs').select('id,run_id,status').eq('batch_id', payload.batchId).in('status', ['queued', 'running']).limit(1).maybeSingle()
  if (existing.error) return json(request, { error: 'job_lookup_failed', detail: existing.error.message }, 422)
  if (existing.data) return json(request, { jobId: existing.data.id, runId: existing.data.run_id, status: existing.data.status }, 202)
  const { data: job, error: jobError } = await client.from('jobs').insert({
    project_id: payload.projectId,
    batch_id: payload.batchId,
    created_by: user.id,
    status: 'queued',
    processor: 'document-extraction-v1',
    idempotency_key: `${payload.batchId}:${crypto.randomUUID()}`,
  }).select('id, run_id, status').single()
  if (jobError) {
    if (jobError.code === '23505') {
      const active = await client.from('jobs').select('id,run_id,status').eq('batch_id', payload.batchId).in('status', ['queued', 'running']).limit(1).single()
      if (active.data) return json(request, { jobId: active.data.id, runId: active.data.run_id, status: active.data.status }, 202)
    }
    return json(request, { error: 'job_create_failed', detail: jobError.message }, 422)
  }
  return json(request, { jobId: job.id, runId: job.run_id, status: job.status }, 202)
})
