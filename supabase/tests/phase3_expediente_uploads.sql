begin;

select plan(32);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase3-owner@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase3-operator@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now()),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase3-outsider@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now());

insert into public.projects (id, name, municipality, department, created_by)
values ('20000000-0000-0000-0000-000000000001', 'Expediente carga fase tres', 'Rionegro', 'Antioquia', '10000000-0000-0000-0000-000000000001');
insert into public.project_members (project_id, user_id, role)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'operador');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);

select is(
  (select skip_upload from public.reserve_expediente_document_upload(
    (select id from public.expediente_document_groups where project_id = '20000000-0000-0000-0000-000000000001' and group_key = 'titles'),
    'Certificado de tradición.pdf', 'application/pdf', 5, repeat('a', 64), 'keep_version'
  )),
  false,
  'un operador puede reservar una ruta privada para títulos'
);

select ok(
  (select storage_path ~ '^20000000-0000-0000-0000-000000000001/expediente/titles/' from public.expediente_upload_reservations limit 1),
  'la ruta estable la genera el servidor dentro del grupo del expediente'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id, metadata) values ('source-documents', '20000000-0000-0000-0000-000000000001/expediente/titles/sin-reserva/archivo.pdf', '10000000-0000-0000-0000-000000000002', '{"size":5,"mimetype":"application/pdf"}') $$,
  '42501', null,
  'Storage no permite una ruta v2 que no tenga reserva'
);

insert into storage.objects (bucket_id, name, owner_id, metadata)
select 'source-documents', storage_path, '10000000-0000-0000-0000-000000000002', '{"size":5,"mimetype":"application/pdf"}'::jsonb
from public.expediente_upload_reservations;

select ok(
  public.commit_expediente_document_upload((select id from public.expediente_upload_reservations limit 1)) is not null,
  'la confirmación registra un archivo únicamente después de verificar Storage'
);
select is(
  (select validation_status from public.expediente_document_files where project_id = '20000000-0000-0000-0000-000000000001'),
  'pending',
  'el archivo comprometido queda pendiente de validación del worker'
);
select is(
  (select status from public.expediente_document_groups where project_id = '20000000-0000-0000-0000-000000000001' and group_key = 'titles'),
  'ready',
  'la carga habilita el análisis del grupo'
);

select is(
  (select skip_upload from public.reserve_expediente_document_upload(
    (select id from public.expediente_document_groups where project_id = '20000000-0000-0000-0000-000000000001' and group_key = 'titles'),
    'Copia.pdf', 'application/pdf', 5, repeat('a', 64), 'omit'
  )),
  true,
  'un duplicado se puede omitir sin crear un nuevo objeto'
);
select is(
  (select count(*) from public.expediente_document_files where project_id = '20000000-0000-0000-0000-000000000001'),
  1::bigint,
  'omitir un duplicado conserva un único documento vigente'
);

select throws_ok(
  $$ insert into public.expediente_document_files (group_id, project_id, original_name, mime_type, storage_path, size_bytes, sha256) values ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000001', 'forjado.pdf', 'application/pdf', '20000000-0000-0000-0000-000000000001/expediente/titles/falso/forjado.pdf', 5, repeat('f', 64)) $$,
  '42501', null,
  'el navegador no puede insertar metadatos documentales sin confirmación'
);

