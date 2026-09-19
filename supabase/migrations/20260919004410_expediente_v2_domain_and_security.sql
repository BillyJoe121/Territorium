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
        when not exists (select 1 from public.expediente_execution_tasks where execution_id = execution_row.id and status in ('queued', 'running')) then 'review_ready'
        else 'processing'
      end,
      completed_at = case when not exists (select 1 from public.expediente_execution_tasks where execution_id = execution_row.id and status in ('queued', 'running')) then now() else null end
  where id = execution_row.id;

  update public.expediente_document_groups
  set status = case when e.status = 'failed' then 'error' when e.status = 'review_ready' then 'review_ready' else 'processing' end,
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
