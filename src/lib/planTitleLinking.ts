/**
 * Vínculo 1 a 1 entre planos y estudios de títulos usando el FMI (folio de
 * matrícula inmobiliaria) como llave primaria.
 *
 * La tabla resultante de planos es la suma de la tabla de planos y la tabla
 * aprobada de estudio de títulos. Sobre ella se calculan alertas por casilla
 * (valores que no coinciden, casillas vacías) y por fila (planos sin estudio
 * de títulos, estudios de títulos sin plano, FMI duplicado).
 */
import type { EditableResultRow, ResultColumn } from '../components/expediente/types'

export type LinkStatus = 'linked' | 'plan_without_title' | 'title_without_plan'
export type LinkAlertKind = 'mismatch' | 'empty' | 'plan_without_title' | 'title_without_plan' | 'duplicate'

export interface LinkCellAlert {
  rowId: string
  columnKey: string
  kind: LinkAlertKind
  severity: 'error' | 'warning'
  message: string
}

export interface LinkSummary {
  linked: number
  mismatches: number
  emptyCells: number
  plansWithoutTitle: number
  titlesWithoutPlan: number
  duplicates: number
}

export interface PlanTitleLinkage {
  columns: ResultColumn[]
  rows: EditableResultRow[]
  alerts: LinkCellAlert[]
  summary: LinkSummary
}

/** Prefijo de las columnas que provienen del estudio de títulos (solo lectura). */
export const TITLE_PREFIX = 't_'
export const LINK_STATUS_KEY = 'linkStatus'
/** Las filas de estudios sin plano no tienen datos de plano editables. */
export const READONLY_ROW_FLAG = '__readonly'
export const TITLE_ONLY_ROW_PREFIX = 'title-only-'

const EMPTY_MARKERS = new Set(['', '—', '-', 'n/a', 'na', 'no identificado', 'no identificada', 'sin dato', 'none', 'null'])

export function isEmptyValue(value: string | undefined | null): boolean {
  return EMPTY_MARKERS.has(String(value ?? '').trim().toLowerCase())
}

