-- Territorium 2.0 / Fase 2
-- Dominio versionado para un expediente (project) y un único predio.
--
-- Estrategia de despliegue: expandir primero. Esta migración no elimina ni
-- reinterpreta batches, property_records o documentos del flujo anterior;
-- estos podían contener varios predios y no son una fuente segura para un
-- backfill automático de resultados v2.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- HU-V2-021. La identidad predial está separada del nombre del proyecto,
-- tiene una fila actual por expediente y conserva sus cambios como versiones.
create table public.expediente_property_identities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  identity_version integer not null default 1 check (identity_version > 0),
  folio text,
  cadastral_id text,
  property_name text not null check (char_length(trim(property_name)) between 1 and 240),
  municipality text not null check (char_length(trim(municipality)) between 1 and 120),
  department text not null check (char_length(trim(department)) between 1 and 120),
  village text,
  identity_metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, folio) deferrable initially immediate,
  check (folio is null or char_length(trim(folio)) between 1 and 120),
  check (cadastral_id is null or char_length(trim(cadastral_id)) between 1 and 120)
);

create table public.expediente_property_identity_versions (
  id uuid primary key default gen_random_uuid(),
  property_identity_id uuid not null references public.expediente_property_identities(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  version integer not null check (version > 0),
  folio text,
  cadastral_id text,
  property_name text not null,
  municipality text not null,
  department text not null,
  village text,
  identity_metadata jsonb not null default '{}'::jsonb,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  change_reason text,
  unique (property_identity_id, version)
);

-- La tabla maestro hace explícita la restricción: un expediente no puede
-- tener dos registros maestros ni un registro de la identidad de otro proyecto.
create table public.expediente_master_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  property_identity_id uuid not null unique references public.expediente_property_identities(id) on delete restrict,
  status text not null default 'blocked' check (status in ('blocked', 'available', 'approved', 'stale')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- HU-V2-022. Cada expediente obtiene exactamente un grupo activo de cada tipo.
create table public.expediente_document_groups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  group_key text not null check (group_key in ('titles', 'plans', 'negotiation')),
  status text not null default 'empty' check (status in ('empty', 'ready', 'queued', 'processing', 'review_ready', 'approved', 'stale', 'error')),
  input_version integer not null default 1 check (input_version > 0),
  current_negotiation_file_id uuid,
  last_error_code text,
  last_error_message text check (last_error_message is null or char_length(last_error_message) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, group_key)
);

-- document_key es la identidad lógica del archivo; cada reemplazo agrega una
-- nueva versión y nunca borra la versión retirada.
create table public.expediente_document_files (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.expediente_document_groups(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  document_key uuid not null default gen_random_uuid(),
  version_number integer not null default 1 check (version_number > 0),
  original_name text not null check (char_length(trim(original_name)) between 1 and 255),
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg'
  )),
  storage_path text not null unique check (storage_path ~ '^[0-9a-f-]+/expediente/(titles|plans|negotiation)/[0-9a-f-]+/.+'),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  is_current boolean not null default true,
  is_active boolean not null default true,
  retired_at timestamptz,
  retirement_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (group_id, document_key, version_number)
);

create unique index expediente_document_one_current_version_idx
  on public.expediente_document_files (group_id, document_key)
  where is_current;
create index expediente_document_group_active_idx
  on public.expediente_document_files (group_id, is_active, is_current);
create index expediente_document_project_idx
  on public.expediente_document_files (project_id, created_at desc);

-- HU-V2-023. La ejecución almacena la foto exacta de los insumos, prompt,
-- extractor y modelo; cada tarea puede reintentarse por separado.
create table public.expediente_executions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  group_id uuid not null references public.expediente_document_groups(id) on delete cascade,
  input_version integer not null check (input_version > 0),
  status text not null default 'queued' check (status in ('queued', 'processing', 'review_ready', 'completed', 'failed', 'cancelled', 'superseded')),
  idempotency_key text not null check (char_length(trim(idempotency_key)) between 16 and 200),
  extractor_key text not null check (extractor_key in ('title_study', 'plan', 'negotiation', 'consolidation')),
  extractor_snapshot jsonb not null default '{}'::jsonb,
  prompt_snapshot jsonb not null default '{}'::jsonb,
  model_snapshot jsonb not null default '{}'::jsonb,
  input_snapshot jsonb not null default '[]'::jsonb,
  total_units integer not null default 0 check (total_units >= 0),
  completed_units integer not null default 0 check (completed_units >= 0 and completed_units <= total_units),
  error_code text,
  error_message text check (error_message is null or char_length(error_message) <= 2000),
  cancelled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (project_id, idempotency_key)
);

create unique index expediente_one_active_execution_idx
  on public.expediente_executions (group_id)
  where status in ('queued', 'processing');
create index expediente_executions_project_status_idx
  on public.expediente_executions (project_id, status, created_at desc);

create table public.expediente_execution_tasks (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.expediente_executions(id) on delete cascade,
  document_file_id uuid references public.expediente_document_files(id) on delete restrict,
  fragment_number integer not null default 1 check (fragment_number > 0),
  fragment_locator jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  idempotency_key text not null check (char_length(trim(idempotency_key)) between 16 and 200),
  attempt_count smallint not null default 0 check (attempt_count >= 0),
  max_attempts smallint not null default 3 check (max_attempts between 1 and 10),
  lease_token uuid,
  lease_expires_at timestamptz,
  error_code text,
  error_message text check (error_message is null or char_length(error_message) <= 2000),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (execution_id, idempotency_key),
  unique (execution_id, document_file_id, fragment_number)
);

create index expediente_tasks_claim_idx
  on public.expediente_execution_tasks (status, lease_expires_at, created_at)
  where status = 'queued';
create index expediente_tasks_execution_idx
  on public.expediente_execution_tasks (execution_id, status);

-- La salida de IA no es editable: los humanos trabajan sobre result_versions.
create table public.expediente_execution_outputs (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.expediente_executions(id) on delete cascade,
  task_id uuid references public.expediente_execution_tasks(id) on delete set null,
  project_id uuid not null references public.projects(id) on delete cascade,
  group_id uuid not null references public.expediente_document_groups(id) on delete cascade,
  payload jsonb not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (execution_id, task_id)
);

create index expediente_outputs_execution_idx
  on public.expediente_execution_outputs (execution_id, created_at);

-- HU-V2-024. Un resultado editable siempre es una versión nueva ligada a una
-- salida inmutable o a una versión anterior. scope=consolidated no tiene group_id.
create table public.expediente_result_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scope text not null check (scope in ('group', 'consolidated')),
  group_id uuid references public.expediente_document_groups(id) on delete cascade,
  source_execution_id uuid references public.expediente_executions(id) on delete set null,
  source_output_id uuid references public.expediente_execution_outputs(id) on delete set null,
  parent_result_version_id uuid references public.expediente_result_versions(id) on delete set null,
  version_number integer not null check (version_number > 0),
  source_input_version integer,
  source_group_versions jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'approved', 'superseded', 'stale')),
  payload jsonb not null default '{}'::jsonb,
  change_summary text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'group' and group_id is not null and source_input_version is not null) or (scope = 'consolidated' and group_id is null)),
  unique (group_id, version_number)
);

create index expediente_result_versions_project_idx
  on public.expediente_result_versions (project_id, scope, status, created_at desc);
