import { FormEvent, useState } from 'react'
import { ArrowRight, KeyRound, LoaderCircle, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from './AuthContext'

type Mode = 'signin' | 'signup' | 'recovery'

export function AuthScreen() {
  const { signIn, signUp, requestPasswordReset } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

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
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Ocurrió un error inesperado.') }
    finally { setBusy(false) }
  }

  return <main className="auth-page">
    <section className="auth-brand-panel"><div className="auth-brand"><span className="auth-brand-icon">T</span><div><strong>TERRIT<span>O</span>RIUM</strong><small>GESTIÓN PREDIAL, ORDENAMIENTO Y DERECHO DE TIERRAS</small></div></div><div className="auth-pitch"><p className="eyebrow">INFORMACIÓN PREDIAL CON TRAZABILIDAD</p><h1>De documentos dispersos a decisiones verificables.</h1><p>Carga, extrae y revisa la información jurídica y técnica de cada predio en un espacio privado.</p><div className="auth-trust"><ShieldCheck size={20} /><span>Archivos privados, permisos por expediente y auditoría de decisiones.</span></div></div></section>
    <section className="auth-form-panel"><form className="auth-form" onSubmit={submit}><p className="eyebrow">ACCESO SEGURO</p><h2>{mode === 'signin' ? 'Bienvenido de nuevo' : mode === 'signup' ? 'Crear cuenta' : 'Recuperar acceso'}</h2><p>{mode === 'recovery' ? 'Te enviaremos instrucciones al correo registrado.' : 'Ingresa con tu cuenta de Territorium.'}</p>
      <label><span>Correo electrónico</span><div className="input-with-icon"><Mail size={17} /><input name="email" type="email" autoComplete="email" required placeholder="nombre@empresa.com" /></div></label>
      {mode !== 'recovery' && <label><span>Contraseña</span><div className="input-with-icon"><KeyRound size={17} /><input name="password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={10} required placeholder="Mínimo 10 caracteres" /></div></label>}
      {error && <div className="form-error" role="alert">{error}</div>}{message && <div className="form-success" role="status">{message}</div>}
      <button className="button primary auth-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />}{busy ? 'Procesando…' : mode === 'signin' ? 'Ingresar' : mode === 'signup' ? 'Crear cuenta' : 'Enviar enlace'}</button>
      <div className="auth-links">{mode === 'signin' ? <><button type="button" onClick={() => setMode('recovery')}>Olvidé mi contraseña</button><button type="button" onClick={() => setMode('signup')}>Crear una cuenta</button></> : <button type="button" onClick={() => setMode('signin')}>Volver al inicio de sesión</button>}</div>
    </form></section>
  </main>
}
