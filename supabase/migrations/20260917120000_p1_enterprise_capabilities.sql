-- Migration: 20260917120000_p1_enterprise_capabilities.sql
-- Adds tables and policies for P1 Enterprise capabilities (E01 - E18)

-- 1. Configuraciones corporativas y de proyecto (US-008, US-031, US-042, US-064, US-144)
create table if not exists public.project_configurations (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade unique,
    session_timeout_minutes integer not null default 60,
    mfa_required boolean not null default false,
    allowed_web_origins text[] not null default array['https://territorium.local', 'http://localhost:5173'],
    max_files_per_batch integer not null default 200,
    max_batch_size_mb integer not null default 500,
    allowed_mime_types text[] not null default array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    retention_days_raw integer not null default 365,
    retention_days_derivatives integer not null default 180,
    retention_days_exports integer not null default 90,
    auto_purge_enabled boolean not null default false,
    budget_cap_usd numeric(10, 2) not null default 250.00,
    budget_alert_threshold_percent integer not null default 80,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2. Auditoría de acceso a datos sensibles (US-009)
create table if not exists public.sensitive_data_audit_logs (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    actor_id uuid references auth.users(id) on delete set null,
    actor_email text not null default 'sistema',
    resource_type text not null check (resource_type in ('property_record', 'document', 'attribute', 'export', 'negotiation')),
    resource_id text not null,
    property_code text,
    action text not null check (action in ('view', 'download', 'export', 'modify', 'delete', 'approve')),
    sensitive_fields text[] default array[]::text[],
    ip_address text,
    user_agent text,
    created_at timestamptz not null default now()
);

-- 3. Versionado de documentos e inspección de seguridad (US-030, US-041)
create table if not exists public.document_versions (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references public.source_documents(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,
    version_number integer not null default 1,
    file_name text not null,
    storage_path text not null,
    size_bytes bigint not null default 0,
    sha256 text not null,
    is_current boolean not null default true,
    change_summary text,
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now()
);

create table if not exists public.file_scan_logs (
    id uuid primary key default gen_random_uuid(),
    document_id uuid references public.source_documents(id) on delete cascade,
    file_name text not null,
    scan_status text not null check (scan_status in ('clean', 'infected', 'quarantined', 'bypassed')),
    threat_details text,
    engine_name text not null default 'Territorium ClamAV Core',
    engine_version text not null default '1.2.0',
    scanned_at timestamptz not null default now()
);

-- 4. Extracción y validación de plantillas de negociación (US-087 a US-092)
create table if not exists public.negotiation_records (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    batch_id uuid not null references public.batches(id) on delete cascade,
    property_code text not null,
    initial_offer_num numeric(14, 2),
    initial_offer_text text,
    negotiated_offer_num numeric(14, 2),
    negotiated_offer_text text,
    final_offer_num numeric(14, 2),
    final_offer_text text,
    offers_match_status text not null check (offers_match_status in ('coinciden', 'discrepancia', 'incompleto')),
    cell_references jsonb not null default '{}'::jsonb,
    is_approved boolean not null default false,
    corrected_manually boolean not null default false,
    reviewer_notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(project_id, batch_id, property_code)
);

-- 5. Plantillas y minutas jurídicas generadas (US-119 a US-127, US-168)
create table if not exists public.document_templates (
    id uuid primary key default gen_random_uuid(),
    project_id uuid references public.projects(id) on delete cascade, -- null para plantillas globales
    template_key text not null check (template_key in ('oferta_economica', 'acta_acuerdo', 'bitacora', 'poder', 'promesa', 'escritura')),
    name text not null,
    version integer not null default 1,
    required_fields text[] not null default array[]::text[],
    template_body text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.generated_documents (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    property_code text not null,
    template_key text not null,
    template_version integer not null default 1,
    document_title text not null,
    status text not null check (status in ('preview', 'generated', 'blocked', 'downloaded')),
    blocking_reasons text[] not null default array[]::text[],
    storage_path text,
    source_data_snapshot jsonb not null default '{}'::jsonb,
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now()
);

-- 6. Historial granular de cambios y asignaciones (US-112, US-114, US-163, US-167)
create table if not exists public.attribute_change_history (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    property_code text not null,
    attribute_key text not null,
    previous_value text,
    new_value text,
    author_id uuid references auth.users(id),
    author_name text not null default 'Revisor',
    reason text not null,
    change_type text not null check (change_type in ('ai_extraction', 'manual_edit', 'bulk_approved', 'restored', 'rule_normalization')),
    created_at timestamptz not null default now()
);

-- 7. Snapshots y copias de seguridad de proyectos (US-016, US-142)
create table if not exists public.project_snapshots (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    snapshot_type text not null check (snapshot_type in ('backup', 'configuration_clone', 'pre_migration')),
    label text not null,
    payload jsonb not null default '{}'::jsonb,
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now()
);

-- 8. Alteraciones a tablas base para soporte de P1 (US-053, US-055, US-112)
alter table public.jobs add column if not exists is_paused boolean not null default false;
alter table public.jobs add column if not exists assigned_to uuid references auth.users(id);
alter table public.jobs add column if not exists lease_expires_at timestamptz;
alter table public.projects add column if not exists budget_cap_usd numeric(10, 2) not null default 250.00;
alter table public.projects add column if not exists total_spent_usd numeric(10, 2) not null default 0.00;

-- 9. RLS y Políticas de Seguridad Granulares
alter table public.project_configurations enable row level security;
alter table public.sensitive_data_audit_logs enable row level security;
alter table public.document_versions enable row level security;
alter table public.file_scan_logs enable row level security;
alter table public.negotiation_records enable row level security;
alter table public.document_templates enable row level security;
alter table public.generated_documents enable row level security;
alter table public.attribute_change_history enable row level security;
alter table public.project_snapshots enable row level security;

-- Políticas de lectura y escritura basadas en membresía de proyecto
create policy "project_configurations_select" on public.project_configurations
    for select using (private.has_project_role(project_id, 'viewer'));
create policy "project_configurations_write" on public.project_configurations
    for all using (private.has_project_role(project_id, 'owner'));

create policy "sensitive_data_audit_logs_select" on public.sensitive_data_audit_logs
    for select using (private.has_project_role(project_id, 'reviewer'));
create policy "sensitive_data_audit_logs_insert" on public.sensitive_data_audit_logs
    for insert with check (private.has_project_role(project_id, 'viewer'));

create policy "document_versions_select" on public.document_versions
    for select using (private.has_project_role(project_id, 'viewer'));
create policy "document_versions_write" on public.document_versions
    for all using (private.has_project_role(project_id, 'operator'));

create policy "file_scan_logs_select" on public.file_scan_logs
    for select using (true);

create policy "negotiation_records_select" on public.negotiation_records
    for select using (private.has_project_role(project_id, 'viewer'));
create policy "negotiation_records_write" on public.negotiation_records
    for all using (private.has_project_role(project_id, 'reviewer'));

create policy "document_templates_select" on public.document_templates
    for select using (true);
create policy "document_templates_write" on public.document_templates
    for all using (project_id is null or private.has_project_role(project_id, 'owner'));

create policy "generated_documents_select" on public.generated_documents
    for select using (private.has_project_role(project_id, 'viewer'));
create policy "generated_documents_write" on public.generated_documents
    for all using (private.has_project_role(project_id, 'reviewer'));

create policy "attribute_change_history_select" on public.attribute_change_history
    for select using (private.has_project_role(project_id, 'viewer'));
create policy "attribute_change_history_insert" on public.attribute_change_history
    for insert with check (private.has_project_role(project_id, 'reviewer'));

create policy "project_snapshots_select" on public.project_snapshots
    for select using (private.has_project_role(project_id, 'owner'));
create policy "project_snapshots_write" on public.project_snapshots
    for all using (private.has_project_role(project_id, 'owner'));
