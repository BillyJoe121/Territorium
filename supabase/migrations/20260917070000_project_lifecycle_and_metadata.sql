-- Territorium: Project metadata expansion and recoverable archival (US-011, US-012, US-015)
alter table public.projects
  add column if not exists client_name text check (client_name is null or char_length(trim(client_name)) <= 180),
  add column if not exists power_line text check (power_line is null or char_length(trim(power_line)) <= 180),
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz;

-- Update column grant so authenticated users with project update permission can update the new metadata
grant update (name, municipality, department, client_name, power_line, is_archived, archived_at) on public.projects to authenticated;

-- Index for searching and filtering by status
create index if not exists projects_status_idx on public.projects (is_archived, created_at desc);
create index if not exists projects_client_idx on public.projects (client_name) where client_name is not null;
