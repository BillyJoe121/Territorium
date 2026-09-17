import { FormEvent, useEffect, useState } from 'react'
import { CheckCircle2, KeyRound, LoaderCircle, Mail, RefreshCw, Shield, ShieldAlert, ShieldCheck, UserCheck, UserMinus, UserPlus, Users } from 'lucide-react'
import type { Project, ProjectMember, ProjectRole } from '../types'
import { addProjectMember, inviteOrRecoverUser, listProjectMembers, removeProjectMember, updateMemberRole } from '../data/platformRepository'
import { dataMode } from '../lib/supabase'

interface UsersManagementViewProps {
  project: Project
  onNotice: (message: string) => void
  onError: (error: string) => void
}

const roleDescriptions: Record<ProjectRole, { label: string; desc: string; color: string }> = {
  owner: {
    label: 'Propietario / Administrador',
    desc: 'Control total del expediente, gestión de participantes y configuración de prompts.',
    color: '#168b40',
  },
  operator: {
    label: 'Operador predial',
    desc: 'Carga lotes documentales, inicia ejecuciones del worker y reintenta procesos.',
    color: '#2871a9',
  },
  reviewer: {
    label: 'Revisor jurídico',
    desc: 'Revisa extracciones, edita atributos con trazabilidad y aprueba/devuelve predios.',
    color: '#a45d12',
  },
  viewer: {
    label: 'Auditor / Consulta',
    desc: 'Acceso de solo lectura para auditoría y descarga de exportaciones aprobadas.',
    color: '#5e655e',
  },
}

