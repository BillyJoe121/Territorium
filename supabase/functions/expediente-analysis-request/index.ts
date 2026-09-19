import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const allowedOrigins = (Deno.env.get('APP_ORIGINS') ?? 'http://127.0.0.1:5173,http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())

function cors(request: Request) {
  const origin = request.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(request), 'Content-Type': 'application/json' },
  })
}

interface AnalysisRequest {
  groupId?: string
  idempotencyKey?: string
  extractorSnapshot?: Record<string, unknown>
  promptSnapshot?: Record<string, unknown>
  modelSnapshot?: Record<string, unknown>
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors(request) })
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405)

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  const publishableKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  if (!token) return json(request, { error: 'missing_authorization' }, 401)
  if (!publishableKey || !supabaseUrl) return json(request, { error: 'server_not_configured' }, 503)

  let payload: AnalysisRequest
  try {
    payload = await request.json()
  } catch {
    return json(request, { error: 'invalid_json' }, 400)
  }
  if (!payload.groupId || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(payload.groupId)) {
    return json(request, { error: 'invalid_group_id' }, 400)
  }
  if (!payload.idempotencyKey || payload.idempotencyKey.trim().length < 16 || payload.idempotencyKey.length > 200) {
    return json(request, { error: 'invalid_idempotency_key' }, 400)
  }

  // La función acepta el trabajo; no extrae ni descarga contenido jurídico.
  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: authError } = await client.auth.getUser(token)
  if (authError || !user) return json(request, { error: 'invalid_token' }, 401)

  const { data: executionId, error } = await client.rpc('queue_expediente_group_execution', {
    p_group_id: payload.groupId,
    p_idempotency_key: payload.idempotencyKey.trim(),
    p_extractor_snapshot: payload.extractorSnapshot ?? {},
    p_prompt_snapshot: payload.promptSnapshot ?? {},
    p_model_snapshot: payload.modelSnapshot ?? {},
  })
  if (error) return json(request, { error: 'analysis_not_accepted', detail: error.message }, 422)
  return json(request, { executionId, status: 'queued' }, 202)
})
