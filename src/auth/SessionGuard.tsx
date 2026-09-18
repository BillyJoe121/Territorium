import { ReactNode } from 'react'
import { AlertOctagon, KeyRound, LoaderCircle, LogIn, RefreshCcw, ShieldAlert } from 'lucide-react'
import { useAuth } from './AuthContext'
import type { ProjectRole } from '../types'

interface SessionGuardProps {
  children: ReactNode
  requiredRole?: ProjectRole | ProjectRole[]
  currentRole?: ProjectRole
  onReauthenticate?: () => void
}

export function SessionGuard({ children, requiredRole, currentRole, onReauthenticate }: SessionGuardProps) {
  const { status, clearSessionExpired, signOut } = useAuth()

  if (status === 'loading') {
    return (
      <div className="loading-page" role="status" aria-live="polite">
        <LoaderCircle className="spin" size={32} />
        <div>
          <h2>Validando sesión segura</h2>
          <p>Verificando credenciales y permisos con el servidor de Territorium…</p>
        </div>
      </div>
    )
  }

  if (status === 'session_expired') {
    return (
      <main className="loading-page error-page" role="alert">
        <KeyRound size={40} className="warning-icon" />
        <h2>Sesión expirada</h2>
        <p>Por seguridad corporativa, tu sesión ha caducado tras un periodo de inactividad o actualización de credenciales.</p>
        <div className="guard-actions">
          <button
            className="button primary"
            onClick={() => {
              clearSessionExpired()
              if (onReauthenticate) onReauthenticate()
              else void signOut()
            }}
          >
            <LogIn size={17} />
            Iniciar sesión de nuevo
          </button>
        </div>
      </main>
    )
  }

  if (requiredRole && currentRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    const hasPermission = roles.includes(currentRole)

    if (!hasPermission) {
      const roleLabels: Record<ProjectRole, string> = {
        owner: 'Propietario / Administrador',
        operator: 'Operador predial',
        reviewer: 'Revisor jurídico',
        viewer: 'Consulta / Auditor',
        administrador: 'Administrador del sistema',
        operador: 'Operador técnico',
        analista_predial: 'Analista predial',
        revisor_juridico: 'Revisor jurídico',
        aprobador: 'Aprobador final',
        auditor: 'Auditor de cumplimiento',
      }

      return (
        <section className="card access-denied-card" role="alert">
          <ShieldAlert size={36} />
          <div>
            <p className="eyebrow">CONTROL DE ACCESO DE MÍNIMO PRIVILEGIO</p>
            <h2>Acceso denegado</h2>
            <p>
              Tu rol actual en este expediente es <strong>{roleLabels[currentRole] ?? currentRole}</strong>, pero esta operación requiere uno de los siguientes roles:{' '}
              <strong>{roles.map((r) => roleLabels[r] ?? r).join(', ')}</strong>.
            </p>
            <small>Si necesitas permisos para esta acción, solicita la actualización de tu rol al administrador del expediente.</small>
          </div>
        </section>
      )
    }
  }

  return <>{children}</>
}

export function AccessDeniedNotice({ message, roleNeeded }: { message?: string; roleNeeded?: string }) {
  return (
    <div className="warning" role="alert">
      <AlertOctagon size={20} />
      <div>
        <strong>Permisos insuficientes</strong>
        <p>{message ?? 'No tienes permisos suficientes para realizar esta acción en el expediente.'}</p>
        {roleNeeded && <small>Rol requerido: {roleNeeded}</small>}
      </div>
    </div>
  )
}
