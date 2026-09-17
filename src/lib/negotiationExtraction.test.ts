import { describe, it, expect } from 'vitest'
import {
  validateNegotiationTemplate,
  extractNegotiationOffers,
  verifyOfferMatch,
  detectNegotiationAnomalies,
  correctNegotiationOfferManually,
  compareBoundariesVisualDiff,
  validateGeometricCoherenceConfigurable,
  aggregateTechnicalPlansSummary
} from './negotiationExtraction'

describe('negotiationExtraction (US-076, US-084, US-085, US-086, US-087 a US-092)', () => {
  it('US-087: valida e identifica plantilla de negociación aprobada', () => {
    const validHeaders = [
      'Codigo_Predial',
      'Oferta_Inicial_Num',
      'Oferta_Inicial_Letras',
      'Oferta_Definitiva_Num',
      'Oferta_Definitiva_Letras'
    ]
    const validCheck = validateNegotiationTemplate(validHeaders)
    expect(validCheck.isValid).toBe(true)
    expect(validCheck.detectedType).toBe('plantilla_aprobada')

    const invalidHeaders = ['Fecha', 'Nombre_Usuario', 'Observaciones']
    const invalidCheck = validateNegotiationTemplate(invalidHeaders)
    expect(invalidCheck.isValid).toBe(false)
    expect(invalidCheck.detectedType).toBe('plantilla_invalida')
  })

  it('US-088 & US-090: extrae tres ofertas por predio con coordenadas de celda', () => {
    const record = extractNegotiationOffers(
      {
        propertyCode: 'PREDIO-010',
        initialOfferNum: '150.000.000',
        initialOfferText: 'ciento cincuenta millones de pesos',
        negotiatedOfferNum: 165000000,
        negotiatedOfferText: 'ciento sesenta y cinco millones',
        finalOfferNum: '$170000000',
        finalOfferText: 'ciento setenta millones de pesos m/cte',
        rowIndex: 9
      },
      'proj-1',
      'batch-1'
    )

    expect(record.initialOfferNum).toBe(150000000)
    expect(record.negotiatedOfferNum).toBe(165000000)
    expect(record.finalOfferNum).toBe(170000000)
    expect(record.cellReferences.propertyCodeCell).toBe('A10')
    expect(record.cellReferences.initialOfferCell).toBe('B10')
    expect(record.cellReferences.finalOfferCell).toBe('F10')
  })

  it('US-089: verifica coincidencia entre números y letras de ofertas', () => {
    // Coinciden
    const match = verifyOfferMatch(50000000, 'cincuenta millones de pesos m/cte')
    expect(match).toBe('coinciden')

    // Discrepancia
    const mismatch = verifyOfferMatch(50000000, 'veinte millones de pesos')
    expect(mismatch).toBe('discrepancia')

    // Incompleto
    const incomplete = verifyOfferMatch(null, '')
    expect(incomplete).toBe('incompleto')
  })

  it('US-091: detecta anomalías en ofertas (sin oferta, duplicadas, rango inválido)', () => {
    const records = [
      {
        id: '1',
        projectId: 'p1',
        batchId: 'b1',
        propertyCode: 'PREDIO-A',
        initialOfferNum: 100000000,
        finalOfferNum: 80000000, // Menor a inicial -> rango inválido
        offersMatchStatus: 'coinciden' as const,
        cellReferences: {},
        isApproved: false,
        correctedManually: false,
        createdAt: '',
        updatedAt: ''
      },
      {
        id: '2',
        projectId: 'p1',
        batchId: 'b1',
        propertyCode: 'PREDIO-A', // Duplicado
        initialOfferNum: 100000000,
        finalOfferNum: 110000000,
        offersMatchStatus: 'coinciden' as const,
        cellReferences: {},
        isApproved: false,
        correctedManually: false,
        createdAt: '',
        updatedAt: ''
      },
      {
        id: '3',
        projectId: 'p1',
        batchId: 'b1',
        propertyCode: 'PREDIO-B',
        initialOfferNum: null,
        finalOfferNum: null, // Sin oferta
        offersMatchStatus: 'incompleto' as const,
        cellReferences: {},
        isApproved: false,
        correctedManually: false,
        createdAt: '',
        updatedAt: ''
      }
    ]

    const anomalies = detectNegotiationAnomalies(records)
    const types = anomalies.map(a => a.anomalyType)
    expect(types).toContain('rango_invalido')
    expect(types).toContain('oferta_duplicada')
    expect(types).toContain('sin_oferta')
  })

  it('US-092: permite corrección manual de ofertas sin tocar el archivo fuente', () => {
    const original = extractNegotiationOffers(
      {
        propertyCode: 'PREDIO-Z',
        initialOfferNum: 50000000,
        initialOfferText: 'cincuenta millones',
        finalOfferNum: 40000000, // Error en fuente
        finalOfferText: 'cuarenta millones',
        rowIndex: 5
      },
      'p1',
      'b1'
    )

    const corrected = correctNegotiationOfferManually(
      original,
      {
        finalOfferNum: 60000000,
        finalOfferText: 'sesenta millones de pesos'
      },
      'Corrección por acta firmada de comité'
    )

    expect(corrected.correctedManually).toBe(true)
    expect(corrected.finalOfferNum).toBe(60000000)
    expect(corrected.reviewerNotes).toContain('acta firmada')
    expect(corrected.offersMatchStatus).toBe('coinciden')
  })

  it('US-076: compara visualmente linderos extraídos contra texto fuente', () => {
    const extracted = 'Por el norte linda con predio La Esmeralda en distancia de doscientos metros.'
    const sourceText = 'Capítulo Linderos: Por el norte linda con predio La Esmeralda en distancia de doscientos metros quebrada al medio.'

    const diff = compareBoundariesVisualDiff(extracted, sourceText)
    expect(diff.similarityRatio).toBeGreaterThan(0.8)
    expect(diff.isCloseMatch).toBe(true)
  })

  it('US-085 & US-086: valida coherencia geométrica de planos y consolida lotes de planos', () => {
    // Validación geométrica: 100m largo x 20m ancho = 2000m2. Si plano declara 2050m2 (+2.5% diff), está dentro del 15%
    const geoValid = validateGeometricCoherenceConfigurable(100, 20, 2050, 15)
    expect(geoValid.isCoherent).toBe(true)

    // Si plano declara 3500m2 (+75% diff), debe fallar
    const geoInvalid = validateGeometricCoherenceConfigurable(100, 20, 3500, 15)
    expect(geoInvalid.isCoherent).toBe(false)
    expect(geoInvalid.warning).toContain('Desviación geométrica')

    // Consolidación masiva de planos
    const planBatch = [
      { areaM2: 2500, widthM: 15, infrastructureCount: 2, hasAnomaly: false },
      { areaM2: 3000, widthM: 25, infrastructureCount: 3, hasAnomaly: true }
    ]
    const summary = aggregateTechnicalPlansSummary(planBatch)
    expect(summary.totalPlans).toBe(2)
    expect(summary.totalAffectedAreaM2).toBe(5500)
    expect(summary.averageServitudeWidthM).toBe(20)
    expect(summary.totalInfrastructureElements).toBe(5)
    expect(summary.plansWithAnomaliesCount).toBe(1)
  })
})
