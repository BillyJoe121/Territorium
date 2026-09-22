-- Migration: 20260922010000_allow_file_deletion_and_private_usage.sql
-- Description: Permite retirar archivos cargados y otorga permisos requeridos en schema private

-- 1. Otorgar permisos de uso en schema private para que los triggers y funciones de seguridad puedan ejecutarse
grant usage on schema private to service_role, authenticated, postgres, anon;
grant execute on all functions in schema private to service_role, authenticated, postgres;

-- 2. Función RPC para retirar/eliminar un archivo de un expediente documental
create or replace function public.delete_expediente_document_file(p_file_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_file public.expediente_document_files%rowtype;
  active_count integer;
  current_grp public.expediente_document_groups%rowtype;
begin
  select * into target_file
  from public.expediente_document_files
  where id = p_file_id;

  if not found then
    return false;
  end if;

  -- Validar rol en el proyecto
  if not private.has_project_role(target_file.project_id, 'operador') then
    raise exception 'No autorizado para eliminar archivos de este expediente.';
  end if;

  -- Validar que el grupo no esté en ejecución activa
  select * into current_grp
  from public.expediente_document_groups
  where id = target_file.group_id;

  if current_grp.status in ('queued', 'processing') then
    raise exception 'No se puede retirar un archivo mientras el grupo se encuentra en análisis.';
  end if;

  -- Marcar archivo como inactivo y retirado
  update public.expediente_document_files
  set is_active = false,
      is_current = false,
      retired_at = now(),
      retirement_reason = 'Retirado por el usuario'
  where id = p_file_id;

  -- Contar archivos activos restantes
  select count(*) into active_count
  from public.expediente_document_files
  where group_id = target_file.group_id and is_active and is_current;

  if active_count = 0 then
    update public.expediente_document_groups
    set status = 'empty',
        current_negotiation_file_id = null
    where id = target_file.group_id;
  else
    if current_grp.current_negotiation_file_id = p_file_id then
      update public.expediente_document_groups
      set current_negotiation_file_id = (
        select id from public.expediente_document_files
        where group_id = target_file.group_id and is_active and is_current
        limit 1
      )
      where id = target_file.group_id;
    end if;

    if current_grp.status in ('review_ready', 'approved') then
      update public.expediente_document_groups
      set status = 'stale'
      where id = target_file.group_id;
    end if;
  end if;

  return true;
end;
$$;

grant execute on function public.delete_expediente_document_file(uuid) to authenticated, service_role;
