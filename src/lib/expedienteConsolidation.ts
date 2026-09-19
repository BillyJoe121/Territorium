export interface ConsolidatedMasterRecord {
  // Identity from Titles
  folio: string
  cadastral_id: string
  property_name: string
  municipality: string
  department: string
  village: string
  owners: string
  acquisition_mode: string
  boundaries: string
  boundaries_document: string
  legal_conditions: string
  justice_ministry_case: string
  urt_case: string
  urt_territorial_direction: string

  // Technical info from Plans
  easement_area: string
  easement_length: string
  easement_width: string
  infrastructure_count: string
  plan_name: string
  plan_scale: string
  voltage_level: string

  // Economic info from Negotiation
  property_code: string
  first_offer: string
  second_offer: string
  third_offer: string
  values_match: string

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
    folio: String(t.folio || 'no identificado'),
    cadastral_id: String(t.cadastral_id || t.cadastralId || 'no identificado'),
    property_name: String(t.property_name || t.propertyName || 'no identificado'),
    municipality: String(t.municipality || 'no identificado'),
    department: String(t.department || 'no identificado'),
    village: String(t.village || 'no identificado'),
    owners: formattedOwners,
    acquisition_mode: String(t.acquisition_mode || t.acquisitionMode || 'no identificado'),
    boundaries: String(t.boundaries || 'no identificado'),
    boundaries_document: String(t.boundaries_document || t.boundariesDocument || 'no identificado'),
    legal_conditions: String(t.legal_conditions || t.legalConditions || 'sin condiciones jurídicas vigentes'),
    justice_ministry_case: String(t.justice_ministry_case || t.justiceMinistryCase || 'no identificado'),
    urt_case: String(t.urt_case || t.urtCase || 'no identificado'),
    urt_territorial_direction: String(t.urt_territorial_direction || t.urtTerritorialDirection || 'no identificado'),

    easement_area: String(p.total_easement_area_numbers || primaryPlan.easement_area_numbers || primaryPlan.easementAreaNumbers || '—'),
    easement_length: String(p.total_easement_length_numbers || primaryPlan.easement_length_numbers || primaryPlan.easementLengthNumbers || '—'),
    easement_width: String(primaryPlan.easement_width_numbers || primaryPlan.easementWidthNumbers || '—'),
    infrastructure_count: String(p.total_infrastructure_count || primaryPlan.infrastructure_count_numbers || primaryPlan.infrastructureCountNumbers || '0'),
    plan_name: String(primaryPlan.plan_name || primaryPlan.planName || '—'),
    plan_scale: String(primaryPlan.plan_scale || primaryPlan.planScale || '—'),
    voltage_level: String(primaryPlan.voltage_level || primaryPlan.voltageLevel || '—'),

    property_code: String(n.property_code || n.propertyCode || '—'),
    first_offer: String(n.first_offer_numbers || n.firstOfferNumbers || '—'),
    second_offer: String(n.second_offer_numbers || n.secondOfferNumbers || '—'),
    third_offer: String(n.third_offer_numbers || n.thirdOfferNumbers || '—'),
    values_match: String(n.values_match || n.valuesMatch || 'Sí, coinciden'),

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
