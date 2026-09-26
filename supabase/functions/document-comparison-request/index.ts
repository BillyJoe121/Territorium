import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const allowedOrigins = (Deno.env.get('APP_ORIGINS') ?? 'http://127.0.0.1:5173,http://localhost:5173')
  .split(',').map((origin) => origin.trim())

function respond(request: Request, body: unknown, status = 200) {
  const origin = request.headers.get('origin') ?? ''
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    },
  })
}

async function wakeWorker(url: string, token: string) {
  try {
    const response = await fetch(url, {
      method: 'POST', headers: { 'x-territorium-wake-token': token },
      signal: AbortSignal.timeout(15_000),
    })
    console.info(JSON.stringify({ event: 'comparison_worker_wake', status: response.status }))
  } catch (error) {
    console.warn(JSON.stringify({ event: 'comparison_worker_wake_failed', errorType: error instanceof Error ? error.name : 'unknown' }))
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return respond(request, {}, 200)
  if (request.method !== 'POST') return respond(request, { error: 'method_not_allowed' }, 405)
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const publishableKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')
  const wakeUrl = Deno.env.get('WORKER_WAKE_URL')?.trim()
  const wakeToken = Deno.env.get('WORKER_WAKE_TOKEN')?.trim()
  if (!token) return respond(request, { error: 'missing_authorization' }, 401)
  if (!supabaseUrl || !publishableKey) return respond(request, { error: 'server_not_configured' }, 503)

  let payload: { leftDocumentId?: string; rightDocumentId?: string }
  try { payload = await request.json() } catch { return respond(request, { error: 'invalid_json' }, 400) }
  const uuid = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i
  if (!payload.leftDocumentId || !uuid.test(payload.leftDocumentId) ||
      !payload.rightDocumentId || !uuid.test(payload.rightDocumentId) ||
      payload.leftDocumentId === payload.rightDocumentId) {
    return respond(request, { error: 'invalid_document_pair' }, 400)
  }
  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: authError } = await client.auth.getUser(token)
  if (authError || !user) return respond(request, { error: 'invalid_token' }, 401)
  const { data: jobId, error } = await client.rpc('queue_comparison', {
    p_left_document_id: payload.leftDocumentId,
    p_right_document_id: payload.rightDocumentId,
  })
  if (error) return respond(request, { error: 'comparison_not_accepted', detail: error.message }, 422)

  if (wakeUrl && wakeToken) {
    try {
      const parsed = new URL(wakeUrl)
      if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) {
        EdgeRuntime.waitUntil(wakeWorker(wakeUrl, wakeToken))
      }
    } catch {
      // Waking the worker is best effort
    }
  }

  return respond(request, { jobId, status: 'queued' }, 202)
})
