begin;

select plan(27);

-- Usuarios y expedientes independientes. El trigger v2 debe inicializar el
-- dominio completo sin que la interfaz inserte filas internas manualmente.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase2-owner@example.test', 'not-used-by-tests', now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase2-outsider@example.test', 'not-used-by-tests', now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase2-reviewer@example.test', 'not-used-by-tests', now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase2-approver@example.test', 'not-used-by-tests', now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now()),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase2-auditor@example.test', 'not-used-by-tests', now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now()),
  ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase2-operator@example.test', 'not-used-by-tests', now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now());

insert into public.projects (id, name, municipality, department, created_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Predio de prueba fase dos', 'Rionegro', 'Antioquia', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Expediente aislado fase dos', 'Marinilla', 'Antioquia', '22222222-2222-2222-2222-222222222222');

insert into public.project_members (project_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'revisor_juridico'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'aprobador'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'auditor'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'operador');

select is(
  (select count(*) from public.expediente_property_identities where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::bigint,
  'todo expediente nuevo recibe una identidad predial única'
);

select is(
  (select count(*) from public.expediente_master_records where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::bigint,
  'todo expediente nuevo recibe un único registro maestro'
);

select is(
  (select count(*) from public.expediente_document_groups where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  3::bigint,
  'todo expediente nuevo recibe los tres grupos documentales'
);

select is(
  (select count(distinct group_key) from public.expediente_document_groups where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  3::bigint,
  'los grupos del expediente no se duplican por tipo'
);

select throws_ok(
  $$
    insert into public.expediente_master_records (project_id, property_identity_id)
    select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id
    from public.expediente_property_identities
    where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  $$,
  '23505',
  null,
  'no se permite un segundo registro maestro para el mismo expediente'
);

insert into public.expediente_document_files (
  id, group_id, project_id, document_key, original_name, mime_type, storage_path,
  size_bytes, sha256, created_by
)
select
  'cccccccc-cccc-cccc-cccc-ccccccccccc1', id, project_id,
  'dddddddd-dddd-dddd-dddd-ddddddddddd1', 'titulo-inicial.pdf', 'application/pdf',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/expediente/titles/dddddddd-dddd-dddd-dddd-ddddddddddd1/titulo-inicial.pdf',
  1200, repeat('a', 64), '11111111-1111-1111-1111-111111111111'
from public.expediente_document_groups
where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and group_key = 'titles';

select is(
  (select status from public.expediente_document_groups where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and group_key = 'titles'),
  'ready',
  'agregar el primer archivo habilita únicamente su grupo'
);
select ok(
  exists (
    select 1 from public.expediente_audit_events
    where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and action = 'expediente.document_uploaded'
  ),
  'la carga de un archivo queda auditada'
);

update public.expediente_document_groups
set status = 'queued'
where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and group_key = 'titles';
update public.expediente_consolidations set status = 'approved' where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
update public.expediente_final_document_states set status = 'final' where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
insert into public.expediente_artifacts (project_id, kind, storage_path)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'consolidated_xlsx', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/expediente/artifacts/consolidated.xlsx');

insert into public.expediente_document_files (
  id, group_id, project_id, document_key, original_name, mime_type, storage_path,
  size_bytes, sha256, created_by
)
select
  'cccccccc-cccc-cccc-cccc-ccccccccccc2', id, project_id,
  'dddddddd-dddd-dddd-dddd-ddddddddddd2', 'titulo-adicional.pdf', 'application/pdf',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/expediente/titles/dddddddd-dddd-dddd-dddd-ddddddddddd2/titulo-adicional.pdf',
  1300, repeat('b', 64), '11111111-1111-1111-1111-111111111111'
from public.expediente_document_groups
where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and group_key = 'titles';

select is(
  (select status from public.expediente_document_groups where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and group_key = 'titles'),
  'stale',
  'un cambio de insumos invalida el grupo que estaba en cola'
);

select is(
  (select status from public.expediente_consolidations where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'stale',
  'un cambio de insumos invalida el consolidado sin borrarlo'
);

select is(
  (select status from public.expediente_final_document_states where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'stale',
  'un cambio de insumos invalida el documento final sin borrarlo'
);

select is(
  (select status from public.expediente_artifacts where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'stale',
  'un artefacto invalidado deja de estar disponible como vigente'
);

update public.expediente_document_files set is_current = false where id = 'cccccccc-cccc-cccc-cccc-ccccccccccc1';
select throws_ok(
  $$ update public.expediente_document_files set original_name = 'no-debe-cambiar.pdf' where id = 'cccccccc-cccc-cccc-cccc-ccccccccccc1' $$,
  'P0001',
  'Las versiones históricas de archivo son inmutables.',
  'un archivo histórico no puede editarse'
);

insert into public.expediente_artifacts (id, project_id, kind, storage_path)
values ('abababab-abab-abab-abab-abababababab', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'final_pdf', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/expediente/artifacts/final.pdf');

update public.expediente_document_groups
set status = 'ready'
where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and group_key = 'titles';
insert into public.expediente_executions (
  id, project_id, group_id, input_version, idempotency_key, extractor_key, total_units
)
select
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', project_id, id, input_version,
  'phase2-late-result-idempotency-key', 'title_study', 1
from public.expediente_document_groups
where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and group_key = 'titles';
update public.expediente_executions set status = 'processing' where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1';
insert into public.expediente_execution_tasks (
  id, execution_id, document_file_id, idempotency_key, status, lease_token, lease_expires_at
)
values (
  'ffffffff-ffff-ffff-ffff-fffffffffff1', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1',
  'cccccccc-cccc-cccc-cccc-ccccccccccc2', 'phase2-late-task-idempotency-key', 'running',
  '99999999-9999-9999-9999-999999999999', now() + interval '5 minutes'
);
update public.expediente_executions set status = 'superseded' where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1';
select is(
  public.complete_expediente_execution_task(
    'ffffffff-ffff-ffff-ffff-fffffffffff1', '99999999-9999-9999-9999-999999999999',
    '{"records":[]}'::jsonb, repeat('c', 64)
  ),
  false,
  'una respuesta tardía de una ejecución sustituida no se acepta'
);

update public.expediente_document_groups
set status = 'queued'
where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and group_key = 'titles';
insert into public.expediente_executions (
  id, project_id, group_id, input_version, idempotency_key, extractor_key, total_units, status
)
select
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', project_id, id, input_version,
  'phase2-retry-exhausted-idempotency-key', 'title_study', 1, 'processing'
from public.expediente_document_groups
where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and group_key = 'titles';
insert into public.expediente_execution_tasks (
  id, execution_id, document_file_id, idempotency_key, status, attempt_count, lease_token, lease_expires_at
)
values (
  'ffffffff-ffff-ffff-ffff-fffffffffff2', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2',
  'cccccccc-cccc-cccc-cccc-ccccccccccc2', 'phase2-retry-exhausted-task-key', 'running', 3,
  '88888888-8888-8888-8888-888888888888', now() - interval '1 minute'
);
select is(
  (select count(*) from public.claim_next_expediente_execution_task('phase2-test-worker')),
  0::bigint,
  'una tarea que agotó reintentos no vuelve a reclamarse'
);
select is(
  (select status from public.expediente_executions where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2'),
  'failed',
  'agotar reintentos marca la ejecución como fallida'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', true);
select lives_ok(
  $$
    select public.queue_expediente_group_execution(
      (select id from public.expediente_document_groups where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and group_key = 'titles'),
      'phase2-reprocess-request-key'
    )
  $$,
  'un operador puede solicitar reproceso de un grupo con error'
);
select ok(
  exists (
    select 1 from public.expediente_audit_events
    where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and action = 'expediente.execution_reprocess_requested'
  ),
  'la solicitud de reproceso queda auditada de forma diferenciada'
);
reset role;
update public.expediente_execution_tasks
set status = 'cancelled', lease_token = null, lease_expires_at = null, completed_at = now()
where execution_id in (
  select id from public.expediente_executions
  where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and status = 'queued'
);
update public.expediente_executions
set status = 'superseded', cancelled_at = now(), completed_at = now()
where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and status = 'queued';
update public.expediente_document_groups
set status = 'ready'
where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and group_key = 'titles';

-- El revisor puede editar únicamente borradores; el operador no puede saltar
-- la separación entre corrección y aprobación.
update public.expediente_document_groups
set status = 'queued'
where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and group_key = 'titles';
update public.expediente_document_groups
set status = 'processing'
where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and group_key = 'titles';
update public.expediente_document_groups
set status = 'review_ready'
where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and group_key = 'titles';

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select lives_ok(
  $$ select public.request_expediente_artifact_download('abababab-abab-abab-abab-abababababab') $$,
  'un miembro autorizado solicita la descarga vigente mediante una RPC auditada'
);
select ok(
  exists (
    select 1 from public.expediente_audit_events
    where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and action = 'expediente.artifact_download_requested'
  ),
  'la solicitud de descarga queda auditada'
);

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
insert into public.expediente_result_versions (
  id, project_id, scope, group_id, version_number, source_input_version, payload, created_by
)
select
  '12121212-1212-1212-1212-121212121212', project_id, 'group', id, 1, input_version,
  '{"state":"draft"}'::jsonb, '33333333-3333-3333-3333-333333333333'
from public.expediente_document_groups
where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and group_key = 'titles';
select lives_ok(
  $$ update public.expediente_result_versions set payload = '{"state":"reviewed"}'::jsonb where id = '12121212-1212-1212-1212-121212121212' $$,
  'un revisor jurídico puede guardar su borrador'
);
select ok(
  exists (
    select 1 from public.expediente_audit_events
    where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and action = 'expediente.result_draft_saved'
  ),
  'la corrección de un borrador queda auditada'
);

select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', true);
update public.expediente_result_versions
set payload = '{"state":"operator-write"}'::jsonb
where id = '12121212-1212-1212-1212-121212121212';
select is(
  (select payload::text from public.expediente_result_versions where id = '12121212-1212-1212-1212-121212121212'),
  '{"state": "reviewed"}',
  'un operador no puede modificar un borrador jurídico'
);

select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
select lives_ok(
  $$ select public.approve_expediente_result_version('12121212-1212-1212-1212-121212121212', 'Aprobación de prueba') $$,
  'un aprobador puede aprobar la versión exacta mediante la RPC'
);
select is(
  (select status from public.expediente_result_versions where id = '12121212-1212-1212-1212-121212121212'),
  'approved',
  'la aprobación convierte el borrador exacto en una versión inmutable'
);

select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', true);
select ok(
  exists (select 1 from public.expediente_audit_events where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'un auditor puede consultar la bitácora del expediente'
);
select throws_ok(
  $$ insert into public.expediente_audit_events (project_id, action, entity_type) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'audit.illegal_write', 'test') $$,
  '42501',
  null,
  'un auditor no puede escribir la bitácora'
);

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select is(
  (select count(*) from public.expediente_document_groups where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'RLS no permite consultar el expediente de otro miembro'
);
reset role;

select * from finish();
rollback;
