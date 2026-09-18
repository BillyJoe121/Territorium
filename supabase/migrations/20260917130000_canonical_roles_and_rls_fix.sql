-- =========================================================================
-- MIGRACIÓN: Roles Canónicos y Corrección de Firmas RLS (US-002, 003, 004)
-- =========================================================================

-- 1. Ampliar enum project_role con los roles canónicos de Territorium
alter type public.project_role add value if not exists 'administrador';
alter type public.project_role add value if not exists 'operador';
alter type public.project_role add value if not exists 'analista_predial';
alter type public.project_role add value if not exists 'revisor_juridico';
alter type public.project_role add value if not exists 'aprobador';
alter type public.project_role add value if not exists 'auditor';

-- 2. Sobrecarga de private.has_project_role para soportar roles canónicos y alias escalares
create or replace function private.normalize_role(r text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(coalesce(r, ''))
    when 'owner' then 'administrador'
    when 'operator' then 'operador'
    when 'reviewer' then 'revisor_juridico'
    when 'viewer' then 'auditor'
    else lower(coalesce(r, ''))
  end
$$;

create or replace function private.role_allows(actual_role text, required_role text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case private.normalize_role(required_role)
    when 'administrador' then private.normalize_role(actual_role) = 'administrador'
    when 'operador' then private.normalize_role(actual_role) in ('administrador', 'operador')
    when 'analista_predial' then private.normalize_role(actual_role) in ('administrador', 'analista_predial')
    when 'revisor_juridico' then private.normalize_role(actual_role) in ('administrador', 'revisor_juridico', 'aprobador')
    when 'aprobador' then private.normalize_role(actual_role) in ('administrador', 'aprobador')
    when 'auditor' then private.normalize_role(actual_role) in (
      'administrador', 'operador', 'analista_predial', 'revisor_juridico', 'aprobador', 'auditor'
    )
    else false
  end
$$;

-- Versión para arrays de project_role
create or replace function private.has_project_role(target_project uuid, accepted public.project_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.project_members pm
    cross join unnest(accepted) as acc(role_val)
    where pm.project_id = target_project
      and pm.user_id = (select auth.uid())
      and private.role_allows(pm.role::text, acc.role_val::text)
  )
$$;

-- Sobrecarga para rol escalar de project_role o texto
create or replace function private.has_project_role(target_project uuid, accepted_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.project_members pm
    where pm.project_id = target_project
      and pm.user_id = (select auth.uid())
      and private.role_allows(pm.role::text, accepted_role)
  )
$$;

-- Permisos de ejecución
revoke all on function private.has_project_role(uuid, public.project_role[]) from public;
grant execute on function private.has_project_role(uuid, public.project_role[]) to authenticated, service_role;

revoke all on function private.has_project_role(uuid, text) from public;
grant execute on function private.has_project_role(uuid, text) to authenticated, service_role;

revoke all on function private.normalize_role(text) from public;
revoke all on function private.role_allows(text, text) from public;
grant execute on function private.normalize_role(text) to authenticated, service_role;
grant execute on function private.role_allows(text, text) to authenticated, service_role;
