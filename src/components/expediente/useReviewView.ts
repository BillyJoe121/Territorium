import { useMemo } from 'react'
import type { ValidationNotice } from '../../lib/expedienteResultAdapters'
import { missingDataAlerts } from '../../lib/missingData'
import { buildNegotiationLinkage, negotiationAlertCount, type LinkedPair } from '../../lib/negotiationLinking'
import { buildPlanTitleLinkage, linkageAlertCount, READONLY_ROW_FLAG } from '../../lib/planTitleLinking'
import { actionColumn, SELECTION_COLUMN } from '../../lib/spreadsheet/selectionColumn'
import { cellAlertKey, type CellAlert } from './ResultDataTable'
import type { SheetView } from './ResultSpreadsheet'
import type { ReviewDialogProps, ReviewRowAction, RowAlert } from './reviewDialogTypes'
import type { EditableResultRow, ResultColumn } from './types'

/** Filas que se tiñen completas: no tienen pareja en el cotejo. */
const ORPHAN_KINDS = new Set(['plan_without_title', 'negotiation_without_pair'])

interface Options {
  draft: EditableResultRow[]
  columns: ResultColumn[]
  groupKey: ReviewDialogProps['groupKey']
  isApproved: boolean
  linkedTitleRows?: EditableResultRow[]
  linkedPairs?: LinkedPair[]
  validateRows?: (rows: EditableResultRow[]) => RowAlert[]
  validationNotices: ValidationNotice[]
  approvalBlockedReason: string | null
  alertsAcknowledged: boolean
  sheetMode: boolean
  selectable: boolean
  rowAction?: ReviewRowAction
  selectedIds: Set<string>
  actionRowId: string | null
}

/**
 * Lo que muestra el modal a partir del borrador: el cotejo por FMI (planos o negociación), las
 * alertas por casilla, la vista de la hoja de cálculo y los motivos que bloquean la aprobación.
 */
