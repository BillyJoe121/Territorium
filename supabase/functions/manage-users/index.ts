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
  action: 'invite' | 'recover' | 'deactivate' | 'update_role'
  email?: string
  role?: 'administrador' | 'operador' | 'analista_predial' | 'revisor_juridico' | 'aprobador' | 'auditor'
  projectId: string
  userId?: string
}

const allowedActions = new Set<ManageUserPayload['action']>(['invite', 'recover', 'deactivate', 'update_role'])
const allowedRoles = new Set<NonNullable<ManageUserPayload['role']>>([
  'administrador', 'operador', 'analista_predial', 'revisor_juridico', 'aprobador', 'auditor',
])
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

  const { action, email, role = 'auditor', projectId, userId } = payload
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!action || !allowedActions.has(action) || !projectId || typeof projectId !== 'string') {
    return json(request, { error: 'invalid_request' }, 400)
  }
  if (['invite', 'recover'].includes(action) && (!cleanEmail || cleanEmail.length > 254 || !emailPattern.test(cleanEmail))) {
    return json(request, { error: 'invalid_request' }, 400)
  }
  if (['invite', 'update_role'].includes(action) && !allowedRoles.has(role)) return json(request, { error: 'invalid_role' }, 400)
  if (['deactivate', 'update_role'].includes(action) && (!userId || typeof userId !== 'string' || !uuidPattern.test(userId))) {
    return json(request, { error: 'user_id_required' }, 400)
  }

  // 2. Client with Service Role Key for privileged operations
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Privileged Auth Admin calls are always scoped to a concrete project and
  // require the canonical administrator role. Never rely on UI visibility.
  const { data: membership, error: memberError } = await adminClient
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (memberError || !['administrador', 'owner'].includes(membership?.role ?? '')) {
    return json(request, { error: 'forbidden_only_administrator_can_manage_users' }, 403)
  }

  try {
    if (action === 'invite') {
      // US-002: Invitar usuario sin compartir credenciales mediante enlace oficial de Supabase
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(cleanEmail, {
        data: { invited_by: user.id, default_role: role },
      })

      if (inviteError) {
        // Si el usuario ya existe, vinculamos su usuario al proyecto directamente
        const { data: existingUsers } = await adminClient.auth.admin.listUsers()
        const found = existingUsers?.users?.find((u) => u.email?.toLowerCase() === cleanEmail)
        if (found) {
          const { error: insertError } = await adminClient
            .from('project_members')
            .upsert({ project_id: projectId, user_id: found.id, role }, { onConflict: 'project_id,user_id' })

          if (insertError) throw insertError

          const { error: auditError } = await adminClient.from('audit_events').insert({
            project_id: projectId,
            actor_id: user.id,
            action: 'member.assigned_existing',
            entity_type: 'project_member',
            entity_id: projectId,
            metadata: { email: cleanEmail, role, detail: `Usuario existente ${cleanEmail} asignado con rol ${role}` },
          })
          if (auditError) throw auditError

          return json(request, { success: true, message: `Usuario ${cleanEmail} asignado al expediente con rol ${role}.` })
        }
        throw inviteError
      }

      if (inviteData?.user) {
        // An invited account is not useful until it has a project role. Use
        // upsert to make retries safe, and never report success if the
        // membership write failed.
        const { error: memberWriteError } = await adminClient
          .from('project_members')
          .upsert({ project_id: projectId, user_id: inviteData.user.id, role }, { onConflict: 'project_id,user_id' })
        if (memberWriteError) throw memberWriteError

        const { error: auditError } = await adminClient.from('audit_events').insert({
          project_id: projectId,
          actor_id: user.id,
          action: 'user.invited',
          entity_type: 'project_member',
          entity_id: projectId,
          metadata: { email: cleanEmail, role, detail: `Invitación enviada a ${cleanEmail} sin compartir credenciales.` },
        })
        if (auditError) throw auditError
      }

      return json(request, { success: true, message: `Invitación enviada de forma segura a ${cleanEmail}.` })
    }

    if (action === 'recover') {
      // US-002: Recuperación de acceso segura sin compartir contraseñas
      const { data: knownUsers, error: knownUsersError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (knownUsersError) throw knownUsersError
      const target = knownUsers.users.find((candidate) => candidate.email?.toLowerCase() === cleanEmail)
      if (!target) return json(request, { error: 'project_member_not_found' }, 404)
      const { data: targetMembership, error: targetMembershipError } = await adminClient
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId)
        .eq('user_id', target.id)
        .maybeSingle()
      if (targetMembershipError) throw targetMembershipError
      if (!targetMembership) return json(request, { error: 'project_member_not_found' }, 404)
      const { error: resetError } = await adminClient.auth.resetPasswordForEmail(cleanEmail)
      if (resetError) throw resetError

      const { error: auditError } = await adminClient.from('audit_events').insert({
        project_id: projectId,
        actor_id: user.id,
        action: 'user.recovery_requested',
        entity_type: 'auth_user',
        entity_id: projectId,
        metadata: { email: cleanEmail, detail: `Enlace de recuperación solicitado para ${cleanEmail}.` },
      })
      if (auditError) throw auditError

      return json(request, { success: true, message: `Enlace de recuperación enviado al correo de ${cleanEmail}.` })
    }

    if (action === 'deactivate') {
      // Desactivación / revocación de acceso
      if (userId === user.id) return json(request, { error: 'cannot_revoke_own_administrator_access' }, 409)

      const { data: targetMembership, error: targetMembershipError } = await adminClient
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .maybeSingle()
      if (targetMembershipError) throw targetMembershipError
      if (!targetMembership) return json(request, { error: 'project_member_not_found' }, 404)
      if (['administrador', 'owner'].includes(targetMembership.role)) {
        const { data: administrators, error: administratorsError } = await adminClient
          .from('project_members')
          .select('user_id')
          .eq('project_id', projectId)
          .in('role', ['administrador', 'owner'])
        if (administratorsError) throw administratorsError
        if ((administrators?.length ?? 0) <= 1) return json(request, { error: 'cannot_revoke_last_administrator' }, 409)
      }

      const { error: delError } = await adminClient
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId)

      if (delError) throw delError

      const { error: auditError } = await adminClient.from('audit_events').insert({
        project_id: projectId,
        actor_id: user.id,
        action: 'user.access_revoked',
        entity_type: 'project_member',
        entity_id: projectId,
        metadata: { userId, email, detail: `Acceso revocado para el usuario ${email}.` },
      })
      if (auditError) throw auditError

      return json(request, { success: true, message: `Acceso revocado para ${email}.` })
    }

    if (action === 'update_role') {
      if (userId === user.id) return json(request, { error: 'cannot_change_own_administrator_role' }, 409)
      const { data: targetMembership, error: targetMembershipError } = await adminClient
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .maybeSingle()
      if (targetMembershipError) throw targetMembershipError
      if (!targetMembership) return json(request, { error: 'project_member_not_found' }, 404)
      if (['administrador', 'owner'].includes(targetMembership.role) && !['administrador', 'owner'].includes(role)) {
        const { data: administrators, error: administratorsError } = await adminClient
          .from('project_members')
          .select('user_id')
          .eq('project_id', projectId)
          .in('role', ['administrador', 'owner'])
        if (administratorsError) throw administratorsError
        if ((administrators?.length ?? 0) <= 1) return json(request, { error: 'cannot_demote_last_administrator' }, 409)
      }
      const { error: roleUpdateError } = await adminClient
        .from('project_members')
        .update({ role })
        .eq('project_id', projectId)
        .eq('user_id', userId)
      if (roleUpdateError) throw roleUpdateError
      const { error: auditError } = await adminClient.from('audit_events').insert({
        project_id: projectId,
        actor_id: user.id,
        action: 'member.role_updated',
        entity_type: 'project_member',
        entity_id: projectId,
        metadata: { userId, role, detail: `Rol actualizado a ${role}.` },
      })
      if (auditError) throw auditError
      return json(request, { success: true, message: 'Rol actualizado correctamente.' })
    }

    return json(request, { error: 'invalid_action' }, 400)
  } catch {
    // Do not return provider or database errors to a caller; they can disclose
    // account existence and internal configuration.
    return json(request, { error: 'user_management_failed' }, 422)
  }
})
