-- Migration: 20260917110000_ai_extractor_configs_and_telemetry.sql
-- Description: Extractor configuration, AI execution logs / telemetry, and prompt versioning support

create table if not exists public.extractor_configs (
  extractor_key text primary key check (extractor_key in ('title_study', 'plan', 'negotiation')),
  provider text not null default 'openai' check (provider in ('openai', 'anthropic', 'deepseek', 'azure_openai')),
  primary_model text not null default 'gpt-4o',
  fallback_model text default 'gpt-4o-mini',
  fallback_provider text default 'openai',
  temperature numeric not null default 0.0 check (temperature between 0.0 and 1.0),
  max_tokens integer not null default 4096 check (max_tokens between 256 and 32768),
  timeout_seconds integer not null default 120 check (timeout_seconds between 10 and 600),
  is_enabled boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- Seed default extractor configs
insert into public.extractor_configs (extractor_key, provider, primary_model, fallback_model, temperature, max_tokens, timeout_seconds, is_enabled)
values
  ('title_study', 'openai', 'gpt-4o', 'gpt-4o-mini', 0.0, 4096, 180, true),
  ('plan', 'openai', 'gpt-4o', 'gpt-4o-mini', 0.0, 4096, 120, true),
  ('negotiation', 'openai', 'gpt-4o', 'gpt-4o-mini', 0.0, 4096, 120, true)
on conflict (extractor_key) do nothing;

create table if not exists public.ai_execution_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  batch_id uuid references public.batches(id) on delete set null,
  task_id uuid references public.document_tasks(id) on delete set null,
  document_id uuid references public.source_documents(id) on delete set null,
  extractor_key text not null check (extractor_key in ('title_study', 'plan', 'negotiation')),
  prompt_version_id uuid references public.prompt_versions(id) on delete set null,
  prompt_version_number integer,
  requested_model text not null,
  used_model text not null,
  fallback_triggered boolean not null default false,
  fallback_reason text,
  status text not null check (status in ('success', 'failed', 'fallback_success')),
  latency_ms integer not null default 0 check (latency_ms >= 0),
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  estimated_cost_usd numeric(10, 6) not null default 0.0,
  error_message text,
  is_test_run boolean not null default false,
  created_at timestamptz not null default now()
);

-- Indexes for telemetry and analytics
create index if not exists idx_ai_execution_logs_project on public.ai_execution_logs(project_id, created_at desc);
create index if not exists idx_ai_execution_logs_task on public.ai_execution_logs(task_id);
create index if not exists idx_ai_execution_logs_extractor on public.ai_execution_logs(extractor_key, created_at desc);

-- RLS
alter table public.extractor_configs enable row level security;
alter table public.ai_execution_logs enable row level security;

-- Extractor configs policies: read by all authenticated, write by owners
create policy extractor_configs_select on public.extractor_configs
  for select to authenticated using (true);

create policy extractor_configs_update on public.extractor_configs
  for update to authenticated
  using (exists (select 1 from public.project_members pm where pm.user_id = (select auth.uid()) and pm.role = 'owner'))
  with check (exists (select 1 from public.project_members pm where pm.user_id = (select auth.uid()) and pm.role = 'owner'));

-- Execution logs policies: read if member of project (or test run), insert by authenticated or service role
create policy ai_logs_select on public.ai_execution_logs
  for select to authenticated
  using (
    is_test_run = true
    or project_id is null
    or private.has_project_role(project_id, array['owner', 'operator', 'reviewer', 'auditor']::public.project_role[])
  );

create policy ai_logs_insert on public.ai_execution_logs
  for insert to authenticated
  with check (true);

-- Realtime
alter publication supabase_realtime add table public.extractor_configs;
alter publication supabase_realtime add table public.ai_execution_logs;
