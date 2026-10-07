/**
 * Cotejo de la Plantilla de negociación contra las parejas estudio de títulos ↔ plano.
 *
 * Cada fila de la plantilla es un predio. Se vincula por FMI con la pareja aprobada en
 * planos; se señalan las parejas sin negociación, las negociaciones sin pareja y los datos
 * que no coinciden. El valor negociado (números y letras) es obligatorio por cada fila
 * vinculada y ambos deben coincidir.
 */
import type { EditableResultRow, ResultColumn } from '../components/expediente/types'
import { checkNegotiatedValue, NEGOTIATED_LETTERS_EXAMPLE, NEGOTIATED_NUMBERS_EXAMPLE } from './negotiatedValue'
import {
  cadastralKey,
  isEmptyValue,
  LINK_STATUS_KEY,
  linkStatusText,
  normalizeFmi,
  READONLY_ROW_FLAG,
} from './planTitleLinking'

export interface LinkedPair {
  fmi: string
  propertyName: string
  owners: string
  cadastralId: string
  planName: string
}

export type NegotiationAlertKind = 'mismatch' | 'missing_value' | 'invalid_value' | 'pair_without_negotiation' | 'negotiation_without_pair' | 'duplicate'

export interface NegotiationAlert {
  rowId: string
  columnKey: string
  kind: NegotiationAlertKind
  severity: 'error' | 'warning'
  message: string
}

export interface NegotiationSummary {
  linked: number
  mismatches: number
  missingValues: number
  pairsWithoutNegotiation: number
  negotiationsWithoutPair: number
  duplicates: number
}

export interface NegotiationLinkage {
  columns: ResultColumn[]
  rows: EditableResultRow[]
  alerts: NegotiationAlert[]
  summary: NegotiationSummary
}

export const NEGOTIATION_STATUS = {
  linked: 'Vinculada a estudio y plano',
  withoutPair: 'Negociación sin estudio/plano',
  pairOnly: 'Estudio y plano sin negociación',
}

/** Parejas vinculadas a partir de la tabla resultante de planos (o su instantánea aprobada). */
export function pairsFromPlanRecords(records: EditableResultRow[]): LinkedPair[] {
  return records
    .filter((row) => row[LINK_STATUS_KEY] === linkStatusText('linked'))
    .map((row) => ({
      fmi: String(row.t_folio || row.planFolio || ''),
      propertyName: String(row.t_propertyName || row.planPropertyName || ''),
      owners: String(row.t_owners || row.planOwners || ''),
      cadastralId: String(row.t_cadastralId || row.planCadastralId || ''),
      planName: String(row.planName || row.planSourceDocument || ''),
    }))
}

const pairColumn = (key: string, label: string, width: number): ResultColumn => ({ key, label, width, editable: false })

export function buildNegotiationColumns(): ResultColumn[] {
  return [
    { key: LINK_STATUS_KEY, label: 'Vínculo FMI', editable: false, width: 200 },
    { key: 'propertyCode', label: 'Carpeta', editable: false, width: 130 },
    { key: 'negFolio', label: 'FMI (negociación)', width: 160 },
    pairColumn('p_planName', 'Plano · Nombre', 190),
    pairColumn('p_propertyName', 'Estudio · Predio', 170),
    pairColumn('p_owners', 'Estudio · Propietarios', 240),
    { key: 'negCadastralId', label: 'Cédula catastral (negociación)', editable: false, width: 210 },
    pairColumn('p_cadastralId', 'Estudio · Cédula catastral', 210),
    { key: 'firstOfferNumbers', label: 'Oferta 1 (números)', inputMode: 'numeric', width: 150 },
    { key: 'firstOfferLetters', label: 'Oferta 1 (letras)', width: 300 },
    { key: 'secondOfferNumbers', label: 'Oferta 2 (números)', inputMode: 'numeric', width: 150 },
    { key: 'secondOfferLetters', label: 'Oferta 2 (letras)', width: 300 },
    { key: 'thirdOfferNumbers', label: 'Oferta 3 (números)', inputMode: 'numeric', width: 150 },
    { key: 'thirdOfferLetters', label: 'Oferta 3 (letras)', width: 300 },
    { key: 'valuesMatch', label: '¿Ofertas coinciden?', editable: false, width: 170 },
    {
      key: 'negotiatedValueNumbers', label: 'Valor negociado (números)', inputMode: 'numeric', width: 190, required: true,
      placeholder: NEGOTIATED_NUMBERS_EXAMPLE, hint: `Obligatorio. Ejemplo: ${NEGOTIATED_NUMBERS_EXAMPLE} o 93468040. Sin comas, decimales ni guiones.`,
    },
    {
      key: 'negotiatedValueLetters', label: 'Valor negociado (letras)', width: 420, required: true,
      placeholder: NEGOTIATED_LETTERS_EXAMPLE, hint: 'Obligatorio. Solo palabras con un espacio entre ellas, terminando en "pesos". Debe coincidir con el valor en números.',
    },
  ]
}

