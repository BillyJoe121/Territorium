import { ChevronDown, Link2 } from 'lucide-react'
import { useMemo, useState } from 'react'

/** Tonos visuales del comparador: coincide, advertencia, diferencia, faltante. */
export type LinkageTone = 'exact' | 'near' | 'different' | 'absent'

export interface LinkageChip {
  label: string
  tone: LinkageTone
}

export interface LinkageFinding {
  key: string
  tone: LinkageTone
  tag: string
  rowLabel: string
  message: string
  /** Casilla a la que se refiere, para llevar a ella desde el panel. */
  target?: { rowId: string; columnKey: string }
}

interface LinkagePanelProps {
  title: string
  chips: LinkageChip[]
  findings: LinkageFinding[]
  okLabel?: string
  /** Lleva a la casilla de la alerta (p. ej. en la hoja de cálculo). */
  onSelect?: (target: { rowId: string; columnKey: string }) => void
  /**
   * panel: bloque con título sobre la tabla. inline: solo las etiquetas, para la línea del
   * título del modal; el detalle se despliega flotando sin mover la tabla.
   */
  variant?: 'panel' | 'inline'
}

/** Resumen plegable de un cotejo. Plegado por defecto: la tabla es la protagonista. */
export function LinkagePanel({ title, chips, findings, okLabel = 'Sin alertas', onSelect, variant = 'panel' }: LinkagePanelProps) {
  const [expanded, setExpanded] = useState(false)
  const unique = useMemo(() => {
    const seen = new Set<string>()
    return findings.filter((f) => (seen.has(f.key) ? false : (seen.add(f.key), true)))
  }, [findings])

  return (
    <section className={variant === 'inline' ? 'plan-linkage-panel is-inline' : 'plan-linkage-panel'} aria-label={title}>
      <header className="plan-linkage-header">
        {variant === 'panel' && (
          <div className="plan-linkage-title">
            <Link2 size={15} />
            <strong>{title}</strong>
          </div>
        )}
        <div className="plan-linkage-counts" role="status">
          {chips.map((chip) => <span key={chip.label} className={`is-${chip.tone}`}>{chip.label}</span>)}
          {unique.length === 0 && <span className="is-exact">{okLabel}</span>}
        </div>
        {unique.length > 0 && (
          <button
            type="button"
            className={`plan-linkage-toggle ${expanded ? 'is-open' : ''}`}
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Ocultar alertas' : 'Ver alertas'}
            title={expanded ? 'Ocultar detalle de alertas' : 'Ver detalle de alertas'}
          >
            <ChevronDown size={14} />
          </button>
        )}
      </header>
      {unique.length > 0 && expanded && (
        <ul className="plan-linkage-findings">
          {unique.map((finding) => {
            const content = (
              <>
                <span className={`linkage-dot is-${finding.tone}`} aria-hidden="true" />
                <span className={`linkage-tag is-${finding.tone}`}>{finding.tag}</span>
                <span className="plan-linkage-row-label" title={finding.rowLabel}>{finding.rowLabel}</span>
                <span className="plan-linkage-message">{finding.message}</span>
              </>
            )
            const target = finding.target
            return (
              <li key={finding.key}>
                {onSelect && target ? (
                  <button type="button" className="plan-linkage-finding-button" onClick={() => onSelect(target)} title="Ir a la casilla en la hoja">
                    {content}
                  </button>
                ) : content}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
