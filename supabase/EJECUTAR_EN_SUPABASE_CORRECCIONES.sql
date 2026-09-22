-- =========================================================================
-- COPIA Y PEGA ESTE BLOQUE COMPLETO EN EL SQL EDITOR DE SUPABASE
-- Y PRESIONA "RUN".
-- =========================================================================

-- 1. OTORGAR PERMISOS EN SCHEMA PRIVATE (Permite eliminar y modificar archivos sin error 403)
grant usage on schema private to service_role, authenticated, postgres, anon;
grant execute on all functions in schema private to service_role, authenticated, postgres;

-- 2. FUNCIÓN RPC PARA ELIMINAR/RETIRAR ARCHIVOS DE FORMA SEGURA E INMEDIATA
create or replace function public.delete_expediente_document_file(p_file_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_file public.expediente_document_files%rowtype;
  active_count integer;
  current_grp public.expediente_document_groups%rowtype;
begin
  select * into target_file
  from public.expediente_document_files
  where id = p_file_id;

  if not found then
    return false;
  end if;

  -- Validar rol en el proyecto
  if not private.has_project_role(target_file.project_id, 'operador') then
    raise exception 'No autorizado para eliminar archivos de este expediente.';
  end if;

  -- Validar que el grupo no esté en ejecución activa
  select * into current_grp
  from public.expediente_document_groups
  where id = target_file.group_id;

  if current_grp.status in ('queued', 'processing') then
    raise exception 'No se puede retirar un archivo mientras el grupo se encuentra en análisis.';
  end if;

  -- Marcar archivo como inactivo y retirado
  update public.expediente_document_files
  set is_active = false,
      is_current = false,
      retired_at = now(),
      retirement_reason = 'Retirado por el usuario'
  where id = p_file_id;

  -- Contar archivos activos restantes
  select count(*) into active_count
  from public.expediente_document_files
  where group_id = target_file.group_id and is_active and is_current;

  if active_count = 0 then
    update public.expediente_document_groups
    set status = 'empty',
        current_negotiation_file_id = null
    where id = target_file.group_id;
  else
    if current_grp.current_negotiation_file_id = p_file_id then
      update public.expediente_document_groups
      set current_negotiation_file_id = (
        select id from public.expediente_document_files
        where group_id = target_file.group_id and is_active and is_current
        limit 1
      )
      where id = target_file.group_id;
    end if;

    if current_grp.status in ('review_ready', 'approved') then
      update public.expediente_document_groups
      set status = 'stale'
      where id = target_file.group_id;
    end if;
  end if;

  return true;
end;
$$;

revoke all on function public.delete_expediente_document_file(uuid) from public, anon;
grant execute on function public.delete_expediente_document_file(uuid) to authenticated, service_role;


-- 3. EVITAR QUE EL ESTADO PASE A REVIEW_READY PREMATURAMENTE ANTES DE QUE LA IA TERMINE
create or replace function public.complete_expediente_execution_task(
  p_task_id uuid,
  p_lease_token uuid,
  p_payload jsonb default null,
  p_payload_sha256 text default null,
  p_error_code text default null,
  p_error_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare task_row public.expediente_execution_tasks%rowtype;
declare execution_row public.expediente_executions%rowtype;
declare is_success boolean := p_payload is not null and p_payload_sha256 ~ '^[0-9a-f]{64}$';
declare retryable boolean := coalesce(p_error_code, '') not like 'PERMANENT_%';
declare retry_delay_seconds integer;
declare execution_failed boolean;
declare execution_ready boolean;
begin
  select * into task_row from public.expediente_execution_tasks where id = p_task_id for update;
  if not found or task_row.status <> 'running' or task_row.lease_token is distinct from p_lease_token then return false; end if;
  select * into execution_row from public.expediente_executions where id = task_row.execution_id for update;
  if execution_row.status in ('cancelled', 'superseded') then return false; end if;

  if not is_success and retryable and task_row.attempt_count < task_row.max_attempts then
    retry_delay_seconds := least(300, 15 * (2 ^ greatest(0, task_row.attempt_count - 1))::integer);
    update public.expediente_execution_tasks
    set status = 'queued', lease_token = null, lease_expires_at = null,
        available_at = now() + make_interval(secs => retry_delay_seconds),
        error_code = coalesce(p_error_code, 'TASK_RETRY'),
        error_message = left(coalesce(p_error_message, 'La tarea falló temporalmente.'), 2000),
        stage = 'retry_wait', stage_message = 'Se reintentará automáticamente.'
    where id = task_row.id;
    update public.expediente_executions
    set status = 'processing', stage = 'retry_wait', stage_message = 'Esperando reintento de una tarea.'
    where id = execution_row.id;
    return true;
  end if;

  update public.expediente_execution_tasks
  set status = case when is_success then 'completed' else 'failed' end,
      lease_token = null, lease_expires_at = null, completed_at = now(),
      error_code = case when is_success then null else coalesce(p_error_code, 'TASK_FAILED') end,
      error_message = case when is_success then null else left(coalesce(p_error_message, 'La tarea falló.'), 2000) end,
      stage = case when is_success then 'completed' else 'failed' end,
      stage_message = case when is_success then 'Insumo validado y preparado.' else 'La tarea requiere atención.' end
  where id = task_row.id;
  if is_success then
    insert into public.expediente_execution_outputs (execution_id, task_id, project_id, group_id, payload, payload_sha256)
    values (execution_row.id, task_row.id, execution_row.project_id, execution_row.group_id, p_payload, p_payload_sha256);
  end if;

  select exists (select 1 from public.expediente_execution_tasks where execution_id = execution_row.id and status = 'failed'),
         not exists (select 1 from public.expediente_execution_tasks where execution_id = execution_row.id and status in ('queued', 'running'))
  into execution_failed, execution_ready;

  update public.expediente_executions
  set completed_units = (select count(*) from public.expediente_execution_tasks where execution_id = execution_row.id and status = 'completed'),
      status = case when execution_failed then 'failed' else 'processing' end,
      stage = case when execution_failed then 'failed' when execution_ready then 'ready_for_extraction' else 'validating' end,
      stage_message = case
        when execution_failed then 'Un insumo no pudo validarse.'
        when execution_ready then 'Insumos validados. Analizando con IA...'
        else 'Validando los insumos restantes.'
      end,
      completed_at = case when execution_failed then now() else null end
  where id = execution_row.id;

  update public.expediente_document_groups
  set status = case when e.status = 'failed' then 'error' else 'processing' end,
      last_error_code = case when e.status = 'failed' then coalesce(p_error_code, 'TASK_FAILED') else null end,
      last_error_message = case when e.status = 'failed' then left(coalesce(p_error_message, 'Un insumo no pudo validarse.'), 2000) else null end
  from public.expediente_executions e
  where expediente_document_groups.id = execution_row.group_id and e.id = execution_row.id;

  return true;
end;
$$;

revoke all on function public.complete_expediente_execution_task(uuid, uuid, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.complete_expediente_execution_task(uuid, uuid, jsonb, text, text, text) to service_role;


-- 4. PERMITIR RE-ENCOLAR GRUPOS EN REVIEW_READY (REPETIR ANÁLISIS)
create or replace function public.queue_expediente_group_execution(
  p_group_id uuid,
  p_idempotency_key text,
  p_extractor_snapshot jsonb default '{}'::jsonb,
  p_prompt_snapshot jsonb default '{}'::jsonb,
  p_model_snapshot jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare group_row public.expediente_document_groups%rowtype;
declare execution_id uuid;
declare existing_group_id uuid;
declare document_count integer;
declare resolved_extractor text;
declare audit_action text;
begin
  if char_length(trim(coalesce(p_idempotency_key, ''))) < 16 then
    raise exception 'La clave de idempotencia debe tener al menos 16 caracteres.';
  end if;

  select * into group_row from public.expediente_document_groups where id = p_group_id for update;
  if not found then raise exception 'No existe el grupo documental.'; end if;
  if not private.has_project_role(group_row.project_id, 'operador') then
    raise exception 'No tienes permiso para procesar este grupo documental.';
  end if;

  select id, group_id into execution_id, existing_group_id
  from public.expediente_executions
  where project_id = group_row.project_id and idempotency_key = trim(p_idempotency_key);
  if found then
    if existing_group_id is distinct from group_row.id then
      raise exception 'La clave de idempotencia ya pertenece a otro grupo documental.';
    end if;
    return execution_id;
  end if;

  if group_row.status not in ('ready', 'stale', 'error', 'review_ready') then
    raise exception 'El grupo no está disponible para una nueva ejecución.';
  end if;
  audit_action := case when group_row.status in ('stale', 'error', 'review_ready')
    then 'expediente.execution_reprocess_requested'
    else 'expediente.execution_queued'
  end;

  select count(*) into document_count from public.expediente_document_files
  where group_id = group_row.id and is_current and is_active;
  if document_count = 0 then raise exception 'El grupo no tiene documentos vigentes para analizar.'; end if;

  resolved_extractor := case group_row.group_key
    when 'titles' then 'title_study'
    when 'plans' then 'plan'
    else 'negotiation'
  end;

  insert into public.expediente_executions (
    project_id, group_id, input_version, status, idempotency_key, extractor_key,
    extractor_snapshot, prompt_snapshot, model_snapshot, input_snapshot, total_units, created_by
  )
  select group_row.project_id, group_row.id, group_row.input_version, 'queued', trim(p_idempotency_key),
    resolved_extractor, p_extractor_snapshot, p_prompt_snapshot, p_model_snapshot,
    coalesce(jsonb_agg(jsonb_build_object(
      'document_file_id', f.id,
      'document_key', f.document_key,
      'version_number', f.version_number,
      'sha256', f.sha256,
      'storage_path', f.storage_path
    ) order by f.created_at), '[]'::jsonb), document_count, (select auth.uid())
  from public.expediente_document_files f
  where f.group_id = group_row.id and f.is_current and f.is_active
  on conflict (project_id, idempotency_key) do nothing
  returning id into execution_id;

  if execution_id is null then
    select id, group_id into execution_id, existing_group_id
    from public.expediente_executions
    where project_id = group_row.project_id and idempotency_key = trim(p_idempotency_key);
    if existing_group_id is distinct from group_row.id then
      raise exception 'La clave de idempotencia ya pertenece a otro grupo documental.';
    end if;
    return execution_id;
  end if;

  insert into public.expediente_execution_tasks (execution_id, document_file_id, idempotency_key)
  select execution_id, f.id, concat(execution_id::text, ':', f.id::text, ':1')
  from public.expediente_document_files f
  where f.group_id = group_row.id and f.is_current and f.is_active;

  update public.expediente_document_groups set status = 'queued' where id = group_row.id;
  insert into public.expediente_audit_events (project_id, actor_id, action, entity_type, entity_id, metadata)
  values (group_row.project_id, (select auth.uid()), audit_action, 'execution', execution_id,
    jsonb_build_object('group_id', group_row.id, 'input_version', group_row.input_version, 'documents', document_count));
  return execution_id;
end;
$$;

revoke all on function public.queue_expediente_group_execution(uuid, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.queue_expediente_group_execution(uuid, text, jsonb, jsonb, jsonb) to authenticated, service_role;


-- 5. HABILITAR SUPABASE REALTIME EN TABLAS DE EJECUCIÓN Y GRUPOS
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'expediente_document_groups'
  ) then
    alter publication supabase_realtime add table public.expediente_document_groups;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'expediente_executions'
  ) then
    alter publication supabase_realtime add table public.expediente_executions;
  end if;
end $$;


-- 6. RPC PARA CONSOLIDACIÓN SEGURA DEL EXPEDIENTE
create or replace function public.save_expediente_consolidation_version(
  p_project_id uuid,
  p_payload jsonb,
  p_change_summary text default 'Consolidación automática'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare next_ver integer;
declare new_version_id uuid;
declare current_user_id uuid;
begin
  current_user_id := (select auth.uid());

  -- Validar permisos en el proyecto
  if not private.has_project_role(p_project_id, 'operador') then
    raise exception 'No tienes permisos para consolidar este expediente.';
  end if;

  -- Obtener el siguiente número de versión consolidada
  select coalesce(max(version_number), 0) + 1 into next_ver
  from public.expediente_result_versions
  where project_id = p_project_id and scope = 'consolidated';

  -- Insertar versión borrador consolidada
  insert into public.expediente_result_versions (
    project_id, scope, group_id, version_number, status, payload, change_summary, created_by
  ) values (
    p_project_id, 'consolidated', null, next_ver, 'draft', p_payload, coalesce(p_change_summary, concat('Consolidación v', next_ver)), current_user_id
  )
  returning id into new_version_id;

  -- Actualizar estado de consolidación
  update public.expediente_consolidations
  set status = 'review_ready', updated_at = now()
  where project_id = p_project_id;

  -- Actualizar registro maestro a disponible
  update public.expediente_master_records
  set status = 'available'
  where project_id = p_project_id;

  -- Auditoría
  insert into public.expediente_audit_events (project_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_project_id, current_user_id, 'expediente.consolidation_created', 'result_version', new_version_id,
    jsonb_build_object('version_number', next_ver, 'scope', 'consolidated'));

  return new_version_id;
end;
$$;

revoke all on function public.save_expediente_consolidation_version(uuid, jsonb, text) from public, anon;
grant execute on function public.save_expediente_consolidation_version(uuid, jsonb, text) to authenticated, service_role;


-- 7. POLÍTICAS RLS COMPLEMENTARIAS PARA INSERTAR VERSIONES Y ACTUALIZAR CONSOLIDADO
alter table public.expediente_result_versions alter column created_by set default auth.uid();

drop policy if exists expediente_results_insert on public.expediente_result_versions;
create policy expediente_results_insert on public.expediente_result_versions
  for insert to authenticated with check (
    status = 'draft' and private.has_project_role(project_id, 'operador')
  );

drop policy if exists expediente_consolidations_update on public.expediente_consolidations;
create policy expediente_consolidations_update on public.expediente_consolidations
  for update to authenticated using (
    private.has_project_role(project_id, 'operador')
  );


-- 8. POLÍTICAS RLS Y PERMISOS PARA TELEMETRÍA DE IA (US-059)
grant select, insert on public.ai_execution_logs to authenticated, anon;

drop policy if exists ai_logs_select on public.ai_execution_logs;
create policy ai_logs_select on public.ai_execution_logs
  for select to authenticated, anon
  using (
    is_test_run = true
    or project_id is null
    or private.has_project_role(project_id, 'viewer')
    or exists (select 1 from public.projects p where p.id = ai_execution_logs.project_id)
  );

drop policy if exists ai_logs_insert on public.ai_execution_logs;
create policy ai_logs_insert on public.ai_execution_logs
  for insert to authenticated, anon
  with check (true);


