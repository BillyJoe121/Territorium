/**
 * Consolidado CORRESPONDENCIA: una fila por predio (pareja estudio de títulos ↔ plano,
 * vinculada por FMI) con su negociación. Las 71 columnas (A–BS) siguen exactamente la
 * plantilla CORRESPONDENCIA.xlsx entregada por Territorium.
 */
import type { EditableResultRow, ResultColumn } from '../components/expediente/types'
import type { ConsolidatedMasterRecord } from './expedienteConsolidation'
import { checkNegotiatedValue, spanishIntegerWords } from './negotiatedValue'
import { isEmptyValue, normalizeFmi, parseAreaSquareMeters } from './planTitleLinking'

export type CorrespondenciaSource = 'titulo' | 'plano' | 'proyecto' | 'negociacion' | 'valor_negociado' | 'calculado' | 'manual'

export interface CorrespondenciaColumn {
  letter: string
  header: string
  source: CorrespondenciaSource
  /** Se guarda y exporta como número en el Excel. */
  numeric?: boolean
}

const col = (letter: string, header: string, source: CorrespondenciaSource, numeric = false): CorrespondenciaColumn => ({ letter, header, source, numeric })

/** Encabezados exactos de CORRESPONDENCIA.xlsx (Hoja1, fila 1), incluida la columna F sin título. */
export const CORRESPONDENCIA_COLUMNS: CorrespondenciaColumn[] = [
  col('A', 'CARPETA', 'negociacion'),
  col('B', 'FOLIO DE MATRICULA', 'titulo'),
  col('C', 'CEDULA CATASTRAL', 'titulo'),
  col('D', 'PROPIETARIOS DEL PREDIO', 'titulo'),
  col('E', 'NO DOCUMENTO', 'titulo'),
  col('F', '', 'titulo'),
  col('G', 'TIPO DOCUMENTO', 'titulo'),
  col('H', 'FECHA DE CONSULTA ANTEDECENTES DEL PROPIETARIO TUSDATOS.CO', 'titulo'),
  col('I', 'NOMBRE DEL PREDIO', 'titulo'),
  col('J', 'MUNICIPIO DEL PREDIO', 'titulo'),
  col('K', 'DEPARTAMENTO DEL PREDIO', 'titulo'),
  col('L', 'VEREDA DEL PREDIO', 'titulo'),
  col('M', 'AREA DEL PREDIO (NUMEROS)', 'titulo'),
  col('N', 'AREA DEL PREDIO (LETRAS)', 'titulo'),
  col('O', 'OFICINA DE REGISTRO DEL PREDIO', 'titulo'),
  col('P', 'MODO DE ADQUISICION DEL PREDIO', 'titulo'),
  col('Q', 'LINDEROS DEL PREDIO', 'titulo'),
  col('R', 'DOCUMENTO QUE CONTIENE LOS LINDEROS DEL PREDIO', 'titulo'),
  col('S', 'CONDICIONES JURÍDICAS VIGENTES', 'titulo'),
  col('T', 'RADICADO CONSULTA MINISTERIO DE JUSTICIA', 'titulo'),
  col('U', 'RADICADO CONSULTA URT', 'titulo'),
  col('V', 'DIRECCIÓN TERRITORIAL DE LA URT', 'titulo'),
  col('W', 'AREA SERVIDUMBRE M2 (NUMEROS)', 'plano', true),
  col('X', 'AREA SERVIDUMBRE M2 (LETRAS)', 'plano'),
  col('Y', 'LONGITUD SERVIDUMBRE M (NUMEROS)', 'plano', true),
  col('Z', 'LONGITUD SERVIDUMBRE M (LETRAS)', 'plano'),
  col('AA', 'ANCHO SERVIDUMBRE M (NUMEROS)', 'plano'),
  col('AB', 'ANCHO SERVIDUMBRE M (LETRAS)', 'plano'),
  col('AC', 'ANCHO A PARTIR DEL EJE M (NUMEROS)', 'calculado', true),
  col('AD', 'ANCHO A PARTIR DEL EJE M (LETRAS)', 'calculado'),
  col('AE', 'CANTIDAD DE POSTES (NUMEROS)', 'plano', true),
  col('AF', 'CANTIDAD DE POSTES (LETRAS)', 'plano'),
  col('AG', 'CANTIDAD DE CAJAS (NUMEROS)', 'plano', true),
  col('AH', 'CANTIDAD DE CAJAS (LETRAS)', 'plano'),
  col('AI', 'NOMBRE DEL PLANO', 'plano'),
  col('AJ', 'ESCALA DEL PLANO', 'plano'),
  col('AK', 'FECHA DEL PLANO', 'plano'),
  col('AL', 'NOMBRE DEL PROYECTO', 'proyecto'),
  col('AM', 'TENSIÓN', 'proyecto'),
  col('AN', 'NOMBRE EMPRESA E.S. P.', 'proyecto'),
  col('AO', 'NIT EMPRESA E.S.P.', 'proyecto'),
  col('AP', 'DOMICILIO EMPRESA', 'proyecto'),
  col('AQ', 'NOMBRE REPR. LEGAL EMPRESA E.S.P.', 'proyecto'),
  col('AR', 'CEDULA REPR. LEGAL EMPRESA E.S.P.', 'proyecto', true),
  col('AS', 'NOMBRE ENCARGADO BIENES INMUEBLES', 'proyecto'),
  col('AT', 'CC ENCARGADO BIENES INMUEBLES', 'proyecto', true),
  col('AU', 'CIUDAD DE EXPEDICION CC', 'proyecto'),
  col('AV', 'NOMBRE APODERADO ESCRITURA PUBLICA', 'proyecto'),
  col('AW', 'CC APODERADO ESCRITURA PUBLICA', 'proyecto', true),
  col('AX', 'CIUDAD DE EXPEDICION CC', 'proyecto'),
  col('AY', 'VALOR OFERTA 1 (NUMEROS)', 'negociacion', true),
  col('AZ', 'VALOR OFERTA 1 (LETRAS)', 'negociacion'),
  col('BA', 'VALOR OFERTA 2 (NUMEROS)', 'negociacion', true),
  col('BB', 'VALOR OFERTA 2 (LETRAS)', 'negociacion'),
  col('BC', 'VALOR OFERTA 3 (NUMEROS)', 'negociacion', true),
  // Encabezado tal como está en la plantilla (aunque la columna contiene letras).
  col('BD', 'VALOR OFERTA 3 (NUMEROS)', 'negociacion'),
  col('BE', 'VALOR NEGOCIADO (NUMEROS)', 'valor_negociado', true),
  col('BF', 'VALOR NEGOCIADO (LETRAS)', 'valor_negociado'),
  col('BG', 'PRIMER PAGO 60% (NUMEROS)', 'calculado', true),
  col('BH', 'PRIMER PAGO 60% (LETRAS)', 'calculado'),
  col('BI', 'SEGUNDO PAGO 40% (NUMEROS)', 'calculado', true),
  col('BJ', 'SEGUNDO PAGO 40% (LETRAS)', 'calculado'),
  col('BK', '% CLAUSULA PENAL', 'manual', true),
  col('BL', 'TIPO DE CUENTA BANCARIA PROPIETARIO', 'manual'),
  col('BM', 'NUMERO DE CUENTA', 'manual'),
  col('BN', 'BANCO', 'manual'),
  col('BO', 'DIRECCIÓN PROPIETARIO', 'manual'),
  col('BP', 'TELEFONO PROPIETARIO', 'manual'),
  col('BQ', 'CORREO ELECTRONICO PROPIETARIO', 'manual'),
  col('BR', 'ESTADO CIVIL PROPIETARIO', 'manual'),
  col('BS', 'CIUDAD DE DOMICILIO PROPIETARIO', 'manual'),
]

