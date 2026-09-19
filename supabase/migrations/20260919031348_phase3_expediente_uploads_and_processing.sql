-- Territorium 2.0 / Fase 3
-- Carga privada reanudable, cola durable y progreso de un expediente v2.
-- La extracción jurídica no pertenece a esta migración: Fase 4 sustituirá el
-- payload de verificación por salidas de extracción estructuradas.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.expediente_document_files
  add column validation_status text not null default 'pending'
    check (validation_status in ('pending', 'validated', 'rejected')),
  add column detected_mime_type text,
  add column validation_error_code text,
  add column duplicate_of_document_file_id uuid references public.expediente_document_files(id) on delete set null;

alter table public.expediente_executions
  add column stage text not null default 'queued',
  add column stage_message text,
  add column cache_hits integer not null default 0 check (cache_hits >= 0),
  add column cache_misses integer not null default 0 check (cache_misses >= 0);

alter table public.expediente_execution_tasks
  add column available_at timestamptz not null default now(),
  add column stage text not null default 'queued',
  add column stage_message text;

create index expediente_tasks_available_idx
  on public.expediente_execution_tasks (status, available_at, created_at)
  where status = 'queued';

-- Una reserva separa la carga binaria del registro documental. La interfaz no
-- elige el path definitivo y un worker puede recoger reservas abandonadas.
create table public.expediente_upload_reservations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  group_id uuid not null references public.expediente_document_groups(id) on delete cascade,
  storage_path text not null unique check (storage_path ~ '^[0-9a-f-]+/expediente/(titles|plans|negotiation)/[0-9a-f-]+/.+'),
  original_name text not null check (char_length(trim(original_name)) between 1 and 255),
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg'
  )),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  duplicate_decision text not null default 'keep_version'
    check (duplicate_decision in ('omit', 'keep_version', 'replace')),
  duplicate_of_document_file_id uuid references public.expediente_document_files(id) on delete set null,
  status text not null default 'reserved'
    check (status in ('reserved', 'uploaded', 'committed', 'cancelled', 'expired')),
  document_file_id uuid references public.expediente_document_files(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  committed_at timestamptz
);
create index expediente_upload_reservations_expiry_idx
  on public.expediente_upload_reservations (status, expires_at)
  where status in ('reserved', 'uploaded');

-- La clave de caché se compone en el worker a partir de hash, extractor,
-- prompt, esquema y modelo. El contenido nunca se entrega al navegador.
create table public.expediente_extraction_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique check (cache_key ~ '^[0-9a-f]{64}$'),
  document_sha256 text not null check (document_sha256 ~ '^[0-9a-f]{64}$'),
  extractor_key text not null check (extractor_key in ('title_study', 'plan', 'negotiation')),
  extractor_fingerprint text not null check (extractor_fingerprint ~ '^[0-9a-f]{64}$'),
  prompt_fingerprint text not null check (prompt_fingerprint ~ '^[0-9a-f]{64}$'),
  schema_fingerprint text not null check (schema_fingerprint ~ '^[0-9a-f]{64}$'),
  model_fingerprint text not null check (model_fingerprint ~ '^[0-9a-f]{64}$'),
  payload jsonb not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  use_count integer not null default 0 check (use_count >= 0)
);
create index expediente_extraction_cache_document_idx
  on public.expediente_extraction_cache (document_sha256, extractor_key, last_used_at desc);

-- Límites centrales, aplicados dentro del reclamo de tarea; no dependen del
-- número de procesos worker que se desplieguen.
create table public.expediente_worker_limits (
  extractor_key text not null check (extractor_key in ('title_study', 'plan', 'negotiation')),
  provider text not null default 'default' check (char_length(trim(provider)) between 1 and 80),
  max_concurrency integer not null check (max_concurrency between 1 and 32),
  updated_at timestamptz not null default now(),
  primary key (extractor_key, provider)
);
insert into public.expediente_worker_limits (extractor_key, provider, max_concurrency) values
  ('title_study', 'default', 2),
  ('plan', 'default', 2),
  ('negotiation', 'default', 1)
on conflict (extractor_key, provider) do nothing;