create unique index expediente_consolidated_result_version_idx
  on public.expediente_result_versions (project_id, version_number)
  where scope = 'consolidated';

create table public.expediente_approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  result_version_id uuid not null unique references public.expediente_result_versions(id) on delete restrict,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default now(),
  approval_note text,
  snapshot_sha256 text not null check (snapshot_sha256 ~ '^[0-9a-f]{64}$')
);

-- HU-V2-025. Consolidado y documento final son estados v2 independientes;
-- una invalidación conserva las versiones pero retira su condición de vigente.
create table public.expediente_consolidations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  status text not null default 'blocked' check (status in ('blocked', 'available', 'processing', 'review_ready', 'approved', 'stale')),
  input_signature jsonb not null default '{}'::jsonb,
  current_execution_id uuid references public.expediente_executions(id) on delete set null,
  approved_result_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expediente_final_document_states (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  status text not null default 'blocked' check (status in ('blocked', 'generating', 'editable', 'reprocessing', 'final', 'stale')),
  source_consolidation_version_id uuid references public.expediente_result_versions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expediente_artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in ('consolidated_xlsx', 'final_pdf', 'final_docx')),
  storage_path text not null unique,
  source_result_version_id uuid references public.expediente_result_versions(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'stale', 'revoked')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index expediente_artifacts_download_idx
  on public.expediente_artifacts (project_id, kind, status, created_at desc);

create table public.expediente_audit_events (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 120),
  entity_type text not null check (char_length(entity_type) between 1 and 80),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index expediente_audit_project_created_idx
  on public.expediente_audit_events (project_id, created_at desc);

alter table public.expediente_document_groups
  add constraint expediente_groups_current_negotiation_file_fk
  foreign key (current_negotiation_file_id) references public.expediente_document_files(id) on delete set null;
alter table public.expediente_document_groups
  add column approved_result_version_id uuid references public.expediente_result_versions(id) on delete set null;
alter table public.expediente_master_records
  add column approved_result_version_id uuid references public.expediente_result_versions(id) on delete set null;
alter table public.expediente_consolidations
  add constraint expediente_consolidations_approved_result_fk
  foreign key (approved_result_version_id) references public.expediente_result_versions(id) on delete set null;

-- Common safeguards and state transitions are enforced on the server, not in UI state.
create or replace function private.assert_expediente_master_record_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare identity_project uuid;
begin
  select project_id into identity_project
  from public.expediente_property_identities
  where id = new.property_identity_id;

  if identity_project is distinct from new.project_id then
    raise exception 'El registro maestro debe referenciar la identidad predial de su mismo expediente.';
  end if;
  return new;
end;
$$;

create trigger expediente_master_record_identity_check
before insert or update of project_id, property_identity_id on public.expediente_master_records
for each row execute function private.assert_expediente_master_record_identity();

create or replace function private.version_expediente_property_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if row(new.folio, new.cadastral_id, new.property_name, new.municipality, new.department, new.village, new.identity_metadata)
     is not distinct from
     row(old.folio, old.cadastral_id, old.property_name, old.municipality, old.department, old.village, old.identity_metadata) then
    return new;
  end if;

  insert into public.expediente_property_identity_versions (
    property_identity_id, project_id, version, folio, cadastral_id, property_name,
    municipality, department, village, identity_metadata, changed_by, change_reason
  ) values (
    old.id, old.project_id, old.identity_version, old.folio, old.cadastral_id, old.property_name,
    old.municipality, old.department, old.village, old.identity_metadata, (select auth.uid()),
    coalesce(new.identity_metadata ->> 'change_reason', 'Actualización de identidad predial')
  );
  new.identity_version = old.identity_version + 1;
  return new;
end;
$$;

create trigger expediente_property_identity_versioning
before update on public.expediente_property_identities
for each row execute function private.version_expediente_property_identity();
create trigger expediente_property_identity_touch
before update on public.expediente_property_identities
for each row execute function private.touch_updated_at();
create trigger expediente_master_records_touch
before update on public.expediente_master_records
for each row execute function private.touch_updated_at();
create trigger expediente_document_groups_touch
before update on public.expediente_document_groups
for each row execute function private.touch_updated_at();
create trigger expediente_executions_touch
before update on public.expediente_executions
for each row execute function private.touch_updated_at();
create trigger expediente_execution_tasks_touch
before update on public.expediente_execution_tasks
for each row execute function private.touch_updated_at();
create trigger expediente_result_versions_touch
before update on public.expediente_result_versions
for each row execute function private.touch_updated_at();
create trigger expediente_consolidations_touch
before update on public.expediente_consolidations
for each row execute function private.touch_updated_at();
create trigger expediente_final_document_states_touch
before update on public.expediente_final_document_states
for each row execute function private.touch_updated_at();

create or replace function private.assert_expediente_group_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status then return new; end if;
  if (old.status = 'empty' and new.status in ('ready', 'stale'))
    or (old.status = 'ready' and new.status in ('empty', 'queued', 'stale', 'error'))
    or (old.status = 'queued' and new.status in ('ready', 'processing', 'error', 'stale'))
    or (old.status = 'processing' and new.status in ('review_ready', 'error', 'stale'))
    or (old.status = 'review_ready' and new.status in ('approved', 'queued', 'stale', 'error'))
    or (old.status = 'approved' and new.status = 'stale')
    or (old.status = 'stale' and new.status in ('empty', 'ready', 'queued'))
    or (old.status = 'error' and new.status in ('ready', 'queued', 'stale')) then
    return new;
  end if;
  raise exception 'Transición inválida para grupo documental: % -> %', old.status, new.status;
end;
$$;

create trigger expediente_group_transition_check
before update of status on public.expediente_document_groups
for each row execute function private.assert_expediente_group_transition();

create or replace function private.assert_current_negotiation_file()
returns trigger
language plpgsql
set search_path = ''
as $$
declare file_group uuid;
declare actual_key text;
begin
  if new.current_negotiation_file_id is null then return new; end if;
  select f.group_id, g.group_key into file_group, actual_key
  from public.expediente_document_files f
  join public.expediente_document_groups g on g.id = f.group_id
  where f.id = new.current_negotiation_file_id;
  if file_group is distinct from new.id or actual_key <> 'negotiation' then
    raise exception 'El archivo vigente de negociación debe pertenecer al grupo Negociación del mismo expediente.';
  end if;
  return new;
end;
$$;

create trigger expediente_group_current_negotiation_check
before insert or update of current_negotiation_file_id on public.expediente_document_groups
for each row execute function private.assert_current_negotiation_file();

create or replace function private.assert_expediente_file_project()
returns trigger
language plpgsql
set search_path = ''
as $$
declare group_project uuid;
begin
  select project_id into group_project from public.expediente_document_groups where id = new.group_id;
  if group_project is distinct from new.project_id then
    raise exception 'El documento debe pertenecer al mismo expediente que su grupo documental.';
  end if;
  return new;
end;
$$;

create trigger expediente_file_project_check
before insert or update of group_id, project_id on public.expediente_document_files
for each row execute function private.assert_expediente_file_project();

create or replace function private.prevent_historical_file_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not old.is_current and new is distinct from old then
    raise exception 'Las versiones históricas de archivo son inmutables.';
  end if;
  return new;
end;
$$;

create trigger expediente_file_history_immutable
before update on public.expediente_document_files
for each row execute function private.prevent_historical_file_mutation();

