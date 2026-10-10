-- Hojas de cálculo editables de los resultados (piloto: Estudio de Títulos).
-- Ruta en el bucket privado source-documents:
--   <project_id>/hojas/<result_version_id>/<grupo>.xlsx
-- Lectura: miembros del proyecto (auditor o superior).
-- Escritura (crear y sobreescribir con upsert): revisor jurídico, solo si la versión de
-- resultado pertenece al proyecto de la ruta y sigue en borrador. Una versión aprobada
-- conserva su archivo tal como quedó.
-- Igual que en 20261007120000, dentro de subconsultas sobre public.projects (que también
-- tiene columna "name") se califica storage.objects.name.
begin;

create or replace function private.can_write_result_sheet(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select array_length(storage.foldername(p_object_name), 1) = 3
    and (storage.foldername(p_object_name))[2] = 'hojas'
    and storage.filename(p_object_name) ~ '^[a-z-]+\.xlsx$'
    and exists (
      select 1
      from public.expediente_result_versions rv
      where rv.id::text = (storage.foldername(p_object_name))[3]
        and rv.project_id::text = (storage.foldername(p_object_name))[1]
        and rv.status = 'draft'
        and private.has_project_role(rv.project_id, 'revisor_juridico')
    )
$$;

revoke all on function private.can_write_result_sheet(text) from public;
grant execute on function private.can_write_result_sheet(text) to authenticated;

drop policy if exists result_sheets_select on storage.objects;
create policy result_sheets_select on storage.objects for select to authenticated
  using (
    bucket_id = 'source-documents'
    and (storage.foldername(storage.objects.name))[2] = 'hojas'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(storage.objects.name))[1]
        and private.has_project_role(p.id, 'auditor')
    )
  );

drop policy if exists result_sheets_insert on storage.objects;
create policy result_sheets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'source-documents' and private.can_write_result_sheet(storage.objects.name));

drop policy if exists result_sheets_update on storage.objects;
create policy result_sheets_update on storage.objects for update to authenticated
  using (bucket_id = 'source-documents' and private.can_write_result_sheet(storage.objects.name))
  with check (bucket_id = 'source-documents' and private.can_write_result_sheet(storage.objects.name));

commit;
