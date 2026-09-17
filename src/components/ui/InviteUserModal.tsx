import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { UserPlus, Mail, Shield, Check, X, AlertCircle } from 'lucide-react'
import type { ProjectRole } from '../../types'

interface InviteUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvite: (data: { email: string; name: string; role: ProjectRole }) => Promise<void>
  projectName?: string
  disablePortal?: boolean
}

const ROLES_INFO: { role: ProjectRole; label: string; desc: string }[] = [
  { role: 'reviewer', label: 'Revisor Jurídico', desc: 'Edición inline de atributos, marcas de discrepancia y aprobación predial.' },
  { role: 'operator', label: 'Operador Ingesta', desc: 'Carga de lotes documentales, validación de manifiesto y exportaciones.' },
  { role: 'owner', label: 'Líder / Administrador', desc: 'Configuración de prompts, asignación de equipo y gestión de enlaces externos.' },
  { role: 'viewer', label: 'Consultor / Auditor', desc: 'Acceso de solo lectura y descarga de libros de trazabilidad forense.' },
]

/**
 * US-267: Modal de invitación de usuarios corporativos con validación en tiempo real de sintaxis de correo.
 */
export const InviteUserModal: React.FC<InviteUserModalProps> = ({
  open,
  onOpenChange,
  onInvite,
  projectName,
  disablePortal = false,
}) => {
  const PortalWrapper = disablePortal ? React.Fragment : Dialog.Portal
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<ProjectRole>('reviewer')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
  const isFormValid = email.trim().length > 0 && isValidEmail(email) && name.trim().length > 1

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) return
    setIsSubmitting(true)
    setErrorMsg('')
    try {
      await onInvite({ email: email.trim().toLowerCase(), name: name.trim(), role })
      setEmail('')
      setName('')
      setRole('reviewer')
      onOpenChange(false)
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al enviar invitación')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <PortalWrapper>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md p-5 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/90 focus:outline-none">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-400" />
              <Dialog.Title className="text-sm font-semibold text-slate-100">
                Invitar Miembro al Proyecto
              </Dialog.Title>
            </div>
            <Dialog.Close className="p-1 text-slate-400 hover:text-slate-200 rounded-lg">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-xs text-slate-400 mt-2">
            Asigne permisos institucionales para el proyecto {projectName ? <strong>{projectName}</strong> : 'seleccionado'}.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-3.5 mt-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">Nombre Completo</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dra. Carolina Martínez"
                className="w-full px-3 py-2 text-xs bg-slate-800/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">Correo Corporativo</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="carolina.martinez@abogados.com"
                  className={`w-full pl-8 pr-8 py-2 text-xs bg-slate-800/80 border rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none ${
                    email.length > 0 && !isValidEmail(email)
                      ? 'border-rose-500 focus:border-rose-400'
                      : 'border-slate-700 focus:border-emerald-500'
                  }`}
                />
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                {email.length > 0 && (
                  <span className="absolute right-2.5 top-2.5">
                    {isValidEmail(email) ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    )}
                  </span>
                )}
              </div>
              {email.length > 0 && !isValidEmail(email) && (
                <p className="text-[10px] text-rose-400 mt-1">Formato de correo electrónico inválido</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1.5">Rol Institucional (RBAC)</label>
              <div className="space-y-1.5">
                {ROLES_INFO.map((r) => (
                  <div
                    key={r.role}
                    onClick={() => setRole(r.role)}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border transition-colors cursor-pointer select-none ${
                      role === r.role
                        ? 'bg-slate-800 border-emerald-500/50 text-slate-100'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="mt-0.5 text-emerald-400">
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${role === r.role ? 'border-emerald-400 bg-emerald-500/20' : 'border-slate-600'}`}>
                        {role === r.role && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-200">{r.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{r.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-400 p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg">
                {errorMsg}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-950"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Enviando...' : 'Enviar Invitación'}</span>
              </button>
            </div>
          </form>
        </Dialog.Content>
      </PortalWrapper>
    </Dialog.Root>
  )
}