create or replace function private.prevent_expediente_output_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'La salida original de una ejecución es inmutable.';
end;
$$;

create trigger expediente_execution_outputs_immutable
before update or delete on public.expediente_execution_outputs
for each row execute function private.prevent_expediente_output_mutation();

create or replace function private.prevent_non_draft_result_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    raise exception 'Solo los borradores de resultado se pueden editar.';
  end if;
  if new.status <> old.status and current_setting('app.expediente_approval', true) is distinct from 'on' then
    raise exception 'El cambio de estado de resultado debe ejecutarse mediante una acción transaccional autorizada.';
  end if;
  return new;
end;
$$;

create trigger expediente_result_versions_draft_only
before update on public.expediente_result_versions
for each row execute function private.prevent_non_draft_result_mutation();

create or replace function private.invalidate_expediente_downstream(p_group_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_project uuid;
declare has_active_files boolean;
begin
  select project_id into target_project from public.expediente_document_groups where id = p_group_id for update;
  if target_project is null then return; end if;

  select exists (
    select 1 from public.expediente_document_files
    where group_id = p_group_id and is_current and is_active
  ) into has_active_files;

  -- Un resultado de una versión de insumos sustituida no puede volver a dejar
  -- el grupo listo para revisión. Las tareas con lease activo quedan canceladas
  -- y complete_expediente_execution_task rechazará su respuesta tardía.
  update public.expediente_executions
  set status = 'superseded', cancelled_at = now(), completed_at = now(),
      error_code = 'INPUTS_CHANGED', error_message = 'Los insumos cambiaron durante la ejecución.'
  where group_id = p_group_id and status in ('queued', 'processing');
  update public.expediente_execution_tasks t
  set status = 'cancelled', lease_token = null, lease_expires_at = null, completed_at = now(),
      error_code = 'INPUTS_CHANGED', error_message = 'La tarea se canceló porque cambió el conjunto de insumos.'
  from public.expediente_executions e
  where t.execution_id = e.id and e.group_id = p_group_id and e.status = 'superseded'
    and t.status in ('queued', 'running');

  update public.expediente_document_groups
  set input_version = input_version + 1,
      status = case
        when status in ('queued', 'processing', 'review_ready', 'approved', 'stale') then 'stale'
        when has_active_files then 'ready'
        else 'empty'
      end,
      approved_result_version_id = null,
      current_negotiation_file_id = case when group_key = 'negotiation' then (
        select id from public.expediente_document_files
        where group_id = p_group_id and is_current and is_active
        order by created_at desc limit 1
      ) else null end,
      last_error_code = null,
      last_error_message = null
  where id = p_group_id;

  update public.expediente_master_records
  set status = case when status = 'approved' then 'stale' else 'blocked' end,
      approved_result_version_id = null
  where project_id = target_project;

  update public.expediente_consolidations
  set status = case when status in ('approved', 'review_ready', 'processing', 'available') then 'stale' else 'blocked' end,
      approved_result_version_id = null
  where project_id = target_project;

  update public.expediente_final_document_states
  set status = case when status in ('editable', 'final', 'generating', 'reprocessing') then 'stale' else 'blocked' end
  where project_id = target_project;

  update public.expediente_artifacts
  set status = 'stale'
  where project_id = target_project and status = 'active';

  insert into public.expediente_audit_events (project_id, actor_id, action, entity_type, entity_id, metadata)
  values (target_project, (select auth.uid()), 'expediente.inputs_invalidated', 'document_group', p_group_id, jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function private.invalidate_after_document_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.invalidate_expediente_downstream(new.group_id, 'Archivo agregado');
  elsif old.is_current is distinct from new.is_current
     or old.is_active is distinct from new.is_active
     or old.storage_path is distinct from new.storage_path
     or old.sha256 is distinct from new.sha256 then
    perform private.invalidate_expediente_downstream(new.group_id, 'Archivo reemplazado o retirado');
  end if;
  return new;
end;
$$;

create trigger expediente_document_change_invalidates
after insert or update on public.expediente_document_files
for each row execute function private.invalidate_after_document_change();

create or replace function private.audit_expediente_document_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare action_name text;
declare target_project uuid;
declare target_id uuid;
declare target_group uuid;
begin
  if tg_op = 'INSERT' then
    action_name := 'expediente.document_uploaded';
    target_project := new.project_id;
    target_id := new.id;
    target_group := new.group_id;
  elsif old.is_current and not new.is_current or old.is_active and not new.is_active then
    action_name := 'expediente.document_retired';
    target_project := new.project_id;
    target_id := new.id;
    target_group := new.group_id;
  elsif old.storage_path is distinct from new.storage_path or old.sha256 is distinct from new.sha256 then
    action_name := 'expediente.document_replaced';
    target_project := new.project_id;
    target_id := new.id;
    target_group := new.group_id;
  else
    return new;
  end if;

  insert into public.expediente_audit_events (project_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    target_project, (select auth.uid()), action_name, 'document_file', target_id,
    jsonb_build_object('group_id', target_group, 'operation', tg_op)
  );
  return new;
end;
$$;

create trigger expediente_document_change_audit
after insert or update on public.expediente_document_files
for each row execute function private.audit_expediente_document_change();

create or replace function private.audit_expediente_result_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare action_name text;
begin
  if tg_op = 'INSERT' then
    action_name := 'expediente.result_draft_created';
  elsif old.payload is distinct from new.payload or old.change_summary is distinct from new.change_summary then
    action_name := 'expediente.result_draft_saved';
  else
    return new;
  end if;

  insert into public.expediente_audit_events (project_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    new.project_id, coalesce((select auth.uid()), new.created_by), action_name, 'result_version', new.id,
    jsonb_build_object('scope', new.scope, 'group_id', new.group_id, 'version_number', new.version_number)
  );
  return new;
end;
$$;

create trigger expediente_result_change_audit
after insert or update of payload, change_summary on public.expediente_result_versions
for each row execute function private.audit_expediente_result_change();

-- Todo expediente nuevo nace con la misma estructura v2 que los expedientes
-- inicializados por el backfill. Esto evita que la interfaz tenga que crear
-- filas críticas por separado o que aparezcan expedientes parcialmente creados.
create or replace function private.initialize_expediente_v2_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare identity_id uuid;
begin
  insert into public.expediente_property_identities (
    project_id, property_name, municipality, department, created_by
  ) values (
    new.id,
    new.name,
    coalesce(nullif(trim(new.municipality), ''), 'Por definir'),
    coalesce(nullif(trim(new.department), ''), 'Por definir'),
    new.created_by
  )
  on conflict (project_id) do update set project_id = excluded.project_id
  returning id into identity_id;

  insert into public.expediente_master_records (project_id, property_identity_id)
  values (new.id, identity_id)
  on conflict (project_id) do nothing;

  insert into public.expediente_document_groups (project_id, group_key)
  select new.id, group_key
  from (values ('titles'::text), ('plans'::text), ('negotiation'::text)) as groups(group_key)
  on conflict (project_id, group_key) do nothing;

  insert into public.expediente_consolidations (project_id)
  values (new.id)
  on conflict (project_id) do nothing;
  insert into public.expediente_final_document_states (project_id)
  values (new.id)
  on conflict (project_id) do nothing;
  return new;
end;
$$;

create trigger project_initialize_expediente_v2
after insert on public.projects
for each row execute function private.initialize_expediente_v2_project();

-- El navegador solo solicita la ejecución; la base fija la foto de documentos
-- y crea tareas idempotentes antes de pasar el grupo a la cola.
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
  select group_row.project_id, group_row.id, group_row.input_version, 'queued', p_idempotency_key,
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
  returning id into execution_id;

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

-- Worker-only lease/complete RPCs. El token de lease evita que una respuesta
-- tardía pise una tarea cancelada, reemplazada o ya reclamada de nuevo.
create or replace function public.claim_next_expediente_execution_task(p_worker_name text default 'worker')
returns setof public.expediente_execution_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare claimed_id uuid;
declare claimed_execution_id uuid;
declare claimed_group_id uuid;
begin
  update public.expediente_execution_tasks
  set status = 'queued', lease_token = null, lease_expires_at = null,
      error_code = 'LEASE_EXPIRED', error_message = 'La tarea perdió su arrendamiento y puede reintentarse.'
  where status = 'running' and lease_expires_at < now() and attempt_count < max_attempts;

  update public.expediente_execution_tasks
  set status = 'failed', lease_token = null, lease_expires_at = null, completed_at = now(),
      error_code = 'RETRY_EXHAUSTED', error_message = 'La tarea agotó sus reintentos después de perder el arrendamiento.'
  where status = 'running' and lease_expires_at < now() and attempt_count >= max_attempts;

  update public.expediente_executions e
  set status = 'failed', completed_at = now(), error_code = 'RETRY_EXHAUSTED',
      error_message = 'Al menos una tarea agotó sus reintentos.'
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

  select t.id into claimed_id
  from public.expediente_execution_tasks t
  join public.expediente_executions e on e.id = t.execution_id
  where t.status = 'queued' and t.attempt_count < t.max_attempts and e.status in ('queued', 'processing')
  order by t.created_at
  for update of t skip locked
  limit 1;

  if claimed_id is null then return; end if;

  update public.expediente_execution_tasks
  set status = 'running', attempt_count = attempt_count + 1,
      started_at = coalesce(started_at, now()), lease_token = gen_random_uuid(),
      lease_expires_at = now() + interval '5 minutes'
  where id = claimed_id
  returning execution_id into claimed_execution_id;

  select group_id into claimed_group_id from public.expediente_executions where id = claimed_execution_id;
  update public.expediente_executions
  set status = 'processing', started_at = coalesce(started_at, now())
  where id = claimed_execution_id and status = 'queued';
  update public.expediente_document_groups
  set status = 'processing'
  where id = claimed_group_id and status = 'queued';

  return query
  select * from public.expediente_execution_tasks
  where id = claimed_id;
end;
$$;

revoke all on function public.claim_next_expediente_execution_task(text) from public, anon, authenticated;
grant execute on function public.claim_next_expediente_execution_task(text) to service_role;

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
declare is_success boolean := p_payload is not null and p_payload_sha256 is not null;
begin
  select t.* into task_row
  from public.expediente_execution_tasks t
  where t.id = p_task_id
  for update;
  if not found or task_row.status <> 'running' or task_row.lease_token is distinct from p_lease_token then
    return false;
  end if;

  select * into execution_row from public.expediente_executions where id = task_row.execution_id for update;
  if execution_row.status in ('cancelled', 'superseded') then return false; end if;

  update public.expediente_execution_tasks
  set status = case when is_success then 'completed' else 'failed' end,
      lease_token = null, lease_expires_at = null, completed_at = now(),
      error_code = case when is_success then null else coalesce(p_error_code, 'TASK_FAILED') end,
      error_message = case when is_success then null else left(coalesce(p_error_message, 'La tarea falló.'), 2000) end
  where id = task_row.id;

  if is_success then
    insert into public.expediente_execution_outputs (
      execution_id, task_id, project_id, group_id, payload, payload_sha256
    ) values (
      execution_row.id, task_row.id, execution_row.project_id, execution_row.group_id, p_payload, p_payload_sha256
    );
  end if;

  update public.expediente_executions
  set completed_units = (select count(*) from public.expediente_execution_tasks where execution_id = execution_row.id and status = 'completed'),
      status = case
        when exists (select 1 from public.expediente_execution_tasks where execution_id = execution_row.id and status = 'failed') then 'failed'
        else 'processing'
      end,
      completed_at = case when exists (select 1 from public.expediente_execution_tasks where execution_id = execution_row.id and status = 'failed') then now() else null end
  where id = execution_row.id;

  update public.expediente_document_groups
  set status = case when e.status = 'failed' then 'error' else 'processing' end,
      last_error_code = case when e.status = 'failed' then 'TASK_FAILED' else null end
  from public.expediente_executions e
  where expediente_document_groups.id = execution_row.group_id and e.id = execution_row.id;

  return true;
end;
$$;

revoke all on function public.complete_expediente_execution_task(uuid, uuid, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.complete_expediente_execution_task(uuid, uuid, jsonb, text, text, text) to service_role;

-- Solo la RPC de aprobación cambia estados inmutables y deja una aprobación verificable.
create or replace function public.approve_expediente_result_version(p_result_version_id uuid, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare result_row public.expediente_result_versions%rowtype;
declare group_row public.expediente_document_groups%rowtype;
declare approval_id uuid;
declare payload_hash text;
begin
  select * into result_row from public.expediente_result_versions where id = p_result_version_id for update;
  if not found or result_row.status <> 'draft' then
    raise exception 'Solo puede aprobarse un borrador vigente.';
  end if;
  if not private.has_project_role(result_row.project_id, 'aprobador') then
    raise exception 'No tienes el rol aprobador para este expediente.';
  end if;

  if result_row.scope = 'group' then
    select * into group_row from public.expediente_document_groups where id = result_row.group_id for update;
    if group_row.input_version <> result_row.source_input_version or group_row.status not in ('review_ready', 'approved') then
      raise exception 'El resultado no corresponde a los insumos vigentes del grupo documental.';
    end if;
    update public.expediente_document_groups
    set status = 'approved', approved_result_version_id = result_row.id
    where id = group_row.id;
  else
    if (select count(*) from public.expediente_document_groups where project_id = result_row.project_id and status = 'approved') <> 3 then
      raise exception 'El consolidado requiere las tres fuentes aprobadas.';
    end if;
    update public.expediente_consolidations
    set status = 'approved', approved_result_version_id = result_row.id
    where project_id = result_row.project_id;
    update public.expediente_master_records
    set status = 'approved', approved_result_version_id = result_row.id
    where project_id = result_row.project_id;
  end if;

  perform set_config('app.expediente_approval', 'on', true);
  update public.expediente_result_versions set status = 'approved' where id = result_row.id;
  select encode(extensions.digest(result_row.payload::text, 'sha256'), 'hex') into payload_hash;
  insert into public.expediente_approvals (project_id, result_version_id, approved_by, approval_note, snapshot_sha256)
  values (result_row.project_id, result_row.id, (select auth.uid()), nullif(trim(p_note), ''), payload_hash)
  returning id into approval_id;
  insert into public.expediente_audit_events (project_id, actor_id, action, entity_type, entity_id, metadata)
  values (result_row.project_id, (select auth.uid()), 'expediente.result_approved', 'result_version', result_row.id, jsonb_build_object('approval_id', approval_id, 'scope', result_row.scope));
  return approval_id;
end;
$$;

revoke all on function public.approve_expediente_result_version(uuid, text) from public, anon;
grant execute on function public.approve_expediente_result_version(uuid, text) to authenticated, service_role;

-- La futura generación de URL firmada invoca esta RPC antes de entregar un
-- artefacto. Así la lectura de una descarga queda trazada sin abrir acceso
-- directo a artefactos obsoletos o de otro expediente.
create or replace function public.request_expediente_artifact_download(p_artifact_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare artifact_row public.expediente_artifacts%rowtype;
begin
  select * into artifact_row from public.expediente_artifacts where id = p_artifact_id;
  if not found or artifact_row.status <> 'active' then
    raise exception 'El artefacto solicitado no está disponible como versión vigente.';
  end if;
  if not private.has_project_role(artifact_row.project_id, 'viewer') then
    raise exception 'No tienes permiso para descargar este artefacto.';
  end if;
  insert into public.expediente_audit_events (project_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    artifact_row.project_id, (select auth.uid()), 'expediente.artifact_download_requested', 'artifact', artifact_row.id,
    jsonb_build_object('kind', artifact_row.kind, 'source_result_version_id', artifact_row.source_result_version_id)
  );
  return artifact_row.storage_path;
end;
$$;

revoke all on function public.request_expediente_artifact_download(uuid) from public, anon;
grant execute on function public.request_expediente_artifact_download(uuid) to authenticated, service_role;

-- Backfill recuperable y acotado: ejecutar repetidamente hasta devolver cero.
-- No se trasladan batches/records antiguos porque su cardinalidad predial no es segura.
create or replace function private.backfill_expediente_v2_baseline(p_limit integer default 500)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare project_ids uuid[];
begin
  if p_limit is null or p_limit < 1 or p_limit > 5000 then
    raise exception 'p_limit debe estar entre 1 y 5000.';
  end if;
  select array_agg(id) into project_ids from (
    select p.id from public.projects p
    left join public.expediente_property_identities i on i.project_id = p.id
    where i.id is null
    order by p.created_at, p.id
    limit p_limit
  ) missing;
  if coalesce(array_length(project_ids, 1), 0) = 0 then return 0; end if;

  insert into public.expediente_property_identities (project_id, property_name, municipality, department, created_by)
  select p.id, p.name, coalesce(nullif(trim(p.municipality), ''), 'Por definir'),
         coalesce(nullif(trim(p.department), ''), 'Por definir'), p.created_by
  from public.projects p where p.id = any(project_ids)
  on conflict (project_id) do nothing;

  insert into public.expediente_master_records (project_id, property_identity_id)
  select i.project_id, i.id from public.expediente_property_identities i where i.project_id = any(project_ids)
  on conflict (project_id) do nothing;

  insert into public.expediente_document_groups (project_id, group_key)
  select i.project_id, k.group_key
  from public.expediente_property_identities i
  cross join (values ('titles'::text), ('plans'::text), ('negotiation'::text)) as k(group_key)
  where i.project_id = any(project_ids)
  on conflict (project_id, group_key) do nothing;

  insert into public.expediente_consolidations (project_id)
  select unnest(project_ids) on conflict (project_id) do nothing;
  insert into public.expediente_final_document_states (project_id)
  select unnest(project_ids) on conflict (project_id) do nothing;
  return array_length(project_ids, 1);
end;
$$;

revoke all on function private.backfill_expediente_v2_baseline(integer) from public, anon, authenticated;
select private.backfill_expediente_v2_baseline(500);

-- RLS / grants. Ninguna tabla v2 usa acceso público y el servicio de worker
-- conserva su acceso de servidor mediante service_role.
alter table public.expediente_property_identities enable row level security;
alter table public.expediente_property_identity_versions enable row level security;
alter table public.expediente_master_records enable row level security;
alter table public.expediente_document_groups enable row level security;
alter table public.expediente_document_files enable row level security;
alter table public.expediente_executions enable row level security;
alter table public.expediente_execution_tasks enable row level security;
alter table public.expediente_execution_outputs enable row level security;
alter table public.expediente_result_versions enable row level security;
alter table public.expediente_approvals enable row level security;
alter table public.expediente_consolidations enable row level security;
alter table public.expediente_final_document_states enable row level security;
alter table public.expediente_artifacts enable row level security;
alter table public.expediente_audit_events enable row level security;

revoke all on table
  public.expediente_property_identities,
  public.expediente_property_identity_versions,
  public.expediente_master_records,
  public.expediente_document_groups,
  public.expediente_document_files,
  public.expediente_executions,
  public.expediente_execution_tasks,
  public.expediente_execution_outputs,
  public.expediente_result_versions,
  public.expediente_approvals,
  public.expediente_consolidations,
  public.expediente_final_document_states,
  public.expediente_artifacts,
  public.expediente_audit_events
from anon, authenticated;

grant select on
  public.expediente_property_identities,
  public.expediente_property_identity_versions,
  public.expediente_master_records,
  public.expediente_document_groups,
  public.expediente_document_files,
  public.expediente_executions,
  public.expediente_execution_tasks,
  public.expediente_execution_outputs,
  public.expediente_result_versions,
  public.expediente_approvals,
  public.expediente_consolidations,
  public.expediente_final_document_states,
  public.expediente_artifacts,
  public.expediente_audit_events
to authenticated;
grant insert, update (folio, cadastral_id, property_name, municipality, department, village, identity_metadata)
  on public.expediente_property_identities to authenticated;
grant insert, update (is_current, is_active, retired_at, retirement_reason)
  on public.expediente_document_files to authenticated;
grant insert, update (payload, change_summary)
  on public.expediente_result_versions to authenticated;
grant usage, select on sequence public.expediente_audit_events_id_seq to authenticated;

-- Tables written by trusted workers must remain inaccessible to browsers.
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

create policy expediente_identity_select on public.expediente_property_identities
  for select to authenticated using (private.has_project_role(project_id, 'viewer'));
create policy expediente_identity_insert on public.expediente_property_identities
  for insert to authenticated with check (created_by = (select auth.uid()) and private.has_project_role(project_id, 'operador'));
create policy expediente_identity_update on public.expediente_property_identities
  for update to authenticated using (private.has_project_role(project_id, 'operador'))
  with check (private.has_project_role(project_id, 'operador'));
create policy expediente_identity_versions_select on public.expediente_property_identity_versions
  for select to authenticated using (private.has_project_role(project_id, 'viewer'));
create policy expediente_master_records_select on public.expediente_master_records
  for select to authenticated using (private.has_project_role(project_id, 'viewer'));
create policy expediente_groups_select on public.expediente_document_groups
  for select to authenticated using (private.has_project_role(project_id, 'viewer'));
create policy expediente_documents_select on public.expediente_document_files
  for select to authenticated using (private.has_project_role(project_id, 'viewer'));
create policy expediente_documents_insert on public.expediente_document_files
  for insert to authenticated with check (created_by = (select auth.uid()) and private.has_project_role(project_id, 'operador'));
create policy expediente_documents_update on public.expediente_document_files
  for update to authenticated using (private.has_project_role(project_id, 'operador'))
  with check (private.has_project_role(project_id, 'operador'));
create policy expediente_executions_select on public.expediente_executions
  for select to authenticated using (private.has_project_role(project_id, 'viewer'));
create policy expediente_execution_tasks_select on public.expediente_execution_tasks
  for select to authenticated using (exists (
    select 1 from public.expediente_executions e
    where e.id = execution_id and private.has_project_role(e.project_id, 'viewer')
  ));
create policy expediente_outputs_select on public.expediente_execution_outputs
  for select to authenticated using (private.has_project_role(project_id, 'viewer'));
create policy expediente_results_select on public.expediente_result_versions
  for select to authenticated using (private.has_project_role(project_id, 'viewer'));
create policy expediente_results_insert on public.expediente_result_versions
  for insert to authenticated with check (created_by = (select auth.uid()) and status = 'draft' and private.has_project_role(project_id, 'revisor_juridico'));
create policy expediente_results_update on public.expediente_result_versions
  for update to authenticated using (status = 'draft' and private.has_project_role(project_id, 'revisor_juridico'))
  with check (status = 'draft' and private.has_project_role(project_id, 'revisor_juridico'));
create policy expediente_approvals_select on public.expediente_approvals
  for select to authenticated using (private.has_project_role(project_id, 'viewer'));
create policy expediente_consolidations_select on public.expediente_consolidations
  for select to authenticated using (private.has_project_role(project_id, 'viewer'));
create policy expediente_final_document_states_select on public.expediente_final_document_states
  for select to authenticated using (private.has_project_role(project_id, 'viewer'));
create policy expediente_artifacts_download_select on public.expediente_artifacts
  for select to authenticated using (status = 'active' and private.has_project_role(project_id, 'viewer'));
create policy expediente_audit_select on public.expediente_audit_events
  for select to authenticated using (private.has_project_role(project_id, 'auditor'));

-- Storage v2 shares the private source bucket, but includes XLSX and prevents
-- browser deletion under the immutable expediente/ path.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg'
]
where id = 'source-documents';

drop policy if exists source_objects_delete on storage.objects;
create policy source_objects_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'source-documents'
  and coalesce((storage.foldername(name))[2], '') <> 'expediente'
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(name))[1]
      and private.has_project_role(p.id, 'operador')
  )
);

commit;
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
-- Documento final y revisión IA: versiones inmutables, solicitudes durables y
-- mutaciones exclusivas mediante RPCs autorizadas. El navegador nunca decide
-- una transición de estado ni puede sobrescribir una revisión concurrente.

alter table public.expediente_result_versions
  add column if not exists edit_revision integer not null default 1 check (edit_revision > 0);

create table public.expediente_document_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_consolidation_version_id uuid not null references public.expediente_result_versions(id) on delete restrict,
  parent_document_version_id uuid references public.expediente_document_versions(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  change_summary text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  is_current boolean not null default true,
  finalized_at timestamptz,
  finalized_by uuid references auth.users(id) on delete set null,
  unique (project_id, version_number)
);
create unique index expediente_document_versions_one_current
  on public.expediente_document_versions(project_id) where is_current;

alter table public.expediente_final_document_states
  add column if not exists current_document_version_id uuid references public.expediente_document_versions(id) on delete set null;

create table public.expediente_document_ai_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_document_version_id uuid not null references public.expediente_document_versions(id) on delete restrict,
  user_comment text not null check (char_length(trim(user_comment)) between 3 and 4000),
  requested_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'accepted', 'discarded')),
  model_snapshot jsonb not null default '{}'::jsonb,
  proposed_content jsonb check (proposed_content is null or jsonb_typeof(proposed_content) = 'object'),
  error_code text,
  lease_token uuid,
  lease_expires_at timestamptz,
  attempt_count smallint not null default 0 check (attempt_count between 0 and 3),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index expediente_document_ai_revisions_claim_idx
  on public.expediente_document_ai_revisions(status, created_at)
  where status in ('queued', 'processing');