export function UsersManagementView({ project, onNotice, onError }: UsersManagementViewProps) {
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<ProjectRole>('reviewer')

  const isOwner = dataMode === 'local' || project.role === 'owner'

  async function loadMembers() {
    setLoading(true)
    try {
      if (dataMode === 'local') {
        setMembers([
          {
            userId: 'local-owner-01',
            projectId: project.id,
            email: 'admin@territorium.com',
            role: 'owner',
            createdAt: project.createdAt,
            isActive: true,
          },
          {
            userId: 'local-reviewer-02',
            projectId: project.id,
            email: 'abogado.revisor@territorium.com',
            role: 'reviewer',
            createdAt: project.createdAt,
            isActive: true,
          },
          {
            userId: 'local-operator-03',
            projectId: project.id,
            email: 'operador.predial@territorium.com',
            role: 'operator',
            createdAt: project.createdAt,
            isActive: true,
          },
        ])
      } else {
        const data = await listProjectMembers(project.id)
        setMembers(data)
      }
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'No fue posible cargar los miembros.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMembers()
  }, [project.id])

  async function handleInvite(event: FormEvent) {
    event.preventDefault()
    if (!inviteEmail.trim()) return

    setBusyAction('invite')
    try {
      if (dataMode === 'local') {
        const newMember: ProjectMember = {
          userId: `local-user-${crypto.randomUUID().slice(0, 8)}`,
          projectId: project.id,
          email: inviteEmail.trim(),
          role: inviteRole,
          createdAt: new Date().toISOString(),
          isActive: true,
        }
        setMembers((current) => [...current, newMember])
        onNotice(`Invitación simulada enviada a ${inviteEmail} con rol de ${roleDescriptions[inviteRole].label}.`)
      } else {
        const res = await inviteOrRecoverUser({
          action: 'invite',
          email: inviteEmail.trim(),
          role: inviteRole,
          projectId: project.id,
        })
        onNotice(res.message)
        await loadMembers()
      }
      setInviteEmail('')
      setShowInviteModal(false)
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Error al invitar al usuario.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleRoleChange(userId: string, newRole: ProjectRole) {
    setBusyAction(`role:${userId}`)
    try {
      if (dataMode === 'local') {
        setMembers((current) =>
          current.map((m) => (m.userId === userId ? { ...m, role: newRole } : m))
        )
        onNotice(`Rol actualizado a ${roleDescriptions[newRole].label}.`)
      } else {
        await updateMemberRole(project.id, userId, newRole)
        onNotice(`Rol actualizado exitosamente a ${roleDescriptions[newRole].label}.`)
        await loadMembers()
      }
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'No se pudo actualizar el rol.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleRemoveMember(userId: string, email?: string) {
    if (!confirm(`¿Revocar acceso al expediente para ${email ?? 'este usuario'}?`)) return

    setBusyAction(`remove:${userId}`)
    try {
      if (dataMode === 'local') {
        setMembers((current) => current.filter((m) => m.userId !== userId))
        onNotice('Acceso revocado correctamente.')
      } else {
        await removeProjectMember(project.id, userId)
        onNotice('Acceso revocado correctamente.')
        await loadMembers()
      }
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'No se pudo revocar el acceso.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleSendRecovery(email?: string) {
    if (!email) return
    setBusyAction(`recover:${email}`)
    try {
      if (dataMode === 'local') {
        onNotice(`Enlace de recuperación seguro enviado al correo de ${email}.`)
      } else {
        const res = await inviteOrRecoverUser({
          action: 'recover',
          email,
          projectId: project.id,
        })
        onNotice(res.message)
      }
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Error al enviar recuperación.')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="users-management-view">
      <div className="intro">
        <p className="eyebrow">{project.name.toUpperCase()} · SEGURIDAD Y ACCESO</p>
        <h2>Participantes y roles de mínimo privilegio</h2>
        <p>
          Administra quién puede operar, revisar o consultar este expediente. Aplica el principio de mínimo privilegio para proteger los datos jurídicos y la trazabilidad de decisiones.
        </p>
      </div>

      <div className="two-column">
        <section className="card">
          <div className="section-title">
            <div>
              <p className="eyebrow">EQUIPO DEL EXPEDIENTE</p>
              <h3>Miembros autorizados ({members.length})</h3>
            </div>
            {isOwner && (
              <button
                className="button primary small"
                onClick={() => setShowInviteModal(true)}
                disabled={busyAction !== null}
              >
                <UserPlus size={16} />
                Invitar usuario
              </button>
            )}
          </div>

          {loading ? (
            <div className="loading-card">
              <LoaderCircle className="spin" size={20} />
              Cargando participantes…
            </div>
          ) : members.length === 0 ? (
            <div className="empty-state">
              <Users size={20} />
              <span>No hay otros miembros registrados en este expediente.</span>
            </div>
          ) : (
            <div className="members-list">
              {members.map((member) => {
                const roleInfo = roleDescriptions[member.role] ?? roleDescriptions.viewer
                const isItemBusy = busyAction?.includes(member.userId) || busyAction?.includes(member.email ?? '')

                return (
                  <div className="member-item list-row" key={member.userId}>
                    <div className="file-icon" style={{ color: roleInfo.color }}>
                      <Shield size={18} />
                    </div>
                    <div className="grow">
                      <strong>{member.email ?? `Usuario ${member.userId.slice(0, 8)}`}</strong>
                      <small>
                        Asignado el {new Date(member.createdAt).toLocaleDateString('es-CO')} ·{' '}
                        <span style={{ color: roleInfo.color, fontWeight: 700 }}>{roleInfo.label}</span>
                      </small>
                    </div>

                    <div className="member-actions">
                      {isOwner ? (
                        <>
                          <label className="role-select-label">
                            <span className="sr-only">Rol</span>
                            <select
                              value={member.role}
                              disabled={isItemBusy}
                              onChange={(e) => void handleRoleChange(member.userId, e.target.value as ProjectRole)}
                            >
                              <option value="owner">Propietario / Admin</option>
                              <option value="operator">Operador predial</option>
                              <option value="reviewer">Revisor jurídico</option>
                              <option value="viewer">Auditor / Consulta</option>
                            </select>
                          </label>

                          {member.email && (
                            <button
                              className="icon-button"
                              title="Enviar enlace seguro de recuperación de acceso (sin compartir contraseñas)"
                              disabled={isItemBusy}
                              onClick={() => void handleSendRecovery(member.email)}
                            >
                              <KeyRound size={16} />
                            </button>
                          )}

                          <button
                            className="icon-button danger"
                            title="Revocar acceso al expediente"
                            disabled={isItemBusy}
                            onClick={() => void handleRemoveMember(member.userId, member.email)}
                          >
                            <UserMinus size={16} />
                          </button>
                        </>
                      ) : (
                        <span className={`status ${member.role}`}>{roleInfo.label}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="card emphasis">
          <div className="section-title">
            <div>
              <p className="eyebrow">POLÍTICA DE PRIVILEGIOS</p>
              <h3>Matriz de roles y permisos</h3>
            </div>
          </div>

          <div className="roles-matrix">
            {(Object.entries(roleDescriptions) as [ProjectRole, typeof roleDescriptions[ProjectRole]][]).map(
              ([key, info]) => (
                <div className="role-card" key={key}>
                  <div className="role-header">
                    <span className="mode-dot" style={{ background: info.color }} />
                    <strong>{info.label}</strong>
                  </div>
                  <p>{info.desc}</p>
                </div>
              )
            )}
          </div>

          <div className="security-guarantee">
            <ShieldCheck size={18} />
            <small>
              Territorium hace cumplir estos permisos a nivel de base de datos mediante 30+ políticas Row-Level Security (RLS). Las credenciales nunca se transmiten por canales no cifrados ni se comparten entre usuarios.
            </small>
          </div>
        </section>
      </div>

      {showInviteModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="invite-modal-title">
          <div className="card modal-card">
            <div className="section-title">
              <div>
                <p className="eyebrow">INVITACIÓN SEGURA</p>
                <h3 id="invite-modal-title">Invitar usuario al expediente</h3>
              </div>
              <button className="text-button" onClick={() => setShowInviteModal(false)}>
                ✕
              </button>
            </div>

            <p className="modal-desc">
              El usuario recibirá un enlace directo y privado en su correo para registrarse o ingresar sin que tengas que compartir contraseñas provisionales.
            </p>

            <form onSubmit={handleInvite}>
              <label className="form-label">
                <span>Correo electrónico corporativo</span>
                <div className="input-with-icon">
                  <Mail size={16} />
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="abogado@empresa.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
              </label>

              <label className="form-label">
                <span>Rol de mínimo privilegio</span>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as ProjectRole)}
                >
                  <option value="reviewer">Revisor jurídico (Recomendado para abogados)</option>
                  <option value="operator">Operador predial (Para carga y ejecución)</option>
                  <option value="viewer">Auditor / Consulta (Solo lectura)</option>
                  <option value="owner">Propietario / Co-administrador</option>
                </select>
                <small className="field-hint">{roleDescriptions[inviteRole].desc}</small>
              </label>

              <div className="modal-buttons">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setShowInviteModal(false)}
                  disabled={busyAction !== null}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="button primary"
                  disabled={busyAction !== null || !inviteEmail.trim()}
                >
                  {busyAction === 'invite' ? <LoaderCircle className="spin" size={16} /> : <UserCheck size={16} />}
                  {busyAction === 'invite' ? 'Enviando invitación…' : 'Enviar invitación segura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
