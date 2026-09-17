import type {
  NegotiationFormulaRule,
  PropertyValuationInput,
  OfferLadderResult,
  ServitudeType
} from '../types'

export const DEFAULT_NEGOTIATION_FORMULA: NegotiationFormulaRule = {
  id: 'rule-isa-estandar-2026',
  name: 'Regla Estándar Servidumbres Eléctricas ISA 2026',
  servitudeCoefficients: {
    transito: 0.60,
    vuelo_linea: 0.35,
    acceso: 0.50,
    subestacion: 1.00
  },
  voluntaryAgreementBonusPercent: 10, // 10% adicional por acuerdo voluntario
  negotiationMarginPercent: 15        // 15% de margen entre inicial y negociada
}

/**
 * US-093: Parametriza y calcula la escalera de tres ofertas de negociación conforme a las reglas formales.
 */
export function calculateOfferLadder(
  input: PropertyValuationInput,
  rule: NegotiationFormulaRule = DEFAULT_NEGOTIATION_FORMULA
): OfferLadderResult {
  const details: string[] = []

  // 1. Valor por metro cuadrado comercial
  const unitValueM2 = input.totalAreaM2 > 0
    ? input.commercialCadastralValue / input.totalAreaM2
    : 0
  details.push(`Valor unitario terreno: $${unitValueM2.toFixed(2)}/m2 (Base comercial: $${input.commercialCadastralValue}, Área total: ${input.totalAreaM2} m2)`)

  // 2. Coeficiente de servidumbre
  const coef = rule.servitudeCoefficients[input.servitudeType] ?? 0.50
  details.push(`Afectación '${input.servitudeType}': coeficiente aplicado del ${(coef * 100).toFixed(1)}%`)

  // 3. Daño emergente de terreno
  const landDamage = unitValueM2 * input.areaAffectedM2 * coef
  details.push(`Indemnización terreno (${input.areaAffectedM2} m2): $${Math.round(landDamage)}`)

  // 4. Mejoras / lucro cesante
  const improvements = input.hasImprovements ? (input.improvementsValue || 0) : 0
  if (improvements > 0) {
    details.push(`Mejoras y cultivos reconocidos: $${improvements}`)
  }

  const baseDamageValue = Math.round(landDamage + improvements)

  // 5. Oferta 1: Oferta Inicial (Daño base)
  let initialOffer = baseDamageValue

  // 6. Oferta 2: Oferta Negociada (Daño base + margen de negociación)
  let negotiatedOffer = Math.round(initialOffer * (1 + (rule.negotiationMarginPercent / 100)))

  // 7. Oferta 3: Oferta Definitiva con Bonificación por Acuerdo Voluntario
  const voluntaryBonus = Math.round(negotiatedOffer * (rule.voluntaryAgreementBonusPercent / 100))
  let finalOffer = negotiatedOffer + voluntaryBonus

  // Validar topes si existen
  if (rule.minOfferCapUsd && initialOffer < rule.minOfferCapUsd) {
    details.push(`Ajuste a tope mínimo obligatorio: $${rule.minOfferCapUsd}`)
    initialOffer = rule.minOfferCapUsd
    negotiatedOffer = Math.max(negotiatedOffer, initialOffer)
    finalOffer = Math.max(finalOffer, negotiatedOffer)
  }

  if (rule.maxOfferCapUsd && finalOffer > rule.maxOfferCapUsd) {
    details.push(`Tope máximo aplicado: $${rule.maxOfferCapUsd}`)
    finalOffer = rule.maxOfferCapUsd
  }

  details.push(`Escalera calculada: Inicial $${initialOffer} -> Negociada $${negotiatedOffer} -> Definitiva $${finalOffer}`)

  return {
    propertyCode: input.propertyCode,
    baseDamageValue,
    initialOffer,
    negotiatedOffer,
    finalOffer,
    voluntaryBonus,
    ruleApplied: rule.name,
    calculationDetails: details
  }
}
