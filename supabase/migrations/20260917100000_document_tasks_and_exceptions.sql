-- Migración para US-044, US-045, US-046, US-048, US-051, US-052: Trabajos independientes, dependencias y bandeja de excepciones

create table if not exists public.document_tasks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  source_document_id uuid not null references public.source_documents(id) on delete cascade,
  property_code text,
  extractor_key text not null check (extractor_key in ('title_study', 'plan', 'negotiation')),
  status public.job_status not null default 'queued',
  dependency_status text not null default 'ready' check (dependency_status in ('ready', 'waiting', 'blocked')),
  depends_on_extractors text[] not null default '{}',
  attempt_count smallint not null default 0 check (attempt_count >= 0),
  max_attempts smallint not null default 3 check (max_attempts between 1 and 10),
  error_code text,
  error_message text check (error_message is null or char_length(error_message) <= 2000),
  exception_category text check (exception_category in (
    'permanent_unreadable',
    'password_encrypted',
    'unsupported_format',
    'ai_quota_exceeded',
    'schema_validation_exhausted',
    'missing_dependency',
    'other'
  )),
  suggested_action text,
  tokens_used integer not null default 0 check (tokens_used >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (batch_id, project_id) references public.batches(id, project_id) on delete cascade
);

create index if not exists idx_document_tasks_batch on public.document_tasks (batch_id, status);
create index if not exists idx_document_tasks_property on public.document_tasks (batch_id, property_code);
create index if not exists idx_document_tasks_exceptions on public.document_tasks (project_id, status) where status = 'failed';
create index if not exists idx_document_tasks_doc on public.document_tasks (source_document_id);

alter table public.document_tasks enable row level security;

create policy document_tasks_select on public.document_tasks
  for select to authenticated
  using (private.has_project_role(project_id, array['owner','operator','reviewer','viewer']::public.project_role[]));

create policy document_tasks_insert on public.document_tasks
  for insert to authenticated
  with check (private.has_project_role(project_id, array['owner','operator']::public.project_role[]));

create policy document_tasks_update on public.document_tasks
  for update to authenticated
  using (private.has_project_role(project_id, array['owner','operator']::public.project_role[]));

-- Gatillo para updated_at
create trigger document_tasks_touch
  before update on public.document_tasks
  for each row execute function private.touch_updated_at();

-- Añadir a publicación realtime
alter publication supabase_realtime add table public.document_tasks;
