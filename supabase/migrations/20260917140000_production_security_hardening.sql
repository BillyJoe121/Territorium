-- Production hardening: explicit grants, tenant-safe RLS and supporting indexes.

-- Future objects are private by default. Every API-facing object must opt in.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Tables added after the baseline must not inherit broad Data API grants.
revoke all on table
  public.document_tasks,
  public.extractor_configs,
  public.ai_execution_logs,
  public.project_configurations,
  public.sensitive_data_audit_logs,
  public.document_versions,
  public.file_scan_logs,
  public.negotiation_records,
  public.document_templates,
  public.generated_documents,
  public.attribute_change_history,
  public.project_snapshots,
  public.sso_configurations,
  public.electronic_signatures,
  public.custom_dynamic_templates,
  public.notification_channel_configs,
  public.capacity_metrics_logs
from anon, authenticated;

-- Minimum browser permissions for the production path used by the application.
grant select, insert, update on public.document_tasks to authenticated;
grant select, update (provider, primary_model, fallback_model, fallback_provider, temperature, max_tokens, timeout_seconds, is_enabled, updated_by, updated_at)
  on public.extractor_configs to authenticated;
grant select, insert on public.ai_execution_logs to authenticated;

-- The worker owns server-side persistence; RLS is bypassed only by its secret key.
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Tighten telemetry. Authenticated users may only see and create logs in projects
-- where they are members; global/system rows remain server-only.
drop policy if exists ai_logs_select on public.ai_execution_logs;
drop policy if exists ai_logs_insert on public.ai_execution_logs;
create policy ai_logs_select on public.ai_execution_logs
  for select to authenticated
  using (project_id is not null and private.has_project_role(project_id, 'viewer'));
create policy ai_logs_insert on public.ai_execution_logs
  for insert to authenticated
  with check (project_id is not null and private.has_project_role(project_id, 'operator'));

-- P1 policies with nullable/global rows need an explicit tenant boundary.
drop policy if exists "file_scan_logs_select" on public.file_scan_logs;
create policy "file_scan_logs_select" on public.file_scan_logs
  for select to authenticated
  using (
    document_id is not null and exists (
      select 1 from public.source_documents d
      where d.id = file_scan_logs.document_id
        and private.has_project_role(d.project_id, 'viewer')
    )
  );

drop policy if exists "document_templates_select" on public.document_templates;
drop policy if exists "document_templates_write" on public.document_templates;
create policy "document_templates_select" on public.document_templates
  for select to authenticated
  using (project_id is null or private.has_project_role(project_id, 'viewer'));
create policy "document_templates_insert" on public.document_templates
  for insert to authenticated
  with check (project_id is not null and private.has_project_role(project_id, 'owner'));
create policy "document_templates_update" on public.document_templates
  for update to authenticated
  using (project_id is not null and private.has_project_role(project_id, 'owner'))
  with check (project_id is not null and private.has_project_role(project_id, 'owner'));
create policy "document_templates_delete" on public.document_templates
  for delete to authenticated
  using (project_id is not null and private.has_project_role(project_id, 'owner'));

-- P2 secrets and integrations are server-managed until real providers exist.
drop policy if exists "sso_configurations_read_auth" on public.sso_configurations;
drop policy if exists "electronic_signatures_all_auth" on public.electronic_signatures;
drop policy if exists "custom_dynamic_templates_all_auth" on public.custom_dynamic_templates;
drop policy if exists "notification_channel_configs_all_auth" on public.notification_channel_configs;
drop policy if exists "capacity_metrics_logs_read_auth" on public.capacity_metrics_logs;

create policy sso_configurations_project_owner on public.sso_configurations
  for select to authenticated
  using (project_id is not null and private.has_project_role(project_id, 'owner'));
create policy electronic_signatures_project_read on public.electronic_signatures
  for select to authenticated
  using (project_id is not null and private.has_project_role(project_id, 'viewer'));
create policy custom_dynamic_templates_project_read on public.custom_dynamic_templates
  for select to authenticated
  using (project_id is not null and private.has_project_role(project_id, 'viewer'));
create policy capacity_metrics_project_read on public.capacity_metrics_logs
  for select to authenticated
  using (project_id is not null and private.has_project_role(project_id, 'owner'));

-- Read-only columns deliberately omit client_secret and webhook_url.
grant select (id, project_id, provider_name, entity_id, metadata_url, client_id, issuer, default_role, role_claim_mapping, is_active, created_at, updated_at)
  on public.sso_configurations to authenticated;
grant select on public.electronic_signatures, public.custom_dynamic_templates, public.capacity_metrics_logs to authenticated;

-- Foreign-key and policy lookup indexes.
create index if not exists project_members_user_project_idx on public.project_members (user_id, project_id);
create index if not exists job_attempts_job_idx on public.job_attempts (job_id);
create index if not exists record_documents_source_idx on public.property_record_documents (source_document_id);
create index if not exists review_comments_task_idx on public.review_comments (review_task_id);
create index if not exists export_files_project_idx on public.export_files (project_id, created_at desc);
create index if not exists document_versions_project_idx on public.document_versions (project_id, created_at desc);
create index if not exists file_scan_logs_document_idx on public.file_scan_logs (document_id);
create index if not exists generated_documents_project_idx on public.generated_documents (project_id, created_at desc);
create index if not exists sso_configurations_project_idx on public.sso_configurations (project_id);
create index if not exists electronic_signatures_project_idx on public.electronic_signatures (project_id, created_at desc);
create index if not exists custom_dynamic_templates_project_idx on public.custom_dynamic_templates (project_id, updated_at desc);
create index if not exists notification_channel_configs_project_idx on public.notification_channel_configs (project_id);
create index if not exists capacity_metrics_project_idx on public.capacity_metrics_logs (project_id, recorded_at desc);