create trigger expediente_document_ai_revisions_touch
before update on public.expediente_document_ai_revisions
for each row execute function private.touch_updated_at();

alter table public.expediente_document_versions enable row level security;
alter table public.expediente_document_ai_revisions enable row level security;
revoke all on public.expediente_document_versions, public.expediente_document_ai_revisions from anon, authenticated;
grant select on public.expediente_document_versions, public.expediente_document_ai_revisions to authenticated;
grant all on public.expediente_document_versions, public.expediente_document_ai_revisions to service_role;

create policy expediente_document_versions_select on public.expediente_document_versions
  for select to authenticated using (private.has_project_role(project_id, 'auditor'));
create policy expediente_document_ai_revisions_select on public.expediente_document_ai_revisions
  for select to authenticated using (private.has_project_role(project_id, 'revisor_juridico'));

-- Prevent direct browser writes to editable results: compare-and-swap occurs
-- while the row is locked, and the returned edit_revision becomes the next token.
revoke update on public.expediente_result_versions from authenticated;
drop policy if exists expediente_results_update on public.expediente_result_versions;

-- User administration is mediated by the verified Edge function. Direct
-- mutations could bypass its last-administrator and audit safeguards.
revoke update, delete on public.project_members from authenticated;
drop policy if exists members_update on public.project_members;
drop policy if exists members_delete on public.project_members;

