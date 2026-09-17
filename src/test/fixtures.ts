/**
 * Anonymized Fixtures for Territorium Automated Acceptance Suite
 * Implements US-146 (E15 P0)
 *
 * Contains realistic test fixtures without sensitive or real personal data:
 * - Title studies with extensive boundaries, multiple owners, historical owners, encumbrances, and SNR filings
 * - Technical plans with geometric data, infrastructure poles, units, and scales
 * - Negotiation templates with economic offers
 */

import type { TitleStudyExtraction, PlanExtraction } from '../lib/legalTechnicalExtraction'

export const FIXTURE_TITLE_STUDY_COMPLEX: TitleStudyExtraction = {
  propertyCode: 'SAN-CIM-036A',
  folio: '300-88492',
  cadastralCedula: '68190000100020003004',
  canonicalName: 'HACIENDA EL ROBLE',
  municipality: 'Cimitarra',
  department: 'Santander',
  registryOffice: 'Vélez',
  areaNumbers: 754000,
  areaLetters: 'SETECIENTOS CINCUENTA Y CUATRO MIL METROS CUADRADOS',
  areaUnit: 'm2',
  currentOwners: [
    {
      name: 'CARLOS ALBERTO JARAMILLO DUQUE',
      documentType: 'CC',
      documentNumber: '79456123',
      percentage: 50,
      isCurrent: true,
    },
    {
      name: 'INVERSIONES AGROPECUARIAS EL ROBLE S.A.S.',
      documentType: 'NIT',
      documentNumber: '900876543-1',
      percentage: 50,
      isCurrent: true,
    },
  ],
  historicalOwners: [
    {
      name: 'MARIA HELENA RESTREPO GOMEZ',
      documentType: 'CC',
      documentNumber: '41567890',
      percentage: 100,
      isCurrent: false,
      historicalNote: 'Transfirió el 100% mediante Escritura Pública 1245 de 2018',
    },
  ],
  acquisitionChronology: [
    {
      order: 1,
      actNumber: 'Escritura Pública 450',
      date: '2005-04-12',
      authority: 'Notaría Única de Cimitarra',
      actType: 'Compraventa',
      details: 'Compraventa de mayor extensión a favor de María Helena Restrepo',
    },
    {
      order: 2,
      actNumber: 'Escritura Pública 1245',
      date: '2018-09-20',
      authority: 'Notaría 25 de Bogotá',
      actType: 'Compraventa y constitución de sociedad',
      details: 'Adquisición por los actuales titulares proindiviso al 50%',
    },
  ],
  acquisitionNarrative:
    'El inmueble fue adquirido por los actuales propietarios mediante Escritura Pública No. 1245 del 20 de septiembre de 2018 otorgada en la Notaría 25 del Círculo de Bogotá, debidamente registrada en la Anotación 4 del Folio de Matrícula 300-88492.',
  boundaries: {
    north: 'Con predio Santa Inés en una distancia de 1.250 metros lineales colindando con cerca de alambre.',
    south: 'Con cauce natural de la Quebrada La Honda en 980 metros.',
    east: 'Con vía secundaria Cimitarra - Puerto Olaya en 640 metros.',
    west: 'Con predio El Paraíso de propiedad de sucesión ilíquida en 890 metros.',
    rawLiteralText:
      'NORTE: Con predio Santa Inés en una distancia de 1.250 metros lineales colindando con cerca de alambre. SUR: Con cauce natural de la Quebrada La Honda en 980 metros. ORIENTE: Con vía secundaria Cimitarra - Puerto Olaya en 640 metros. OCCIDENTE: Con predio El Paraíso de propiedad de sucesión ilíquida en 890 metros.',
    isLong: false,
    isIncomplete: false,
    isSuspiciouslySummarized: false,
    requiresMandatoryReview: false,
  },
  legalConditions: {
    hasEncumbrances: true,
    items: [
      'Anotación 5: Hipoteca Abierta de primer grado a favor de Banco Agrario de Colombia.',
      'Anotación 6: Servidumbre eléctrica pasiva a favor de ISA Interconexión Eléctrica S.A.',
    ],
    formalStatement: 'con limitaciones o gravámenes vigentes',
  },
  consultations: {
    snrFiling: 'SNR-2026-ER-045991',
    territorialDirection: 'Dirección Territorial Santander',
    isIdentified: true,
  },
  sourceDocumentId: 'doc-fixture-title-01',
  sourceFormatChosen: 'docx',
  sourceFormatRationale: 'US-075: Se prefirió Word (.docx) para evitar ruido tipográfico.',
  evidenceMap: {
    folio: {
      source: 'ET_SAN-CIM-036A.docx',
      page: '1',
      quote: 'Matrícula Inmobiliaria No. 300-88492 de la Oficina de Registro de Instrumentos Públicos de Vélez.',
    },
    boundaries: {
      source: 'ET_SAN-CIM-036A.docx',
      page: '3',
      quote: 'Linderos especiales del predio: NORTE: Con predio Santa Inés...',
    },
  },
}

export const FIXTURE_TECHNICAL_PLAN_COMPLEX: PlanExtraction = {
  propertyCode: 'SAN-CIM-036A',
  planName: 'PLANO_TOPOGRAFICO_SAN-CIM-036A.dwg',
  totalArea: {
    numbers: 754000,
    letters: 'SETECIENTOS CINCUENTA Y CUATRO MIL METROS CUADRADOS',
    unit: 'm2',
  },
  affectedArea: {
    numbers: 8500,
    letters: 'OCHO MIL QUINIENTOS METROS CUADRADOS',
    unit: 'm2',
  },
  servitudeLengthMeters: 425,
  servitudeLengthLetters: 'CUATROCIENTOS VEINTICINCO METROS',
  stripWidthMeters: 20,
  infrastructurePostCount: 2,
  infrastructureItems: [
    { identifier: 'TORRE-T-14', type: 'torre' },
    { identifier: 'TORRE-T-15', type: 'torre' },
  ],
  scale: '1:2.000',
  unitsPreserved: ['m', 'm2', 'ha', '1:2.000'],
  isAmbiguousOrInconsistent: false,
  ambiguityReasons: [],
  evidenceMap: {
    affectedArea: {
      source: 'PLANO_TOPOGRAFICO_SAN-CIM-036A.dwg',
      pageOrQuadrant: 'Cuadro de Áreas - Cuadrante D4',
      quote: 'Área de servidumbre requerida = 8.500 m2 (Franja de 20m x 425m)',
    },
  },
}
