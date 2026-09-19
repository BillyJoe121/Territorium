import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, Check, CheckCircle2, ShieldCheck, Sparkles, X } from 'lucide-react'
import type { AiRevisionProposal } from '../../lib/expedienteAiRevisionGuard'

interface AiRevisionProposalModalProps {
  open: boolean
  proposal: AiRevisionProposal | null
  userComment: string
  onOpenChange: (open: boolean) => void
  onAccept: (proposal: AiRevisionProposal) => void
  onDiscard: () => void
}

export function AiRevisionProposalModal({
  open,
  proposal,
  userComment,
  onOpenChange,
  onAccept,
  onDiscard,
}: AiRevisionProposalModalProps) {
  if (!proposal) return null

  const isGuardClean = proposal.guardianResult.passed

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="expediente-modal-overlay" />
        <Dialog.Content
          className="expediente-review-modal"
          style={{ maxWidth: '880px', width: '92vw' }}
          aria-describedby="ai-proposal-description"
        >
          <header className="expediente-modal-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="expediente-modal-kicker">Revisión Asistida por IA</span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: 600,
                    backgroundColor: isGuardClean ? 'rgba(30, 77, 43, 0.12)' : 'rgba(217, 83, 79, 0.15)',
                    color: isGuardClean ? '#1B4D2E' : '#A82D2A',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {isGuardClean ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
                  {isGuardClean ? 'Campos estructurados protegidos' : 'Alerta: Violación de integridad'}
                </span>
              </div>
              <Dialog.Title style={{ fontSize: '1.25rem', fontWeight: 700, margin: '4px 0' }}>
                Propuesta de ajuste documental (v{proposal.sourceVersion} → v{proposal.proposedVersion})
              </Dialog.Title>
              <p id="ai-proposal-description" style={{ fontSize: '0.85rem', color: '#666', margin: 0 }}>
                La versión actual no ha sido modificada. Revisa los cambios propuestos en las consideraciones antes de aceptar.
              </p>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="expediente-modal-close" aria-label="Cerrar modal" onClick={onDiscard}>
                <X size={18} />
              </button>
            </Dialog.Close>
          </header>

          <div className="expediente-review-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* User prompt context */}
            <div
              style={{
                backgroundColor: '#F8F9FA',
                border: '1px solid #E9ECEF',
                borderRadius: '8px',
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6C757D', fontWeight: 700, marginBottom: '4px' }}>
                Solicitud del analista
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#212529', fontStyle: 'italic' }}>
                “{userComment}”
              </p>
            </div>

            {/* Guardian summary */}
            {!isGuardClean && (
              <div
                style={{
                  backgroundColor: '#FFF5F5',
                  border: '1px solid #FFC9C9',
                  borderRadius: '8px',
                  padding: '12px 14px',
                }}
                role="alert"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#C92A2A', fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>
                  <AlertTriangle size={16} />
                  El guardián bloqueó la adopción automática
                </div>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#495057' }}>
                  {proposal.guardianResult.summary}
                </p>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.82rem', color: '#C92A2A' }}>
                  {proposal.guardianResult.violations.map((v, idx) => (
                    <li key={idx}>
                      <strong>{v.fieldName}</strong>: Original “{v.originalValue}” vs Propuesto “{v.proposedValue}”
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Side-by-side comparison */}
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px', color: '#1B365D' }}>
                Comparación de consideraciones jurídicas (Sección 5):
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div
                  style={{
                    backgroundColor: '#FAFAFA',
                    border: '1px solid #DEE2E6',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6C757D', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Texto actual (v{proposal.sourceVersion})
                  </div>
                  <div style={{ fontSize: '0.85rem', lineHeight: '1.5', color: '#495057', whiteSpace: 'pre-wrap' }}>
                    {proposal.previousNarrative || '(Sin texto previo)'}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: '#F3F9F4',
                    border: '1px solid #C3E6CB',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1E4D2B', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles size={12} />
                    Propuesta de la IA (v{proposal.proposedVersion})
                  </div>
                  <div style={{ fontSize: '0.85rem', lineHeight: '1.5', color: '#155724', whiteSpace: 'pre-wrap' }}>
                    {proposal.proposedNarrative}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <footer className="expediente-modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid #E9ECEF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              className="expediente-secondary-action"
              onClick={() => {
                onDiscard()
                onOpenChange(false)
              }}
            >
              <X size={15} />
              Descartar propuesta
            </button>

            <button
              type="button"
              className="expediente-primary-action"
              disabled={!isGuardClean}
              title={!isGuardClean ? 'No puedes aceptar una propuesta que modifique campos protegidos' : undefined}
              onClick={() => {
                onAccept(proposal)
                onOpenChange(false)
              }}
            >
              <Check size={16} />
              Aceptar propuesta (v{proposal.proposedVersion})
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