const SOURCE_LABEL: Record<CorrespondenciaSource, string> = {
  titulo: 'Estudio de títulos',
  plano: 'Plano',
  proyecto: 'Dato del proyecto (igual para todas las filas)',
  negociacion: 'Plantilla de negociación',
  valor_negociado: 'Valor negociado',
  calculado: 'Calculado automáticamente',
  manual: 'Se diligencia por predio',
}

/** Columnas del modal: letra + encabezado de la plantilla. */
export function correspondenciaTableColumns(): ResultColumn[] {
  return CORRESPONDENCIA_COLUMNS.map((c) => ({
    key: c.letter,
    label: `${c.letter} · ${c.header || '(sin título)'}`,
    width: ['Q', 'P', 'S'].includes(c.letter) ? 320 : c.header.includes('(LETRAS)') || c.letter === 'BD' ? 340 : c.header.length > 28 ? 230 : 170,
    editable: c.source !== 'calculado',
    broadcast: c.source === 'proyecto',
    hint: SOURCE_LABEL[c.source],
  }))
}

/** Datos de la empresa y el proyecto (columnas AL–AX): iguales en todas las filas. */
export type ProjectConstants = Record<'AL' | 'AM' | 'AN' | 'AO' | 'AP' | 'AQ' | 'AR' | 'AS' | 'AT' | 'AU' | 'AV' | 'AW' | 'AX', string>

