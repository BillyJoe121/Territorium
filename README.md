# Territorium — extracción predial asistida

Plataforma de operación documental para expedientes prediales: carga segura, extracción secuencial de estudios de títulos, planos y negociación, revisión humana, trazabilidad y exportación Excel.

## Estado

La aplicación, el esquema de datos, RLS, Storage privado, Edge Function, trabajador durable y despliegue de Render están implementados. Para procesar documentos reales solo se requiere configurar `OPENAI_API_KEY` (y confirmar el modelo en `AI_MODEL`). Sin esa clave, el worker permanece no listo y no consume trabajos de la cola.

## Desarrollo local

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Variables públicas del frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_DATA_MODE=supabase`

Nunca exponga `SUPABASE_SECRET_KEY` ni `OPENAI_API_KEY` en variables `VITE_*`.

## Componentes

```text
React/Vite
  ├─ Supabase Auth
  ├─ Postgres + RLS por expediente
  ├─ Storage privado + URLs firmadas
  └─ create-batch-job (Edge Function)
            └─ jobs con lease, idempotencia y reintentos
                  └─ worker Python / OpenAI Responses
                        └─ registros + atributos + evidencia + revisión
```

El trabajador carga cada archivo al proveedor de IA solo durante la extracción, solicita salida JSON validada, usa `store=false` y elimina el archivo remoto al terminar. No registra contenido legal en logs.

## Verificación

```powershell
npm run verify
$env:PYTHONPATH='worker'
.\worker\.venv\Scripts\python.exe -m unittest discover -s worker\tests -v
```

## Despliegue

- Supabase: aplicar `supabase/migrations/20260917062048_territorium_initial_schema.sql` y desplegar `create-batch-job`.
- Render: conectar el futuro repositorio y crear el Blueprint desde `render.yaml`.
- Configurar los secretos del worker: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `OPENAI_API_KEY` y `AI_MODEL`.
- Configurar `APP_ORIGINS` en la Edge Function con el dominio final.

El procedimiento operativo y de recuperación está en [docs/runbook-produccion.md](docs/runbook-produccion.md).