select lives_ok(
  $$ select public.queue_expediente_group_execution(
    (select id from public.expediente_document_groups where project_id = '20000000-0000-0000-0000-000000000001' and group_key = 'titles'),
    'phase3-idempotency-key-0001', '{"version":"v1"}'::jsonb, '{"schema":{"version":"v1"}}'::jsonb, '{"provider":"default","model":"none"}'::jsonb
  ) $$,
  'la solicitud de análisis se acepta sin ejecutar contenido en la petición'
);
select is(
  (select status from public.expediente_executions where project_id = '20000000-0000-0000-0000-000000000001'),
  'queued',
  'la ejecución inicia en cola'
);

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select is(
  (select count(*) from public.claim_next_expediente_execution_task('phase3-test-worker')),
  1::bigint,
  'el worker reclama una tarea con lease'
);
select is(
  (select stage from public.expediente_execution_tasks where execution_id = (select id from public.expediente_executions where project_id = '20000000-0000-0000-0000-000000000001')),
  'validating',
  'el reclamo expone una etapa de progreso real'
);
select lives_ok(
  $$ select public.complete_expediente_execution_task(
    (select id from public.expediente_execution_tasks limit 1),
    (select lease_token from public.expediente_execution_tasks limit 1),
    '{"phase":"ingestion_validation"}'::jsonb, repeat('b', 64), null, null
  ) $$,
  'el worker completa el insumo con un payload inmutable de preparación'
);
select is(
  (select completed_units from public.expediente_executions where project_id = '20000000-0000-0000-0000-000000000001'),
  1,
  'el progreso confirmado deriva de tareas completadas'
);
select is(
  (select status from public.expediente_executions where project_id = '20000000-0000-0000-0000-000000000001'),
  'review_ready',
  'la ejecución preparada queda lista para la fase de extracción/revisión'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select is(
  public.cancel_expediente_document_upload((select reservation_id from public.reserve_expediente_document_upload(
    (select id from public.expediente_document_groups where project_id = '20000000-0000-0000-0000-000000000001' and group_key = 'plans'),
    'Plano cancelado.pdf', 'application/pdf', 5, repeat('d', 64), 'keep_version'
  ))),
  true,
  'una carga interrumpida se puede cancelar de forma compensatoria'
);
reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select is(
  (select count(*) from public.expire_expediente_upload_reservations(10)),
  1::bigint,
  'el worker recibe la ruta cancelada para retirar el objeto privado'
);
select is(
  (select status from public.expediente_upload_reservations where original_name = 'Plano cancelado.pdf'),
  'expired',
  'la reserva cancelada no queda disponible para confirmación'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
-- La reserva de reemplazo se crea e inserta su objeto en dos pasos para que
-- Storage compruebe la ruta emitida por el servidor.
select is(
  (select skip_upload from public.reserve_expediente_document_upload(
    (select id from public.expediente_document_groups where project_id = '20000000-0000-0000-0000-000000000001' and group_key = 'titles'),
    'Certificado actualizado.pdf', 'application/pdf', 5, repeat('a', 64), 'replace'
  )),
  false,
  'un duplicado puede reservarse como reemplazo versionado'
);
insert into storage.objects (bucket_id, name, owner_id, metadata)
select 'source-documents', storage_path, '10000000-0000-0000-0000-000000000002', '{"size":5,"mimetype":"application/pdf"}'::jsonb
from public.expediente_upload_reservations where original_name = 'Certificado actualizado.pdf';
select ok(
  public.commit_expediente_document_upload((select id from public.expediente_upload_reservations where original_name = 'Certificado actualizado.pdf')) is not null,
  'un reemplazo confirma una nueva versión documental'
);
select is(
  (select version_number from public.expediente_document_files where project_id = '20000000-0000-0000-0000-000000000001' and is_current),
  2,
  'el reemplazo conserva la identidad lógica y avanza su versión'
);
select is(
  (select status from public.expediente_document_groups where project_id = '20000000-0000-0000-0000-000000000001' and group_key = 'titles'),
  'stale',
  'un reemplazo invalida el resultado preparado aguas abajo'
);
select lives_ok(
  $$ select public.queue_expediente_group_execution(
    (select id from public.expediente_document_groups where project_id = '20000000-0000-0000-0000-000000000001' and group_key = 'titles'),
    'phase3-retry-idempotency-key-0002', '{"version":"v1"}'::jsonb, '{"schema":{"version":"v1"}}'::jsonb, '{"provider":"default"}'::jsonb
  ) $$,
  'un grupo invalidado puede solicitar una nueva ejecución'
);
reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select is(
  (select count(*) from public.claim_next_expediente_execution_task('phase3-retry-worker')),
  1::bigint,
  'el reproceso reclama su tarea con un nuevo lease'
);
select lives_ok(
  $$ select public.complete_expediente_execution_task(
    (select id from public.expediente_execution_tasks where status = 'running'),
    (select lease_token from public.expediente_execution_tasks where status = 'running'),
    null, null, 'TRANSIENT_PREPARATION_FAILURE', 'Fallo transitorio de red.'
  ) $$,
  'un error transitorio programa un reintento sin cerrar la ejecución'
);
select is(
  (select status from public.expediente_execution_tasks where status = 'queued' order by updated_at desc limit 1),
  'queued',
  'la tarea transitoria vuelve a cola con backoff'
);
select is(
  (select status from public.expediente_executions where id = (select execution_id from public.expediente_execution_tasks where status = 'queued' order by updated_at desc limit 1)),
  'processing',
  'el reintento no marca el grupo como fallo permanente'
);
insert into public.expediente_extraction_cache (
  cache_key, document_sha256, extractor_key, extractor_fingerprint, prompt_fingerprint, schema_fingerprint, model_fingerprint, payload, payload_sha256
) values (
  repeat('e', 64), repeat('a', 64), 'title_study', repeat('b', 64), repeat('c', 64), repeat('d', 64), repeat('e', 64), '{"phase":"cache"}'::jsonb, repeat('f', 64)
);
select is(
  public.record_expediente_cache_hit(repeat('e', 64))->>'phase',
  'cache',
  'el worker recupera una coincidencia de caché versionada'
);
select is(
  (select use_count from public.expediente_extraction_cache where cache_key = repeat('e', 64)),
  1,
  'el acierto de caché queda contabilizado'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select * from public.reserve_expediente_document_upload(
    (select id from public.expediente_document_groups where project_id = '20000000-0000-0000-0000-000000000001' and group_key = 'titles'),
    'intruso.pdf', 'application/pdf', 5, repeat('c', 64), 'keep_version'
  ) $$,
  null, null,
  'un usuario ajeno no puede reservar una carga'
);

select is(
  (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'expediente_executions'),
  1::bigint,
  'las ejecuciones v2 están publicadas para progreso Realtime'
);

select * from finish();
rollback;
