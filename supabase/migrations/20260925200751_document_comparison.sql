-- Pairwise comparison workspace. Originals remain in the private source-documents bucket.
create table public.comparison_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  document_label text check (document_label is null or char_length(document_label) between 1 and 120),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id, project_id),
  check (storage_path ~ ('^' || project_id::text || '/comparison/[0-9a-f-]+/[^/]+$'))
);

create table public.comparison_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  left_document_id uuid not null,
  right_document_id uuid not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  lease_token uuid,
  lease_expires_at timestamptz,
  result jsonb,
  error_code text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (left_document_id, project_id) references public.comparison_documents(id, project_id),
  foreign key (right_document_id, project_id) references public.comparison_documents(id, project_id),
  check (left_document_id <> right_document_id)
);
create index comparison_documents_project_idx on public.comparison_documents(project_id, created_at desc);
create index comparison_jobs_claim_idx on public.comparison_jobs(status, created_at) where status in ('queued', 'running');
create index comparison_jobs_project_idx on public.comparison_jobs(project_id, created_at desc);

create or replace function private.limit_comparison_documents()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize additions within a project to enforce the ten-active-document limit.
  perform 1 from public.projects where id = new.project_id for update;
  if new.is_active and (
    select count(*) from public.comparison_documents
    where project_id = new.project_id and is_active and id <> new.id
  ) >= 10 then
    raise exception 'comparison_document_limit_reached';
  end if;
  return new;
end;
$$;
revoke all on function private.limit_comparison_documents() from public;
create trigger comparison_document_limit before insert or update of is_active on public.comparison_documents
for each row execute function private.limit_comparison_documents();

alter table public.comparison_documents enable row level security;
alter table public.comparison_jobs enable row level security;
grant select, insert, update (is_active) on public.comparison_documents to authenticated;
grant select on public.comparison_jobs to authenticated;
create policy comparison_documents_read on public.comparison_documents for select to authenticated
  using (private.has_project_role(project_id, 'auditor'));
create policy comparison_documents_add on public.comparison_documents for insert to authenticated
  with check (created_by = (select auth.uid()) and is_active
    and (private.has_project_role(project_id, 'operador')
      or private.has_project_role(project_id, 'revisor_juridico')));
create policy comparison_documents_retire on public.comparison_documents for update to authenticated
  using (private.has_project_role(project_id, 'operador')
    or private.has_project_role(project_id, 'revisor_juridico'))
  with check (not is_active and (private.has_project_role(project_id, 'operador')
    or private.has_project_role(project_id, 'revisor_juridico')));
create policy comparison_jobs_read on public.comparison_jobs for select to authenticated
  using (private.has_project_role(project_id, 'auditor'));

-- The existing source-documents policies do not cover comparison paths reliably.
-- Keep access scoped to the comparison subfolder and the owning project.
create policy comparison_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'source-documents'
    and (storage.foldername(storage.objects.name))[2] = 'comparison'
    and exists (select 1 from public.projects p
      where p.id::text = (storage.foldername(storage.objects.name))[1]
        and (private.has_project_role(p.id, 'operador')
          or private.has_project_role(p.id, 'revisor_juridico'))));

create policy comparison_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'source-documents'
    and (storage.foldername(storage.objects.name))[2] = 'comparison'
    and exists (select 1 from public.projects p
      where p.id::text = (storage.foldername(storage.objects.name))[1]
        and private.has_project_role(p.id, 'auditor')));

create or replace function public.queue_comparison(p_left_document_id uuid, p_right_document_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_project_id uuid;
  v_job_id uuid;
begin
  if p_left_document_id = p_right_document_id then
    raise exception 'comparison_requires_two_documents';
  end if;
  select l.project_id into v_project_id
  from public.comparison_documents l
  join public.comparison_documents r on r.id = p_right_document_id
    and r.project_id = l.project_id and r.is_active
  where l.id = p_left_document_id and l.is_active;
  if v_project_id is null or not (
    private.has_project_role(v_project_id, 'operador')
    or private.has_project_role(v_project_id, 'revisor_juridico')
  ) then
    raise exception 'comparison_documents_not_available';
  end if;
  perform 1 from public.projects where id = v_project_id for update;
  if (select count(*) from public.comparison_jobs
      where project_id = v_project_id and status in ('queued', 'running')) >= 2 then
    raise exception 'comparison_queue_full';
  end if;
  if exists (select 1 from public.comparison_jobs
      where project_id = v_project_id and status in ('queued', 'running')
        and left_document_id = p_left_document_id and right_document_id = p_right_document_id) then
    raise exception 'comparison_already_running';
  end if;
  insert into public.comparison_jobs(project_id, left_document_id, right_document_id, created_by)
  values (v_project_id, p_left_document_id, p_right_document_id, (select auth.uid()))
  returning id into v_job_id;
  return v_job_id;
end;
$$;
revoke all on function public.queue_comparison(uuid, uuid) from public;
grant execute on function public.queue_comparison(uuid, uuid) to authenticated;

create or replace function public.claim_next_comparison_job()
returns setof public.comparison_jobs language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'forbidden'; end if;
  update public.comparison_jobs set status = 'failed', error_code = 'WORKER_RETRIES_EXHAUSTED',
    completed_at = now(), lease_token = null, lease_expires_at = null
  where status = 'running' and lease_expires_at < now() and attempt_count >= 3;
  select id into v_id from public.comparison_jobs
  where status = 'queued' or (status = 'running' and lease_expires_at < now())
  order by created_at for update skip locked limit 1;
  if v_id is null then return; end if;
  return query update public.comparison_jobs
    set status = 'running', attempt_count = attempt_count + 1,
        lease_token = gen_random_uuid(), lease_expires_at = now() + interval '10 minutes',
        error_code = null
    where id = v_id
    returning *;
end;
$$;
revoke all on function public.claim_next_comparison_job() from public;
grant execute on function public.claim_next_comparison_job() to service_role;

create or replace function public.finish_comparison_job(
  p_job_id uuid, p_lease_token uuid, p_result jsonb, p_error_code text
)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'forbidden'; end if;
  update public.comparison_jobs
  set status = case when p_error_code is null then 'completed' else 'failed' end,
      result = case when p_error_code is null then p_result else null end,
      error_code = left(p_error_code, 80), completed_at = now(),
      lease_token = null, lease_expires_at = null
  where id = p_job_id and lease_token = p_lease_token and status = 'running';
  return found;
end;
$$;
revoke all on function public.finish_comparison_job(uuid, uuid, jsonb, text) from public;
grant execute on function public.finish_comparison_job(uuid, uuid, jsonb, text) to service_role;
