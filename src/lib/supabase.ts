import { createClient } from '@supabase/supabase-js'
import { config, hasRemoteConfiguration } from './config'

export const isSupabaseConfigured = hasRemoteConfiguration
export const supabase = isSupabaseConfigured ? createClient(config.supabaseUrl!, config.supabasePublishableKey!, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: { headers: { 'x-client-info': 'territorium-web/0.2.0' } },
}) : null

/**
 * The local adapter keeps this MVP demonstrable before credentials exist. When
 * VITE_DATA_MODE=supabase, the UI must authenticate before calling the Edge Functions.
 */
export const dataMode = config.dataMode

export function requireSupabase() {
  if (!supabase) throw new Error('Supabase no está configurado. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.')
  return supabase
}
