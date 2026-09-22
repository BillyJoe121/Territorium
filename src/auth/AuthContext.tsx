import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { dataMode, requireSupabase, supabase } from '../lib/supabase'

import type { SessionStatus } from '../types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  status: SessionStatus
  isRecovery: boolean
  clearRecovery(): void
  clearSessionExpired(): void
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string): Promise<'authenticated' | 'confirmation_required'>
  requestPasswordReset(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
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
  const [isRecovery, setIsRecovery] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.location.hash.includes('type=recovery')
  })
  const [localAuthenticated, setLocalAuthenticated] = useState(() => dataMode === 'local' && getLocalAuthenticationState())

  useEffect(() => {
    if (dataMode !== 'supabase' || !supabase) { setLoading(false); return }
    let mounted = true

    // Si la URL contiene access_token y refresh_token (o code de PKCE), establecer la sesión explícitamente
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace(/^#/, '')
      const hashParams = new URLSearchParams(hash)
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const isRec = hashParams.get('type') === 'recovery' || hash.includes('type=recovery')

      if (accessToken && refreshToken) {
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ data }) => {
            if (mounted && data.session) {
              setSession(data.session)
              if (isRec) setIsRecovery(true)
            }
          })
          .catch(() => {})
      }

      const queryParams = new URLSearchParams(window.location.search)
      const code = queryParams.get('code')
      if (code) {
        supabase.auth.exchangeCodeForSession(code)
          .then(({ data }) => {
            if (mounted && data.session) {
              setSession(data.session)
            }
          })
          .catch(() => {})
      }
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error) {
        console.warn('No se pudo recuperar la sesión de Supabase:', error.message)
        setIsExpired(true)
      }
      if (data.session) {
        setSession(data.session)
      }
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true)
      } else if (event === 'TOKEN_REFRESHED' && !nextSession) {
        setIsExpired(true)
      } else if (event === 'SIGNED_OUT') {
        setIsExpired(false)
        setIsRecovery(false)
      }
      if (nextSession) {
        setSession(nextSession)
      }
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
    isRecovery,
    clearRecovery() {
      setIsRecovery(false)
    },
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
      if (error) throw new Error(error.message || 'No fue posible iniciar sesión. Verifica tus credenciales.')
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
      if (error) throw new Error(error.message || 'No fue posible enviar el enlace de recuperación.')
    },
    async updatePassword(password) {
      if (dataMode === 'local') return
      const client = requireSupabase()
      let currentSession = (await client.auth.getSession()).data.session

      // Si no hay sesión activa en memoria/storage, intentar rescatarla del hash o de la URL
      if (!currentSession && typeof window !== 'undefined') {
        const hash = window.location.hash.replace(/^#/, '')
        const hashParams = new URLSearchParams(hash)
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (accessToken && refreshToken) {
          const { data: setRes, error: setErr } = await client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (!setErr && setRes.session) {
            currentSession = setRes.session
            setSession(setRes.session)
          }
        }

        const queryParams = new URLSearchParams(window.location.search)
        const code = queryParams.get('code')
        if (!currentSession && code) {
          const { data: exRes, error: exErr } = await client.auth.exchangeCodeForSession(code)
          if (!exErr && exRes.session) {
            currentSession = exRes.session
            setSession(exRes.session)
          }
        }
      }

      if (!currentSession) {
        throw new Error(
          'La sesión de recuperación ha caducado o el enlace ya fue utilizado. Solicita un nuevo enlace desde "Olvidé mi contraseña" o cambia tu contraseña directamente en el panel de Supabase.'
        )
      }

      const { error } = await client.auth.updateUser({ password })
      if (error) throw new Error(error.message || 'No fue posible actualizar la contraseña.')
      setIsRecovery(false)
      try {
        window.history.replaceState(null, '', window.location.pathname)
      } catch {
        // no-op
      }
    },
    async signOut() {
      setIsExpired(false)
      setIsRecovery(false)
      if (dataMode !== 'supabase' || !supabase) {
        setSession(null)
        setLocalAuthenticated(false)
        saveLocalAuthenticationState(false)
        return
      }
      const { error } = await requireSupabase().auth.signOut({ scope: 'local' })
      if (error) throw new Error('No fue posible cerrar la sesión.')
    },
  }), [isRecovery, loading, localAuthenticated, session, status])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return value
}
