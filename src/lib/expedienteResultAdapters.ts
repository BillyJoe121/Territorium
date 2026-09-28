import type { EditableResultRow, ResultColumn } from '../components/expediente/types'
import type { ExpedienteGroupKey } from './expedienteWorkflow'

export interface ValidationNotice {
  fieldName: string
  severity: 'error' | 'warning'
  message: string
}

export interface AdaptedResultData {
  columns: ResultColumn[]
  rows: EditableResultRow[]
  validationNotices: ValidationNotice[]
}

export const TITLE_COLUMNS_CONTRACT: ResultColumn[] = [
  { key: 'sourceDocument', label: 'Documento fuente', width: 220, editable: false },
  { key: 'folio', label: 'Folio de matrícula', width: 170 },
  { key: 'cadastralId', label: 'Cédula catastral', width: 190 },
  { key: 'owners', label: 'Propietarios del predio', width: 240 },
  { key: 'documentNumber', label: 'No. documento', width: 145 },
  { key: 'documentType', label: 'Tipo documento', width: 165 },
  { key: 'antecedentsConsultationDate', label: 'Fecha consulta Tusdatos.co', width: 230 },
  { key: 'propertyName', label: 'Nombre del predio', width: 180 },
  { key: 'municipality', label: 'Municipio', width: 160 },
  { key: 'department', label: 'Departamento', width: 160 },
  { key: 'village', label: 'Vereda', width: 160 },
  { key: 'areaNumbers', label: 'Área del predio (números)', inputMode: 'numeric', width: 190 },
  { key: 'areaLetters', label: 'Área del predio (letras)', width: 260 },
  { key: 'registryOffice', label: 'Oficina de registro (ORIP)', width: 210 },
  { key: 'acquisitionMode', label: 'Modo de adquisición', width: 260 },
  { key: 'boundaries', label: 'Linderos del predio (literal)', width: 320 },
  { key: 'boundariesDocument', label: 'Documento fuente de linderos', width: 260 },
  { key: 'legalConditions', label: 'Condiciones jurídicas vigentes', width: 260 },
  { key: 'justiceMinistryCase', label: 'Radicado MinJusticia', width: 220 },
  { key: 'urtCase', label: 'Radicado URT', width: 200 },
  { key: 'urtTerritorialDirection', label: 'Dirección territorial URT', width: 210 },
]

export const PLAN_COLUMNS_CONTRACT: ResultColumn[] = [
  { key: 'planName', label: 'Nombre del plano', width: 220 },
  { key: 'easementAreaNumbers', label: 'Área servidumbre (m²) números', inputMode: 'numeric', width: 210 },
  { key: 'easementAreaLetters', label: 'Área servidumbre (m²) letras', width: 240 },
  { key: 'easementLengthNumbers', label: 'Longitud servidumbre (m) números', inputMode: 'numeric', width: 230 },
  { key: 'easementLengthLetters', label: 'Longitud servidumbre (m) letras', width: 240 },
  { key: 'easementWidthNumbers', label: 'Ancho servidumbre (m) números', inputMode: 'numeric', width: 210 },
  { key: 'easementWidthLetters', label: 'Ancho servidumbre (m) letras', width: 220 },
  { key: 'infrastructureCountNumbers', label: 'Postes / infraestructuras números', inputMode: 'numeric', width: 260 },
  { key: 'infrastructureCountLetters', label: 'Postes / infraestructuras letras', width: 250 },
  { key: 'planScale', label: 'Escala del plano', width: 140 },
  { key: 'voltageLevel', label: 'Nivel de tensión', width: 150 },
]

export const NEGOTIATION_COLUMNS_CONTRACT: ResultColumn[] = [
  { key: 'propertyCode', label: 'Código carpeta / predio', editable: false, width: 180 },
  { key: 'firstOfferNumbers', label: 'Primera oferta (números)', inputMode: 'numeric', width: 210 },
  { key: 'firstOfferLetters', label: 'Primera oferta (letras)', width: 290 },
  { key: 'secondOfferNumbers', label: 'Segunda oferta (números)', inputMode: 'numeric', width: 215 },
  { key: 'secondOfferLetters', label: 'Segunda oferta (letras)', width: 290 },
  { key: 'thirdOfferNumbers', label: 'Tercera oferta (números)', inputMode: 'numeric', width: 215 },
  { key: 'thirdOfferLetters', label: 'Tercera oferta (letras)', width: 290 },
  { key: 'valuesMatch', label: '¿Coinciden números y letras?', editable: false, width: 230 },
]