create or replace function private.expediente_safe_storage_name(p_original_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(coalesce(p_original_name, '')), '[^a-z0-9._-]+', '-', 'g')),
      ''
    ),
    'documento'
  )
$$;

-- Security-definer is required so an INSERT policy on storage.objects can
-- check a private reservation without exposing its paths to other members.
create or replace function private.can_upload_expediente_storage_object(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.expediente_upload_reservations r
    where r.storage_path = p_object_name
      and r.status = 'reserved'
      and r.expires_at > now()
      and r.created_by = (select auth.uid())
      and private.has_project_role(r.project_id, 'operador')
  )
$$;

revoke all on function private.can_upload_expediente_storage_object(text) from public;
grant execute on function private.can_upload_expediente_storage_object(text) to authenticated;

create or replace function public.reserve_expediente_document_upload(
  p_group_id uuid,
  p_original_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_sha256 text,
  p_duplicate_decision text default 'keep_version'
)
returns table (
  reservation_id uuid,
  storage_path text,
  skip_upload boolean,
  duplicate_of_document_file_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare group_row public.expediente_document_groups%rowtype;
declare duplicate_row public.expediente_document_files%rowtype;
declare new_reservation_id uuid;
declare new_path text;
declare normalized_decision text := lower(trim(coalesce(p_duplicate_decision, 'keep_version')));
begin
  if normalized_decision not in ('omit', 'keep_version', 'replace') then
    raise exception 'La decisión de duplicado no es válida.';
  end if;
  if p_mime_type not in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png', 'image/jpeg'
  ) then
    raise exception 'El tipo de archivo no está permitido.';
  end if;
  if p_size_bytes <= 0 or p_size_bytes > 52428800 then
    raise exception 'El tamaño del archivo no está permitido.';
  end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'El hash SHA-256 no tiene el formato esperado.';
  end if;

  select * into group_row from public.expediente_document_groups where id = p_group_id for update;
  if not found or not private.has_project_role(group_row.project_id, 'operador') then
    raise exception 'No tienes permiso para cargar documentos en este expediente.';
  end if;

  select * into duplicate_row
  from public.expediente_document_files
  where group_id = group_row.id and is_current and is_active and sha256 = p_sha256
  order by created_at desc
  limit 1;

  if found and normalized_decision = 'omit' then
    insert into public.expediente_audit_events (project_id, actor_id, action, entity_type, entity_id, metadata)
    values (group_row.project_id, (select auth.uid()), 'expediente.document_duplicate_omitted', 'document_file', duplicate_row.id,
      jsonb_build_object('group_id', group_row.id, 'sha256', p_sha256));
    return query select null::uuid, null::text, true, duplicate_row.id, null::timestamptz;
    return;
  end if;

  new_reservation_id := gen_random_uuid();
  new_path := concat(
    group_row.project_id::text, '/expediente/', group_row.group_key, '/', new_reservation_id::text, '/',
    private.expediente_safe_storage_name(p_original_name)
  );
  insert into public.expediente_upload_reservations (
    id, project_id, group_id, storage_path, original_name, mime_type, size_bytes, sha256,
    duplicate_decision, duplicate_of_document_file_id, created_by
  ) values (
    new_reservation_id, group_row.project_id, group_row.id, new_path, trim(p_original_name), p_mime_type,
    p_size_bytes, p_sha256, normalized_decision, case when found then duplicate_row.id else null end, (select auth.uid())
  );
  return query
    select r.id, r.storage_path, false, r.duplicate_of_document_file_id, r.expires_at
    from public.expediente_upload_reservations r where r.id = new_reservation_id;
end;
$$;

