# Estado de cierre — 2026-09-17

## Terminado y verificado

- Frontend React/Vite conectado por configuración al proyecto Supabase de Territorium.
- Autenticación, recuperación de contraseña y cierre de sesión.
- Expedientes, roles, carga validada y reanudable, archivos privados y URLs firmadas.
- Cola durable con idempotencia, leases, reintentos y cancelación.
- Worker Python con procesamiento secuencial: títulos, planos y negociación.
- Prompts versionados adaptados de los insumos originales y salida JSON estricta.
- Consolidación por folio, evidencia por atributo, confianza, revisión humana y auditoría.
- Excel seguro contra inyección de fórmulas.
- Blueprint de Render, Docker no-root, cabeceras de seguridad y runbook.
- Build productivo, 9 pruebas y auditoría npm sin vulnerabilidades conocidas.
- Grafo de código Forge/Graphify actualizado: 252 nodos, 432 aristas, 20 comunidades.

## No ejecutado para evitar cambios remotos no confirmados

- La migración SQL no se aplicó al proyecto Supabase remoto.
- La Edge Function `create-batch-job` no se desplegó.
- No se creó un usuario de aplicación ni un token personal de Supabase.
- Render no se desplegó porque todavía no existe el repositorio remoto.
- La API de IA no se configuró.

## Estado operativo

`http://127.0.0.1:5173/` permanece ejecutándose y muestra el acceso real conectado a Supabase. Hasta aplicar la migración, el inicio de sesión funciona pero las tablas, políticas y buckets de Territorium no existen en el proyecto remoto.