/** "FMI No. 350 – 108418" → "350-108418". Conserva letras de círculo registral (050N). */
export function normalizeFmi(value: string | undefined | null): string {
  if (isEmptyValue(value)) return ''
  return String(value)
    .toUpperCase()
    .replace(/F\.?\s?M\.?\s?I\.?|FOLIO(\s+DE)?(\s+MATR[IÍ]CULA)?(\s+INMOBILIARIA)?|MATR[IÍ]CULA(\s+INMOBILIARIA)?/g, ' ')
    .replace(/\bN(O|°|º)\.?(?=[\s\d:]|$)/g, ' ')
    .replace(/[–—_]/g, '-')
    .replace(/[^0-9A-Z-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const PROPERTY_NOISE = /\b(predio|finca|lote|hacienda|parcela|rural|urbano|denominado|llamado)\b/g

function textsMatch(a: string, b: string, noise?: RegExp): boolean {
  let left = normalizeText(a)
  let right = normalizeText(b)
  if (noise) {
    left = left.replace(noise, ' ').replace(/\s+/g, ' ').trim()
    right = right.replace(noise, ' ').replace(/\s+/g, ' ').trim()
  }
  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}

const digitsOnly = (value: string) => value.replace(/\D/g, '')

/**
 * Llave común entre el código catastral anterior (20 dígitos: depto, municipio, zona,
 * sector, vereda, terreno, mejora) y el Número Predial Nacional (30 dígitos, que agrega
 * comuna/barrio tras el sector y condición/edificio/piso/unidad al final).
 */
export function cadastralKey(value: string): string {
  const digits = digitsOnly(value)
  if (digits.length === 30) return digits.slice(0, 9) + digits.slice(13, 21)
  if (digits.length === 20) return digits.slice(0, 17)
  return digits
}

function cadastralMatch(a: string, b: string): boolean {
  const left = cadastralKey(a)
  const right = cadastralKey(b)
  if (!left || !right) return false
  return left === right
}

const NAME_STOPWORDS = new Set(['y', 'de', 'del', 'la', 'las', 'los', 'e', 'sra', 'sr', 'senor', 'senora'])

function nameTokens(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 1 && !NAME_STOPWORDS.has(token) && !/^\d+$/.test(token))
}

/** Cada propietario de un lado debe aparecer (por tokens) en el otro. */
function ownersMatch(a: string, b: string): boolean {
  const left = new Set(nameTokens(a))
  const right = new Set(nameTokens(b))
  if (!left.size || !right.size) return false
  const [small, large] = left.size <= right.size ? [left, right] : [right, left]
  let shared = 0
  for (const token of small) if (large.has(token)) shared++
  return shared / small.size >= 0.8
}

/** Área en m²: admite "1.245,80 m²", "12 ha", "4580 m2", "0,5 Ha + 120 m2". */
export function parseAreaSquareMeters(value: string): number | null {
  if (isEmptyValue(value)) return null
  const text = value.toLowerCase()
  const toNumber = (raw: string) => {
    let clean = raw
    if (clean.includes('.') && clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.')
    else if (clean.includes(',')) clean = clean.replace(',', '.')
    else if (/^\d{1,3}(\.\d{3})+$/.test(clean)) clean = clean.replace(/\./g, '')
    const n = Number(clean)
    return Number.isFinite(n) ? n : null
  }
  let total = 0
  let found = false
  const pattern = /(\d[\d.,]*)\s*(ha|hect[aá]reas?|m2|m²|mts2|metros cuadrados|m)?/g
  for (const match of text.matchAll(pattern)) {
    const n = toNumber(match[1])
    if (n === null) continue
    found = true
    total += match[2] && /^(ha|hect)/.test(match[2]) ? n * 10_000 : n
  }
  return found ? total : null
}

function areasMatch(a: string, b: string): boolean {
  const left = parseAreaSquareMeters(a)
  const right = parseAreaSquareMeters(b)
  if (left === null || right === null) return false
  if (left === right) return true
  return Math.abs(left - right) / Math.max(left, right) <= 0.005
}

interface ComparedPair {
  planKey: string
  titleKey: string
  label: string
  matches: (plan: string, title: string) => boolean
}

/** Campos que aparecen tanto en el plano como en el estudio de títulos. */
export const COMPARED_FIELDS: ComparedPair[] = [
  { planKey: 'planCadastralId', titleKey: 'cadastralId', label: 'Cédula catastral', matches: cadastralMatch },
  { planKey: 'planPropertyName', titleKey: 'propertyName', label: 'Nombre del predio', matches: (a, b) => textsMatch(a, b, PROPERTY_NOISE) },
  { planKey: 'planOwners', titleKey: 'owners', label: 'Propietarios', matches: ownersMatch },
  { planKey: 'planMunicipality', titleKey: 'municipality', label: 'Municipio', matches: (a, b) => textsMatch(a, b) },
  { planKey: 'planVillage', titleKey: 'village', label: 'Vereda', matches: (a, b) => textsMatch(a, b, /\b(vereda|corregimiento)\b/g) },
  { planKey: 'planPropertyArea', titleKey: 'areaNumbers', label: 'Área del predio', matches: areasMatch },
]

const PLAN_TECHNICAL_COLUMNS: ResultColumn[] = [
  { key: 'planName', label: 'Nombre del plano', width: 220 },
  { key: 'easementAreaNumbers', label: 'Área servidumbre (m²) números', inputMode: 'numeric', width: 210 },
  { key: 'easementAreaLetters', label: 'Área servidumbre (m²) letras', width: 240 },
  { key: 'easementLengthNumbers', label: 'Longitud servidumbre (m) números', inputMode: 'numeric', width: 230 },
  { key: 'easementLengthLetters', label: 'Longitud servidumbre (m) letras', width: 240 },
  { key: 'easementWidthNumbers', label: 'Ancho servidumbre (m) números', inputMode: 'numeric', width: 210 },
  { key: 'easementWidthLetters', label: 'Ancho servidumbre (m) letras', width: 220 },
  { key: 'infrastructureCountNumbers', label: 'Postes / infraestructuras números', inputMode: 'numeric', width: 230 },
  { key: 'infrastructureCountLetters', label: 'Postes / infraestructuras letras', width: 230 },
  { key: 'planScale', label: 'Escala del plano', width: 140 },
  { key: 'voltageLevel', label: 'Nivel de tensión', width: 150 },
]

const TITLE_ONLY_COLUMNS: ResultColumn[] = [
  { key: 'sourceDocument', label: 'Documento del estudio', width: 220 },
  { key: 'documentNumber', label: 'No. documento', width: 145 },
  { key: 'documentType', label: 'Tipo documento', width: 165 },
  { key: 'department', label: 'Departamento', width: 160 },
  { key: 'areaLetters', label: 'Área del predio (letras)', width: 240 },
  { key: 'registryOffice', label: 'Oficina de registro (ORIP)', width: 210 },
  { key: 'acquisitionMode', label: 'Modo de adquisición', width: 260 },
  { key: 'boundaries', label: 'Linderos del predio', width: 320 },
  { key: 'boundariesDocument', label: 'Documento fuente de linderos', width: 240 },
  { key: 'legalConditions', label: 'Condiciones jurídicas vigentes', width: 260 },
  { key: 'justiceMinistryCase', label: 'Radicado MinJusticia', width: 200 },
  { key: 'urtCase', label: 'Radicado URT', width: 180 },
  { key: 'urtTerritorialDirection', label: 'Dirección territorial URT', width: 210 },
  { key: 'antecedentsConsultationDate', label: 'Fecha consulta Tusdatos.co', width: 210 },
]

const titleColumn = (key: string, label: string, width: number): ResultColumn => ({
  key: `${TITLE_PREFIX}${key}`,
  label: `Estudio · ${label}`,
  width,
  editable: false,
})

/** Columnas de la tabla resultante de planos (plano + estudio de títulos). */
export function buildLinkedColumns(): ResultColumn[] {
  const compared: ResultColumn[] = COMPARED_FIELDS.flatMap(({ planKey, titleKey, label }) => [
    { key: planKey, label: `Plano · ${label}`, width: planKey === 'planOwners' ? 240 : 190 },
    titleColumn(titleKey, label, titleKey === 'owners' ? 240 : 190),
  ])
  return [
    { key: LINK_STATUS_KEY, label: 'Vínculo FMI', editable: false, width: 180 },
    { key: 'planFolio', label: 'FMI (matrícula) del plano', width: 190 },
    titleColumn('folio', 'FMI (matrícula)', 170),
    { key: 'planSourceDocument', label: 'Archivo del plano', editable: false, width: 220 },
    ...compared,
    ...PLAN_TECHNICAL_COLUMNS,
    ...TITLE_ONLY_COLUMNS.map((column) => titleColumn(column.key, column.label, column.width ?? 180)),
  ]
}

const TITLE_KEYS = [
  'folio',
  ...COMPARED_FIELDS.map((field) => field.titleKey),
  ...TITLE_ONLY_COLUMNS.map((column) => column.key),
]

function titleFields(title: EditableResultRow | undefined): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const key of TITLE_KEYS) fields[`${TITLE_PREFIX}${key}`] = title ? String(title[key] ?? '') : ''
  return fields
}

const STATUS_TEXT: Record<LinkStatus, string> = {
  linked: 'Vinculado por FMI',
  plan_without_title: 'Plano sin estudio de títulos',
  title_without_plan: 'Estudio de títulos sin plano',
}

export function linkStatusText(status: LinkStatus): string {
  return STATUS_TEXT[status]
}

/**
 * Construye la tabla resultante de planos y sus alertas.
 * Las filas de planos conservan su id (para que las ediciones persistan);
 * los estudios sin plano se agregan como filas de solo lectura.
 */
export function buildPlanTitleLinkage(planRows: EditableResultRow[], titleRows: EditableResultRow[]): PlanTitleLinkage {
  const alerts: LinkCellAlert[] = []
  const summary: LinkSummary = { linked: 0, mismatches: 0, emptyCells: 0, plansWithoutTitle: 0, titlesWithoutPlan: 0, duplicates: 0 }

  const titlesByFmi = new Map<string, EditableResultRow>()
  for (const title of titleRows) {
    const fmi = normalizeFmi(title.folio)
    if (fmi && !titlesByFmi.has(fmi)) titlesByFmi.set(fmi, title)
  }

  const planCountByFmi = new Map<string, number>()
  for (const plan of planRows) {
    const fmi = normalizeFmi(plan.planFolio)
    if (fmi) planCountByFmi.set(fmi, (planCountByFmi.get(fmi) ?? 0) + 1)
  }

  const linkedTitleFmis = new Set<string>()
  const rows: EditableResultRow[] = []

  for (const plan of planRows) {
    const fmi = normalizeFmi(plan.planFolio)
    const title = fmi ? titlesByFmi.get(fmi) : undefined
    const status: LinkStatus = title ? 'linked' : 'plan_without_title'
    const row: EditableResultRow = { ...plan, ...titleFields(title), [LINK_STATUS_KEY]: STATUS_TEXT[status] }
    rows.push(row)

    if (!title) {
      summary.plansWithoutTitle++
      alerts.push({
        rowId: plan.id,
        columnKey: LINK_STATUS_KEY,
        kind: 'plan_without_title',
        severity: 'error',
        message: fmi
          ? `Ningún estudio de títulos aprobado tiene el FMI ${plan.planFolio}.`
          : 'El plano no tiene FMI. Ingrésalo para vincularlo con su estudio de títulos.',
      })
      if (!fmi) {
        alerts.push({ rowId: plan.id, columnKey: 'planFolio', kind: 'empty', severity: 'error', message: 'FMI vacío: es la llave para vincular el plano.' })
        summary.emptyCells++
      }
      continue
    }

    linkedTitleFmis.add(fmi)
    summary.linked++

    if ((planCountByFmi.get(fmi) ?? 0) > 1) {
      summary.duplicates++
      alerts.push({
        rowId: plan.id,
        columnKey: 'planFolio',
        kind: 'duplicate',
        severity: 'warning',
        message: `Hay ${planCountByFmi.get(fmi)} planos con el FMI ${title.folio}. Lo esperado es un plano por estudio de títulos.`,
      })
    }

    for (const field of COMPARED_FIELDS) {
      const planValue = String(plan[field.planKey] ?? '')
      const titleValue = String(title[field.titleKey] ?? '')
      const planEmpty = isEmptyValue(planValue)
      const titleEmpty = isEmptyValue(titleValue)
      if (planEmpty || titleEmpty) {
        if (planEmpty) {
          alerts.push({ rowId: plan.id, columnKey: field.planKey, kind: 'empty', severity: 'warning', message: `${field.label}: casilla vacía en el plano.` })
          summary.emptyCells++
        }
        if (titleEmpty) {
          alerts.push({ rowId: plan.id, columnKey: `${TITLE_PREFIX}${field.titleKey}`, kind: 'empty', severity: 'warning', message: `${field.label}: casilla vacía en el estudio de títulos.` })
          summary.emptyCells++
        }
        continue
      }
      if (!field.matches(planValue, titleValue)) {
        summary.mismatches++
        const message = `${field.label} no coincide. Plano: "${planValue}" · Estudio: "${titleValue}".`
        alerts.push({ rowId: plan.id, columnKey: field.planKey, kind: 'mismatch', severity: 'error', message })
        alerts.push({ rowId: plan.id, columnKey: `${TITLE_PREFIX}${field.titleKey}`, kind: 'mismatch', severity: 'error', message })
      }
    }

    for (const column of PLAN_TECHNICAL_COLUMNS) {
      if (isEmptyValue(plan[column.key])) {
        alerts.push({ rowId: plan.id, columnKey: column.key, kind: 'empty', severity: 'warning', message: `${column.label}: casilla vacía.` })
        summary.emptyCells++
      }
    }
  }

  titleRows.forEach((title, index) => {
    const fmi = normalizeFmi(title.folio)
    if (fmi && linkedTitleFmis.has(fmi)) return
    const id = `${TITLE_ONLY_ROW_PREFIX}${title.id || index}`
    const row: EditableResultRow = { id, ...titleFields(title), [LINK_STATUS_KEY]: STATUS_TEXT.title_without_plan, [READONLY_ROW_FLAG]: 'true' }
    rows.push(row)
    summary.titlesWithoutPlan++
    alerts.push({
      rowId: id,
      columnKey: LINK_STATUS_KEY,
      kind: 'title_without_plan',
      severity: 'error',
      message: fmi
        ? `El estudio de títulos con FMI ${title.folio} no tiene plano cargado.`
        : 'El estudio de títulos no tiene FMI y no puede vincularse a ningún plano.',
    })
  })

  return { columns: buildLinkedColumns(), rows, alerts, summary }
}

export function linkageAlertCount(summary: LinkSummary): number {
  return summary.mismatches + summary.emptyCells + summary.plansWithoutTitle + summary.titlesWithoutPlan + summary.duplicates
}

/** Instantánea persistida con la aprobación de planos (sin claves internas). */
export function linkageSnapshot(linkage: PlanTitleLinkage): Record<string, unknown> {
  return {
    linked_records: linkage.rows.map((row) => {
      const { [READONLY_ROW_FLAG]: _readonly, ...rest } = row
      return rest
    }),
    linkage_summary: linkage.summary,
    linkage_alerts: linkage.alerts.map(({ rowId, columnKey, kind, severity, message }) => ({ row_id: rowId, column: columnKey, kind, severity, message })),
  }
}
