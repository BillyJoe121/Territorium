import { LINK_STATUS_KEY, type LinkAlertKind, type PlanTitleLinkage } from '../../lib/planTitleLinking'
import type { NegotiationAlertKind, NegotiationLinkage } from '../../lib/negotiationLinking'
import type { EditableResultRow } from './types'
import { LinkagePanel, type LinkageChip, type LinkageFinding, type LinkageTone } from './LinkagePanel'

const PLAN_KIND: Record<LinkAlertKind, [string, LinkageTone]> = {
  mismatch: ['No coincide', 'different'],
  empty: ['Casilla vacía', 'near'],
  plan_without_title: ['Plano sin estudio', 'different'],
  title_without_plan: ['Estudio sin plano', 'absent'],
  duplicate: ['FMI repetido', 'near'],
}

const NEGOTIATION_KIND: Record<NegotiationAlertKind, [string, LinkageTone]> = {
  mismatch: ['No coincide', 'different'],
  missing_value: ['Falta valor negociado', 'different'],
  invalid_value: ['Valor negociado inválido', 'different'],
  pair_without_negotiation: ['Sin negociación', 'absent'],
  negotiation_without_pair: ['Sin estudio/plano', 'near'],
  duplicate: ['FMI repetido', 'near'],
}

const labelOf = (rows: EditableResultRow[]) => new Map(rows.map((row) => [
  row.id,
  row.propertyCode && row.propertyCode !== '—' ? row.propertyCode : row.planName || row.planFolio || row.negFolio || row.t_folio || row[LINK_STATUS_KEY] || row.id,
]))

function findingsOf<K extends string>(
  alerts: { rowId: string; columnKey: string; kind: K; message: string }[],
  rows: EditableResultRow[],
  kinds: Record<K, [string, LinkageTone]>,
): LinkageFinding[] {
  const labels = labelOf(rows)
  return alerts.map((alert) => ({
    key: `${alert.rowId}|${alert.kind}|${alert.message}`,
    tag: kinds[alert.kind][0],
    tone: kinds[alert.kind][1],
    rowLabel: labels.get(alert.rowId) ?? alert.rowId,
    message: alert.message,
    target: { rowId: alert.rowId, columnKey: alert.columnKey },
  }))
}

const chip = (count: number, label: string, tone: LinkageTone): LinkageChip[] => (count > 0 ? [{ label: `${count} ${label}`, tone }] : [])

type SelectAlert = (rowId: string, columnKey: string) => void

export function PlanLinkagePanel({ linkage, onSelectAlert }: { linkage: PlanTitleLinkage; onSelectAlert?: SelectAlert }) {
  const { summary } = linkage
  return (
    <LinkagePanel
      title="Cotejo plano ↔ estudio de títulos por FMI"
      okLabel="Sin alertas: los datos cotejados coinciden"
      chips={[
        { label: `${summary.linked} vinculados`, tone: 'exact' },
        ...chip(summary.mismatches, 'no coinciden', 'different'),
        ...chip(summary.emptyCells, 'vacías', 'near'),
        ...chip(summary.plansWithoutTitle, 'planos sin estudio', 'different'),
        ...chip(summary.titlesWithoutPlan, 'estudios sin plano', 'absent'),
        ...chip(summary.duplicates, 'FMI repetido', 'near'),
      ]}
      findings={findingsOf(linkage.alerts, linkage.rows, PLAN_KIND)}
      onSelect={onSelectAlert ? (target) => onSelectAlert(target.rowId, target.columnKey) : undefined}
    />
  )
}

export function NegotiationLinkagePanel({ linkage, onSelectAlert }: { linkage: NegotiationLinkage; onSelectAlert?: SelectAlert }) {
  const { summary } = linkage
  return (
    <LinkagePanel
      title="Cotejo negociación ↔ estudio y plano por FMI"
      okLabel="Sin alertas: todas las filas tienen valor negociado válido"
      chips={[
        { label: `${summary.linked} vinculadas`, tone: 'exact' },
        ...chip(summary.missingValues, 'sin valor negociado válido', 'different'),
        ...chip(summary.mismatches, 'no coinciden', 'different'),
        ...chip(summary.pairsWithoutNegotiation, 'predios sin negociación', 'absent'),
        ...chip(summary.negotiationsWithoutPair, 'negociaciones sin estudio/plano', 'near'),
        ...chip(summary.duplicates, 'FMI repetido', 'near'),
      ]}
      findings={findingsOf(linkage.alerts, linkage.rows, NEGOTIATION_KIND)}
      onSelect={onSelectAlert ? (target) => onSelectAlert(target.rowId, target.columnKey) : undefined}
    />
  )
}
