-- Migración P2: Capacidades avanzadas empresariales (SSO, Firma Electrónica, Plantillas Dinámicas, Notificaciones Corporativas y Capacidad)
-- Fecha: 2026-09-17

-- 1. Configuraciones de Proveedores de Identidad Corporativa (US-010)
CREATE TABLE IF NOT EXISTS public.sso_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    provider_name TEXT NOT NULL, -- 'azure_ad', 'okta', 'google_workspace', 'saml2'
    entity_id TEXT NOT NULL,
    metadata_url TEXT,
    client_id TEXT NOT NULL,
    client_secret TEXT,
    issuer TEXT NOT NULL,
    default_role TEXT NOT NULL DEFAULT 'CONSULTOR',
    role_claim_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Registro de Solicitudes y Sellos de Firma Electrónica (US-115)
CREATE TABLE IF NOT EXISTS public.electronic_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id TEXT NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    property_code TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'docusign', 'certicamara', 'internal_otp'
    envelope_id TEXT NOT NULL,
    signer_email TEXT NOT NULL,
    signer_name TEXT NOT NULL,
    signer_role TEXT NOT NULL,
    document_sha256 TEXT NOT NULL,
    timestamp_token TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'signed', 'declined', 'expired'
    certificate_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Plantillas Dinámicas No-Code con Marcadores Personalizados (US-128)
CREATE TABLE IF NOT EXISTS public.custom_dynamic_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    template_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    format TEXT NOT NULL DEFAULT 'txt', -- 'txt', 'docx', 'xlsx'
    raw_content TEXT NOT NULL,
    detected_placeholders TEXT[] NOT NULL DEFAULT '{}',
    field_mappings JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Canales de Notificación Corporativa Externa (US-136)
CREATE TABLE IF NOT EXISTS public.notification_channel_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    channel_type TEXT NOT NULL, -- 'teams', 'slack', 'email_smtp', 'whatsapp'
    webhook_url TEXT,
    target_recipients TEXT[] NOT NULL DEFAULT '{}',
    events_subscribed TEXT[] NOT NULL DEFAULT '{batch_blocked,budget_alert,system_degraded,all_approved}',
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Monitor de Capacidad, Concurrencia y Cuotas Externas (US-145)
CREATE TABLE IF NOT EXISTS public.capacity_metrics_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL, -- 'openai', 'gemini', 'supabase_storage', 'worker_pool'
    current_usage NUMERIC(12, 4) NOT NULL,
    capacity_limit NUMERIC(12, 4) NOT NULL,
    unit TEXT NOT NULL, -- 'tokens', 'megabytes', 'active_jobs', 'usd'
    percent_consumed NUMERIC(5, 2) NOT NULL,
    alert_level TEXT NOT NULL, -- 'normal', 'warning_70', 'critical_85', 'exhausted_95'
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Políticas RLS Básicas
ALTER TABLE public.sso_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electronic_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_dynamic_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_channel_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capacity_metrics_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sso_configurations_read_auth" ON public.sso_configurations
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "electronic_signatures_all_auth" ON public.electronic_signatures
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "custom_dynamic_templates_all_auth" ON public.custom_dynamic_templates
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "notification_channel_configs_all_auth" ON public.notification_channel_configs
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "capacity_metrics_logs_read_auth" ON public.capacity_metrics_logs
    FOR SELECT TO authenticated USING (true);
