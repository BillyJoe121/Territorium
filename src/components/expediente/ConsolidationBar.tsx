import { Download, LoaderCircle, PencilLine, Play } from 'lucide-react'
import { StatusText, consolidationLabel } from './expedienteGroups'
import type { PrototypeConsolidationStatus } from './types'

interface Props {
  status: PrototypeConsolidationStatus
  canOpen: boolean
  allGroupsApproved: boolean
  consolidating: boolean
  onOpen: () => void
  onConsolidate: () => void
  onDownloadExcel: () => void
}

/** Barra bajo las tarjetas de Extracción: consolidar, abrir el consolidado y descargar el Excel. */
export function ConsolidationBar({ status, canOpen, allGroupsApproved, consolidating, onOpen, onConsolidate, onDownloadExcel }: Props) {
  return (
    <section className="extraction-consolidation-bar" aria-label="Consolidación predial">
      <div className="extraction-consolidation-left">
        {canOpen ? (
          <button type="button" className="expediente-primary-action" onClick={onOpen}>
            <PencilLine size={16} />
            Analizar consolidado
          </button>
        ) : (
          <button
            type="button"
            className="expediente-primary-action"
            disabled={!allGroupsApproved || consolidating}
            onClick={onConsolidate}
            title={
              !allGroupsApproved
                ? 'Debes aprobar los 3 subconjuntos para consolidar'
                : status === 'stale'
                ? 'Las fuentes cambiaron: vuelve a consolidar con los resultados aprobados'
                : 'Consolidar resultados de las fuentes aprobadas'
            }
          >
            {consolidating ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />}
            {consolidating
              ? 'Consolidando…'
              : status === 'stale'
              ? 'Actualizar consolidado'
              : 'Consolidar resultados'}
          </button>
        )}
      </div>

      <div className="extraction-consolidation-right">
        <StatusText status={status} label={consolidationLabel(status)} />
        {canOpen && (
          <div className="extraction-consolidation-actions">
            <button type="button" className="expediente-secondary-action" onClick={onDownloadExcel}>
              <Download size={16} />
              <span>Descargar Excel</span>
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