create or replace function public.commit_expediente_document_upload(p_reservation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare reservation_row public.expediente_upload_reservations%rowtype;
declare group_row public.expediente_document_groups%rowtype;
declare object_metadata jsonb;
declare document_id uuid;
declare document_key_value uuid;
declare version_value integer;
begin
  select * into reservation_row from public.expediente_upload_reservations where id = p_reservation_id for update;
  if not found or reservation_row.created_by is distinct from (select auth.uid())
    or not private.has_project_role(reservation_row.project_id, 'operador') then
    raise exception 'La reserva de carga no existe o no te pertenece.';
  end if;
  if reservation_row.status = 'committed' then return reservation_row.document_file_id; end if;
  if reservation_row.status <> 'reserved' or reservation_row.expires_at <= now() then
    raise exception 'La reserva de carga ya no está vigente.';
  end if;

  select metadata into object_metadata from storage.objects
  where bucket_id = 'source-documents' and name = reservation_row.storage_path and archived_at is null;
  if object_metadata is null then
    raise exception 'El archivo no fue encontrado en almacenamiento privado.';
  end if;
  if coalesce((object_metadata->>'size')::bigint, -1) <> reservation_row.size_bytes
    or coalesce(object_metadata->>'mimetype', '') <> reservation_row.mime_type then
    raise exception 'Los metadatos del archivo cargado no coinciden con la reserva.';
  end if;

  select * into group_row from public.expediente_document_groups where id = reservation_row.group_id for update;
  if reservation_row.duplicate_decision = 'replace' and reservation_row.duplicate_of_document_file_id is not null then
    select document_key, version_number + 1 into document_key_value, version_value
    from public.expediente_document_files
    where id = reservation_row.duplicate_of_document_file_id for update;
    update public.expediente_document_files
    set is_current = false, is_active = false, retired_at = now(), retirement_reason = 'Reemplazado por carga duplicada autorizada.'
    where id = reservation_row.duplicate_of_document_file_id;
  else
    document_key_value := gen_random_uuid();
    version_value := 1;
  end if;

  insert into public.expediente_document_files (
    group_id, project_id, document_key, version_number, original_name, mime_type, storage_path,
    size_bytes, sha256, duplicate_of_document_file_id, validation_status, created_by
  ) values (
    group_row.id, reservation_row.project_id, document_key_value, version_value,
    reservation_row.original_name, reservation_row.mime_type, reservation_row.storage_path,
    reservation_row.size_bytes, reservation_row.sha256, reservation_row.duplicate_of_document_file_id,
    'pending', (select auth.uid())
  ) returning id into document_id;

  update public.expediente_upload_reservations
  set status = 'committed', document_file_id = document_id, committed_at = now()
  where id = reservation_row.id;
  insert into public.expediente_audit_events (project_id, actor_id, action, entity_type, entity_id, metadata)
  values (reservation_row.project_id, (select auth.uid()), 'expediente.document_upload_committed', 'document_file', document_id,
    jsonb_build_object('reservation_id', reservation_row.id, 'duplicate_decision', reservation_row.duplicate_decision,
      'duplicate_of_document_file_id', reservation_row.duplicate_of_document_file_id));
  return document_id;
end;
$$;

create or replace function public.cancel_expediente_document_upload(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare reservation_row public.expediente_upload_reservations%rowtype;
begin
  select * into reservation_row from public.expediente_upload_reservations where id = p_reservation_id for update;
  if not found or reservation_row.created_by is distinct from (select auth.uid())
    or not private.has_project_role(reservation_row.project_id, 'operador') then
    raise exception 'La reserva de carga no existe o no te pertenece.';
  end if;
  if reservation_row.status = 'committed' then return false; end if;
  update public.expediente_upload_reservations set status = 'cancelled' where id = reservation_row.id;
  insert into public.expediente_audit_events (project_id, actor_id, action, entity_type, entity_id, metadata)
  values (reservation_row.project_id, (select auth.uid()), 'expediente.document_upload_cancelled', 'upload_reservation', reservation_row.id,
    jsonb_build_object('storage_path', reservation_row.storage_path));
  return true;
end;
$$;

create or replace function public.expire_expediente_upload_reservations(p_limit integer default 100)
returns table (reservation_id uuid, storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'Solo el worker puede expirar reservas.'; end if;
  return query
    with expired as (
      update public.expediente_upload_reservations
      set status = 'expired'
      where id in (
        select id from public.expediente_upload_reservations
        where (status = 'reserved' and expires_at <= now()) or status = 'cancelled'
        order by expires_at, created_at
        limit greatest(1, least(p_limit, 500))
        for update skip locked
      )
      returning id, public.expediente_upload_reservations.storage_path
    ) select expired.id, expired.storage_path from expired;
end;
$$;

revoke all on function public.reserve_expediente_document_upload(uuid, text, text, bigint, text, text) from public, anon;
grant execute on function public.reserve_expediente_document_upload(uuid, text, text, bigint, text, text) to authenticated, service_role;
revoke all on function public.commit_expediente_document_upload(uuid) from public, anon;
grant execute on function public.commit_expediente_document_upload(uuid) to authenticated, service_role;
revoke all on function public.cancel_expediente_document_upload(uuid) from public, anon;
grant execute on function public.cancel_expediente_document_upload(uuid) to authenticated, service_role;
revoke all on function public.expire_expediente_upload_reservations(integer) from public, anon, authenticated;
grant execute on function public.expire_expediente_upload_reservations(integer) to service_role;

-- Reemplaza el reclamo de Fase 2 para respetar backoff y límites de extractor.
create or replace function public.claim_next_expediente_execution_task(p_worker_name text default 'worker')
returns setof public.expediente_execution_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare candidate record;
declare claimed_task public.expediente_execution_tasks%rowtype;
declare provider_key text;
declare configured_limit integer;
declare running_count integer;
begin
  update public.expediente_execution_tasks
  set status = 'queued', lease_token = null, lease_expires_at = null, available_at = now(),
      error_code = 'LEASE_EXPIRED', error_message = 'La tarea perdió su arrendamiento y puede reintentarse.',
      stage = 'retry_wait', stage_message = 'Recuperada después de una interrupción del worker.'
  where status = 'running' and lease_expires_at < now() and attempt_count < max_attempts;

  update public.expediente_execution_tasks
  set status = 'failed', lease_token = null, lease_expires_at = null, completed_at = now(),
      error_code = 'RETRY_EXHAUSTED', error_message = 'La tarea agotó sus reintentos después de perder el arrendamiento.',
      stage = 'failed', stage_message = 'No fue posible recuperar la tarea.'
  where status = 'running' and lease_expires_at < now() and attempt_count >= max_attempts;

  -- Un lease agotado no puede dejar el grupo como procesando para siempre.
  update public.expediente_executions e
  set status = 'failed', completed_at = now(), error_code = 'RETRY_EXHAUSTED',
      error_message = 'Al menos una tarea agotó sus reintentos.', stage = 'failed',
      stage_message = 'Una tarea no pudo recuperarse.'
  where e.status in ('queued', 'processing')
    and exists (
      select 1 from public.expediente_execution_tasks t
      where t.execution_id = e.id and t.status = 'failed' and t.error_code = 'RETRY_EXHAUSTED'
    );

  update public.expediente_document_groups g
  set status = 'error', last_error_code = 'RETRY_EXHAUSTED',
      last_error_message = 'Una tarea agotó sus reintentos.'
  from public.expediente_executions e
  where e.group_id = g.id and e.input_version = g.input_version
    and e.status = 'failed' and e.error_code = 'RETRY_EXHAUSTED'
    and g.status in ('queued', 'processing');

  for candidate in
    select t.id, e.id as execution_id, e.group_id, e.extractor_key,
      coalesce(nullif(e.model_snapshot->>'provider', ''), 'default') as provider
    from public.expediente_execution_tasks t
    join public.expediente_executions e on e.id = t.execution_id
    where t.status = 'queued' and t.available_at <= now() and t.attempt_count < t.max_attempts
      and e.status in ('queued', 'processing')
    order by t.created_at
    for update of t skip locked
  loop
    provider_key := candidate.provider;
    if not pg_try_advisory_xact_lock(hashtext(candidate.extractor_key || ':' || provider_key)) then continue; end if;
    select max_concurrency into configured_limit
    from public.expediente_worker_limits
    where extractor_key = candidate.extractor_key and provider = provider_key;
    configured_limit := coalesce(configured_limit, 1);
    select count(*) into running_count
    from public.expediente_execution_tasks running_task
    join public.expediente_executions running_execution on running_execution.id = running_task.execution_id
    where running_task.status = 'running'
      and running_execution.extractor_key = candidate.extractor_key
      and coalesce(nullif(running_execution.model_snapshot->>'provider', ''), 'default') = provider_key;
    if running_count >= configured_limit then continue; end if;

    update public.expediente_execution_tasks
    set status = 'running', attempt_count = attempt_count + 1, started_at = coalesce(started_at, now()),
        lease_token = gen_random_uuid(), lease_expires_at = now() + interval '5 minutes',
        stage = 'validating', stage_message = concat('Validando insumo con ', left(coalesce(p_worker_name, 'worker'), 80), '.')
    where id = candidate.id
    returning * into claimed_task;
    update public.expediente_executions
    set status = 'processing', started_at = coalesce(started_at, now()), stage = 'validating',
        stage_message = 'Validando insumos y preparando procesamiento.'
    where id = candidate.execution_id and status = 'queued';
    update public.expediente_document_groups
    set status = 'processing', last_error_code = null, last_error_message = null
    where id = candidate.group_id and status = 'queued';
    return next claimed_task;
    return;
  end loop;
  return;
end;
$$;

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
      status = case when execution_failed then 'failed' when execution_ready then 'review_ready' else 'processing' end,
      stage = case when execution_failed then 'failed' when execution_ready then 'ready_for_extraction' else 'validating' end,
      stage_message = case when execution_failed then 'Un insumo no pudo validarse.' when execution_ready then 'Insumos preparados para extracción.' else 'Validando los insumos restantes.' end,
      completed_at = case when execution_failed or execution_ready then now() else null end
  where id = execution_row.id;
  update public.expediente_document_groups
  set status = case when e.status = 'failed' then 'error' when e.status = 'review_ready' then 'review_ready' else 'processing' end,
      last_error_code = case when e.status = 'failed' then coalesce(p_error_code, 'TASK_FAILED') else null end,
      last_error_message = case when e.status = 'failed' then left(coalesce(p_error_message, 'Un insumo no pudo validarse.'), 2000) else null end
  from public.expediente_executions e
  where expediente_document_groups.id = execution_row.group_id and e.id = execution_row.id;
  return true;
end;
$$;

create or replace function public.record_expediente_cache_hit(p_cache_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare cached_payload jsonb;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'Solo el worker puede consultar la caché de extracción.'; end if;
  update public.expediente_extraction_cache
  set last_used_at = now(), use_count = use_count + 1
  where cache_key = p_cache_key
  returning payload into cached_payload;
  return cached_payload;
end;
$$;
revoke all on function public.record_expediente_cache_hit(text) from public, anon, authenticated;
grant execute on function public.record_expediente_cache_hit(text) to service_role;

-- La reserva es una frontera de autorización: los navegadores no insertan ni
-- modifican filas documentales sin haber confirmado un objeto real en Storage.
alter table public.expediente_upload_reservations enable row level security;
alter table public.expediente_extraction_cache enable row level security;
alter table public.expediente_worker_limits enable row level security;
revoke all on public.expediente_upload_reservations, public.expediente_extraction_cache, public.expediente_worker_limits from anon, authenticated;
grant select on public.expediente_upload_reservations to authenticated;
grant all privileges on public.expediente_upload_reservations, public.expediente_extraction_cache, public.expediente_worker_limits to service_role;
create policy expediente_upload_reservations_select on public.expediente_upload_reservations
  for select to authenticated using (created_by = (select auth.uid()) and private.has_project_role(project_id, 'operador'));

revoke insert, update on public.expediente_document_files from authenticated;
drop policy if exists expediente_documents_insert on public.expediente_document_files;
drop policy if exists expediente_documents_update on public.expediente_document_files;

drop policy if exists source_objects_insert on storage.objects;
create policy source_objects_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'source-documents' and (
    (
      coalesce((storage.foldername(name))[2], '') <> 'expediente'
      and exists (
        select 1 from public.projects p
        where p.id::text = (storage.foldername(name))[1] and private.has_project_role(p.id, 'operador')
      )
    )
    or private.can_upload_expediente_storage_object(name)
  )
);

alter publication supabase_realtime add table
  public.expediente_document_groups,
  public.expediente_executions,
  public.expediente_execution_tasks;

commit;
