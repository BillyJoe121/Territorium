import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Share2, Copy, Check, Clock, Building, X, ExternalLink } from 'lucide-react'
import { generateNotaryShareToken } from '../../lib/publicNotaryPortal'

interface ShareNotaryLinkModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  propertyId?: string
  propertyName?: string
}

export function ShareNotaryLinkModal({
  open,
  onOpenChange,
  projectId,
  propertyId,
  propertyName = 'Predio en revisión',
}: ShareNotaryLinkModalProps) {
  const [recipientName, setRecipientName] = useState('')
  const [recipientOrg, setRecipientOrg] = useState('')
  const [durationHours, setDurationHours] = useState(48)
  const [generatedUrl, setGeneratedUrl] = useState('')
  const [copied, setCopied] = useState(false)

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipientName.trim() || !recipientOrg.trim()) return

    const { token } = generateNotaryShareToken({
      projectId,
      propertyId,
      recipientName,
      recipientOrganization: recipientOrg,
      durationHours,
    })

    const fullUrl = `${window.location.origin}/#/public/portal/${token}`
    setGeneratedUrl(fullUrl)
    setCopied(false)
  }

  const copyToClipboard = () => {
    if (!generatedUrl) return
    navigator.clipboard.writeText(generatedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClose = () => {
    setGeneratedUrl('')
    setRecipientName('')
    setRecipientOrg('')
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="radix-dialog-overlay" />
        <Dialog.Content className="radix-dialog-content">
          <div className="radix-dialog-header">
            <div className="radix-dialog-icon primary">
              <Share2 size={20} />
            </div>
            <div>
              <Dialog.Title className="radix-dialog-title">
                Generar Enlace para Notaría o Tercero
              </Dialog.Title>
              <Dialog.Description className="radix-dialog-description">
                Crea un acceso temporal seguro para que una notaría o perito revise {propertyName} sin requerir cuenta en la plataforma.
              </Dialog.Description>
            </div>
          </div>

          {!generatedUrl ? (
            <form onSubmit={handleGenerate} className="share-notary-form">
              <div className="form-group">
                <label htmlFor="recipient-name">Nombre del Funcionario Destinatario *</label>
                <input
                  id="recipient-name"
                  type="text"
                  className="form-control"
                  placeholder="Ej. Dr. Mauricio Gómez"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="recipient-org">Notaría o Despacho *</label>
                <input
                  id="recipient-org"
                  type="text"
                  className="form-control"
                  placeholder="Ej. Notaría 45 de Bogotá"
                  value={recipientOrg}
                  onChange={(e) => setRecipientOrg(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="duration-hours">Tiempo de Vigencia del Enlace</label>
                <select
                  id="duration-hours"
                  className="form-control"
                  value={durationHours}
                  onChange={(e) => setDurationHours(Number(e.target.value))}
                >
                  <option value={24}>24 horas (1 día)</option>
                  <option value={48}>48 horas (2 días)</option>
                  <option value={168}>7 días (1 semana)</option>
                  <option value={720}>30 días (1 mes)</option>
                </select>
              </div>

              <div className="radix-dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={handleClose}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <Share2 size={16} /> Generar Enlace Seguro
                </button>
              </div>
            </form>
          ) : (
            <div className="generated-link-box">
              <div className="alert-banner success">
                ¡Enlace generado exitosamente! Válido por {durationHours} horas.
              </div>
              <div className="link-input-group">
                <input type="text" readOnly className="form-control font-mono" value={generatedUrl} />
                <button type="button" className="btn btn-primary" onClick={copyToClipboard}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <div className="link-meta-hint">
                <Clock size={14} />
                <span>Caduca automáticamente al expirar. Puedes revocarlo en cualquier momento desde Configuración.</span>
              </div>
              <div className="radix-dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={handleClose}>
                  Cerrar
                </button>
                <a
                  href={generatedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary"
                >
                  <ExternalLink size={16} /> Probar portal
                </a>
              </div>
            </div>
          )}

          <Dialog.Close asChild>
            <button type="button" className="radix-dialog-close" aria-label="Cerrar">
              <X size={16} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