export const CONSOLIDATED_COLUMNS_CONTRACT: ResultColumn[] = [
  { key: 'field', label: 'Campo maestro', editable: false, width: 210 },
  { key: 'value', label: 'Valor consolidado', width: 380 },
  { key: 'source', label: 'Subconjunto origen', editable: false, width: 140 },
]

export function adaptCanonicalPayloadToTable(
  groupKey: ExpedienteGroupKey | 'consolidated',
  payload: Record<string, unknown>,
  validationReport?: { errors?: Array<{ field_name: string; message: string }>; warnings?: Array<{ field_name: string; message: string }> },
): AdaptedResultData {
  const notices: ValidationNotice[] = []
  if (validationReport) {
    for (const err of validationReport.errors ?? []) {
      notices.push({ fieldName: err.field_name, severity: 'error', message: err.message })
    }
    for (const warn of validationReport.warnings ?? []) {
      notices.push({ fieldName: warn.field_name, severity: 'warning', message: warn.message })
    }
  }

  if (groupKey === 'titles') {
    const titlesList = Array.isArray(payload.titles) && payload.titles.length > 0
      ? payload.titles
      : [payload]

    const rows: EditableResultRow[] = titlesList.map((t: any, idx: number) => {
      const owners = Array.isArray(t.owners) ? t.owners : []
      const primaryOwner = owners[0] ?? {}
      const ownersFormatted = owners.map((o: any) => o.name ?? '').filter(Boolean).join('; ') || String(t.owners_str ?? '')

      return {
        id: `title-row-${idx + 1}`,
        sourceDocument: String(t.source_document ?? t.sourceDocument ?? (titlesList.length > 1 ? `Documento ${idx + 1}` : 'Documento principal')),
        folio: String(t.folio ?? ''),
        cadastralId: String(t.cadastral_id ?? t.cadastralId ?? ''),
        owners: ownersFormatted || String(primaryOwner.name ?? ''),
        documentNumber: String(primaryOwner.document_number ?? primaryOwner.documentNumber ?? t.document_number ?? t.documentNumber ?? ''),
        documentType: String(primaryOwner.document_type ?? primaryOwner.documentType ?? t.document_type ?? t.documentType ?? 'Cédula de ciudadanía'),
        antecedentsConsultationDate: String(t.antecedents_consultation_date ?? t.antecedentsConsultationDate ?? ''),
        propertyName: String(t.property_name ?? t.propertyName ?? ''),
        municipality: String(t.municipality ?? ''),
        department: String(t.department ?? ''),
        village: String(t.village ?? ''),
        areaNumbers: String(t.area_numbers ?? t.areaNumbers ?? ''),
        areaLetters: String(t.area_letters ?? t.areaLetters ?? ''),
        registryOffice: String(t.registry_office ?? t.registryOffice ?? ''),
        acquisitionMode: String(t.acquisition_mode ?? t.acquisitionMode ?? ''),
        boundaries: String(t.boundaries ?? ''),
        boundariesDocument: String(t.boundaries_document ?? t.boundariesDocument ?? ''),
        legalConditions: String(t.legal_conditions ?? t.legalConditions ?? ''),
        justiceMinistryCase: String(t.justice_ministry_case ?? t.justiceMinistryCase ?? ''),
        urtCase: String(t.urt_case ?? t.urtCase ?? ''),
        urtTerritorialDirection: String(t.urt_territorial_direction ?? t.urtTerritorialDirection ?? ''),
      }
    })

    return { columns: TITLE_COLUMNS_CONTRACT, rows, validationNotices: notices }
  }

  if (groupKey === 'plans') {
    const plansList = Array.isArray(payload.plans) && payload.plans.length > 0 ? payload.plans : [payload]
    const rows: EditableResultRow[] = plansList.map((p: any, idx: number) => ({
      id: `plan-row-${idx + 1}`,
      planName: String(p.plan_name ?? p.planName ?? `Plano ${idx + 1}`),
      easementAreaNumbers: String(p.easement_area_numbers ?? p.easementAreaNumbers ?? '—'),
      easementAreaLetters: String(p.easement_area_letters ?? p.easementAreaLetters ?? '—'),
      easementLengthNumbers: String(p.easement_length_numbers ?? p.easementLengthNumbers ?? '—'),
      easementLengthLetters: String(p.easement_length_letters ?? p.easementLengthLetters ?? '—'),
      easementWidthNumbers: String(p.easement_width_numbers ?? p.easementWidthNumbers ?? '—'),
      easementWidthLetters: String(p.easement_width_letters ?? p.easementWidthLetters ?? '—'),
      infrastructureCountNumbers: String(p.infrastructure_count_numbers ?? p.infrastructureCountNumbers ?? '0'),
      infrastructureCountLetters: String(p.infrastructure_count_letters ?? p.infrastructureCountLetters ?? 'cero'),
      planScale: String(p.plan_scale ?? p.planScale ?? '—'),
      voltageLevel: String(p.voltage_level ?? p.voltageLevel ?? '—'),
    }))

    return { columns: PLAN_COLUMNS_CONTRACT, rows, validationNotices: notices }
  }

  if (groupKey === 'negotiation') {
    const row: EditableResultRow = {
      id: 'negotiation-row-1',
      propertyCode: String(payload.property_code ?? payload.propertyCode ?? '—'),
      firstOfferNumbers: String(payload.first_offer_numbers ?? payload.firstOfferNumbers ?? '—'),
      firstOfferLetters: String(payload.first_offer_letters ?? payload.firstOfferLetters ?? '—'),
      secondOfferNumbers: String(payload.second_offer_numbers ?? payload.secondOfferNumbers ?? '—'),
      secondOfferLetters: String(payload.second_offer_letters ?? payload.secondOfferLetters ?? '—'),
      thirdOfferNumbers: String(payload.third_offer_numbers ?? payload.thirdOfferNumbers ?? '—'),
      thirdOfferLetters: String(payload.third_offer_letters ?? payload.thirdOfferLetters ?? '—'),
      valuesMatch: String(payload.values_match ?? payload.valuesMatch ?? 'Sí, coinciden'),
    }

    return { columns: NEGOTIATION_COLUMNS_CONTRACT, rows: [row], validationNotices: notices }
  }

  // Consolidated: comprehensive mapping of all fields without omitting or summarizing
  const consolidatedFields = [
    // 1. Identidad y antecedentes jurídicos (Títulos)
    { key: 'folio', label: 'Matrícula inmobiliaria', source: 'Títulos' },
    { key: 'cadastral_id', label: 'Cédula catastral', source: 'Títulos' },
    { key: 'property_name', label: 'Nombre del predio', source: 'Títulos' },
    { key: 'municipality', label: 'Municipio del predio', source: 'Títulos' },
    { key: 'department', label: 'Departamento del predio', source: 'Títulos' },
    { key: 'village', label: 'Vereda del predio', source: 'Títulos' },
    { key: 'owners', label: 'Propietario(s) actual(es)', source: 'Títulos' },
    { key: 'area_numbers', label: 'Área del predio (números)', source: 'Títulos' },
    { key: 'area_letters', label: 'Área del predio (letras)', source: 'Títulos' },
    { key: 'registry_office', label: 'Oficina de registro', source: 'Títulos' },
    { key: 'acquisition_mode', label: 'Modo de adquisición', source: 'Títulos' },
    { key: 'boundaries', label: 'Linderos del predio', source: 'Títulos' },
    { key: 'boundaries_document', label: 'Documento que contiene los linderos', source: 'Títulos' },
    { key: 'legal_conditions', label: 'Condiciones jurídicas vigentes', source: 'Títulos' },
    { key: 'justice_ministry_case', label: 'Radicado Ministerio de Justicia', source: 'Títulos' },
    { key: 'urt_case', label: 'Radicado consulta URT', source: 'Títulos' },
    { key: 'urt_territorial_direction', label: 'Dirección territorial URT', source: 'Títulos' },

    // 2. Información técnica y geográfica (Planos)
    { key: 'plan_name', label: 'Nombre del plano', source: 'Planos' },
    { key: 'plan_scale', label: 'Escala del plano', source: 'Planos' },
    { key: 'voltage_level', label: 'Nivel de tensión', source: 'Planos' },
    { key: 'easement_area', label: 'Área de servidumbre', source: 'Planos' },
    { key: 'easement_area_letters', label: 'Área de servidumbre (letras)', source: 'Planos' },
    { key: 'easement_length', label: 'Longitud de servidumbre', source: 'Planos' },
    { key: 'easement_length_letters', label: 'Longitud de servidumbre (letras)', source: 'Planos' },
    { key: 'easement_width', label: 'Ancho de servidumbre', source: 'Planos' },
    { key: 'easement_width_letters', label: 'Ancho de servidumbre (letras)', source: 'Planos' },
    { key: 'infrastructure_count', label: 'Cantidad de postes / apoyos', source: 'Planos' },
    { key: 'infrastructure_count_letters', label: 'Cantidad de postes / apoyos (letras)', source: 'Planos' },

    // 3. Negociación y ofertas económicas (Negociación)
    { key: 'property_code', label: 'Código carpeta / predio', source: 'Negociación' },
    { key: 'first_offer', label: 'Primera oferta económica', source: 'Negociación' },
    { key: 'first_offer_letters', label: 'Primera oferta (letras)', source: 'Negociación' },
    { key: 'second_offer', label: 'Segunda oferta económica', source: 'Negociación' },
    { key: 'second_offer_letters', label: 'Segunda oferta (letras)', source: 'Negociación' },
    { key: 'third_offer', label: 'Tercera oferta económica', source: 'Negociación' },
    { key: 'third_offer_letters', label: 'Tercera oferta (letras)', source: 'Negociación' },
    { key: 'values_match', label: '¿Coinciden números y letras?', source: 'Negociación' },
    { key: 'appraisal_value', label: 'Valor del avalúo comercial', source: 'Negociación' },
  ]

  const rows: EditableResultRow[] = consolidatedFields.map(({ key, label, source }) => ({
    id: `cons-${key}`,
    field: label,
    value: String(payload[key] ?? '—'),
    source,
  }))

  return { columns: CONSOLIDATED_COLUMNS_CONTRACT, rows, validationNotices: notices }
}

