# Brecha PMO → Territorium

Evaluación basada en los grafos de ambos proyectos y lectura directa de los límites decisivos.

| Capacidad | PMO | Territorium antes del cierre | Acción de cierre |
|---|---|---|---|
| Autenticación | Login, rutas protegidas, administración | Cliente Supabase sin flujo de sesión | AuthProvider, login, registro, recuperación y cierre |
| Persistencia | Estado repartido entre contexto y Supabase | `localStorage` | Repositorio Supabase y sincronización en tiempo real |
| Proyectos | CRUD y navegación por proyecto | CRUD local | CRUD remoto, miembros y roles con RLS |
| Archivos | Carga, nombres normalizados y Storage | Solo metadatos simulados | Storage privado, hash, validación y TUS para archivos grandes |
| Ejecuciones | Fases, `runId`, cancelación y fallback de proveedor | Temporizador local | Jobs idempotentes, intentos, cancelación y errores persistidos |
| Prompts | Lógica de agentes versionada en código | Tres borradores en Python | Catálogo versionado y editable por proyecto |
| Revisión | Resultados por fase y estados | Aprobación local mínima | Atributos editables, evidencia, tareas y auditoría |
| Exportación | Artefactos y descargas | Excel local básico | Libro consolidado con metadatos y estado de revisión |
| Operación | Manejo de errores útil, pero monolítico | Sin telemetría ni recuperación | Eventos, métricas de job, reintentos y runbook |
| Calidad | Build manual, pocas pruebas | Solo typecheck/build | Unitarias, integración, recorrido de navegador y RLS |

No se copia el monolito de PMO ni sus debilidades de autorización. Se conservan sus ideas maduras —estado de ejecución, `runId`, cancelación, errores claros y separación por proyecto— con límites de seguridad y persistencia más estrictos.
