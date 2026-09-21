-- =========================================================================
-- MIGRACIÓN: Corrección RLS en tabla projects para INSERT ... RETURNING
-- =========================================================================

-- 1. Asegurar default auth.uid() en la columna created_by
alter table public.projects alter column created_by set default auth.uid();

-- 2. Permitir SELECT tanto si el usuario es el creador (requerido para RETURNING)
--    como si tiene rol asignado en project_members.
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (
    created_by = (select auth.uid())
    or private.has_project_role(id, array['owner','operator','reviewer','viewer','administrador','operador','analista_predial','revisor_juridico','aprobador','auditor']::public.project_role[])
  );

-- 3. Permitir INSERT si created_by coincide con el usuario autenticado (o es null por default)
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    or created_by is null
  );

-- 4. Permitir UPDATE al creador o miembros con rol de operador/administrador
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using (
    created_by = (select auth.uid())
    or private.has_project_role(id, array['owner','operator','administrador','operador']::public.project_role[])
  )
  with check (
    created_by = (select auth.uid())
    or private.has_project_role(id, array['owner','operator','administrador','operador']::public.project_role[])
  );

-- 5. Permitir DELETE al creador o propietario/administrador
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete to authenticated
  using (
    created_by = (select auth.uid())
    or private.has_project_role(id, array['owner','administrador']::public.project_role[])
  );

-- 6. Garantizar que cada usuario pueda ver siempre su propia membresía en project_members
drop policy if exists members_select on public.project_members;
create policy members_select on public.project_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_project_role(project_id, array['owner','operator','reviewer','viewer','administrador','operador','analista_predial','revisor_juridico','aprobador','auditor']::public.project_role[])
  );

-- 7. Asegurar que el trigger de owner use ON CONFLICT DO NOTHING para evitar fallas por concurrencia o reintentos
create or replace function private.add_project_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.created_by, 'owner'::public.project_role)
  on conflict (project_id, user_id) do nothing;
  return new;
end;
$$;
