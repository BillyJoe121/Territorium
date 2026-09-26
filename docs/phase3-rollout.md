# Fase 3 — Carga privada y procesamiento asíncrono

Esta guía operacionaliza HU-V2-027 a HU-V2-033. No despliega servicios ni
modifica datos por sí sola.

## Componentes y límites

- La web calcula el SHA-256, reserva una ruta privada y carga directamente a
  `source-documents` con TUS. Nunca recibe la `service_role` key.
- La Edge Function `expediente-analysis-request` autentica al usuario y
  responde `202`; no descarga documentos ni ejecuta extracción.
- El worker externo reclama tareas con lease, valida los binarios y deja el
  progreso confirmado en PostgreSQL. La extracción estructurada empieza en
  Fase 4.
- El path estable sigue el patrón
  `<project-id>/expediente/<grupo>/<reserva>/<nombre-normalizado>`; los enlaces
  de lectura son siempre firmados y emitidos tras el control RLS de Storage.

## Orden de despliegue

1. Aplicar las migraciones, incluida
   `20260919031348_phase3_expediente_uploads_and_processing.sql`.
2. Habilitar Realtime para `expediente_document_groups`,
   `expediente_executions` y `expediente_execution_tasks` (la migración las
   agrega a la publicación `supabase_realtime`).
3. Desplegar `expediente-analysis-request` con `APP_ORIGINS` igual a la lista
   exacta de orígenes de la aplicación. Configurar además
   `WORKER_WAKE_URL=https://<worker>/internal/wake` y `WORKER_WAKE_TOKEN`.
   La URL debe usar HTTPS y el token debe ser un secreto aleatorio compartido
   únicamente con el worker. No usar el valor por defecto en producción.
4. Desplegar por separado el worker con `SUPABASE_URL`,
   `SUPABASE_SECRET_KEY`, `EXPEDIENTE_V2_WORKER_ENABLED=true` y un
   `WORKER_NAME` identificable. Configurar el mismo `WORKER_WAKE_TOKEN` que
   en la Edge Function. Mantener las claves de Supabase, IA y todos los
   secretos fuera del frontend; el token de wake-up solo vive en los dos
   servicios de servidor.
5. Ajustar `expediente_worker_limits` por combinación extractor/proveedor
   antes de incrementar réplicas del worker. El límite se aplica al reclamar
   tareas, no en el navegador.

## Operación y recuperación

- Una reserva vencida o cancelada se recoge con
  `expire_expediente_upload_reservations`; el worker elimina el objeto privado
  correspondiente en su siguiente ciclo de limpieza.
- Los errores `PERMANENT_*` requieren corregir o sustituir el archivo. Los
  transitorios se reencolan con backoff exponencial de 15 a 300 segundos y un
  máximo por tarea.
- Un lease de cinco minutos vencido se recupera de forma atómica al siguiente
  reclamo. No se deben completar tareas con un lease token antiguo.
- El progreso visible se calcula desde `completed_units/total_units` y se
  rehidrata desde la base de datos al recargar; Realtime solo acelera la
  actualización.
- Al encolar, la Edge Function conserva la ejecución y envía una señal de
  activación no bloqueante al worker. Si el servicio está arrancando o no
  responde, la tarea permanece durable en `queued`; revisar el evento
  `expediente_worker_wake_failed` y la antigüedad de cola, no crear una nueva
  ejecución manualmente.
- Si faltan `WORKER_WAKE_URL` o `WORKER_WAKE_TOKEN`, la función rechaza la
  solicitud con `503 processing_not_configured`; así evita aceptar una tarea
  que no tiene un mecanismo configurado para despertar al consumidor.

## Evidencia mínima antes de habilitar usuarios

```powershell
npx supabase db reset --local --workdir .
npx supabase test db --local supabase/tests/phase2_expediente_domain.sql --workdir .
npx supabase test db --local supabase/tests/phase3_expediente_uploads.sql --workdir .
npm run verify
cd worker
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v
```

Además, en el entorno objetivo se debe probar con una cuenta de operador: una
carga interrumpida/reanudada, un archivo corrupto, un duplicado con cada una de
las tres decisiones, reinicio del worker y reconexión del navegador. Esas
pruebas son obligatorias porque no se pueden demostrar con tests unitarios
locales.
