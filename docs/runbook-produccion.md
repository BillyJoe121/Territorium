# Runbook de producción

## Servicios y señales

| Componente | Señal saludable | Acción inicial ante falla |
|---|---|---|
| Web | carga `/` y puede iniciar sesión | revisar build y variables `VITE_*` |
| Supabase | proyecto Healthy y consultas sin errores RLS | revisar Advisors, Logs y migraciones |
| Edge Function | `create-batch-job` responde 202 | revisar logs, JWT y `APP_ORIGINS` |
| Worker | proceso activo; `/ready` responde 200 localmente | revisar secretos y conexión saliente |
| Cola | trabajos avanzan de `queued` a `running` | revisar lease, `next_attempt_at` y worker |

## Incidentes

### Trabajo atascado

1. Consultar el trabajo y su último `last_heartbeat_at`.
2. Si expiró el lease, la siguiente llamada a `claim_next_job` lo devuelve a cola automáticamente.
3. Revisar `job_attempts` antes de reintentar manualmente.
4. No borrar el lote: conserva archivos y trazabilidad.

### Proveedor de IA indisponible

Los errores transitorios usan espera exponencial y hasta tres intentos. Al agotar intentos, el lote queda `failed` con un código acotado. El contenido documental nunca se incluye en logs.

### Revocar acceso

Cambiar o eliminar la fila correspondiente en `project_members`. RLS aplica el cambio a base de datos, Storage y Realtime. Rotar la clave secreta si se sospecha exposición y actualizarla en Render.

### Recuperación

- La migración es la fuente de verdad del esquema.
- Los documentos fuente permanecen en el bucket privado `source-documents`.
- Una nueva ejecución crea un nuevo `run_id`; no sobreescribe el historial de intentos.
- Antes de una migración destructiva, generar respaldo y ensayar restauración.

## Privacidad y retención

Definir con el área jurídica el tiempo de conservación de documentos, resultados y auditoría antes del lanzamiento. La integración de IA usa respuestas no almacenadas y elimina el archivo temporal, pero deben validarse contractualmente residencia, tratamiento y retención del proveedor elegido.

## Checklist de lanzamiento

- Dominio final agregado a Auth Redirect URLs y `APP_ORIGINS`.
- Confirmación de correo y SMTP corporativo habilitados.
- RLS y pruebas de aislamiento aprobadas.
- `SUPABASE_SECRET_KEY` únicamente en el worker.
- `OPENAI_API_KEY` únicamente en el worker.
- Alertas de errores y presupuesto activas en Supabase, Render y proveedor de IA.
- Política de retención aprobada.
- Prueba de carga y restauración realizada con documentos no sensibles.