const PLAN_CODE = /[A-Z]{3}-[A-Z]{3}-\d{3}[A-Z]?/

export function buildNegotiationLinkage(negotiationRows: EditableResultRow[], pairs: LinkedPair[]): NegotiationLinkage {
  const alerts: NegotiationAlert[] = []
  const summary: NegotiationSummary = { linked: 0, mismatches: 0, missingValues: 0, pairsWithoutNegotiation: 0, negotiationsWithoutPair: 0, duplicates: 0 }
  const pairByFmi = new Map<string, LinkedPair>()
  for (const pair of pairs) {
    const fmi = normalizeFmi(pair.fmi)
    if (fmi && !pairByFmi.has(fmi)) pairByFmi.set(fmi, pair)
  }
  const countByFmi = new Map<string, number>()
  for (const row of negotiationRows) {
    const fmi = normalizeFmi(row.negFolio)
    if (fmi) countByFmi.set(fmi, (countByFmi.get(fmi) ?? 0) + 1)
  }

  const usedPairs = new Set<string>()
  const linkedRows: EditableResultRow[] = []
  const orphanRows: EditableResultRow[] = []

  for (const row of negotiationRows) {
    const fmi = normalizeFmi(row.negFolio)
    const pair = fmi ? pairByFmi.get(fmi) : undefined
    const out: EditableResultRow = {
      ...row,
      [LINK_STATUS_KEY]: pair ? NEGOTIATION_STATUS.linked : NEGOTIATION_STATUS.withoutPair,
      p_planName: pair?.planName ?? '',
      p_propertyName: pair?.propertyName ?? '',
      p_owners: pair?.owners ?? '',
      p_cadastralId: pair?.cadastralId ?? '',
    }

    if (!pair) {
      summary.negotiationsWithoutPair++
      alerts.push({
        rowId: row.id, columnKey: LINK_STATUS_KEY, kind: 'negotiation_without_pair', severity: 'warning',
        message: fmi
          ? `La negociación de ${row.propertyCode || row.negFolio} (FMI ${row.negFolio}) no tiene estudio de títulos y plano aprobados en este proyecto.`
          : `La negociación de ${row.propertyCode || 'una fila'} no tiene FMI para vincularla.`,
      })
      orphanRows.push(out)
      continue
    }

    usedPairs.add(fmi)
    summary.linked++
    linkedRows.push(out)

    if ((countByFmi.get(fmi) ?? 0) > 1) {
      summary.duplicates++
      alerts.push({ rowId: row.id, columnKey: 'negFolio', kind: 'duplicate', severity: 'warning', message: `Hay ${countByFmi.get(fmi)} filas de negociación con el FMI ${row.negFolio}.` })
    }
    if (!isEmptyValue(row.negCadastralId) && !isEmptyValue(pair.cadastralId) && cadastralKey(row.negCadastralId) !== cadastralKey(pair.cadastralId)) {
      summary.mismatches++
      const message = `Cédula catastral no coincide. Negociación: "${row.negCadastralId}" · Estudio: "${pair.cadastralId}".`
      alerts.push({ rowId: row.id, columnKey: 'negCadastralId', kind: 'mismatch', severity: 'error', message })
      alerts.push({ rowId: row.id, columnKey: 'p_cadastralId', kind: 'mismatch', severity: 'error', message })
    }
    const planCode = PLAN_CODE.exec(pair.planName.toUpperCase())?.[0]
    const folderCode = PLAN_CODE.exec(String(row.propertyCode ?? '').toUpperCase())?.[0]
    if (planCode && folderCode && planCode !== folderCode) {
      summary.mismatches++
      const message = `La carpeta ${folderCode} no corresponde al plano ${pair.planName}.`
      alerts.push({ rowId: row.id, columnKey: 'propertyCode', kind: 'mismatch', severity: 'error', message })
      alerts.push({ rowId: row.id, columnKey: 'p_planName', kind: 'mismatch', severity: 'error', message })
    }
    if (row.valuesMatch && !/^s[ií]/i.test(row.valuesMatch)) {
      summary.mismatches++
      alerts.push({ rowId: row.id, columnKey: 'valuesMatch', kind: 'mismatch', severity: 'error', message: `Ofertas de ${row.propertyCode}: ${row.valuesMatch}.` })
    }

    // Valor negociado: obligatorio y coincidente en cada fila vinculada.
    const numbers = String(row.negotiatedValueNumbers ?? '')
    const letters = String(row.negotiatedValueLetters ?? '')
    if (!numbers.trim() && !letters.trim()) {
      summary.missingValues++
      const message = `Ingresa el valor negociado de ${row.propertyCode || row.negFolio} en números y en letras.`
      alerts.push({ rowId: row.id, columnKey: 'negotiatedValueNumbers', kind: 'missing_value', severity: 'error', message })
      alerts.push({ rowId: row.id, columnKey: 'negotiatedValueLetters', kind: 'missing_value', severity: 'error', message })
      continue
    }
    const check = checkNegotiatedValue(numbers, letters)
    if (!check.ok) {
      summary.missingValues++
      if (check.numbersError) alerts.push({ rowId: row.id, columnKey: 'negotiatedValueNumbers', kind: 'invalid_value', severity: 'error', message: check.numbersError })
      if (check.lettersError) alerts.push({ rowId: row.id, columnKey: 'negotiatedValueLetters', kind: 'invalid_value', severity: 'error', message: check.lettersError })
    }
  }

  const pairRows: EditableResultRow[] = []
  for (const pair of pairs) {
    const fmi = normalizeFmi(pair.fmi)
    if (!fmi || usedPairs.has(fmi)) continue
    usedPairs.add(fmi)
    const id = `pair-only-${fmi}`
    summary.pairsWithoutNegotiation++
    pairRows.push({
      id, [READONLY_ROW_FLAG]: 'true', [LINK_STATUS_KEY]: NEGOTIATION_STATUS.pairOnly, negFolio: pair.fmi,
      p_planName: pair.planName, p_propertyName: pair.propertyName, p_owners: pair.owners, p_cadastralId: pair.cadastralId,
    })
    alerts.push({
      rowId: id, columnKey: LINK_STATUS_KEY, kind: 'pair_without_negotiation', severity: 'error',
      message: `El predio ${pair.propertyName || pair.fmi} (FMI ${pair.fmi}) tiene estudio y plano, pero no tiene fila en la plantilla de negociación.`,
    })
  }

  // Primero las filas del proyecto, luego las parejas sin negociación y al final las negociaciones ajenas.
  return { columns: buildNegotiationColumns(), rows: [...linkedRows, ...pairRows, ...orphanRows], alerts, summary }
}

export function negotiationAlertCount(summary: NegotiationSummary): number {
  return summary.mismatches + summary.missingValues + summary.pairsWithoutNegotiation + summary.negotiationsWithoutPair + summary.duplicates
}

/** Instantánea persistida con la aprobación de la negociación. */
export function negotiationLinkageSnapshot(linkage: NegotiationLinkage): Record<string, unknown> {
  return {
    linked_records: linkage.rows.map((row) => {
      const { [READONLY_ROW_FLAG]: _readonly, ...rest } = row
      return rest
    }),
    linkage_summary: linkage.summary,
    linkage_alerts: linkage.alerts.map(({ rowId, columnKey, kind, severity, message }) => ({ row_id: rowId, column: columnKey, kind, severity, message })),
  }
}
