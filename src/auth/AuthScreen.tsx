import { FormEvent, useEffect, useState } from 'react'
import { ArrowRight, KeyRound, LoaderCircle, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from './AuthContext'

type Mode = 'signin' | 'signup' | 'recovery' | 'update_password'

export function AuthScreen({ initialMode }: { initialMode?: Mode } = {}) {
  const { signIn, signUp, requestPasswordReset, updatePassword, clearRecovery, isRecovery } = useAuth()
  const [mode, setMode] = useState<Mode>(() => initialMode || (isRecovery ? 'update_password' : 'signin'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode)
      return
    }
    if (isRecovery) {
      setMode('update_password')
      return
    }
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (hash.includes('type=recovery')) {
      setMode('update_password')
    } else if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.replace(/^#/, ''))
      const errorCode = params.get('error_code')
      const errorDescription = params.get('error_description')

      if (errorCode === 'otp_expired' || errorDescription?.includes('expired') || errorDescription?.includes('invalid')) {
        setError('El enlace de confirmación ha expirado o ya fue utilizado. Puedes solicitar un nuevo enlace o iniciar sesión.')
      } else if (errorDescription) {
        setError(decodeURIComponent(errorDescription.replace(/\+/g, ' ')))
      }
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [initialMode, isRecovery])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null)
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')
    try {
      if (mode === 'signin') await signIn(email, password)
      if (mode === 'signup') {
        const result = await signUp(email, password)
        if (result === 'confirmation_required') setMessage('Revisa tu correo para confirmar la cuenta antes de ingresar.')
      }
      if (mode === 'recovery') { await requestPasswordReset(email); setMessage('Si la cuenta existe, recibirás un enlace de recuperación.') }
      if (mode === 'update_password') {
        const confirm = String(form.get('confirm_password') ?? '')
        if (password !== confirm) {
          throw new Error('Las contraseñas no coinciden. Por favor verifícalas.')
        }
        if (password.length < 10) {
          throw new Error('La contraseña debe tener al menos 10 caracteres.')
        }
        await updatePassword(password)
        setMessage('Contraseña actualizada exitosamente. Ingresando…')
        setTimeout(() => {
          clearRecovery()
        }, 1200)
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Ocurrió un error inesperado.') }
    finally { setBusy(false) }
  }

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand">
          <span className="auth-brand-icon" aria-hidden="true">T</span>
          <div className="auth-brand-wordmark">
            <strong>TERRITORIUM</strong>
            <small>Gestión predial, ordenamiento y derecho de tierras</small>
          </div>
        </div>

        <div className="auth-pitch">
          <p className="eyebrow">Información predial con trazabilidad</p>
          <h1>De documentos dispersos a decisiones verificables.</h1>
          <p>Carga, extrae y revisa la información jurídica y técnica de cada predio en un espacio privado.</p>
          <div className="auth-trust">
            <ShieldCheck size={20} aria-hidden="true" />
            <span>Archivos privados, permisos por expediente y auditoría de decisiones.</span>
          </div>
        </div>
      </section>

      <section className="auth-form-panel">
        <form className="auth-form" onSubmit={submit}>
          <div className="auth-form-heading">
            <p className="eyebrow">Acceso seguro</p>
            <h2>
              {mode === 'signin'
                ? 'Bienvenido de nuevo'
                : mode === 'signup'
                ? 'Crear cuenta'
                : mode === 'update_password'
                ? 'Establecer nueva contraseña'
                : 'Recuperar acceso'}
            </h2>
            <p>
              {mode === 'recovery'
                ? 'Te enviaremos instrucciones al correo registrado.'
                : mode === 'update_password'
                ? 'Ingresa tu nueva contraseña para ingresar a tu cuenta.'
                : 'Ingresa con tu cuenta de Territorium.'}
            </p>
          </div>

          {mode !== 'update_password' && (
            <label className="auth-field">
              <span>Correo electrónico</span>
              <div className="input-with-icon">
                <Mail size={17} aria-hidden="true" />
                <input name="email" type="email" autoComplete="email" required placeholder="nombre@empresa.com" />
              </div>
            </label>
          )}

          {mode !== 'recovery' && (
            <label className="auth-field">
              <span>{mode === 'update_password' ? 'Nueva contraseña' : 'Contraseña'}</span>
              <div className="input-with-icon">
                <KeyRound size={17} aria-hidden="true" />
                <input
                  name="password"
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  minLength={10}
                  required
                  placeholder="Mínimo 10 caracteres"
                />
              </div>
            </label>
          )}

          {mode === 'update_password' && (
            <label className="auth-field">
              <span>Confirmar nueva contraseña</span>
              <div className="input-with-icon">
                <KeyRound size={17} aria-hidden="true" />
                <input
                  name="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  required
                  placeholder="Repite la nueva contraseña"
                />
              </div>
            </label>
          )}

          {error && <div className="form-error" role="alert">{error}</div>}
          {message && <div className="form-success" role="status">{message}</div>}
          <button className="button primary auth-submit" type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />}
            {busy
              ? 'Procesando…'
              : mode === 'signin'
              ? 'Ingresar'
              : mode === 'signup'
              ? 'Crear cuenta'
              : mode === 'update_password'
              ? 'Guardar nueva contraseña'
              : 'Enviar enlace'}
          </button>
          <div className="auth-links">
            {mode === 'signin' ? (
              <>
                <button type="button" onClick={() => setMode('recovery')}>Olvidé mi contraseña</button>
                <button type="button" onClick={() => setMode('signup')}>Crear una cuenta</button>
              </>
            ) : mode === 'update_password' ? (
              <button type="button" onClick={() => { clearRecovery(); setMode('signin') }}>Cancelar y volver al inicio</button>
            ) : (
              <button type="button" onClick={() => setMode('signin')}>Volver al inicio de sesión</button>
            )}
          </div>
        </form>
      </section>
    </main>
  )
}
