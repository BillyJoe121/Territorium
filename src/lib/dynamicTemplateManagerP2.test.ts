import { describe, it, expect } from 'vitest'
import {
  extractPlaceholdersFromTemplate,
  createDynamicTemplate,
  renderDynamicTemplate
} from './dynamicTemplateManagerP2'

describe('dynamicTemplateManagerP2 (US-128)', () => {
  const sampleTemplateRaw = `
    REPÚBLICA DE COLOMBIA
    ACTA DE NOTIFICACIÓN PREDIAL
    
    Predio: {{codigo_predial}}
    Propietario: {{nombre_titular}}
    Cédula: {{cedula}}
    Municipio: {{municipio}}
    Área Afectada: {{area_m2}} m2
    Valor Indemnización: $[VALOR_OFERTA]
    
    Firma Notificado: _______________________
  `

  it('detecta automáticamente marcadores de posición en sintaxis de llaves dobles y corchetes', () => {
    const placeholders = extractPlaceholdersFromTemplate(sampleTemplateRaw)

    expect(placeholders).toContain('codigo_predial')
    expect(placeholders).toContain('nombre_titular')
    expect(placeholders).toContain('cedula')
    expect(placeholders).toContain('municipio')
    expect(placeholders).toContain('area_m2')
    expect(placeholders).toContain('valor_oferta')
  })

  it('crea plantilla dinámica con mapeo de campos configurable sin tocar código fuente', () => {
    const template = createDynamicTemplate({
      projectId: 'proj-001',
      templateKey: 'acta_notificacion',
      name: 'Acta de Notificación Notarial',
      rawContent: sampleTemplateRaw,
      initialMappings: {
        nombre_titular: 'propietario_actual',
        valor_oferta: 'oferta_definitiva_num'
      }
    })

    expect(template.detectedPlaceholders.length).toBe(6)
    expect(template.fieldMappings['nombre_titular']).toBe('propietario_actual')
    expect(template.fieldMappings['valor_oferta']).toBe('oferta_definitiva_num')
  })

  it('renderiza la plantilla sustituyendo atributos de la mesa maestra e identificando pendientes', () => {
    const template = createDynamicTemplate({
      projectId: 'proj-001',
      templateKey: 'acta_notificacion',
      name: 'Acta de Notificación Notarial',
      rawContent: sampleTemplateRaw,
      initialMappings: {
        nombre_titular: 'propietario_actual',
        valor_oferta: 'oferta_definitiva_num'
      }
    })

    const propertyData = {
      codigo_predial: 'PREDIO-CALI-10',
      propietario_actual: 'Rodrigo Morales',
      cedula: '14.890.123',
      municipio: 'Cali',
      area_m2: '850.25',
      oferta_definitiva_num: '45.000.000'
    }

    const result = renderDynamicTemplate(template, propertyData)

    expect(result.success).toBe(true)
    expect(result.unresolvedPlaceholders.length).toBe(0)
    expect(result.renderedContent).toContain('PREDIO-CALI-10')
    expect(result.renderedContent).toContain('Rodrigo Morales')
    expect(result.renderedContent).toContain('45.000.000')

    // Prueba con campo faltante
    const incompleteData = { ...propertyData, municipio: '' }
    const incompleteResult = renderDynamicTemplate(template, incompleteData)
    expect(incompleteResult.success).toBe(false)
    expect(incompleteResult.unresolvedPlaceholders).toContain('municipio')
  })
})
