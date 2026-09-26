-- Qualify the Storage object path inside project subqueries. Unqualified
-- `name` binds to public.projects.name and rejects every comparison upload.
alter policy comparison_objects_insert on storage.objects
  with check (
    bucket_id = 'source-documents'
    and (storage.foldername(storage.objects.name))[2] = 'comparison'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(storage.objects.name))[1]
        and (private.has_project_role(p.id, 'operador')
          or private.has_project_role(p.id, 'revisor_juridico'))
    )
  );

alter policy comparison_objects_select on storage.objects
  using (
    bucket_id = 'source-documents'
    and (storage.foldername(storage.objects.name))[2] = 'comparison'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(storage.objects.name))[1]
        and private.has_project_role(p.id, 'auditor')
    )
  );
