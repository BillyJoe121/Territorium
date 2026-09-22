-- =========================================================================
-- CORRECCIÓN DEFINITIVA DE CONDICIÓN DE CARRERA EN PROCESAMIENTO
-- Y HABILITACIÓN DE REPETICIÓN DE ANÁLISIS
-- =========================================================================

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

  -- IMPORTANTE: Cuando se validan los archivos, el estado debe permanecer en 'processing'
  -- (con stage = 'ready_for_extraction') para que el worker ejecute la Fase 4 de extracción por IA.
  -- Solo cuando el worker termine de extraer y guarde la versión en expediente_result_versions,
  -- el estado pasará a 'review_ready'. Esto evita la carrera donde el modal se abre vacío o con datos previos.
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


-- Permitir re-encolar grupos en 'review_ready' además de 'ready', 'stale', 'error'
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

  -- Permitir encolar si está en ready, stale, error O review_ready (re-análisis)
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
