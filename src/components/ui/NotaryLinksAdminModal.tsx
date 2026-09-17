import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Link2, ShieldAlert, Calendar, User, Building, X, Ban, CheckCircle2 } from 'lucide-react'
import type { NotaryShareTokenPayload } from '../../lib/publicNotaryPortal'

export interface NotaryLinkRecord {
  payload: NotaryShareTokenPayload
  token: string
  isRevoked: boolean
  lastAccessedAt?: string
}

interface NotaryLinksAdminModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  links: NotaryLinkRecord[]
  onRevokeLink: (tokenId: string) => void
  disablePortal?: boolean
}

/**
 * US-295: Panel de administración y revocación inmediata de enlaces públicos externos.
 * Permite auditar tokens emitidos, vigencias, destinatarios y revocarlos en un solo clic.
 */
export const NotaryLinksAdminModal: React.FC<NotaryLinksAdminModalProps> = ({
  open,
  onOpenChange,
  links,
  onRevokeLink,
  disablePortal = false,
}) => {
  const PortalWrapper = disablePortal ? React.Fragment : Dialog.Portal

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <PortalWrapper>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl p-5 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/90 focus:outline-none">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-emerald-400" />
              <Dialog.Title className="text-sm font-semibold text-slate-100">
                Administración de Enlaces Notariales Externos (US-295)
              </Dialog.Title>
            </div>
            <Dialog.Close className="p-1 text-slate-400 hover:text-slate-200 rounded-lg">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-xs text-slate-400 mt-2">
            Consulte y revoque inmediatamente los accesos temporales concedidos a notarías y peritos.
          </Dialog.Description>

          <div className="space-y-2 mt-3 max-h-80 overflow-y-auto pr-1">
            {links.length > 0 ? (
              links.map((item) => {
                const isExpired = new Date() > new Date(item.payload.expiresAt)
                const isInactive = item.isRevoked || isExpired

                return (
                  <div
                    key={item.payload.tokenId}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                      item.isRevoked
                        ? 'bg-rose-950/20 border-rose-900/40 text-slate-400'
                        : isExpired
                        ? 'bg-amber-950/20 border-amber-900/40 text-slate-400'
                        : 'bg-slate-800/60 border-slate-750 text-slate-200'
                    }`}
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200 truncate">
                          {item.payload.recipientName}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-mono">
                          {item.payload.recipientOrganization}
                        </span>
                        {item.isRevoked ? (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Revocado
                          </span>
                        ) : isExpired ? (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Expirado
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Activo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                        <span>Creado: {new Date(item.payload.createdAt).toLocaleDateString()}</span>
                        <span>Vence: {new Date(item.payload.expiresAt).toLocaleDateString()}</span>
                        {item.lastAccessedAt && (
                          <span>Último acceso: {new Date(item.lastAccessedAt).toLocaleTimeString()}</span>
                        )}
                      </div>
                    </div>

                    {!item.isRevoked && !isExpired && (
                      <button
                        type="button"
                        onClick={() => onRevokeLink(item.payload.tokenId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 border border-rose-500/40 transition-colors"
                      >
                        <Ban className="w-3 h-3" />
                        Revocar
                      </button>
                    )}
                  </div>
                )
              })
            ) : (
              <p className="text-xs text-slate-500 text-center py-6">
                No hay enlaces externos generados recientemente.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end pt-3 mt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cerrar
            </button>
          </div>
        </Dialog.Content>
      </PortalWrapper>
    </Dialog.Root>
  )
}
