-- Territorium production baseline. All business data is private and project scoped.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create type public.project_role as enum (
  'owner', 'operator', 'reviewer', 'viewer',
  'administrador', 'operador', 'analista_predial', 'revisor_juridico', 'aprobador', 'auditor'
);
create type public.job_status as enum ('queued', 'running', 'blocked', 'needs_review', 'completed', 'failed', 'cancelled');
create type public.document_kind as enum ('title_study', 'plan', 'negotiation', 'support', 'unclassified');
create type public.review_status as enum ('pending', 'approved', 'returned');

create table public.projects (
  id uuid primary key default gen_random_uuid(), name text not null check (char_length(trim(name)) between 3 and 180),
  municipality text check (municipality is null or char_length(municipality) <= 120), department text check (department is null or char_length(department) <= 120),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  role public.project_role not null default 'viewer', created_at timestamptz not null default now(), primary key (project_id, user_id)
);
create table public.batches (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 180), status public.job_status not null default 'queued',
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (id, project_id)
);
create table public.source_documents (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, batch_id uuid not null,
  storage_path text not null unique check (storage_path ~ '^[0-9a-f-]+/[0-9a-f-]+/.+'), original_name text not null check (char_length(original_name) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/png','image/jpeg')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800), kind public.document_kind not null default 'unclassified',
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'), created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  foreign key (batch_id, project_id) references public.batches(id, project_id) on delete cascade
);
create table public.jobs (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, batch_id uuid not null,
  status public.job_status not null default 'queued', run_id uuid not null default gen_random_uuid(), progress smallint not null default 0 check (progress between 0 and 100),
  processor text not null default 'document-extraction-v1', payload_version smallint not null default 1 check (payload_version > 0), idempotency_key text not null unique,
  attempt_count smallint not null default 0 check (attempt_count >= 0), max_attempts smallint not null default 3 check (max_attempts between 1 and 10),
  next_attempt_at timestamptz not null default now(), lease_expires_at timestamptz, last_heartbeat_at timestamptz, error_code text,
  error_message text check (error_message is null or char_length(error_message) <= 1000), created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz, updated_at timestamptz not null default now(),
  foreign key (batch_id, project_id) references public.batches(id, project_id) on delete cascade, unique (batch_id, run_id)
);
create unique index one_active_job_per_batch on public.jobs(batch_id) where status in ('queued', 'running');
create table public.job_attempts (
  id bigint generated always as identity primary key, job_id uuid not null references public.jobs(id) on delete cascade,
  attempt_number smallint not null check (attempt_number > 0), status public.job_status not null, error_code text,
  error_message text check (error_message is null or char_length(error_message) <= 1000), started_at timestamptz not null default now(), completed_at timestamptz,
  metrics jsonb not null default '{}'::jsonb, unique (job_id, attempt_number)
);
create table public.property_records (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  source_document_id uuid references public.source_documents(id) on delete set null, canonical_name text not null check (char_length(trim(canonical_name)) between 1 and 240),
  folio text, municipality text, confidence numeric(4,3) check (confidence between 0 and 1), review_status public.review_status not null default 'pending',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.extracted_attributes (
  id uuid primary key default gen_random_uuid(), property_record_id uuid not null references public.property_records(id) on delete cascade,
  source_document_id uuid references public.source_documents(id) on delete set null, extractor_key text not null check (extractor_key in ('title_study', 'plan', 'negotiation')),
  attribute_key text not null check (char_length(attribute_key) between 1 and 120), value_json jsonb not null, evidence jsonb not null default '[]'::jsonb,
  confidence numeric(4,3) check (confidence between 0 and 1), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (property_record_id, extractor_key, attribute_key)
);
create table public.property_record_documents (
  property_record_id uuid not null references public.property_records(id) on delete cascade,
  source_document_id uuid not null references public.source_documents(id) on delete cascade,
  extractor_key text not null check (extractor_key in ('title_study', 'plan', 'negotiation')),
  created_at timestamptz not null default now(),
  primary key (property_record_id, source_document_id, extractor_key)
);
create table public.review_tasks (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  property_record_id uuid not null references public.property_records(id) on delete cascade, title text not null check (char_length(title) between 1 and 200),
  reason text not null check (char_length(reason) between 1 and 2000), severity text not null check (severity in ('high', 'medium', 'low')),
  status public.review_status not null default 'pending', assigned_to uuid references auth.users(id), resolved_by uuid references auth.users(id), resolved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.review_comments (
  id uuid primary key default gen_random_uuid(), review_task_id uuid not null references public.review_tasks(id) on delete cascade,
  author_id uuid not null references auth.users(id), body text not null check (char_length(trim(body)) between 1 and 4000), created_at timestamptz not null default now()
);
create table public.prompt_versions (
  id uuid primary key default gen_random_uuid(), extractor_key text not null check (extractor_key in ('title_study', 'plan', 'negotiation')),
  version integer not null check (version > 0), name text not null check (char_length(name) between 1 and 180), prompt text not null check (char_length(prompt) between 30 and 50000),
  output_schema jsonb not null, is_active boolean not null default false, created_by uuid references auth.users(id), created_at timestamptz not null default now(), unique (extractor_key, version)
);
create unique index one_active_prompt_per_extractor on public.prompt_versions(extractor_key) where is_active;
create table public.export_files (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, storage_path text not null unique,
  format text not null check (format in ('xlsx', 'csv')), record_count integer not null default 0 check (record_count >= 0),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.audit_events (
  id bigint generated always as identity primary key, project_id uuid not null references public.projects(id) on delete cascade, actor_id uuid references auth.users(id),
  action text not null check (char_length(action) between 1 and 120), entity_type text not null check (char_length(entity_type) between 1 and 80),
  entity_id uuid, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create index jobs_claim_idx on public.jobs (status, next_attempt_at, created_at) where status = 'queued';
create index jobs_project_created_idx on public.jobs (project_id, created_at desc);
create index documents_batch_idx on public.source_documents (batch_id);
create index records_project_review_idx on public.property_records (project_id, review_status, updated_at desc);
create unique index records_project_folio_unique on public.property_records (project_id, folio) where folio is not null and length(trim(folio)) > 0;
create index attributes_record_idx on public.extracted_attributes (property_record_id);
create index reviews_project_status_idx on public.review_tasks (project_id, status, created_at desc);
create index audit_project_created_idx on public.audit_events (project_id, created_at desc);

create or replace function private.has_project_role(target_project uuid, accepted public.project_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.project_members pm where pm.project_id = target_project and pm.user_id = (select auth.uid()) and pm.role = any(accepted));
$$;
revoke all on function private.has_project_role(uuid, public.project_role[]) from public;
grant usage on schema private to authenticated;
grant execute on function private.has_project_role(uuid, public.project_role[]) to authenticated;

-- Compatibility overload used by later migrations. The canonical role migration
-- replaces it with the complete legacy/canonical capability mapping.
create or replace function private.has_project_role(target_project uuid, accepted_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = target_project
      and pm.user_id = (select auth.uid())
      and (
        accepted_role = 'viewer'
        or pm.role::text = accepted_role
        or (accepted_role = 'owner' and pm.role::text = 'administrador')
        or (accepted_role = 'operator' and pm.role::text in ('owner', 'administrador', 'operador'))
        or (accepted_role = 'reviewer' and pm.role::text in ('owner', 'administrador', 'revisor_juridico', 'aprobador'))
      )
  );
$$;
revoke all on function private.has_project_role(uuid, text) from public;
grant execute on function private.has_project_role(uuid, text) to authenticated;

create or replace function private.add_project_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.project_members(project_id, user_id, role) values (new.id, new.created_by, 'owner'); return new; end;
$$;
revoke all on function private.add_project_owner() from public;
create trigger project_owner_after_insert after insert on public.projects for each row execute function private.add_project_owner();

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
create trigger projects_touch before update on public.projects for each row execute function private.touch_updated_at();
create trigger batches_touch before update on public.batches for each row execute function private.touch_updated_at();
create trigger jobs_touch before update on public.jobs for each row execute function private.touch_updated_at();
create trigger records_touch before update on public.property_records for each row execute function private.touch_updated_at();
create trigger attributes_touch before update on public.extracted_attributes for each row execute function private.touch_updated_at();
create trigger reviews_touch before update on public.review_tasks for each row execute function private.touch_updated_at();

-- Atomic leased claim. Execution is restricted to server-side service credentials.
create or replace function public.claim_next_job(worker_name text default 'worker')
returns setof public.jobs language plpgsql security definer set search_path = '' as $$
declare claimed_id uuid;
begin
  update public.jobs set status = 'queued', lease_expires_at = null, error_code = 'LEASE_EXPIRED', error_message = 'La ejecución anterior perdió su arrendamiento y será reintentada.'
    where status = 'running' and lease_expires_at < now() and attempt_count < max_attempts;
  select id into claimed_id from public.jobs where status = 'queued' and next_attempt_at <= now() and attempt_count < max_attempts
    order by created_at for update skip locked limit 1;
  if claimed_id is null then return; end if;
  return query update public.jobs set status = 'running', started_at = coalesce(started_at, now()), attempt_count = attempt_count + 1,
    last_heartbeat_at = now(), lease_expires_at = now() + interval '5 minutes', error_code = null, error_message = null
    where id = claimed_id returning *;
end;
$$;
revoke all on function public.claim_next_job(text) from public, anon, authenticated;
grant execute on function public.claim_next_job(text) to service_role;

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.batches enable row level security;
alter table public.source_documents enable row level security;
alter table public.jobs enable row level security;
alter table public.job_attempts enable row level security;
alter table public.property_records enable row level security;
alter table public.extracted_attributes enable row level security;
alter table public.property_record_documents enable row level security;
alter table public.review_tasks enable row level security;
alter table public.review_comments enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.export_files enable row level security;
alter table public.audit_events enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select, insert, update (name, municipality, department), delete on public.projects to authenticated;
grant select, insert, update (role), delete on public.project_members to authenticated;
grant select, insert, update (status), delete on public.batches to authenticated;
grant select, insert, delete on public.source_documents to authenticated;
grant select, insert, update (status, completed_at) on public.jobs to authenticated;
grant select on public.job_attempts to authenticated;
grant select, update (canonical_name, folio, municipality, review_status) on public.property_records to authenticated;
grant select, update (value_json) on public.extracted_attributes to authenticated;
grant select on public.property_record_documents to authenticated;
grant select, update (status, assigned_to, resolved_by, resolved_at) on public.review_tasks to authenticated;
grant select, insert, delete on public.review_comments to authenticated;
grant select, insert, update (name, prompt, output_schema, is_active) on public.prompt_versions to authenticated;
grant select, insert, delete on public.export_files to authenticated;
grant select, insert on public.audit_events to authenticated;
grant usage, select on sequence public.audit_events_id_seq, public.job_attempts_id_seq to authenticated;

create policy projects_select on public.projects for select to authenticated using (private.has_project_role(id, array['owner','operator','reviewer','viewer']::public.project_role[]));
create policy projects_insert on public.projects for insert to authenticated with check (created_by = (select auth.uid()));
create policy projects_update on public.projects for update to authenticated using (private.has_project_role(id, array['owner','operator']::public.project_role[])) with check (private.has_project_role(id, array['owner','operator']::public.project_role[]));
create policy projects_delete on public.projects for delete to authenticated using (private.has_project_role(id, array['owner']::public.project_role[]));
create policy members_select on public.project_members for select to authenticated using (private.has_project_role(project_id, array['owner','operator','reviewer','viewer']::public.project_role[]));
create policy members_insert on public.project_members for insert to authenticated with check (private.has_project_role(project_id, array['owner']::public.project_role[]));
create policy members_update on public.project_members for update to authenticated using (private.has_project_role(project_id, array['owner']::public.project_role[])) with check (private.has_project_role(project_id, array['owner']::public.project_role[]));
create policy members_delete on public.project_members for delete to authenticated using (private.has_project_role(project_id, array['owner']::public.project_role[]) and user_id <> (select auth.uid()));
create policy batches_select on public.batches for select to authenticated using (private.has_project_role(project_id, array['owner','operator','reviewer','viewer']::public.project_role[]));
create policy batches_insert on public.batches for insert to authenticated with check (created_by = (select auth.uid()) and private.has_project_role(project_id, array['owner','operator']::public.project_role[]));
create policy batches_update on public.batches for update to authenticated using (private.has_project_role(project_id, array['owner','operator']::public.project_role[])) with check (private.has_project_role(project_id, array['owner','operator']::public.project_role[]) and status = 'cancelled');
create policy batches_delete on public.batches for delete to authenticated using (private.has_project_role(project_id, array['owner','operator']::public.project_role[]));
create policy documents_select on public.source_documents for select to authenticated using (private.has_project_role(project_id, array['owner','operator','reviewer','viewer']::public.project_role[]));
create policy documents_insert on public.source_documents for insert to authenticated with check (created_by = (select auth.uid()) and split_part(storage_path, '/', 1) = project_id::text and private.has_project_role(project_id, array['owner','operator']::public.project_role[]));
create policy documents_delete on public.source_documents for delete to authenticated using (private.has_project_role(project_id, array['owner','operator']::public.project_role[]));
create policy jobs_select on public.jobs for select to authenticated using (private.has_project_role(project_id, array['owner','operator','reviewer','viewer']::public.project_role[]));
create policy jobs_insert on public.jobs for insert to authenticated with check (created_by = (select auth.uid()) and private.has_project_role(project_id, array['owner','operator']::public.project_role[]));
create policy jobs_cancel on public.jobs for update to authenticated using (status in ('queued','running') and private.has_project_role(project_id, array['owner','operator']::public.project_role[])) with check (status = 'cancelled' and private.has_project_role(project_id, array['owner','operator']::public.project_role[]));
create policy attempts_select on public.job_attempts for select to authenticated using (exists (select 1 from public.jobs j where j.id = job_id and private.has_project_role(j.project_id, array['owner','operator','reviewer','viewer']::public.project_role[])));
create policy records_select on public.property_records for select to authenticated using (private.has_project_role(project_id, array['owner','operator','reviewer','viewer']::public.project_role[]));
create policy records_update on public.property_records for update to authenticated using (private.has_project_role(project_id, array['owner','operator','reviewer']::public.project_role[])) with check (private.has_project_role(project_id, array['owner','operator','reviewer']::public.project_role[]));
create policy attributes_select on public.extracted_attributes for select to authenticated using (exists (select 1 from public.property_records r where r.id = property_record_id and private.has_project_role(r.project_id, array['owner','operator','reviewer','viewer']::public.project_role[])));
create policy attributes_update on public.extracted_attributes for update to authenticated using (exists (select 1 from public.property_records r where r.id = property_record_id and private.has_project_role(r.project_id, array['owner','operator','reviewer']::public.project_role[]))) with check (exists (select 1 from public.property_records r where r.id = property_record_id and private.has_project_role(r.project_id, array['owner','operator','reviewer']::public.project_role[])));
create policy record_documents_select on public.property_record_documents for select to authenticated using (exists (select 1 from public.property_records r where r.id = property_record_id and private.has_project_role(r.project_id, array['owner','operator','reviewer','viewer']::public.project_role[])));
create policy reviews_select on public.review_tasks for select to authenticated using (private.has_project_role(project_id, array['owner','operator','reviewer','viewer']::public.project_role[]));
create policy reviews_update on public.review_tasks for update to authenticated using (private.has_project_role(project_id, array['owner','operator','reviewer']::public.project_role[])) with check (private.has_project_role(project_id, array['owner','operator','reviewer']::public.project_role[]));
create policy comments_select on public.review_comments for select to authenticated using (exists (select 1 from public.review_tasks t where t.id = review_task_id and private.has_project_role(t.project_id, array['owner','operator','reviewer','viewer']::public.project_role[])));
create policy comments_insert on public.review_comments for insert to authenticated with check (author_id = (select auth.uid()) and exists (select 1 from public.review_tasks t where t.id = review_task_id and private.has_project_role(t.project_id, array['owner','operator','reviewer']::public.project_role[])));
create policy comments_delete on public.review_comments for delete to authenticated using (author_id = (select auth.uid()));
create policy prompts_select on public.prompt_versions for select to authenticated using (true);
create policy prompts_insert on public.prompt_versions for insert to authenticated with check (created_by = (select auth.uid()) and exists (select 1 from public.project_members pm where pm.user_id = (select auth.uid()) and pm.role = 'owner'));
create policy prompts_update on public.prompt_versions for update to authenticated using (exists (select 1 from public.project_members pm where pm.user_id = (select auth.uid()) and pm.role = 'owner')) with check (exists (select 1 from public.project_members pm where pm.user_id = (select auth.uid()) and pm.role = 'owner'));
create policy exports_select on public.export_files for select to authenticated using (private.has_project_role(project_id, array['owner','operator','reviewer','viewer']::public.project_role[]));
create policy exports_insert on public.export_files for insert to authenticated with check (created_by = (select auth.uid()) and private.has_project_role(project_id, array['owner','operator','reviewer']::public.project_role[]));
create policy exports_delete on public.export_files for delete to authenticated using (private.has_project_role(project_id, array['owner','operator']::public.project_role[]));
create policy audit_select on public.audit_events for select to authenticated using (private.has_project_role(project_id, array['owner','operator','reviewer','viewer']::public.project_role[]));
create policy audit_insert on public.audit_events for insert to authenticated with check (actor_id = (select auth.uid()) and private.has_project_role(project_id, array['owner','operator','reviewer']::public.project_role[]));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
('source-documents', 'source-documents', false, 52428800, array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','image/png','image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
('exports', 'exports', false, 52428800, array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy source_objects_select on storage.objects for select to authenticated using (bucket_id = 'source-documents' and exists (select 1 from public.projects p where p.id::text = (storage.foldername(name))[1] and private.has_project_role(p.id, array['owner','operator','reviewer','viewer']::public.project_role[])));
create policy source_objects_insert on storage.objects for insert to authenticated with check (bucket_id = 'source-documents' and exists (select 1 from public.projects p where p.id::text = (storage.foldername(name))[1] and private.has_project_role(p.id, array['owner','operator']::public.project_role[])));
create policy source_objects_delete on storage.objects for delete to authenticated using (bucket_id = 'source-documents' and exists (select 1 from public.projects p where p.id::text = (storage.foldername(name))[1] and private.has_project_role(p.id, array['owner','operator']::public.project_role[])));
create policy export_objects_select on storage.objects for select to authenticated using (bucket_id = 'exports' and exists (select 1 from public.projects p where p.id::text = (storage.foldername(name))[1] and private.has_project_role(p.id, array['owner','operator','reviewer','viewer']::public.project_role[])));
create policy export_objects_insert on storage.objects for insert to authenticated with check (bucket_id = 'exports' and exists (select 1 from public.projects p where p.id::text = (storage.foldername(name))[1] and private.has_project_role(p.id, array['owner','operator','reviewer']::public.project_role[])));
create policy export_objects_delete on storage.objects for delete to authenticated using (bucket_id = 'exports' and exists (select 1 from public.projects p where p.id::text = (storage.foldername(name))[1] and private.has_project_role(p.id, array['owner','operator']::public.project_role[])));

insert into public.prompt_versions (extractor_key, version, name, prompt, output_schema, is_active) values
('title_study', 1, 'Estudios de títulos — prompt definitivo adaptado', 'Actúa como abogado experto en estudios de títulos. Genera un registro independiente por cada estudio y usa exactamente estas claves de atributo: FOLIO DE MATRICULA; CEDULA CATASTRAL; PROPIETARIOS DEL PREDIO; NO DOCUMENTO; TIPO DOCUMENTO; FECHA DE CONSULTA ANTECEDENTES DEL PROPIETARIO TUSDATOS.CO; NOMBRE DEL PREDIO; MUNICIPIO DEL PREDIO; DEPARTAMENTO DEL PREDIO; VEREDA DEL PREDIO; AREA DEL PREDIO (NUMEROS); AREA DEL PREDIO (LETRAS); OFICINA DE REGISTRO DEL PREDIO; MODO DE ADQUISICION DEL PREDIO; LINDEROS DEL PREDIO; DOCUMENTO QUE CONTIENE LOS LINDEROS DEL PREDIO; CONDICIONES JURÍDICAS VIGENTES; RADICADO CONSULTA MINISTERIO DE JUSTICIA; RADICADO CONSULTA URT; DIRECCIÓN TERRITORIAL DE LA URT; VALIDACIÓN DE LINDEROS. Si un dato no aparece usa no identificado; no mezcles predios y conserva los nombres exactos. PROPIETARIOS DEL PREDIO contiene solo propietarios actuales. MODO DE ADQUISICION debe redactarse cronológicamente como acto jurídico, otorgante, título y anotación. CONDICIONES JURÍDICAS VIGENTES contiene gravámenes, limitaciones o cautelares vigentes; si no existen usa sin condiciones jurídicas vigentes. Transcribe LINDEROS de forma exacta y literal, sin resumir, identifica el documento fuente y marca VALIDACIÓN DE LINDEROS como LINDEROS EXACTOS o LINDEROS RESUMIDOS. Devuelve cada atributo con confianza y evidencia verificable; no inventes ni emitas conceptos jurídicos.', '{"type":"object","required":["records"],"properties":{"records":{"type":"array"}}}'::jsonb, true),
('plan', 1, 'Planos y linderos — estructura validada', 'Extrae un registro por plano sin mezclar archivos. Usa exactamente estas claves de atributo: NOMBRE DEL PLANO; AREA SERVIDUMBRE (m²) NUMEROS; AREA SERVIDUMBRE (m²) LETRAS; LONGITUD SERVIDUMBRE (m) NUMEROS; LONGITUD SERVIDUMBRE (m) LETRAS; ANCHO SERVIDUMBRE (m) NUMEROS; ANCHO SERVIDUMBRE (m) LETRAS; CANTIDAD POSTES O INFRAESTRUCTURAS NUMEROS; CANTIDAD POSTES O INFRAESTRUCTURAS LETRAS; ESCALA DEL PLANO. Conserva unidades y escritura originales. No calcules, conviertas ni infieras valores ausentes; usa no identificado. Devuelve cada atributo con confianza y evidencia verificable y marca para revisión cualquier inconsistencia entre números y letras.', '{"type":"object","required":["records"],"properties":{"records":{"type":"array"}}}'::jsonb, true),
('negotiation', 1, 'Negociación — estructura validada', 'Extrae un registro por predio de la plantilla de negociación. Usa exactamente estas claves de atributo: PRIMERA OFERTA (Números); PRIMERA OFERTA (Letras); SEGUNDA OFERTA (Números); SEGUNDA OFERTA (Letras); VALIDACIÓN DE VALORES. En VALIDACIÓN DE VALORES indica si la representación numérica y en letras coincide para cada oferta. No corrijas ni infieras valores; conserva la fuente y usa no identificado cuando falte un dato. Devuelve cada atributo con confianza y evidencia verificable y marca toda diferencia para revisión humana.', '{"type":"object","required":["records"],"properties":{"records":{"type":"array"}}}'::jsonb, true);

alter publication supabase_realtime add table public.batches, public.source_documents, public.jobs, public.property_records, public.review_tasks, public.audit_events;
