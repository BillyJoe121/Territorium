-- HU-V2-029: una clave repetida representa la misma intención del usuario.
-- Debe devolver la ejecución original, aun si el primer clic ya puso el grupo
-- en cola, en lugar de convertir un doble clic o reintento de red en un 409.
begin;

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

  -- Este camino debe ejecutarse antes de validar el estado: la primera
  -- solicitud ya habrá cambiado ready -> queued cuando llegue el duplicado.
  select id, group_id into execution_id, existing_group_id
  from public.expediente_executions
  where project_id = group_row.project_id and idempotency_key = trim(p_idempotency_key);
  if found then
    if existing_group_id is distinct from group_row.id then
      raise exception 'La clave de idempotencia ya pertenece a otro grupo documental.';
    end if;
    return execution_id;
  end if;

  if group_row.status not in ('ready', 'stale', 'error') then
    raise exception 'El grupo no está disponible para una nueva ejecución.';
  end if;
  audit_action := case when group_row.status in ('stale', 'error')
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

  -- Otro grupo puede intentar la misma clave concurrentemente. La restricción
  -- única arbitra esa carrera; solo devolvemos el resultado si es este grupo.
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

commit;
