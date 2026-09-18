import type { ReactNode } from 'react'
import { Volume2, VolumeX, X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

export interface AppLayoutProps {
  sidebar: ReactNode
  header: ReactNode
  breadcrumbs?: ReactNode
  notice?: ReactNode
  children: ReactNode
  overlays?: ReactNode
}

export function AppLayout({ sidebar, header, breadcrumbs, notice, children, overlays }: AppLayoutProps) {
  return (
    <div className="app-shell">
      {sidebar}
      <main>
        {header}
        {breadcrumbs}
        {notice}
        <section className="page-content">{children}</section>
      </main>
      {overlays}
    </div>
  )
}

export function RouteState({
  kind,
  title,
  detail,
  action,
}: {
  kind: 'loading' | 'empty' | 'error'
  title: string
  detail?: string
  action?: ReactNode
}) {
  return (
    <section className={`route-state route-state-${kind}`} aria-live="polite" aria-busy={kind === 'loading'}>
      <h2>{title}</h2>
      {detail && <p>{detail}</p>}
      {action && <div className="route-state-action">{action}</div>}
    </section>
  )
}

export function CreditsModal({
  open,
  onOpenChange,
  used,
  limit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  used: number
  limit: number
}) {
  const remaining = Math.max(limit - used, 0)
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="radix-dialog-overlay" />
        <Dialog.Content className="radix-dialog-content credits-modal">
          <Dialog.Title className="radix-dialog-title">Uso de procesamiento</Dialog.Title>
          <Dialog.Description className="radix-dialog-description">
            Consulta el consumo disponible para las operaciones asistidas por IA del expediente.
          </Dialog.Description>
          <div className="credits-summary" aria-label={`${remaining} créditos disponibles de ${limit}`}>
            <strong>{remaining}</strong>
            <span>créditos disponibles de {limit}</span>
          </div>
          <Dialog.Close asChild>
            <button className="btn btn-secondary" type="button">Cerrar</button>
          </Dialog.Close>
          <Dialog.Close asChild>
            <button className="radix-dialog-close" type="button" aria-label="Cerrar"><X size={16} /></button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function SoundToggleButton({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  return (
    <button
      className="icon-button"
      type="button"
      aria-pressed={enabled}
      aria-label={enabled ? 'Desactivar sonidos de confirmación' : 'Activar sonidos de confirmación'}
      title={enabled ? 'Desactivar sonidos de confirmación' : 'Activar sonidos de confirmación'}
      onClick={() => onChange(!enabled)}
    >
      {enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
    </button>
  )
}