export function useReviewView({
  draft,
  columns,
  groupKey,
  isApproved,
  linkedTitleRows,
  linkedPairs,
  validateRows,
  validationNotices,
  approvalBlockedReason,
  alertsAcknowledged,
  sheetMode,
  selectable,
  rowAction,
  selectedIds,
  actionRowId,
}: Options) {
  const planLinkage = useMemo(
    () => (groupKey === 'plans' && linkedTitleRows ? buildPlanTitleLinkage(draft, linkedTitleRows) : null),
    [draft, groupKey, linkedTitleRows],
  )
  const negotiationLinkage = useMemo(
    () => (groupKey === 'negotiation' && linkedPairs ? buildNegotiationLinkage(draft, linkedPairs) : null),
    [draft, groupKey, linkedPairs],
  )
  const linkage = planLinkage ?? negotiationLinkage
  // El valor negociado faltante bloquea; las demás alertas se aprueban bajo confirmación.
  const missingNegotiated = negotiationLinkage?.summary.missingValues ?? 0
  const linkageAlerts = planLinkage
    ? linkageAlertCount(planLinkage.summary)
    : negotiationLinkage ? negotiationAlertCount(negotiationLinkage.summary) - missingNegotiated : 0
  const rowAlerts = useMemo(() => (validateRows ? validateRows(draft) : []), [draft, validateRows])
  const rowAlertErrors = rowAlerts.filter((alert) => alert.severity === 'error').length
  // Filas y columnas que se muestran: las del cotejo cuando lo hay.
  const displayRows = linkage ? linkage.rows : draft
  const displayColumns = useMemo(() => {
    const base = linkage ? linkage.columns : columns
    const shown = isApproved ? base.map((col) => ({ ...col, editable: false })) : base
    if (sheetMode && rowAction) return [actionColumn(rowAction.columnLabel, rowAction.buttonLabel), ...shown]
    return sheetMode && selectable ? [SELECTION_COLUMN, ...shown] : shown
  }, [linkage, columns, isApproved, sheetMode, selectable, rowAction?.columnLabel, rowAction?.buttonLabel])
  // Alertas por casilla: cotejo, validaciones propias y datos faltantes (en ese orden de prioridad).
  const mergedAlerts = useMemo(() => {
    const byCell = new Map<string, RowAlert>()
    const all = [
      ...((linkage?.alerts ?? []) as RowAlert[]),
      ...rowAlerts,
      ...missingDataAlerts(displayRows, linkage ? linkage.columns : columns),
    ]
    for (const alert of all) {
      const key = cellAlertKey(alert.rowId, alert.columnKey)
      // Un error prevalece sobre una advertencia en la misma casilla.
      if (!byCell.has(key) || (alert.severity === 'error' && byCell.get(key)!.severity !== 'error')) byCell.set(key, alert)
    }
    return byCell
  }, [linkage, rowAlerts, displayRows, columns])
  const cellAlerts = useMemo(() => (mergedAlerts.size ? mergedAlerts as Map<string, CellAlert> : undefined), [mergedAlerts])
  const sheetView = useMemo<SheetView>(() => ({
    rows: displayRows,
    alerts: [...mergedAlerts.values()],
    errorRows: new Set((linkage?.alerts ?? []).filter((alert) => ORPHAN_KINDS.has(alert.kind)).map((alert) => alert.rowId)),
    selected: selectedIds,
    actions: rowAction
      ? new Map(displayRows.filter((row) => row[READONLY_ROW_FLAG] !== 'true').map((row) => [row.id, rowAction.unavailableReason(row)]))
      : undefined,
  }), [displayRows, mergedAlerts, linkage, selectedIds, rowAction])
  // Vista de la acción abierta (p. ej. el comparador de un plano), en lugar de la hoja.
  const actionRow = actionRowId ? displayRows.find((row) => row.id === actionRowId) : undefined
  const actionPanel = useMemo(
    () => (actionRow && rowAction ? rowAction.renderPanel(actionRow) : null),
    // Se arma al abrir la fila; las ediciones de la hoja no la reinician.
    [actionRowId, rowAction],
  )
  const blockedRows = useMemo(() => {
    const blocked = new Map<string, string>()
    for (const alert of mergedAlerts.values()) {
      if (alert.severity === 'error' && !blocked.has(alert.rowId)) blocked.set(alert.rowId, alert.message)
    }
    return blocked
  }, [mergedAlerts])

  const approvalBlocker = approvalBlockedReason
    ?? (rowAlertErrors > 0 ? `Corrige las ${rowAlertErrors} casilla(s) marcadas en rojo antes de aprobar.` : null)
    ?? (missingNegotiated > 0 ? `Falta el valor negociado válido (números y letras que coincidan) en ${missingNegotiated} fila(s).` : null)
    ?? (linkageAlerts > 0 && !alertsAcknowledged ? 'Confirma que revisaste las alertas del cotejo antes de aprobar.' : null)

  const hasBlockingErrors = useMemo(
    () => validationNotices.some((notice) => notice.severity === 'error'),
    [validationNotices],
  )

  // Tabla (sin hoja de cálculo): columnas en solo lectura cuando la versión está aprobada.
  const tableColumns = useMemo(() => {
    const base = linkage ? linkage.columns : columns
    return isApproved ? base.map((col) => ({ ...col, editable: false })) : base
  }, [linkage, columns, isApproved])
  const tableRowClassName = linkage ? (row: EditableResultRow) => {
    if (row[READONLY_ROW_FLAG] === 'true') return 'linkage-row-orphan'
    return (linkage.alerts as { rowId: string; kind: string }[]).some((alert) => alert.rowId === row.id && ORPHAN_KINDS.has(alert.kind))
      ? 'linkage-row-orphan'
      : undefined
  } : undefined

  return {
    planLinkage,
    negotiationLinkage,
    linkageAlerts,
    displayRows,
    displayColumns,
    cellAlerts,
    sheetView,
    actionPanel,
    blockedRows,
    approvalBlocker,
    hasBlockingErrors,
    tableColumns,
    tableRowClassName,
  }
}