create or replace function public.save_expediente_result_draft(
  p_result_version_id uuid,
  p_payload jsonb,
  p_change_summary text,
  p_expected_edit_revision integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare result_row public.expediente_result_versions%rowtype;
declare next_revision integer;
begin
  if (select auth.uid()) is null then raise exception 'Sesión requerida.'; end if;
  if jsonb_typeof(p_payload) <> 'object' then raise exception 'El borrador debe ser un objeto JSON.'; end if;
  if p_expected_edit_revision is null or p_expected_edit_revision < 1 then raise exception 'Token de edición inválido.'; end if;

  select * into result_row from public.expediente_result_versions where id = p_result_version_id for update;
  if not found or result_row.status <> 'draft' then raise exception 'Solo puede editarse un borrador vigente.'; end if;
  if not private.has_project_role(result_row.project_id, 'revisor_juridico') then raise exception 'No tienes permiso para editar este resultado.'; end if;
  if result_row.edit_revision <> p_expected_edit_revision then
    raise exception 'EDIT_CONFLICT:%', result_row.edit_revision using errcode = '40001';
  end if;

  next_revision := result_row.edit_revision + 1;
  update public.expediente_result_versions
  set payload = p_payload,
      change_summary = nullif(left(trim(coalesce(p_change_summary, '')), 1000), ''),
      edit_revision = next_revision
  where id = result_row.id;
  insert into public.expediente_audit_events(project_id, actor_id, action, entity_type, entity_id, metadata)
  values (result_row.project_id, (select auth.uid()), 'expediente.result_draft_saved', 'result_version', result_row.id,
    jsonb_build_object('edit_revision', next_revision));
  return next_revision;
end;
$$;
revoke all on function public.save_expediente_result_draft(uuid, jsonb, text, integer) from public, anon;
grant execute on function public.save_expediente_result_draft(uuid, jsonb, text, integer) to authenticated, service_role;

create or replace function public.save_expediente_document_version(
  p_project_id uuid,
  p_content jsonb,
  p_expected_current_document_id uuid default null,
  p_change_summary text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare state_row public.expediente_final_document_states%rowtype;
declare current_document public.expediente_document_versions%rowtype;
declare approved_consolidation uuid;
declare next_version integer;
declare new_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Sesión requerida.'; end if;
  if jsonb_typeof(p_content) <> 'object' then raise exception 'El documento debe usar JSON Tiptap válido.'; end if;
  if not private.has_project_role(p_project_id, 'revisor_juridico') then raise exception 'No tienes permiso para guardar el documento.'; end if;

  select * into state_row from public.expediente_final_document_states where project_id = p_project_id for update;
  if not found then raise exception 'Estado documental inexistente.'; end if;
  select approved_result_version_id into approved_consolidation from public.expediente_consolidations where project_id = p_project_id;
  if approved_consolidation is null then raise exception 'Se requiere un consolidado aprobado.'; end if;
  if state_row.current_document_version_id is distinct from p_expected_current_document_id then
    raise exception 'DOCUMENT_EDIT_CONFLICT' using errcode = '40001';
  end if;
  if state_row.current_document_version_id is not null then
    select * into current_document from public.expediente_document_versions where id = state_row.current_document_version_id for update;
    if current_document.finalized_at is not null then raise exception 'La versión final no puede modificarse.'; end if;
    update public.expediente_document_versions set is_current = false where id = current_document.id;
    -- A review is tied to an exact immutable source. Once the user saves a
    -- newer version, a queued request against the prior source is no longer
    -- admissible and must not consume a provider call.
    update public.expediente_document_ai_revisions
    set status = 'discarded', lease_token = null, lease_expires_at = null
    where source_document_version_id = current_document.id
      and status in ('queued', 'processing');
  end if;
  select coalesce(max(version_number), 0) + 1 into next_version from public.expediente_document_versions where project_id = p_project_id;
  insert into public.expediente_document_versions(
    project_id, source_consolidation_version_id, parent_document_version_id, version_number, content, content_sha256, change_summary, created_by
  ) values (
    p_project_id, approved_consolidation, current_document.id, next_version, p_content,
    encode(extensions.digest(p_content::text, 'sha256'), 'hex'),
    nullif(left(trim(coalesce(p_change_summary, '')), 1000), ''), (select auth.uid())
  ) returning id into new_id;
  update public.expediente_final_document_states
  set current_document_version_id = new_id, status = 'editable'
  where id = state_row.id;
  insert into public.expediente_audit_events(project_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_project_id, (select auth.uid()), 'expediente.document_saved', 'document_version', new_id,
    jsonb_build_object('version_number', next_version));
  return new_id;
end;
$$;
revoke all on function public.save_expediente_document_version(uuid, jsonb, uuid, text) from public, anon;
grant execute on function public.save_expediente_document_version(uuid, jsonb, uuid, text) to authenticated, service_role;

create or replace function public.queue_expediente_document_ai_revision(
  p_document_version_id uuid,
  p_user_comment text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare document_row public.expediente_document_versions%rowtype;
declare state_row public.expediente_final_document_states%rowtype;
declare request_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Sesión requerida.'; end if;
  select * into document_row from public.expediente_document_versions where id = p_document_version_id;
  if not found then raise exception 'La versión documental ya no es revisable.'; end if;
  if not private.has_project_role(document_row.project_id, 'revisor_juridico') then raise exception 'No tienes permiso para solicitar cambios de IA.'; end if;
  if char_length(trim(coalesce(p_user_comment, ''))) not between 3 and 4000 then raise exception 'El comentario debe tener entre 3 y 4000 caracteres.'; end if;
  -- Lock in the same state -> document order used by manual saves. This makes
  -- the request conditional on the source remaining current at commit time.
  select * into state_row from public.expediente_final_document_states where project_id = document_row.project_id for update;
  select * into document_row from public.expediente_document_versions where id = p_document_version_id for update;
  if not found or not document_row.is_current or document_row.finalized_at is not null
    or state_row.current_document_version_id is distinct from document_row.id then
    raise exception 'DOCUMENT_EDIT_CONFLICT' using errcode = '40001';
  end if;
  insert into public.expediente_document_ai_revisions(project_id, source_document_version_id, user_comment, requested_by, model_snapshot)
  values(document_row.project_id, document_row.id, trim(p_user_comment), (select auth.uid()), jsonb_build_object('scope', 'narrative_only'))
  returning id into request_id;
  update public.expediente_final_document_states set status = 'reprocessing' where project_id = document_row.project_id;
  insert into public.expediente_audit_events(project_id, actor_id, action, entity_type, entity_id, metadata)
  values(document_row.project_id, (select auth.uid()), 'expediente.document_ai_revision_queued', 'document_ai_revision', request_id,
    jsonb_build_object('source_document_version_id', document_row.id));
  return request_id;
end;
$$;
revoke all on function public.queue_expediente_document_ai_revision(uuid, text) from public, anon;
grant execute on function public.queue_expediente_document_ai_revision(uuid, text) to authenticated, service_role;

create or replace function public.claim_next_expediente_document_ai_revision(p_worker_name text default 'worker')
returns table(id uuid, project_id uuid, source_document_version_id uuid, source_content jsonb, user_comment text, lease_token uuid, attempt_count smallint)
language plpgsql
security definer
set search_path = ''
as $$
declare request_row public.expediente_document_ai_revisions%rowtype;
declare lease uuid := gen_random_uuid();
begin
  update public.expediente_document_ai_revisions
  set status = 'queued', lease_token = null, lease_expires_at = null
  where status = 'processing' and lease_expires_at < now() and attempt_count < 3;
  select * into request_row from public.expediente_document_ai_revisions
  where status = 'queued' and attempt_count < 3 order by created_at for update skip locked limit 1;
  if not found then return; end if;
  update public.expediente_document_ai_revisions
  set status = 'processing', lease_token = lease, lease_expires_at = now() + interval '5 minutes', attempt_count = attempt_count + 1
  where id = request_row.id;
  return query
  select request_row.id, request_row.project_id, request_row.source_document_version_id, document_row.content,
    request_row.user_comment, lease, (request_row.attempt_count + 1)::smallint
  from public.expediente_document_versions document_row where document_row.id = request_row.source_document_version_id;
end;
$$;
revoke all on function public.claim_next_expediente_document_ai_revision(text) from public, anon, authenticated;
grant execute on function public.claim_next_expediente_document_ai_revision(text) to service_role;

create or replace function public.complete_expediente_document_ai_revision(
  p_revision_id uuid,
  p_lease_token uuid,
  p_proposed_content jsonb default null,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare request_row public.expediente_document_ai_revisions%rowtype;
begin
  select * into request_row from public.expediente_document_ai_revisions where id = p_revision_id for update;
  if not found or request_row.status <> 'processing' or request_row.lease_token is distinct from p_lease_token or request_row.lease_expires_at < now() then return false; end if;
  if p_error_code is null and jsonb_typeof(p_proposed_content) = 'object' then
    update public.expediente_document_ai_revisions
    set status = 'completed', proposed_content = p_proposed_content, completed_at = now(), lease_token = null, lease_expires_at = null
    where id = request_row.id;
    update public.expediente_final_document_states set status = 'editable' where project_id = request_row.project_id;
  else
    update public.expediente_document_ai_revisions
    set status = case when request_row.attempt_count >= 3 then 'failed' else 'queued' end,
      error_code = coalesce(left(p_error_code, 80), 'AI_REVISION_FAILED'), lease_token = null, lease_expires_at = null,
      completed_at = case when request_row.attempt_count >= 3 then now() else null end
    where id = request_row.id;
    if request_row.attempt_count >= 3 then
      update public.expediente_final_document_states set status = 'editable' where project_id = request_row.project_id;
    end if;
  end if;
  return true;
end;
$$;
revoke all on function public.complete_expediente_document_ai_revision(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.complete_expediente_document_ai_revision(uuid, uuid, jsonb, text) to service_role;

create or replace function public.accept_expediente_document_ai_revision(p_revision_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare request_row public.expediente_document_ai_revisions%rowtype;
declare state_row public.expediente_final_document_states%rowtype;
declare source_row public.expediente_document_versions%rowtype;
declare next_version integer;
declare new_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Sesión requerida.'; end if;
  select * into request_row from public.expediente_document_ai_revisions where id = p_revision_id for update;
  if not found or request_row.status <> 'completed' or request_row.proposed_content is null then raise exception 'La propuesta no está disponible.'; end if;
  if not private.has_project_role(request_row.project_id, 'revisor_juridico') then raise exception 'No tienes permiso para adoptar esta propuesta.'; end if;
  select * into state_row from public.expediente_final_document_states where project_id = request_row.project_id for update;
  if state_row.current_document_version_id is distinct from request_row.source_document_version_id then raise exception 'DOCUMENT_EDIT_CONFLICT' using errcode = '40001'; end if;
  select * into source_row from public.expediente_document_versions where id = request_row.source_document_version_id for update;
  if source_row.finalized_at is not null then raise exception 'La versión final no puede sustituirse.'; end if;
  update public.expediente_document_versions set is_current = false where id = source_row.id;
  update public.expediente_document_ai_revisions
  set status = 'discarded', lease_token = null, lease_expires_at = null
  where source_document_version_id = source_row.id
    and id <> request_row.id
    and status in ('queued', 'processing');
  select coalesce(max(version_number), 0) + 1 into next_version from public.expediente_document_versions where project_id = request_row.project_id;
  insert into public.expediente_document_versions(project_id, source_consolidation_version_id, parent_document_version_id, version_number, content, content_sha256, change_summary, created_by)
  values(request_row.project_id, source_row.source_consolidation_version_id, source_row.id, next_version, request_row.proposed_content,
    encode(extensions.digest(request_row.proposed_content::text, 'sha256'), 'hex'), 'Propuesta IA aceptada', (select auth.uid())) returning id into new_id;
  update public.expediente_document_ai_revisions set status = 'accepted' where id = request_row.id;
  update public.expediente_final_document_states set current_document_version_id = new_id, status = 'editable' where id = state_row.id;
  insert into public.expediente_audit_events(project_id, actor_id, action, entity_type, entity_id, metadata)
  values(request_row.project_id, (select auth.uid()), 'expediente.document_ai_revision_accepted', 'document_version', new_id,
    jsonb_build_object('ai_revision_id', request_row.id, 'version_number', next_version));
  return new_id;
end;
$$;
revoke all on function public.accept_expediente_document_ai_revision(uuid) from public, anon;
grant execute on function public.accept_expediente_document_ai_revision(uuid) to authenticated, service_role;

create or replace function public.discard_expediente_document_ai_revision(p_revision_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare request_row public.expediente_document_ai_revisions%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Sesión requerida.'; end if;
  select * into request_row from public.expediente_document_ai_revisions where id = p_revision_id for update;
  if not found or request_row.status <> 'completed' then raise exception 'La propuesta no está disponible.'; end if;
  if not private.has_project_role(request_row.project_id, 'revisor_juridico') then raise exception 'No tienes permiso para descartar esta propuesta.'; end if;
  update public.expediente_document_ai_revisions set status = 'discarded' where id = request_row.id;
  update public.expediente_final_document_states set status = 'editable' where project_id = request_row.project_id;
end;
$$;
revoke all on function public.discard_expediente_document_ai_revision(uuid) from public, anon;
grant execute on function public.discard_expediente_document_ai_revision(uuid) to authenticated, service_role;

create or replace function public.finalize_expediente_document(p_document_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare document_row public.expediente_document_versions%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Sesión requerida.'; end if;
  select * into document_row from public.expediente_document_versions where id = p_document_version_id for update;
  if not found or not document_row.is_current then raise exception 'La versión documental ya no es vigente.'; end if;
  if not private.has_project_role(document_row.project_id, 'aprobador') then raise exception 'No tienes permiso para finalizar el documento.'; end if;
  update public.expediente_document_versions set finalized_at = now(), finalized_by = (select auth.uid()) where id = document_row.id;
  update public.expediente_final_document_states set status = 'final' where project_id = document_row.project_id;
  insert into public.expediente_audit_events(project_id, actor_id, action, entity_type, entity_id, metadata)
  values(document_row.project_id, (select auth.uid()), 'expediente.document_finalized', 'document_version', document_row.id, '{}'::jsonb);
end;
$$;
revoke all on function public.finalize_expediente_document(uuid) from public, anon;
grant execute on function public.finalize_expediente_document(uuid) to authenticated, service_role;
-- =========================================================================
-- MIGRACIÓN: Corrección RLS en tabla projects para INSERT ... RETURNING
-- =========================================================================

-- 1. Asegurar default auth.uid() en la columna created_by
alter table public.projects alter column created_by set default auth.uid();

-- 2. Permitir SELECT tanto si el usuario es el creador (requerido para RETURNING)
--    como si tiene rol asignado en project_members.
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (
    created_by = (select auth.uid())
    or private.has_project_role(id, array['owner','operator','reviewer','viewer','administrador','operador','analista_predial','revisor_juridico','aprobador','auditor']::public.project_role[])
  );

-- 3. Permitir INSERT si created_by coincide con el usuario autenticado (o es null por default)
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    or created_by is null
  );

-- 4. Permitir UPDATE al creador o miembros con rol de operador/administrador
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using (
    created_by = (select auth.uid())
    or private.has_project_role(id, array['owner','operator','administrador','operador']::public.project_role[])
  )
  with check (
    created_by = (select auth.uid())
    or private.has_project_role(id, array['owner','operator','administrador','operador']::public.project_role[])
  );

-- 5. Permitir DELETE al creador o propietario/administrador
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete to authenticated
  using (
    created_by = (select auth.uid())
    or private.has_project_role(id, array['owner','administrador']::public.project_role[])
  );

-- 6. Garantizar que cada usuario pueda ver siempre su propia membresía en project_members
drop policy if exists members_select on public.project_members;
create policy members_select on public.project_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_project_role(project_id, array['owner','operator','reviewer','viewer','administrador','operador','analista_predial','revisor_juridico','aprobador','auditor']::public.project_role[])
  );

-- 7. Asegurar que el trigger de owner use ON CONFLICT DO NOTHING para evitar fallas por concurrencia o reintentos
create or replace function private.add_project_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.created_by, 'owner'::public.project_role)
  on conflict (project_id, user_id) do nothing;
  return new;
end;
$$;

-- 8. Otorgar permisos de uso en schema private para ejecución de triggers
grant usage on schema private to service_role, authenticated, postgres, anon;
grant execute on all functions in schema private to service_role, authenticated, postgres;

-- 9. Función RPC para eliminar/retirar un archivo cargado en un expediente
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

grant execute on function public.delete_expediente_document_file(uuid) to authenticated, service_role;

