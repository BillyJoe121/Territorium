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
}

interface LinkagePanelProps {
  title: string
  chips: LinkageChip[]
  findings: LinkageFinding[]
  okLabel?: string
}

/** Resumen plegable de un cotejo. Plegado por defecto: la tabla es la protagonista. */
export function LinkagePanel({ title, chips, findings, okLabel = 'Sin alertas' }: LinkagePanelProps) {
  const [expanded, setExpanded] = useState(false)
  const unique = useMemo(() => {
    const seen = new Set<string>()
    return findings.filter((f) => (seen.has(f.key) ? false : (seen.add(f.key), true)))
  }, [findings])

  return (
    <section className="plan-linkage-panel" aria-label={title}>
      <header className="plan-linkage-header">
        <div className="plan-linkage-title">
          <Link2 size={15} />
          <strong>{title}</strong>
        </div>
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
          {unique.map((finding) => (
            <li key={finding.key}>
              <span className={`linkage-dot is-${finding.tone}`} aria-hidden="true" />
              <span className={`linkage-tag is-${finding.tone}`}>{finding.tag}</span>
              <span className="plan-linkage-row-label" title={finding.rowLabel}>{finding.rowLabel}</span>
              <span className="plan-linkage-message">{finding.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
