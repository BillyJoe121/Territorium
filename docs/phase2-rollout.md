# Fase 2 — modelo v2 del expediente

## Alcance y compatibilidad

La migración `20260919004410_expediente_v2_domain_and_security.sql` agrega el dominio v2 sin borrar ni reinterpretar `batches`, `property_records` ni documentos del flujo anterior. Un `project` pasa a tener exactamente una identidad predial y un registro maestro v2; los tres grupos documentales son `titles`, `plans` y `negotiation`.

La migración crea una línea base para un máximo de 500 proyectos. Esta línea base usa los datos seguros del proyecto (nombre, municipio y departamento), deja los campos prediales desconocidos como pendientes y no copia resultados históricos cuya cardinalidad podría ser de varios predios. Para completar lotes posteriores, un administrador debe ejecutar:

```sql
select private.backfill_expediente_v2_baseline(500);
```

Repita la consulta hasta que devuelva `0`. La operación es idempotente.

## Garantías del servidor

- Un proyecto tiene una sola identidad predial y un solo registro maestro.
- Cada grupo conserva archivos por versión lógica; no se borran versiones históricas.
- Cada ejecución conserva snapshots de archivos, extractor, prompt y modelo, y sus tareas usan claves de idempotencia y leases.
- Cuando cambian los documentos, la transacción invalida solamente el grupo afectado, cancela su trabajo en curso y deja obsoletos el consolidado, documento final y descargas aguas abajo.
- Las salidas de IA son inmutables. Las correcciones humanas se hacen sobre borradores; la aprobación se registra con usuario, fecha y hash del resultado exacto.
- RLS limita cada dato al proyecto y al rol. El navegador no puede reclamar tareas ni escribir salidas o aprobaciones: esas rutas son RPC de worker o RPC transaccional.

## Activación gradual del frontend

`ExpedienteV2Repository` es el contrato único entre interfaz y persistencia. `createExpedienteV2Repository({ mode: 'demo' | 'supabase' })` es el punto único de conmutación: `DemoExpedienteV2Repository` conserva el prototipo actual y `SupabaseExpedienteV2Repository` usa las mismas operaciones (`load`, encolar, guardar borrador y aprobar). La UI debe seleccionar `supabase` solo después de aplicar la migración y completar el backfill del proyecto; así se evita mostrar estados parciales a usuarios reales.

## Verificación antes de activar Supabase

Con Docker Desktop funcional, desde la raíz de Territorium ejecute:

```powershell
npx --yes supabase@2.117.0 start
npx --yes supabase@2.117.0 db reset --local
npx --yes supabase@2.117.0 db lint --local
npx --yes supabase@2.117.0 test db --local supabase/tests/phase2_expediente_domain.sql
```

Después de aplicar la migración, valide la cardinalidad y la inicialización:

```sql
select project_id, count(*)
from public.expediente_property_identities
group by project_id
having count(*) <> 1;

select project_id, count(*)
from public.expediente_document_groups
group by project_id
having count(*) <> 3;

select project_id, group_key, count(*)
from public.expediente_document_groups
group by project_id, group_key
having count(*) <> 1;
```

Las tres consultas deben devolver cero filas. La suite `phase2_expediente_domain.sql` crea dos expedientes aislados dentro de una transacción que se revierte: verifica inicialización automática, unicidad, historial inmutable, invalidación de descendientes, agotamiento de reintentos, rechazo de resultados tardíos, auditoría de carga/corrección/reproceso/descarga y aislamiento RLS. También cubre los perfiles operador, revisor jurídico, aprobador y auditor.

## Recuperación

El despliegue es de expansión: si se detecta un problema, mantenga la interfaz en `DemoExpedienteV2Repository` o en el flujo anterior y corrija con una nueva migración. No se revierte ni se elimina la información v2, pues contiene versiones, evidencias de aprobación y trazabilidad que deben preservarse.
