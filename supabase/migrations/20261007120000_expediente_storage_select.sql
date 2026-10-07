-- Lectura de los insumos del expediente (vista previa de archivos cargados).
-- La política heredada source_objects_select usa storage.foldername(name) dentro de un
-- subquery sobre public.projects, que también tiene columna "name": se resuelve con el
-- nombre del proyecto y nunca autoriza. Igual que en 20260925204347 para comparison/,
-- aquí se califica storage.objects.name para las rutas <project_id>/expediente/...
begin;

drop policy if exists expediente_objects_select on storage.objects;
create policy expediente_objects_select on storage.objects for select to authenticated
  using (
    bucket_id = 'source-documents'
    and (storage.foldername(storage.objects.name))[2] = 'expediente'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(storage.objects.name))[1]
        and private.has_project_role(p.id, 'auditor')
    )
  );

commit;
