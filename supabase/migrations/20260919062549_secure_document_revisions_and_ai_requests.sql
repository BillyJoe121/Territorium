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
