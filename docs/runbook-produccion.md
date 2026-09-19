# Runbook de producción — Territorium 2.0

Este documento describe la operación en producción, monitorización, respuesta a incidentes y procedimientos de recuperación para **Territorium 2.0 (Flujo de Expediente Único por Predio)**.

---

## 1. Servicios, Salud y Telemetría

| Componente | Señal saludable | Umbral de Alerta | Acción inicial ante falla |
|---|---|---|---|
| **Web Frontend (Vite/React)** | Carga `/`, sesión activa | HTTP 5xx > 1% en 5 min | Verificar build en hosting, variables `VITE_*` y certificados SSL. |
| **Supabase (PostgreSQL + RLS)** | Status `Healthy`, RLS activa | Consultas lentas > 500ms | Revisar Advisors, Pool de conexiones PgBouncer y políticas RLS. |
| **Edge Functions** | Respuesta HTTP 200/202 | Errores 5xx > 0 | Revisar logs en Supabase dashboard, JWT y cabeceras CORS. |
| **Worker (FastAPI + Python)** | `/ready` responde 200 | Latencia de cola > 600s (10 min) | Verificar proceso en background, memoria y credenciales. |
| **Pipeline de Procesamiento** | Cola avanza de `queued` a `ready` | Reintentos > 3 consecutivos | Consultar `job_attempts`, inspeccionar código acotado de error. |
| **Consumo de IA** | Tokens por ejecución < 50k | Tokens > 50k por expediente | Auditar tamaño del lote y respuestas generativas; verificar caché. |

---

## 2. Protocolos de Respuesta ante Incidentes

### 2.1 Trabajo de Extracción Atascado (>10 Minutos)
1. Consultar el estado de la tarea en `expediente_tasks` o `job_attempts` mediante el ID de la tarea.
2. Si el lease expiró, el worker devolverá la tarea a la cola automáticamente en la siguiente iteración de reclamo.
3. Si el worker falló por timeout o memoria (archivo de gran tamaño escaneado), el motor de preprocesamiento activará el extractor OCR por fragmentos.
4. **Regla de oro**: Nunca eliminar el expediente ni sus archivos; conservar el historial inmutable para auditoría.

### 2.2 Fallo Transitorio o Indisponibilidad del Proveedor de IA
- El sistema implementa reintentos con retroceso exponencial (máximo 3 intentos).
- Al agotarse los intentos, la etapa pasa a estado `failed` registrando un código de error normalizado (ej. `AI_PROVIDER_UNAVAILABLE`, `RATE_LIMIT_EXCEEDED`).
- Los datos estructurados aprobados no se ven afectados: el usuario puede reintentar la etapa individualmente desde el botón "Repetir análisis".
- **Privacidad**: Ni el texto jurídico sensible ni los datos personales de propietarios se registran en los logs de error.

### 2.3 Alerta de Consumo Anómalo de Tokens o Costo
- Umbral de alerta: ejecuciones que superen los 50.000 tokens en una sola etapa narrativa.
- Procedimiento:
  1. Revisar si el documento contenía anexos irrelevantes que no debieron enviarse al prompt narrativo.
  2. Ajustar la configuración del extractor en `extractorConfig.ts` para restringir el contexto al apartado de consideraciones.

---

## 3. Privacidad de Datos y Sanitización de Logs (HU-V2-056)

En cumplimiento de las normas de protección de datos personales y secreto profesional:
- **Redacción obligatoria**: Todo registro de telemetría, métricas o logs en consola pasa por `sanitizeTelemetryPayload`.
- **Campos protegidos redactados**: Cédulas, folios de matrícula inmobiliaria, nombres de propietarios, linderos exactos, valores de avalúos y textos narrativos se reemplazan por tokens enmascarados `[REDACTED_SECURE_TOKEN]`.
- **Retención**: Los documentos fuente se almacenan en el bucket privado `source-documents` con URLs firmadas de expiración temporal (máximo 60 minutos).

---

## 4. Migración de Expedientes y Reversibilidad (HU-V2-052)

### Diagnóstico previo
Antes de reclasificar un proyecto existente:
```typescript
import { diagnoseLegacyProject, buildMigrationPlan, executeMigrationPlan } from './lib/expedienteMigration'
const diagnostic = diagnoseLegacyProject(project, documents, records)
```
- **Proyectos de un solo predio**: Se crea el plan y se migran automáticamente a los subconjuntos de Títulos, Planos y Negociación.
- **Proyectos multipredio heredados**: Se marcan con `archiveAsReadOnly: true` (modo consulta histórica) para evitar mezclar gestiones prediales.

### Procedimiento de Reversión (Rollback)
Si una migración requiere deshacerse:
```typescript
import { rollbackMigrationPlan } from './lib/expedienteMigration'
const result = rollbackMigrationPlan(plan, operatorId)
```
El evento de reversión se registra en la auditoría inmutable sin pérdida de documentos.

---

## 5. Checklist de Lanzamiento a Producción

- [ ] Todas las pruebas automatizadas en verde (`npm run verify` con código 0).
- [ ] RLS y autenticación estricta configuradas en Supabase.
- [ ] Variables de entorno seguras (`SUPABASE_SECRET_KEY` y claves de IA solo en el worker).
- [ ] Enlaces antiguos de navegación redirigiendo a la Ficha del Expediente.
- [ ] Matriz de autorizaciones RBAC probada (operadores y auditores no pueden aprobar).
- [ ] Formatos de exportación verificados: PDF oficial (`#1E3A2B`) y Excel `CORRESPONDENCIA.xlsx` sincronizados con código hash SHA-256.
