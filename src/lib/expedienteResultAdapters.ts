import type { EditableResultRow, ResultColumn } from '../components/expediente/types'
import type { ExpedienteGroupKey } from './expedienteWorkflow'
import { correspondenciaTableColumns } from './correspondencia'
import { buildNegotiationColumns } from './negotiationLinking'

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
  { key: 'planFolio', label: 'FMI (matrícula) del plano', width: 190 },
  { key: 'planSourceDocument', label: 'Archivo del plano', editable: false, width: 220 },
  { key: 'planCadastralId', label: 'Cédula catastral (plano)', width: 190 },
  { key: 'planPropertyName', label: 'Nombre del predio (plano)', width: 190 },
  { key: 'planOwners', label: 'Propietarios (plano)', width: 240 },
  { key: 'planMunicipality', label: 'Municipio (plano)', width: 170 },
  { key: 'planVillage', label: 'Vereda (plano)', width: 170 },
  { key: 'planPropertyArea', label: 'Área del predio (plano)', width: 180 },
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

export const CONSOLIDATED_COLUMNS_CONTRACT: ResultColumn[] = [
  { key: 'field', label: 'Campo maestro', editable: false, width: 210 },
  { key: 'value', label: 'Valor consolidado', width: 380 },
  { key: 'source', label: 'Subconjunto origen', editable: false, width: 190 },
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
    const text = (value: unknown, fallback = '') => (value === undefined || value === null ? fallback : String(value))
    const rows: EditableResultRow[] = plansList.map((p: any, idx: number) => ({
      id: `plan-row-${idx + 1}`,
      planFolio: text(p.folio ?? p.fmi ?? p.planFolio),
      planSourceDocument: text(p.source_document ?? p.planSourceDocument, `Plano ${idx + 1}`),
      planCadastralId: text(p.cadastral_id ?? p.planCadastralId),
      planPropertyName: text(p.property_name ?? p.planPropertyName),
      planOwners: text(p.owners ?? p.planOwners),
      planMunicipality: text(p.municipality ?? p.planMunicipality),
      planVillage: text(p.village ?? p.planVillage),
      planPropertyArea: text(p.property_area ?? p.planPropertyArea),
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
    const text = (value: unknown, fallback = '') => (value === undefined || value === null ? fallback : String(value))
    // La plantilla trae un predio por fila; los resultados antiguos traían solo uno.
    const list = Array.isArray(payload.negotiations) && payload.negotiations.length > 0
      ? (payload.negotiations as Record<string, unknown>[])
      : [payload]
    const rows: EditableResultRow[] = list.map((n, idx) => ({
      id: `neg-row-${idx + 1}`,
      propertyCode: text(n.property_code ?? n.propertyCode, '—'),
      negFolio: text(n.fmi ?? n.negFolio),
      negCadastralId: text(n.cadastral_id ?? n.negCadastralId),
      firstOfferNumbers: text(n.first_offer_numbers ?? n.firstOfferNumbers, '—'),
      firstOfferLetters: text(n.first_offer_letters ?? n.firstOfferLetters, '—'),
      secondOfferNumbers: text(n.second_offer_numbers ?? n.secondOfferNumbers, '—'),
      secondOfferLetters: text(n.second_offer_letters ?? n.secondOfferLetters, '—'),
      thirdOfferNumbers: text(n.third_offer_numbers ?? n.thirdOfferNumbers, '—'),
      thirdOfferLetters: text(n.third_offer_letters ?? n.thirdOfferLetters, '—'),
      valuesMatch: text(n.values_match ?? n.valuesMatch, 'Sí, coinciden'),
      // Valor negociado: lo ingresa el profesional en la tabla, por cada fila vinculada.
      negotiatedValueNumbers: text(n.negotiated_value_numbers),
      negotiatedValueLetters: text(n.negotiated_value_letters),
    }))

    return { columns: buildNegotiationColumns(), rows, validationNotices: notices }
  }

  if (groupKey === 'consolidated' && Array.isArray(payload.correspondencia)) {
    const rows = (payload.correspondencia as Record<string, unknown>[]).map((row, idx) => {
      const out: EditableResultRow = { id: String(row.id ?? `corr-${idx + 1}`) }
      for (const [key, value] of Object.entries(row)) if (key !== 'id') out[key] = value === null || value === undefined ? '' : String(value)
      return out
    })
    return { columns: correspondenciaTableColumns(), rows, validationNotices: notices }
  }

  // Consolidated: comprehensive mapping of all fields without omitting or summarizing
  const consolidatedFields = [
    // 1. Identidad y antecedentes jurídicos (Títulos)
    { key: 'folio', label: 'Matrícula inmobiliaria (FMI)', source: 'Estudio de Títulos' },
    { key: 'cadastral_id', label: 'Cédula catastral', source: 'Estudio de Títulos' },
    { key: 'property_name', label: 'Nombre del predio', source: 'Estudio de Títulos' },
    { key: 'municipality', label: 'Municipio del predio', source: 'Estudio de Títulos' },
    { key: 'department', label: 'Departamento del predio', source: 'Estudio de Títulos' },
    { key: 'village', label: 'Vereda del predio', source: 'Estudio de Títulos' },
    { key: 'owners', label: 'Propietario(s) actual(es)', source: 'Estudio de Títulos' },
    { key: 'area_numbers', label: 'Área del predio (números)', source: 'Estudio de Títulos' },
    { key: 'area_letters', label: 'Área del predio (letras)', source: 'Estudio de Títulos' },
    { key: 'registry_office', label: 'Oficina de registro', source: 'Estudio de Títulos' },
    { key: 'acquisition_mode', label: 'Modo de adquisición', source: 'Estudio de Títulos' },
    { key: 'boundaries', label: 'Linderos del predio', source: 'Estudio de Títulos' },
    { key: 'boundaries_document', label: 'Documento que contiene los linderos', source: 'Estudio de Títulos' },
    { key: 'legal_conditions', label: 'Condiciones jurídicas vigentes', source: 'Estudio de Títulos' },
    { key: 'justice_ministry_case', label: 'Radicado Ministerio de Justicia', source: 'Estudio de Títulos' },
    { key: 'urt_case', label: 'Radicado consulta URT', source: 'Estudio de Títulos' },
    { key: 'urt_territorial_direction', label: 'Dirección territorial URT', source: 'Estudio de Títulos' },

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
    { key: 'property_code', label: 'Código carpeta / predio', source: 'Plantilla de negociación' },
    { key: 'first_offer', label: 'Primera oferta económica', source: 'Plantilla de negociación' },
    { key: 'first_offer_letters', label: 'Primera oferta (letras)', source: 'Plantilla de negociación' },
    { key: 'second_offer', label: 'Segunda oferta económica', source: 'Plantilla de negociación' },
    { key: 'second_offer_letters', label: 'Segunda oferta (letras)', source: 'Plantilla de negociación' },
    { key: 'third_offer', label: 'Tercera oferta económica', source: 'Plantilla de negociación' },
    { key: 'third_offer_letters', label: 'Tercera oferta (letras)', source: 'Plantilla de negociación' },
    { key: 'values_match', label: '¿Coinciden números y letras?', source: 'Plantilla de negociación' },
    { key: 'negotiated_value', label: 'Valor negociado', source: 'Plantilla de negociación' },
    { key: 'negotiated_value_letters', label: 'Valor negociado (letras)', source: 'Plantilla de negociación' },
    { key: 'appraisal_value', label: 'Valor del avalúo comercial', source: 'Plantilla de negociación' },
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
      source_document: r.planSourceDocument,
      folio: r.planFolio,
      cadastral_id: r.planCadastralId,
      property_name: r.planPropertyName,
      owners: r.planOwners,
      municipality: r.planMunicipality,
      village: r.planVillage,
      property_area: r.planPropertyArea,
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
    // Solo las filas de la plantilla (las parejas sin negociación son filas informativas).
    const negotiationRows = rows.filter((r) => r.id.startsWith('neg-row-'))
    result.negotiations = negotiationRows.map((r) => ({
      property_code: r.propertyCode,
      fmi: r.negFolio ?? '',
      cadastral_id: r.negCadastralId ?? '',
      first_offer_numbers: r.firstOfferNumbers,
      first_offer_letters: r.firstOfferLetters,
      second_offer_numbers: r.secondOfferNumbers,
      second_offer_letters: r.secondOfferLetters,
      third_offer_numbers: r.thirdOfferNumbers,
      third_offer_letters: r.thirdOfferLetters,
      values_match: r.valuesMatch,
      negotiated_value_numbers: r.negotiatedValueNumbers ?? '',
      negotiated_value_letters: r.negotiatedValueLetters ?? '',
    }))
    const row = negotiationRows[0] ?? rows[0]
    result.property_code = row.propertyCode
    result.first_offer_numbers = row.firstOfferNumbers
    result.first_offer_letters = row.firstOfferLetters
    result.second_offer_numbers = row.secondOfferNumbers
    result.second_offer_letters = row.secondOfferLetters
    result.third_offer_numbers = row.thirdOfferNumbers
    result.third_offer_letters = row.thirdOfferLetters
    result.values_match = row.valuesMatch
    result.negotiated_value_numbers = row.negotiatedValueNumbers ?? ''
    result.negotiated_value_letters = row.negotiatedValueLetters ?? ''
  } else if (groupKey === 'consolidated' && rows.some((r) => 'B' in r && 'BE' in r)) {
    result.correspondencia = rows.map((row) => {
      const { __readonly: _readonly, ...rest } = row
      return rest
    })
  } else if (groupKey === 'consolidated') {
    for (const r of rows) {
      const fieldId = r.id.replace('cons-', '')
      result[fieldId] = r.value
    }
  }

  return result
}
