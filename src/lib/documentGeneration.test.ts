import { describe, it, expect } from 'vitest'
import {
  DEFAULT_LEGAL_TEMPLATES,
  validateTemplateRequirements,
  renderDocumentTemplate,
  generateLegalDocument,
  createGeneratedDocumentsZip
} from './documentGeneration'
import JSZip from 'jszip'

describe('documentGeneration (US-119 a US-127, US-168)', () => {
  const completePropertyData = {
    codigo_predial: 'PREDIO-CALI-001',
    propietario_actual: 'Juan Pérez Gómez',
    cedula_propietario: '16.789.012',
    apoderado_nombre: 'Dra. María Abogada',
    apoderado_cedula: '31.456.789',
    matricula_inmobiliaria: '370-123456',
    municipio: 'Cali',
    linderos: 'Norte linda con lote 1...',
    area_afectada_m2: '1500.50',
    oferta_definitiva_num: '85000000',
    oferta_definitiva_letras: 'ochenta y cinco millones de pesos'
  }

  it('US-119: genera oferta económica con datos completos y aprobados', () => {
    const tmpl = DEFAULT_LEGAL_TEMPLATES['oferta_economica']
    const val = validateTemplateRequirements(tmpl, completePropertyData)
    expect(val.canGenerate).toBe(true)
    expect(val.missingFields.length).toBe(0)

    const rendered = renderDocumentTemplate(tmpl, completePropertyData)
    expect(rendered).toContain('Juan Pérez Gómez')
    expect(rendered).toContain('$ 85000000')
    expect(rendered).toContain('ochenta y cinco millones')
  })

  it('US-120: genera acta de acuerdo voluntario', () => {
    const tmpl = DEFAULT_LEGAL_TEMPLATES['acta_acuerdo']
    const rendered = renderDocumentTemplate(tmpl, completePropertyData)
    expect(rendered).toContain('1500.50 m2')
    expect(rendered).toContain('PREDIO-CALI-001')
  })

  it('US-121: genera bitácora predial consolidada', () => {
    const tmpl = DEFAULT_LEGAL_TEMPLATES['bitacora']
    const rendered = renderDocumentTemplate(tmpl, completePropertyData)
    expect(rendered).toContain('BITÁCORA PREDIAL')
    expect(rendered).toContain('Cali')
  })

  it('US-122: genera poder especial, promesa de compraventa y minuta de escritura', () => {
    // Poder
    const poderTmpl = DEFAULT_LEGAL_TEMPLATES['poder']
    const poderDoc = renderDocumentTemplate(poderTmpl, completePropertyData)
    expect(poderDoc).toContain('PODER ESPECIAL')
    expect(poderDoc).toContain('Dra. María Abogada')

    // Promesa
    const promesaTmpl = DEFAULT_LEGAL_TEMPLATES['promesa']
    const promesaDoc = renderDocumentTemplate(promesaTmpl, completePropertyData)
    expect(promesaDoc).toContain('PROMESA DE CONSTITUCIÓN')
    expect(promesaDoc).toContain('85000000')

    // Escritura
    const escrTmpl = DEFAULT_LEGAL_TEMPLATES['escritura']
    const escrDoc = renderDocumentTemplate(escrTmpl, completePropertyData)
    expect(escrDoc).toContain('MINUTA DE ESCRITURA PÚBLICA')
  })

  it('US-123 & US-127: detecta campos obligatorios faltantes o conflictos que bloquean la generación', () => {
    const incompleteData = {
      codigo_predial: 'PREDIO-CALI-002',
      municipio: 'Cali'
      // Faltan propietario, matricula, oferta
    }

    const tmpl = DEFAULT_LEGAL_TEMPLATES['oferta_economica']
    const val = validateTemplateRequirements(tmpl, incompleteData)
    expect(val.canGenerate).toBe(false)
    expect(val.missingFields).toContain('propietario_actual')
    expect(val.missingFields).toContain('oferta_definitiva_num')

    const genDoc = generateLegalDocument(tmpl, 'p1', 'PREDIO-CALI-002', incompleteData)
    expect(genDoc.status).toBe('blocked')
    expect(genDoc.blockingReasons[0]).toContain('Campos obligatorios faltantes')
  })

  it('US-124 & US-125: previsualiza documento y preserva versión de plantilla y origen', () => {
    const tmpl = DEFAULT_LEGAL_TEMPLATES['oferta_economica']
    const genDoc = generateLegalDocument(tmpl, 'p1', 'PREDIO-CALI-001', completePropertyData)

    expect(genDoc.status).toBe('generated')
    expect(genDoc.templateVersion).toBe(1)
    expect(genDoc.sourceDataSnapshot['propietario_actual']).toBe('Juan Pérez Gómez')
    expect(genDoc.storagePath).toContain('generated/p1/PREDIO-CALI-001/oferta_economica.txt')
  })

  it('US-126: genera paquete ZIP con documentos en lote', async () => {
    const tmpl = DEFAULT_LEGAL_TEMPLATES['oferta_economica']
    const doc1 = generateLegalDocument(tmpl, 'p1', 'PREDIO-A', completePropertyData)
    const doc2 = generateLegalDocument(tmpl, 'p1', 'PREDIO-B', completePropertyData)

    const zipBytes = await createGeneratedDocumentsZip([
      { document: doc1, content: 'Contenido Oferta Predio A' },
      { document: doc2, content: 'Contenido Oferta Predio B' }
    ])

    expect(zipBytes.length).toBeGreaterThan(50)

    // Leer el ZIP para comprobar archivos contenidos
    const zip = await JSZip.loadAsync(zipBytes)
    const files = Object.keys(zip.files)
    expect(files).toContain('PREDIO-A_oferta_economica.txt')
    expect(files).toContain('PREDIO-B_oferta_economica.txt')
  })
})
