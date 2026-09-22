export interface ConsolidatedMasterRecord {
  // Identity and legal background from Titles
  folio: string
  cadastral_id: string
  property_name: string
  municipality: string
  department: string
  village: string
  owners: string
  area_numbers?: string
  area_letters?: string
  registry_office?: string
  acquisition_mode: string
  boundaries: string
  boundaries_document: string
  legal_conditions: string
  justice_ministry_case: string
  urt_case: string
  urt_territorial_direction: string

  // Technical and geographic info from Plans
  easement_area: string
  easement_area_letters?: string
  easement_length: string
  easement_length_letters?: string
  easement_width: string
  easement_width_letters?: string
  infrastructure_count: string
  infrastructure_count_letters?: string
  plan_name: string
  plan_scale: string
  voltage_level: string

  // Economic and negotiation info from Negotiation
  property_code: string
  first_offer: string
  first_offer_letters?: string
  second_offer: string
  second_offer_letters?: string
  third_offer: string
  third_offer_letters?: string
  values_match: string
  appraisal_value?: string

  // Traceability signature
  metadata: {
    titles_result_version_id: string
    plans_result_version_id: string
    negotiation_result_version_id: string
    consolidated_at: string
    consolidated_by?: string
    is_valid: boolean
  }
}

export interface ConsolidationInputs {
  titlesApprovedPayload: Record<string, unknown>
  titlesVersionId: string
  plansApprovedPayload: Record<string, unknown>
  plansVersionId: string
  negotiationApprovedPayload: Record<string, unknown>
  negotiationVersionId: string
  userId?: string
}

export function consolidateApprovedGroups({
  titlesApprovedPayload: t,
  titlesVersionId,
  plansApprovedPayload: p,
  plansVersionId,
  negotiationApprovedPayload: n,
  negotiationVersionId,
  userId,
}: ConsolidationInputs): ConsolidatedMasterRecord {
  // Extract primary plan if multiple plans are present
  const plansList = Array.isArray(p.plans) && p.plans.length > 0 ? p.plans : [p]
  const primaryPlan = plansList[0] ?? {}

  // Format owners string
  const ownersList = Array.isArray(t.owners) ? t.owners : []
  const formattedOwners = ownersList
    .map((o: any) => `${o.name || ''} (${o.document_type || 'CC'} ${o.document_number || ''})`.trim())
    .filter((s: string) => s.length > 5)
    .join('; ') || String(t.owners_str || t.owners || 'no identificado')

  return {
    // 1. TÍTULOS
    folio: String(t.folio || 'no identificado'),
    cadastral_id: String(t.cadastral_id || t.cadastralId || 'no identificado'),
    property_name: String(t.property_name || t.propertyName || 'no identificado'),
    municipality: String(t.municipality || 'no identificado'),
    department: String(t.department || 'no identificado'),
    village: String(t.village || 'no identificado'),
    owners: formattedOwners,
    area_numbers: String(t.area_numbers || t.areaNumbers || 'no identificado'),
    area_letters: String(t.area_letters || t.areaLetters || 'no identificado'),
    registry_office: String(t.registry_office || t.registryOffice || 'no identificado'),
    acquisition_mode: String(t.acquisition_mode || t.acquisitionMode || 'no identificado'),
    boundaries: String(t.boundaries || 'no identificado'),
    boundaries_document: String(t.boundaries_document || t.boundariesDocument || 'no identificado'),
    legal_conditions: String(t.legal_conditions || t.legalConditions || 'sin condiciones jurídicas vigentes'),
    justice_ministry_case: String(t.justice_ministry_case || t.justiceMinistryCase || 'no identificado'),
    urt_case: String(t.urt_case || t.urtCase || 'no identificado'),
    urt_territorial_direction: String(t.urt_territorial_direction || t.urtTerritorialDirection || 'no identificado'),

    // 2. PLANOS
    easement_area: String(p.total_easement_area_numbers || primaryPlan.easement_area_numbers || primaryPlan.easementAreaNumbers || '—'),
    easement_area_letters: String(p.total_easement_area_letters || primaryPlan.easement_area_letters || primaryPlan.easementAreaLetters || '—'),
    easement_length: String(p.total_easement_length_numbers || primaryPlan.easement_length_numbers || primaryPlan.easementLengthNumbers || '—'),
    easement_length_letters: String(p.total_easement_length_letters || primaryPlan.easement_length_letters || primaryPlan.easementLengthLetters || '—'),
    easement_width: String(primaryPlan.easement_width_numbers || primaryPlan.easementWidthNumbers || '—'),
    easement_width_letters: String(primaryPlan.easement_width_letters || primaryPlan.easementWidthLetters || '—'),
    infrastructure_count: String(p.total_infrastructure_count || primaryPlan.infrastructure_count_numbers || primaryPlan.infrastructureCountNumbers || '0'),
    infrastructure_count_letters: String(primaryPlan.infrastructure_count_letters || primaryPlan.infrastructureCountLetters || 'cero'),
    plan_name: String(primaryPlan.plan_name || primaryPlan.planName || '—'),
    plan_scale: String(primaryPlan.plan_scale || primaryPlan.planScale || '—'),
    voltage_level: String(primaryPlan.voltage_level || primaryPlan.voltageLevel || '—'),

    // 3. NEGOCIACIÓN
    property_code: String(n.property_code || n.propertyCode || '—'),
    first_offer: String(n.first_offer_numbers || n.firstOfferNumbers || '—'),
    first_offer_letters: String(n.first_offer_letters || n.firstOfferLetters || '—'),
    second_offer: String(n.second_offer_numbers || n.secondOfferNumbers || '—'),
    second_offer_letters: String(n.second_offer_letters || n.secondOfferLetters || '—'),
    third_offer: String(n.third_offer_numbers || n.thirdOfferNumbers || '—'),
    third_offer_letters: String(n.third_offer_letters || n.thirdOfferLetters || '—'),
    values_match: String(n.values_match || n.valuesMatch || 'Sí, coinciden'),
    appraisal_value: String(n.appraisal_value || n.appraisalValue || '—'),

    metadata: {
      titles_result_version_id: titlesVersionId,
      plans_result_version_id: plansVersionId,
      negotiation_result_version_id: negotiationVersionId,
      consolidated_at: new Date().toISOString(),
      consolidated_by: userId,
      is_valid: true,
    },
  }
}