export function adaptTableRowsToPayload(
  groupKey: ExpedienteGroupKey | 'consolidated',
  rows: EditableResultRow[],
  existingPayload: Record<string, unknown> = {},
): Record<string, unknown> {
  const result = { ...existingPayload }

  if (groupKey === 'titles' && rows.length > 0) {
    result.titles = rows.map((r) => ({
      source_document: r.sourceDocument,
      folio: r.folio,
      cadastral_id: r.cadastralId,
      owners_str: r.owners,
      owners: r.owners ? [{ name: r.owners, document_number: r.documentNumber, document_type: r.documentType }] : [],
      document_number: r.documentNumber,
      document_type: r.documentType,
      property_name: r.propertyName,
      municipality: r.municipality,
      department: r.department,
      village: r.village,
      area_numbers: r.areaNumbers,
      area_letters: r.areaLetters,
      registry_office: r.registryOffice,
      acquisition_mode: r.acquisitionMode,
      boundaries: r.boundaries,
      boundaries_document: r.boundariesDocument,
      legal_conditions: r.legalConditions,
      justice_ministry_case: r.justiceMinistryCase,
      urt_case: r.urtCase,
      urt_territorial_direction: r.urtTerritorialDirection,
      antecedents_consultation_date: r.antecedentsConsultationDate,
    }))

    const row = rows[0]
    result.source_document = row.sourceDocument
    result.folio = row.folio
    result.cadastral_id = row.cadastralId
    result.property_name = row.propertyName
    result.municipality = row.municipality
    result.department = row.department
    result.village = row.village
    result.area_numbers = row.areaNumbers
    result.area_letters = row.areaLetters
    result.registry_office = row.registryOffice
    result.acquisition_mode = row.acquisitionMode
    result.boundaries = row.boundaries
    result.boundaries_document = row.boundariesDocument
    result.legal_conditions = row.legalConditions
    result.justice_ministry_case = row.justiceMinistryCase
    result.urt_case = row.urtCase
    result.urt_territorial_direction = row.urtTerritorialDirection
    result.antecedents_consultation_date = row.antecedentsConsultationDate
    if (row.owners) {
      result.owners_str = row.owners
    }
  } else if (groupKey === 'plans') {
    result.plans = rows.map((r) => ({
      plan_name: r.planName,
      easement_area_numbers: r.easementAreaNumbers,
      easement_area_letters: r.easementAreaLetters,
      easement_length_numbers: r.easementLengthNumbers,
      easement_length_letters: r.easementLengthLetters,
      easement_width_numbers: r.easementWidthNumbers,
      easement_width_letters: r.easementWidthLetters,
      infrastructure_count_numbers: r.infrastructureCountNumbers,
      infrastructure_count_letters: r.infrastructureCountLetters,
      plan_scale: r.planScale,
      voltage_level: r.voltageLevel,
    }))
  } else if (groupKey === 'negotiation' && rows.length > 0) {
    const row = rows[0]
    result.property_code = row.propertyCode
    result.first_offer_numbers = row.firstOfferNumbers
    result.first_offer_letters = row.firstOfferLetters
    result.second_offer_numbers = row.secondOfferNumbers
    result.second_offer_letters = row.secondOfferLetters
    result.third_offer_numbers = row.thirdOfferNumbers
    result.third_offer_letters = row.thirdOfferLetters
    result.values_match = row.valuesMatch
  } else if (groupKey === 'consolidated') {
    for (const r of rows) {
      const fieldId = r.id.replace('cons-', '')
      result[fieldId] = r.value
    }
  }

  return result
}
