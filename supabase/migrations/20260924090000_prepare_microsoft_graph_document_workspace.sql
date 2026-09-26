-- Microsoft 365 final-document preparation.
--
-- Expand-only migration: it creates a secure mapping from a Territorium
-- project to its organization-owned Microsoft 365 drive item and preserves
-- immutable checkpoints of Graph/SharePoint file versions. It intentionally
-- does not alter the existing Tiptap JSON documents or enable a browser to
-- call Microsoft Graph directly.

begin;

create table public.expediente_office_document_bindings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  provider text not null check (provider = 'microsoft_graph'),
  storage_kind text not null check (storage_kind in ('sharepoint', 'onedrive_business')),
  drive_id text not null check (char_length(trim(drive_id)) between 1 and 512),
  item_id text not null check (char_length(trim(item_id)) between 1 and 1024),
  source_consolidation_version_id uuid not null references public.expediente_result_versions(id) on delete restrict,
  status text not null default 'provisioning' check (status in ('provisioning', 'ready', 'stale', 'failed', 'archived')),
  last_synced_graph_version_id text,
  last_synced_etag text,
  last_synced_at timestamptz,
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 120),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, drive_id, item_id),
  check (
    (last_synced_graph_version_id is null and last_synced_etag is null and last_synced_at is null)
    or (last_synced_graph_version_id is not null and last_synced_etag is not null and last_synced_at is not null)
  )
);

create table public.expediente_office_document_checkpoints (
  id uuid primary key default gen_random_uuid(),
  binding_id uuid not null references public.expediente_office_document_bindings(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete cascade,
  source_consolidation_version_id uuid not null references public.expediente_result_versions(id) on delete restrict,
  graph_version_id text not null check (char_length(trim(graph_version_id)) between 1 and 512),
  item_etag text not null check (char_length(trim(item_etag)) between 1 and 2048),
  size_bytes bigint not null check (size_bytes >= 0),
  modified_at timestamptz not null,
  modified_by_display_name text,
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  checkpoint_kind text not null check (checkpoint_kind in ('provisioned', 'synchronized', 'finalized', 'restored')),
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  unique (binding_id, graph_version_id),
  unique (binding_id, item_etag)
);

create index expediente_office_document_checkpoints_project_idx
  on public.expediente_office_document_checkpoints(project_id, recorded_at desc);

create trigger expediente_office_document_bindings_touch
before update on public.expediente_office_document_bindings
for each row execute function private.touch_updated_at();

alter table public.expediente_office_document_bindings enable row level security;
alter table public.expediente_office_document_checkpoints enable row level security;

revoke all on public.expediente_office_document_bindings, public.expediente_office_document_checkpoints from anon, authenticated;
grant select on public.expediente_office_document_bindings, public.expediente_office_document_checkpoints to authenticated;
grant all on public.expediente_office_document_bindings, public.expediente_office_document_checkpoints to service_role;

create policy expediente_office_document_bindings_select on public.expediente_office_document_bindings
  for select to authenticated using (private.has_project_role(project_id, 'auditor'));

create policy expediente_office_document_checkpoints_select on public.expediente_office_document_checkpoints
  for select to authenticated using (private.has_project_role(project_id, 'auditor'));

commit;
