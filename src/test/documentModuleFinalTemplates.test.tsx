import { describe, expect, it } from 'vitest'
import { OFFICIAL_FINAL_DOCUMENT_TEMPLATES } from '../lib/expedienteDocumentTemplates'
import {
  compileConsolidatedToTiptap,
} from '../lib/expedienteDocumentCompiler'
import type { ConsolidatedMasterRecord } from '../lib/expedienteConsolidation'

const mockConsolidatedRecord: ConsolidatedMasterRecord = {
  folio: '370-123456',
  cadastral_id: '73001000100020003000',
  property_name: 'HACIENDA EL PORVENIR',
  municipality: 'Anzoátegui',
  department: 'Tolima',
  village: 'La Cabaña',
  owners: 'CARLOS ALBERTO GÓMEZ PÉREZ (CC 19.456.789)',
  acquisition_mode: 'Compraventa',
  boundaries: 'Por el Norte con predio La Florida, por el Sur con río Totare, por el Oriente con camino real y por el Occidente con predio El Roble.',
  boundaries_document: 'Escritura 1245 de 2015',
  legal_conditions: 'Ninguno registrado en el folio de matrícula.',
  justice_ministry_case: 'Sin requerimientos',
  urt_case: 'Sin antecedentes',
  urt_territorial_direction: 'Tolima',
  easement_area: '12500.50',
  easement_length: '850.25',
  easement_width: '30.00',
  infrastructure_count: '4',
  plan_name: 'PL-TOL-ANZ-045-REV2',
  plan_scale: '1:5000',
  voltage_level: '230 kV',
  property_code: 'TOL-ANZ-045',
  first_offer: '45000000',
  first_offer_letters: 'CUARENTA Y CINCO MILLONES DE PESOS MONEDA CORRIENTE',
  second_offer: '0',
  third_offer: '0',
  values_match: 'Coinciden',
  metadata: {
    titles_result_version_id: 'v1',
    plans_result_version_id: 'v1',
    negotiation_result_version_id: 'v1',
    consolidated_at: '2026-09-27T12:00:00Z',
    is_valid: true,
  },
}

describe('Document Module Final Templates Specification', () => {

  it('compiles Template 1: Escritura Pública TOL-ANZ-045 with all notarial clauses', () => {
    const tpl1 = OFFICIAL_FINAL_DOCUMENT_TEMPLATES[0]
    const compiled = compileConsolidatedToTiptap(mockConsolidatedRecord, {
      template: tpl1,
      projectCode: 'PRJ-001',
    })

    expect(compiled.content.type).toBe('doc')
    const fullText = JSON.stringify(compiled.content)

    // Verify Title & Calificación SNR
    expect(fullText).toContain('ESCRITURA PÚBLICA No.')
    expect(fullText).toContain('FORMATO DE CALIFICACIÓN')
    expect(fullText).toContain('CARLOS ALBERTO GÓMEZ PÉREZ')
    expect(fullText).toContain('370-123456')
    expect(fullText).toContain('73001000100020003000')

    // Verify Clauses
    expect(fullText).toContain('PRIMERA: Inmueble y Linderos Generales')
    expect(fullText).toContain('SEGUNDA: Tradición')
    expect(fullText).toContain('TERCERA: Constitución de Servidumbre')
    expect(fullText).toContain('DÉCIMA CUARTA: Valor y Forma de Pago')
    expect(fullText).toContain('CUARENTA Y CINCO MILLONES DE PESOS MONEDA CORRIENTE')
    expect(fullText).toContain('VIGÉSIMA PRIMERA: Protocolizaciones y Aceptación')
    expect(fullText).toContain('CELSIA COLOMBIA S.A. E.S.P.')
  })

  it('compiles Template 2: Descripción de Linderos ID02 with CTM12 tables & vertices', () => {
    const tpl2 = OFFICIAL_FINAL_DOCUMENT_TEMPLATES[1]
    const compiled = compileConsolidatedToTiptap(mockConsolidatedRecord, {
      template: tpl2,
      projectCode: 'PRJ-001',
    })

    const fullText = JSON.stringify(compiled.content)

    // Verify Heading
    expect(fullText).toContain('FICHA TÉCNICA DE DESCRIPCIÓN DE LINDEROS DE SERVIDUMBRE')
    expect(fullText).toContain('HACIENDA EL PORVENIR')
    expect(fullText).toContain('12500.50')
    expect(fullText).toContain('850.25')

    // Verify Tramos
    expect(fullText).toContain('1. Descripción de Vértices de Servidumbre por Tramos')
    expect(fullText).toContain('Tramo 1')
    expect(fullText).toContain('Tramo 2A')
    expect(fullText).toContain('Tramo 2B')

    // Verify Coordinates Tables
    expect(fullText).toContain('TABLA DE COORDENADAS VÉRTICES DE SERVIDUMBRE TRAMO 1')
    expect(fullText).toContain('2124501.376')
    expect(fullText).toContain('4789744.450')
    expect(fullText).toContain('TABLA DE COORDENADAS VÉRTICES DE SERVIDUMBRE TRAMO 2A')
    expect(fullText).toContain('TABLA DE COORDENADAS VÉRTICES DE SERVIDUMBRE TRAMO 2B')
  })

  it('compiles Template 3: Minuta Tipo Territorium with 5 SNR tables & 19 clauses', () => {
    const tpl3 = OFFICIAL_FINAL_DOCUMENT_TEMPLATES[2]
    const compiled = compileConsolidatedToTiptap(mockConsolidatedRecord, {
      template: tpl3,
      projectCode: 'PRJ-001',
    })

    const fullText = JSON.stringify(compiled.content)

    // Title & SNR Tables
    expect(fullText).toContain('MINUTA TIPO TERRITORIUM — CONSTITUCIÓN DE SERVIDUMBRE')
    expect(fullText).toContain('SUPERINTENDENCIA DE NOTARIADO Y REGISTRO — SÍNTESIS DE CONTENIDO')
    expect(fullText).toContain('CLASE DEL ACTO')
    expect(fullText).toContain('0339')
    expect(fullText).toContain('SERVIDUMBRE LEGAL DE LÍNEAS DE DISTRIBUCIÓN DE ENERGÍA ELÉCTRICA')
    expect(fullText).toContain('PARQUE SOLAR PUERTA DE ORO S.A.S. E.S.P.')
    expect(fullText).toContain('HACIENDA EL PORVENIR')

    // Clauses
    expect(fullText).toContain('PRIMERA: Inmueble y Linderos Generales')
    expect(fullText).toContain('SEGUNDA: Tradición')
    expect(fullText).toContain('TERCERA: Constitución de Servidumbre')
    expect(fullText).toContain('DÉCIMA CUARTA: Precio y Forma de Pago')
    expect(fullText).toContain('DÉCIMA NOVENA: Poder especial amplio y suficiente para trámites registrales.')
  })
})
