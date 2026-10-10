
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
  /** Valor negociado ingresado y verificado por el profesional (números y letras). */
  negotiated_value?: string
  negotiated_value_letters?: string

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
