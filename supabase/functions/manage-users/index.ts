import { createClient } from 'jsr:@supabase/supabase-js@2'

const allowedOrigins = (Deno.env.get('APP_ORIGINS') ?? 'http://127.0.0.1:5173,http://localhost:5173').split(',').map((origin) => origin.trim())

function cors(request: Request) {
  const origin = request.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

const json = (request: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(request), 'Content-Type': 'application/json' } })

interface ManageUserPayload {
  action: 'invite' | 'recover' | 'deactivate'
  email: string
  role?: 'owner' | 'operator' | 'reviewer' | 'viewer'
  projectId?: string
  userId?: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors(request) })
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405)

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json(request, { error: 'missing_authorization' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const publishableKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !serviceRoleKey || !publishableKey) {
    return json(request, { error: 'server_credentials_not_configured' }, 503)
  }

  // 1. Verify caller identity using their JWT
  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser(token)
  if (authError || !user) return json(request, { error: 'invalid_token' }, 401)

  let payload: ManageUserPayload
  try {
    payload = await request.json()
  } catch {
    return json(request, { error: 'invalid_json' }, 400)
  }

  const { action, email, role = 'viewer', projectId, userId } = payload
  if (!email || !action) return json(request, { error: 'email_and_action_required' }, 400)

  // 2. Client with Service Role Key for privileged operations
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 3. Authorization check: if projectId is given, caller must be 'owner' of the project
  if (projectId) {
    const { data: membership, error: memberError } = await adminClient
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (memberError || membership?.role !== 'owner') {
      return json(request, { error: 'forbidden_only_owner_can_manage_users' }, 403)
    }
  }

  try {
    if (action === 'invite') {
      // US-002: Invitar usuario sin compartir credenciales mediante enlace oficial de Supabase
      const cleanEmail = email.trim().toLowerCase()
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(cleanEmail, {
        data: { invited_by: user.id, default_role: role },
      })

      if (inviteError) {
        // Si el usuario ya existe, vinculamos su usuario al proyecto directamente
        const { data: existingUsers } = await adminClient.auth.admin.listUsers()
        const found = existingUsers?.users?.find((u) => u.email?.toLowerCase() === cleanEmail)
        if (found && projectId) {
          const { error: insertError } = await adminClient
            .from('project_members')
            .upsert({ project_id: projectId, user_id: found.id, role }, { onConflict: 'project_id,user_id' })

          if (insertError) throw insertError

          await adminClient.from('audit_events').insert({
            project_id: projectId,
            actor_id: user.id,
            action: 'member.assigned_existing',
            entity_type: 'project_member',
            entity_id: projectId,
            metadata: { email: cleanEmail, role, detail: `Usuario existente ${cleanEmail} asignado con rol ${role}` },
          })

          return json(request, { success: true, message: `Usuario ${cleanEmail} asignado al expediente con rol ${role}.` })
        }
        throw inviteError
      }

      if (inviteData?.user && projectId) {
        await adminClient
          .from('project_members')
          .insert({ project_id: projectId, user_id: inviteData.user.id, role })

        await adminClient.from('audit_events').insert({
          project_id: projectId,
          actor_id: user.id,
          action: 'user.invited',
          entity_type: 'project_member',
          entity_id: projectId,
          metadata: { email: cleanEmail, role, detail: `Invitación enviada a ${cleanEmail} sin compartir credenciales.` },
        })
      }

      return json(request, { success: true, message: `Invitación enviada de forma segura a ${cleanEmail}.` })
    }

    if (action === 'recover') {
      // US-002: Recuperación de acceso segura sin compartir contraseñas
      const cleanEmail = email.trim().toLowerCase()
      const { error: resetError } = await adminClient.auth.resetPasswordForEmail(cleanEmail)
      if (resetError) throw resetError

      if (projectId) {
        await adminClient.from('audit_events').insert({
          project_id: projectId,
          actor_id: user.id,
          action: 'user.recovery_requested',
          entity_type: 'auth_user',
          entity_id: projectId,
          metadata: { email: cleanEmail, detail: `Enlace de recuperación solicitado para ${cleanEmail}.` },
        })
      }

      return json(request, { success: true, message: `Enlace de recuperación enviado al correo de ${cleanEmail}.` })
    }

    if (action === 'deactivate') {
      // Desactivación / revocación de acceso
      if (!projectId || !userId) return json(request, { error: 'projectId_and_userId_required' }, 400)

      const { error: delError } = await adminClient
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId)

      if (delError) throw delError

      await adminClient.from('audit_events').insert({
        project_id: projectId,
        actor_id: user.id,
        action: 'user.access_revoked',
        entity_type: 'project_member',
        entity_id: projectId,
        metadata: { userId, email, detail: `Acceso revocado para el usuario ${email}.` },
      })

      return json(request, { success: true, message: `Acceso revocado para ${email}.` })
    }

    return json(request, { error: 'invalid_action' }, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido al administrar usuario.'
    return json(request, { error: 'user_management_failed', detail: message }, 422)
  }
})
