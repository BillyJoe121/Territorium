import { describe, it, expect } from 'vitest'
import { calculateOfferLadder, DEFAULT_NEGOTIATION_FORMULA } from '../lib/negotiationFormulasP2'
import { processExcelManifestRows, type RawExcelManifestRow } from '../lib/manifestExcelImporterP2'
import { renderDynamicTemplate, createDynamicTemplate } from '../lib/dynamicTemplateManagerP2'
import type { PropertyValuationInput } from '../types'

describe('US-157: Pruebas de Carga y Rendimiento con Lotes Representativos (100+ Predios)', () => {
  it('procesa y calcula ofertas para 150 predios concurrentes con latencia promedio menor a 10ms por predio', () => {
    const testSize = 150
    const properties: PropertyValuationInput[] = Array.from({ length: testSize }, (_, i) => ({
      propertyCode: `PREDIO-STRESS-${String(i + 1).padStart(4, '0')}`,
      commercialCadastralValue: 50000000 + (i * 1000000),
      totalAreaM2: 5000 + (i * 50),
      areaAffectedM2: 800 + (i * 10),
      servitudeType: i % 2 === 0 ? 'vuelo_linea' : 'transito',
      hasImprovements: i % 3 === 0,
      improvementsValue: i % 3 === 0 ? 3000000 : 0
    }))

    const startTime = performance.now()

    const results = properties.map(p => calculateOfferLadder(p, DEFAULT_NEGOTIATION_FORMULA))

    const endTime = performance.now()
    const totalDurationMs = endTime - startTime
    const avgLatencyPerProperty = totalDurationMs / testSize

    expect(results.length).toBe(testSize)
    expect(avgLatencyPerProperty).toBeLessThan(10) // Menor a 10 milisegundos por cálculo
    expect(results[0].initialOffer).toBeGreaterThan(0)
    expect(results[testSize - 1].finalOffer).toBeGreaterThan(results[testSize - 1].initialOffer)
  })

  it('procesa un manifiesto masivo de 200 filas contra un repositorio de 500 archivos subidos eficientemente', () => {
    const manifestRows: RawExcelManifestRow[] = Array.from({ length: 200 }, (_, i) => ({
      codigo_predial: `SAN-CIM-${String(i + 1).padStart(3, '0')}`,
      tipo_documento: i % 2 === 0 ? 'estudio_titulos' : 'plano',
      nombre_archivo_esperado: `Doc_SAN-CIM-${String(i + 1).padStart(3, '0')}.pdf`
    }))

    const uploadedFiles: string[] = Array.from({ length: 500 }, (_, i) =>
      `Doc_SAN-CIM-${String(i + 1).padStart(3, '0')}.pdf`
    )

    const startTime = performance.now()
    const manifestResult = processExcelManifestRows(manifestRows, uploadedFiles)
    const durationMs = performance.now() - startTime

    expect(manifestResult.totalRows).toBe(200)
    expect(manifestResult.matchedRows).toBe(200)
    expect(manifestResult.unmatchedRows).toBe(0)
    expect(durationMs).toBeLessThan(100) // Menos de 100ms para 200 cruces contra 500 archivos
  })

  it('renderiza dinámicamente 100 documentos jurídicos masivos en lote sin degradación', () => {
    const template = createDynamicTemplate({
      projectId: 'proj-mass',
      templateKey: 'oferta_masiva',
      name: 'Oferta Masiva',
      rawContent: 'Estimado propietario {{titular}}, el predio {{codigo}} tiene una oferta de $[oferta].'
    })

    const startTime = performance.now()
    const renderedDocs: string[] = []

    for (let i = 0; i < 100; i++) {
      const res = renderDynamicTemplate(template, {
        titular: `Titular Propietario ${i + 1}`,
        codigo: `P-${i + 1}`,
        oferta: `${(i + 1) * 10}.000.000`
      })
      if (res.success) {
        renderedDocs.push(res.renderedContent)
      }
    }

    const durationMs = performance.now() - startTime

    expect(renderedDocs.length).toBe(100)
    expect(durationMs).toBeLessThan(50)
  })
})
