import React, { useState } from 'react'
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Copy,
  ExternalLink,
  Key,
  Lock,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react'
import type { Project, PropertyRecord } from '../../types'
import { PageHeader } from '../common/PageHeader'
import { StatusBadge } from '../common/StatusBadge'
import { generateNotaryShareToken, revokeNotaryShareToken } from '../../lib/publicNotaryPortal'

export interface NotaryLinkItem {
  tokenId: string
  propertyCode: string
  recipientName: string
  organization: string
  role: string
  expiresAt: string
  isRevoked: boolean
  token: string
}

export interface NotaryPortalAdminViewProps {
  project?: Project
  projects?: Project[]
  records?: PropertyRecord[]
  links?: any[]
  activeProjectId?: string
  onCreateLink?: (newLink: any) => void
  onRevokeLink?: (tokenId: string) => void
  onOpenPortalModal?: () => void
}

export function NotaryPortalAdminView({
  project,
  projects,
  records = [],
  links: externalLinks,
  activeProjectId,
  onCreateLink,
  onRevokeLink,
  onOpenPortalModal,
}: NotaryPortalAdminViewProps) {
  const resolvedProject = project || projects?.find((p) => p.id === activeProjectId) || {
    id: activeProjectId || 'PRJ-DEMO',
    name: 'Expediente Territorial',
  }

  // Lista de enlaces creados
  const [internalLinks, setInternalLinks] = useState<NotaryLinkItem[]>([
    {
      tokenId: 'tok-notary-01',
      propertyCode: 'SAN-CIM-036',
      recipientName: 'Dr. Mario Gómez Rincón',
      organization: 'Notaría 45 de Bogotá',
      role: 'notario',
      expiresAt: new Date(Date.now() + 20 * 3600 * 1000).toISOString(),
      isRevoked: false,
      token: 'ttm_ext_demo_token_1.mock_hmac_valid_hash',
    },
    {
      tokenId: 'tok-notary-02',
      propertyCode: 'SAN-CIM-040',
      recipientName: 'Dra. Claudia Morales',
      organization: 'Notaría Única de Cimitarra',
      role: 'notario',
      expiresAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      isRevoked: true,
      token: 'ttm_ext_demo_token_2.mock_hmac_revoked_hash',
    },
  ])

  const links: NotaryLinkItem[] = externalLinks
    ? externalLinks.map((l: any) => ({
        tokenId: l.payload?.tokenId || l.tokenId,
        propertyCode: l.payload?.propertyId || l.propertyCode || 'SAN-CIM-036',
        recipientName: l.payload?.recipientName || l.recipientName,
        organization: l.payload?.recipientOrganization || l.organization,
        role: l.payload?.role || l.role,
        expiresAt: l.payload?.expiresAt || l.expiresAt,
        isRevoked: l.isRevoked ?? false,
        token: l.token || '',
      }))
    : internalLinks

  // Formulario de creación
  const [selectedProperty, setSelectedProperty] = useState(records[0]?.name ?? 'SAN-CIM-036')
  const [recipientName, setRecipientName] = useState('')
  const [organization, setOrganization] = useState('')
  const [durationHours, setDurationHours] = useState('24')
  const [role, setRole] = useState<'notario' | 'perito' | 'consultor'>('notario')
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  function handleCreateLink(e: React.FormEvent) {
    e.preventDefault()
    if (!recipientName.trim() || !organization.trim()) return

    const { token, payload } = generateNotaryShareToken({
      projectId: resolvedProject.id,
      propertyId: selectedProperty,
      recipientName: recipientName.trim(),
      recipientOrganization: organization.trim(),
      role,
      durationHours: Number(durationHours) || 24,
    })

    const newLink: NotaryLinkItem = {
      tokenId: payload.tokenId,
      propertyCode: selectedProperty,
      recipientName: payload.recipientName,
      organization: payload.recipientOrganization,
      role: payload.role,
      expiresAt: payload.expiresAt,
      isRevoked: false,
      token,
    }

    if (onCreateLink) {
      onCreateLink({
        payload,
        token,
        isRevoked: false,
        lastAccessedAt: new Date().toISOString(),
      })
    } else {
      setInternalLinks([newLink, ...internalLinks])
    }

    setRecipientName('')
    setOrganization('')
  }

  function handleRevoke(tokenId: string) {
    if (onRevokeLink) {
      onRevokeLink(tokenId)
    } else {
      setInternalLinks((prev) =>
        prev.map((l) => (l.tokenId === tokenId ? { ...l, isRevoked: true } : l))
      )
    }
  }

  function handleCopy(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/#/public/portal/${token}`)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2500)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Acceso Seguro para Notarías y Peritos Externos"
        title="Portal Notarial y Enlaces Externos"
        description={`Emisión, revocación y auditoría de enlaces seguros protegidos con token criptográfico HMAC-SHA256 y desafío OTP de 6 dígitos.`}
        actions={
          <div className="flex items-center gap-2">
            {onOpenPortalModal && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onOpenPortalModal}
              >
                <Share2 size={14} /> Compartir Enlace Rápido
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna 1: Formulario de Emisión */}
        <div className="card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[#182230] border-b border-[#E4E7EC] pb-2 flex items-center gap-2">
            <Key size={15} className="text-[#2459D3]" />
            Generar Enlace Seguro
          </h3>

          <form onSubmit={handleCreateLink} className="space-y-3 text-xs">
            <div>
              <label className="block text-[#526071] mb-1 font-medium">Predio a Compartir:</label>
              <select
                className="w-full p-2.5 rounded-md border border-[#E4E7EC] bg-white text-xs text-[#182230]"
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
              >
                {records.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name} ({r.folio || 'Sin folio'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[#526071] mb-1 font-medium">Nombre del Destinatario:</label>
              <input
                type="text"
                className="w-full p-2.5 rounded-md border border-[#98A2B3] bg-white text-xs"
                placeholder="Ej: Dr. Roberto Méndez"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-[#526071] mb-1 font-medium">Notaría / Entidad:</label>
              <input
                type="text"
                className="w-full p-2.5 rounded-md border border-[#98A2B3] bg-white text-xs"
                placeholder="Ej: Notaría Primera de Vélez"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[#526071] mb-1 font-medium">Rol:</label>
                <select
                  className="w-full p-2.5 rounded-md border border-[#E4E7EC] bg-white text-xs"
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                >
                  <option value="notario">Notario</option>
                  <option value="perito">Perito</option>
                  <option value="consultor">Consultor</option>
                </select>
              </div>

              <div>
                <label className="block text-[#526071] mb-1 font-medium">Vigencia:</label>
                <select
                  className="w-full p-2.5 rounded-md border border-[#E4E7EC] bg-white text-xs"
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                >
                  <option value="4">4 Horas</option>
                  <option value="12">12 Horas</option>
                  <option value="24">24 Horas</option>
                  <option value="48">48 Horas</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button type="submit" className="btn btn-primary btn-sm w-full">
                <Plus size={14} /> Emitir Token Criptográfico
              </button>
            </div>
          </form>

          <div className="p-3 bg-[#F1F3F6] rounded-md text-[11px] text-[#526071] space-y-1">
            <span className="font-semibold text-[#182230] block">Parámetros de Seguridad:</span>
            <p>• Los tokens están firmados con clave HMAC y caducan automáticamente.</p>
            <p>• Se exige código OTP de 6 dígitos enviado al correo oficial de la notaría.</p>
          </div>
        </div>

        {/* Columna 2 y 3: Tabla de Enlaces Emitidos y Acciones */}
        <div className="lg:col-span-2 card p-0 overflow-hidden">
          <div className="p-4 border-b border-[#E4E7EC] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#182230]">
              Enlaces Notariales Emitidos ({links.length})
            </h3>
            <span className="text-xs text-[#667085]">Revocación con efecto inmediato</span>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Predio</th>
                  <th>Destinatario</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {links.map((item) => (
                  <tr key={item.tokenId}>
                    <td>
                      <strong className="text-xs font-semibold text-[#182230] block">
                        {item.propertyCode}
                      </strong>
                    </td>
                    <td className="text-xs">
                      <span className="font-medium text-[#182230] block">{item.recipientName}</span>
                      <span className="text-[#667085] text-[11px]">{item.organization}</span>
                    </td>
                    <td className="text-xs text-[#526071] tabular-nums">
                      {new Date(item.expiresAt).toLocaleString('es-CO')}
                    </td>
                    <td>
                      <StatusBadge
                        status={item.isRevoked ? 'cancelado' : 'aprobado'}
                        label={item.isRevoked ? 'Revocado' : 'Activo'}
                      />
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {!item.isRevoked && (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              title="Copiar enlace directo"
                              onClick={() => handleCopy(item.token)}
                            >
                              <Copy size={12} />
                              {copiedToken === item.token ? 'Copiado' : 'Copiar'}
                            </button>
                            <a
                              href={`/#/public/portal/${item.token}`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-secondary btn-sm"
                              title="Probar en pestaña externa"
                            >
                              <ExternalLink size={12} />
                            </a>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              title="Revocar acceso inmediatamente"
                              onClick={() => handleRevoke(item.tokenId)}
                            >
                              Revocar
                            </button>
                          </>
                        )}
                        {item.isRevoked && (
                          <span className="text-xs text-[#667085] italic">Inactivo</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
