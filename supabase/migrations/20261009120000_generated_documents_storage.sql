-- Documentos finales generados desde el consolidado (uno por predio y plantilla).
-- Ruta en el bucket privado source-documents:
--   <project_id>/documentos/<escritura|linderos|minuta>/<archivo>.docx
-- Lectura (listar, visualizar, descargar): miembros del proyecto (auditor o superior).
-- Crear, sobreescribir (regenerar) y eliminar: revisor jurídico del proyecto.
-- Igual que en 20261007120000, dentro de subconsultas sobre public.projects (que también
-- tiene columna "name") se califica storage.objects.name.
begin;

create or replace function private.can_write_generated_document(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select array_length(storage.foldername(p_object_name), 1) = 3
    and (storage.foldername(p_object_name))[2] = 'documentos'
    and (storage.foldername(p_object_name))[3] in ('escritura', 'linderos', 'minuta')
    and storage.filename(p_object_name) ~ '^[A-Za-z0-9 ._()-]+\.docx$'
    and exists (
      select 1
      from public.projects p
      where p.id::text = (storage.foldername(p_object_name))[1]
        and private.has_project_role(p.id, 'revisor_juridico')
    )
$$;

revoke all on function private.can_write_generated_document(text) from public;
grant execute on function private.can_write_generated_document(text) to authenticated;

drop policy if exists generated_documents_select on storage.objects;
create policy generated_documents_select on storage.objects for select to authenticated
  using (
    bucket_id = 'source-documents'
    and (storage.foldername(storage.objects.name))[2] = 'documentos'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(storage.objects.name))[1]
        and private.has_project_role(p.id, 'auditor')
    )
  );

drop policy if exists generated_documents_insert on storage.objects;
create policy generated_documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'source-documents' and private.can_write_generated_document(storage.objects.name));

drop policy if exists generated_documents_update on storage.objects;
create policy generated_documents_update on storage.objects for update to authenticated
  using (bucket_id = 'source-documents' and private.can_write_generated_document(storage.objects.name))
  with check (bucket_id = 'source-documents' and private.can_write_generated_document(storage.objects.name));

drop policy if exists generated_documents_delete on storage.objects;
create policy generated_documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'source-documents' and private.can_write_generated_document(storage.objects.name));

commit;
