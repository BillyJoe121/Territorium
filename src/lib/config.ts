import { z } from 'zod'

const schema = z.object({
  VITE_DATA_MODE: z.enum(['local', 'supabase']).default('supabase'),
  VITE_SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(10).optional().or(z.literal('')),
  VITE_MAX_UPLOAD_MB: z.coerce.number().int().positive().max(500).default(50),
  VITE_WORKER_URL: z.string().url().optional().or(z.literal('')),
})

const parsed = schema.safeParse(import.meta.env)
if (!parsed.success) throw new Error(`Configuración inválida: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`)

export const config = {
  dataMode: parsed.data.VITE_DATA_MODE,
  supabaseUrl: parsed.data.VITE_SUPABASE_URL || null,
  supabasePublishableKey: parsed.data.VITE_SUPABASE_PUBLISHABLE_KEY || null,
  maxUploadBytes: parsed.data.VITE_MAX_UPLOAD_MB * 1024 * 1024,
  // URL base del worker. En producción se configura en Render como VITE_WORKER_URL.
  // El fallback de cadena vacía fuerza rutas relativas (mismo origen) cuando no se define.
  workerUrl: (parsed.data.VITE_WORKER_URL || '').replace(/\/$/, ''),
}

export const hasRemoteConfiguration = Boolean(config.supabaseUrl && config.supabasePublishableKey)
