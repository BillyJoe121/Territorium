import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { dataMode, requireSupabase, supabase } from '../lib/supabase'

import type { SessionStatus } from '../types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  status: SessionStatus
  clearSessionExpired(): void
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string): Promise<'authenticated' | 'confirmation_required'>
  requestPasswordReset(email: string): Promise<void>
  signOut(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const LOCAL_AUTH_STORAGE_KEY = 'territorium.local-authenticated'

function getLocalAuthenticationState() {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(LOCAL_AUTH_STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

function saveLocalAuthenticationState(authenticated: boolean) {
  try {
    window.localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, String(authenticated))
  } catch {
    // The local workspace remains usable when browser storage is unavailable.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(dataMode === 'supabase')
  const [isExpired, setIsExpired] = useState(false)
  const [localAuthenticated, setLocalAuthenticated] = useState(() => dataMode === 'local' && getLocalAuthenticationState())

  useEffect(() => {
    if (dataMode !== 'supabase' || !supabase) { setLoading(false); return }
    let mounted = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error) {
        console.warn('No se pudo recuperar la sesión de Supabase:', error.message)
        setIsExpired(true)
      }
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'TOKEN_REFRESHED' && !nextSession) {
        setIsExpired(true)
      } else if (event === 'SIGNED_OUT') {
        setIsExpired(false)
      }
      setSession(nextSession)
      setLoading(false)
    })
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [])

  const status: SessionStatus = useMemo(() => {
    if (loading) return 'loading'
    if (isExpired) return 'session_expired'
    if (dataMode === 'local' && localAuthenticated) return 'authenticated'
    if (session) return 'authenticated'
    return 'unauthenticated'
  }, [isExpired, loading, localAuthenticated, session])

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    status,
    clearSessionExpired() {
      setIsExpired(false)
    },
    async signIn(email, password) {
      setIsExpired(false)
      if (dataMode === 'local') {
        if (!email.trim() || !password) throw new Error('Ingresa tu correo y contraseña para continuar.')
        setLocalAuthenticated(true)
        saveLocalAuthenticationState(true)
        return
      }
      const { error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw new Error('No fue posible iniciar sesión. Verifica tus credenciales.')
    },
    async signUp(email, password) {
      if (dataMode === 'local') {
        if (!email.trim() || !password) throw new Error('Ingresa tu correo y contraseña para continuar.')
        setLocalAuthenticated(true)
        saveLocalAuthenticationState(true)
        return 'authenticated'
      }
      const redirectTo = `${window.location.origin}/`
      const { data, error } = await requireSupabase().auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectTo } })
      if (error) throw new Error(error.message)
      return data.session ? 'authenticated' : 'confirmation_required'
    },
    async requestPasswordReset(email) {
      if (dataMode === 'local') {
        if (!email.trim()) throw new Error('Ingresa tu correo para continuar.')
        return
      }
      const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/` })
      if (error) throw new Error('No fue posible enviar el enlace de recuperación.')
    },
    async signOut() {
      setIsExpired(false)
      if (dataMode !== 'supabase' || !supabase) {
        setSession(null)
        setLocalAuthenticated(false)
        saveLocalAuthenticationState(false)
        return
      }
      const { error } = await requireSupabase().auth.signOut({ scope: 'local' })
      if (error) throw new Error('No fue posible cerrar la sesión.')
    },
  }), [loading, localAuthenticated, session, status])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return value
}
