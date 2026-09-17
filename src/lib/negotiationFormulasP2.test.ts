import { describe, it, expect } from 'vitest'
import {
  calculateOfferLadder,
  DEFAULT_NEGOTIATION_FORMULA
} from './negotiationFormulasP2'
import type { PropertyValuationInput, NegotiationFormulaRule } from '../types'

describe('negotiationFormulasP2 (US-093)', () => {
  const mockProperty: PropertyValuationInput = {
    propertyCode: 'PREDIO-CALI-05',
    commercialCadastralValue: 100000000, // 100 millones valor total
    totalAreaM2: 10000,                  // 10.000 m2 ($10.000 / m2)
    areaAffectedM2: 2000,                 // 2.000 m2 afectados
    servitudeType: 'vuelo_linea',        // Coeficiente 0.35
    hasImprovements: true,
    improvementsValue: 5000000           // 5 millones en mejoras
  }

  it('calcula la escalera de tres ofertas respetando coeficientes de servidumbre y bonificación voluntaria', () => {
    // Daño terreno = (100.000.000 / 10.000) * 2.000 * 0.35 = 10.000 * 2.000 * 0.35 = 7.000.000
    // Mejoras = 5.000.000
    // Daño base / Oferta Inicial = 12.000.000
    // Oferta Negociada (+15%) = 12.000.000 * 1.15 = 13.800.000
    // Oferta Definitiva (+10% voluntario) = 13.800.000 * 1.10 = 15.180.000

    const result = calculateOfferLadder(mockProperty, DEFAULT_NEGOTIATION_FORMULA)

    expect(result.propertyCode).toBe('PREDIO-CALI-05')
    expect(result.baseDamageValue).toBe(12000000)
    expect(result.initialOffer).toBe(12000000)
    expect(result.negotiatedOffer).toBe(13800000)
    expect(result.finalOffer).toBe(15180000)
    expect(result.voluntaryBonus).toBe(1380000)
    expect(result.calculationDetails.length).toBeGreaterThan(3)
  })

  it('aplica coeficientes específicos para servidumbre de tránsito (0.60)', () => {
    const transitProperty: PropertyValuationInput = {
      ...mockProperty,
      servitudeType: 'transito',
      hasImprovements: false,
      improvementsValue: 0
    }

    // Daño terreno = 10.000 * 2.000 * 0.60 = 12.000.000
    const result = calculateOfferLadder(transitProperty, DEFAULT_NEGOTIATION_FORMULA)
    expect(result.initialOffer).toBe(12000000)
    expect(result.negotiatedOffer).toBe(13800000)
  })

  it('respeta topes mínimos y máximos configurados en la regla de negociación', () => {
    const cappedRule: NegotiationFormulaRule = {
      ...DEFAULT_NEGOTIATION_FORMULA,
      minOfferCapUsd: 20000000, // Tope mínimo forzado
      maxOfferCapUsd: 22000000  // Tope máximo forzado
    }

    const result = calculateOfferLadder(mockProperty, cappedRule)
    expect(result.initialOffer).toBe(20000000)
    expect(result.finalOffer).toBeLessThanOrEqual(22000000)
  })
})