/** Valores por defecto tomados de la fila de ejemplo de CORRESPONDENCIA.xlsx (cliente CELSIA). */
export function defaultProjectConstants(projectName?: string): ProjectConstants {
  return {
    AL: projectName || 'SUPLENCIAS ARREBOLES ETAPA-2',
    AM: '13,2 kV',
    AN: 'CELSIA COLOMBIA S.A E.S.P.',
    AO: '800.249.860-1',
    AP: 'Yumbo - Valle del Cauca',
    AQ: 'Julián Darío Cadavid Velásquez',
    AR: '71624537',
    AS: 'Yeison Fabian Marín Álzate',
    AT: '80190666',
    AU: 'Bogotá',
    AV: 'Yeison Fabian Marín Álzate',
    AW: '80190666',
    AX: 'Bogotá',
  }
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "15/10/2024", "2024/10/15" o "2024-10-15" → "quince (15) de octubre de 2024". */
export function formatLongDate(value: string): string {
  const text = String(value ?? '').trim()
  let day: number | undefined
  let month: number | undefined
  let year: number | undefined
  let m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(text)
  if (m) [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  m = m ? m : /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(text)
  if (m && day === undefined) [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (!day || !month || !year || month > 12 || day > 31) return text
  return `${spanishIntegerWords(day, false)} (${String(day).padStart(2, '0')}) de ${MESES[month - 1]} de ${year}`
}

/** "3.374,06 m²", "3374,06", "3374.06" → 3374.06 */
export function parseDecimal(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const text = String(value).trim()
  if (isEmptyValue(text)) return null
  const match = /-?\d[\d.,]*/.exec(text.replace(/\s/g, ''))
  if (!match) return null
  let raw = match[0]
  if (raw.includes('.') && raw.includes(',')) raw = raw.replace(/\./g, '').replace(',', '.')
  else if (raw.includes(',')) raw = raw.replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, '')
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

const plain = (n: number, decimals = 2) => String(Number(n.toFixed(decimals)))
const upper = (text: string) => text.toUpperCase()

/** 3374.06 → "TRES MIL TRESCIENTOS SETENTA Y CUATRO CON SEIS" (+ unidad). */
export function decimalWords(n: number, unit = ''): string {
  const fixed = Math.round(n * 100) / 100
  const integer = Math.trunc(fixed)
  const cents = Math.round((fixed - integer) * 100)
  const base = spanishIntegerWords(integer, Boolean(unit))
  if (unit && cents === 50) return upper(`${base} ${unit} y medio`)
  const decimals = cents ? ` con ${spanishIntegerWords(cents, Boolean(unit))}` : ''
  return upper(`${base}${decimals}${unit ? ` ${unit}` : ''}`)
}

const pesos = (n: number) => upper(`${spanishIntegerWords(n)}${n % 1_000_000 === 0 && n >= 1_000_000 ? ' de' : ''} pesos`)

/** 69524 m² → "6 ha 9524 m2" y "SEIS HECTÁREAS CON NUEVE MIL QUINIENTOS VEINTICUATRO METROS CUADRADOS". */
function hectares(m2: number): { numbers: string; letters: string } {
  const ha = Math.floor(m2 / 10000)
  const rest = Math.round((m2 - ha * 10000) * 100) / 100
  if (!ha) return { numbers: `${plain(rest)} m2`, letters: decimalWords(rest, 'metros cuadrados') }
  const haWords = ha === 1 ? 'UNA HECTÁREA' : `${upper(spanishIntegerWords(ha))} HECTÁREAS`
  if (!rest) return { numbers: `${ha} ha`, letters: haWords }
  return { numbers: `${ha} ha ${plain(rest)} m2`, letters: `${haWords} CON ${decimalWords(rest, 'metros cuadrados')}` }
}

const DOC_TYPE: Record<string, string> = {
  'cedula de ciudadania': 'CC', 'cédula de ciudadanía': 'CC', cc: 'CC', 'c.c.': 'CC', nit: 'NIT',
  'cedula de extranjeria': 'CE', 'cédula de extranjería': 'CE', ce: 'CE', pasaporte: 'PA',
}

const text = (value: unknown) => (isEmptyValue(value as string) ? '' : String(value).trim())

export interface CorrespondenciaInputs {
  titlesPayload: Record<string, unknown>
  plansPayload: Record<string, unknown>
  negotiationPayload: Record<string, unknown>
  constants: ProjectConstants
}

export interface CorrespondenciaExclusion {
  fmi: string
  label: string
  reason: string
}

export interface CorrespondenciaResult {
  rows: EditableResultRow[]
  excluded: CorrespondenciaExclusion[]
}

function listOf(payload: Record<string, unknown>, key: string): Record<string, any>[] {
  const value = payload[key]
  return Array.isArray(value) ? (value as Record<string, any>[]) : []
}

/** Calcula las columnas derivadas del valor negociado y el ancho desde el eje. */
export function deriveCorrespondenciaRow(row: EditableResultRow): EditableResultRow {
  const next = { ...row }
  const negotiated = parseDecimal(row.BE)
  if (negotiated !== null && negotiated > 0) {
    const value = Math.round(negotiated)
    const first = Math.round(value * 0.6)
    const second = value - first
    next.BG = String(first)
    next.BH = pesos(first)
    next.BI = String(second)
    next.BJ = pesos(second)
  } else {
    next.BG = next.BH = next.BI = next.BJ = ''
  }
  const width = parseDecimal(row.AA)
  if (width !== null && width > 0) {
    next.AC = plain(width / 2)
    next.AD = decimalWords(width / 2, 'metros')
  } else {
    next.AC = next.AD = ''
  }
  return next
}

export function buildCorrespondencia({ titlesPayload, plansPayload, negotiationPayload, constants }: CorrespondenciaInputs): CorrespondenciaResult {
  const titles = listOf(titlesPayload, 'titles')
  const plans = listOf(plansPayload, 'plans')
  const negotiations = listOf(negotiationPayload, 'negotiations')

  const planByFmi = new Map<string, Record<string, any>>()
  for (const plan of plans) {
    const fmi = normalizeFmi(plan.folio)
    if (fmi && !planByFmi.has(fmi)) planByFmi.set(fmi, plan)
  }
  const negotiationByFmi = new Map<string, Record<string, any>>()
  for (const negotiation of negotiations) {
    const fmi = normalizeFmi(negotiation.fmi)
    if (fmi && !negotiationByFmi.has(fmi)) negotiationByFmi.set(fmi, negotiation)
  }

  const rows: EditableResultRow[] = []
  const excluded: CorrespondenciaExclusion[] = []

  titles.forEach((title, index) => {
    const fmi = normalizeFmi(title.folio)
    const label = text(title.property_name) || text(title.source_document) || `Estudio ${index + 1}`
    if (!fmi) {
      excluded.push({ fmi: '', label, reason: 'El estudio de títulos no tiene FMI.' })
      return
    }
    const plan = planByFmi.get(fmi)
    if (!plan) {
      excluded.push({ fmi: title.folio, label, reason: 'No tiene plano vinculado.' })
      return
    }
    const negotiation = negotiationByFmi.get(fmi)
    if (!negotiation) {
      excluded.push({ fmi: title.folio, label, reason: 'No tiene fila en la plantilla de negociación.' })
      return
    }
    const check = checkNegotiatedValue(String(negotiation.negotiated_value_numbers ?? ''), String(negotiation.negotiated_value_letters ?? ''))
    if (!check.ok || check.amount === null) {
      excluded.push({ fmi: title.folio, label, reason: 'La negociación no tiene un valor negociado válido.' })
      return
    }

    const owners = Array.isArray(title.owners) ? title.owners : []
    const ownerNames = owners.map((o: any) => text(o?.name)).filter(Boolean)
    const ownerDocs = owners.map((o: any) => text(o?.document_number)).filter(Boolean)
    const ownerTypes = owners.map((o: any) => DOC_TYPE[text(o?.document_type).toLowerCase()] ?? text(o?.document_type)).filter(Boolean)
    const area = parseAreaSquareMeters(text(title.area_numbers))
    const areaParts = area !== null ? hectares(area) : { numbers: text(title.area_numbers), letters: text(title.area_letters) }

    const easementArea = parseDecimal(plan.easement_area_numbers)
    const easementLength = parseDecimal(plan.easement_length_numbers)
    const easementWidth = parseDecimal(plan.easement_width_numbers)
    const poles = parseDecimal(plan.infrastructure_count_numbers)
    const boxes = parseDecimal(plan.box_count_numbers)
    const offers = [1, 2, 3].map((n) => {
      const key = ['first', 'second', 'third'][n - 1]
      const value = parseDecimal(negotiation[`${key}_offer_numbers`])
      return { value, letters: text(negotiation[`${key}_offer_letters`]) }
    })
    const planName = text(plan.plan_name) || text(plan.source_document).replace(/\.pdf$/i, '')

    const row: EditableResultRow = {
      id: `corr-${fmi}`,
      A: text(negotiation.property_code) || (/[A-Z]{3}-[A-Z]{3}-\d{3}/.exec(planName)?.[0] ?? ''),
      B: text(title.folio),
      C: text(title.cadastral_id),
      D: ownerNames.join(' / ') || text(title.owners_str),
      E: ownerDocs.join(' / ') || text(title.document_number),
      F: '',
      G: ownerTypes.join(' / ') || (DOC_TYPE[text(title.document_type).toLowerCase()] ?? text(title.document_type)),
      H: formatLongDate(text(title.antecedents_consultation_date)),
      I: text(title.property_name),
      J: text(title.municipality),
      K: text(title.department),
      L: text(title.village),
      M: areaParts.numbers,
      N: text(title.area_letters) || areaParts.letters,
      O: text(title.registry_office),
      P: text(title.acquisition_mode),
      Q: text(title.boundaries),
      R: text(title.boundaries_document),
      S: text(title.legal_conditions),
      T: text(title.justice_ministry_case),
      U: text(title.urt_case),
      V: text(title.urt_territorial_direction),
      W: easementArea !== null ? plain(easementArea) : '',
      X: easementArea !== null ? decimalWords(easementArea, 'metros cuadrados') : text(plan.easement_area_letters),
      Y: easementLength !== null ? plain(easementLength) : '',
      Z: easementLength !== null ? decimalWords(easementLength) : text(plan.easement_length_letters),
      AA: easementWidth !== null ? `${plain(easementWidth)} m` : '',
      AB: easementWidth !== null ? decimalWords(easementWidth, 'metros') : text(plan.easement_width_letters),
      AC: '',
      AD: '',
      AE: poles !== null ? plain(poles, 0) : '',
      AF: poles !== null ? upper(spanishIntegerWords(Math.round(poles), false)) : text(plan.infrastructure_count_letters),
      AG: boxes !== null ? plain(boxes, 0) : '',
      AH: boxes !== null ? upper(spanishIntegerWords(Math.round(boxes), false)) : '',
      AI: planName,
      AJ: text(plan.plan_scale),
      AK: formatLongDate(text(plan.plan_date)),
      ...constants,
      AY: offers[0].value !== null ? String(Math.round(offers[0].value)) : '',
      AZ: offers[0].letters,
      BA: offers[1].value !== null ? String(Math.round(offers[1].value)) : '',
      BB: offers[1].letters,
      BC: offers[2].value !== null ? String(Math.round(offers[2].value)) : '',
      BD: offers[2].letters,
      BE: String(check.amount),
      BF: upper(String(negotiation.negotiated_value_letters ?? '').trim()),
      BG: '', BH: '', BI: '', BJ: '',
      BK: '0.2',
      BL: '', BM: '', BN: '', BO: '', BP: '', BQ: '', BR: '', BS: '',
    }
    rows.push(deriveCorrespondenciaRow(row))
  })

  // Negociaciones cuyo FMI no corresponde a ningún estudio de títulos.
  const titleFmis = new Set(titles.map((t) => normalizeFmi(t.folio)).filter(Boolean))
  for (const negotiation of negotiations) {
    const fmi = normalizeFmi(negotiation.fmi)
    if (fmi && !titleFmis.has(fmi) && (negotiation.negotiated_value_numbers || negotiation.negotiated_value_letters)) {
      excluded.push({ fmi: negotiation.fmi, label: text(negotiation.property_code) || negotiation.fmi, reason: 'La negociación no tiene estudio de títulos ni plano.' })
    }
  }

  return { rows, excluded }
}

/** Fila CORRESPONDENCIA → registro maestro que usan las plantillas de documento final. */
export function correspondenciaRowToMasterRecord(row: EditableResultRow, metadata: Partial<ConsolidatedMasterRecord['metadata']> = {}): ConsolidatedMasterRecord {
  const fmt = (n: string) => {
    const value = parseDecimal(n)
    return value === null ? '—' : `$ ${Math.round(value).toLocaleString('es-CO').replace(/,/g, '.')}`
  }
  return {
    folio: row.B || '—',
    cadastral_id: row.C || '—',
    property_name: row.I || '—',
    municipality: row.J || '—',
    department: row.K || '—',
    village: row.L || '—',
    owners: row.D ? row.D.split(' / ').map((name, i) => `${name}${row.E?.split(' / ')[i] ? ` (${row.G?.split(' / ')[i] || 'CC'} ${row.E.split(' / ')[i]})` : ''}`).join('; ') : '—',
    area_numbers: row.M || '—',
    area_letters: row.N || '—',
    registry_office: row.O || '—',
    acquisition_mode: row.P || '—',
    boundaries: row.Q || '—',
    boundaries_document: row.R || '—',
    legal_conditions: row.S || '—',
    justice_ministry_case: row.T || '—',
    urt_case: row.U || '—',
    urt_territorial_direction: row.V || '—',
    easement_area: row.W ? row.W.replace('.', ',') : '—',
    easement_area_letters: row.X || '—',
    easement_length: row.Y ? row.Y.replace('.', ',') : '—',
    easement_length_letters: row.Z || '—',
    easement_width: row.AA ? row.AA.replace(/\s*m$/, '').replace('.', ',') : '—',
    easement_width_letters: row.AB || '—',
    infrastructure_count: row.AE || '0',
    infrastructure_count_letters: row.AF || '—',
    plan_name: row.AI || '—',
    plan_scale: row.AJ || '—',
    voltage_level: row.AM || '—',
    property_code: row.A || '—',
    first_offer: fmt(row.AY),
    first_offer_letters: row.AZ || '—',
    second_offer: fmt(row.BA),
    second_offer_letters: row.BB || '—',
    third_offer: fmt(row.BC),
    third_offer_letters: row.BD || '—',
    values_match: 'Sí, coinciden',
    negotiated_value: fmt(row.BE),
    negotiated_value_letters: row.BF || '—',
    metadata: {
      titles_result_version_id: metadata.titles_result_version_id ?? '—',
      plans_result_version_id: metadata.plans_result_version_id ?? '—',
      negotiation_result_version_id: metadata.negotiation_result_version_id ?? '—',
      consolidated_at: metadata.consolidated_at ?? new Date().toISOString(),
      consolidated_by: metadata.consolidated_by,
      is_valid: true,
    },
  }
}

/** Valor negociado BE (números) y BF (letras) deben coincidir en cada fila del consolidado. */
export function validateCorrespondenciaRows(rows: EditableResultRow[]): { rowId: string; columnKey: string; severity: 'error'; kind: string; message: string }[] {
  const alerts: { rowId: string; columnKey: string; severity: 'error'; kind: string; message: string }[] = []
  for (const row of rows) {
    if (!('BE' in row)) continue
    const check = checkNegotiatedValue(String(row.BE ?? ''), String(row.BF ?? ''))
    if (check.ok) continue
    if (check.numbersError) alerts.push({ rowId: row.id, columnKey: 'BE', severity: 'error', kind: 'invalid_value', message: check.numbersError })
    if (check.lettersError) alerts.push({ rowId: row.id, columnKey: 'BF', severity: 'error', kind: 'invalid_value', message: check.lettersError })
  }
  return alerts
}
