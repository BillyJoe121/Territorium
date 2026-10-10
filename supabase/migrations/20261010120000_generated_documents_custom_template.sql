-- Documentos generados con una plantilla personalizada (.docx con marcadores {{COLUMNA}}) y,
-- más adelante, documentos tipo EPM. Se agregan sus carpetas a las permitidas:
--   <project_id>/documentos/<escritura|linderos|minuta|personalizada|epm>/<archivo>.docx
-- Las políticas de 20261009120000 ya usan esta función: solo cambia la lista de carpetas.
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
    and (storage.foldername(p_object_name))[3] in ('escritura', 'linderos', 'minuta', 'personalizada', 'epm')
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

commit;
