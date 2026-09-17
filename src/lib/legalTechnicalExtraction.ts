import type { SourceDocument } from '../types'

export interface PropertyOwner {
  name: string
  documentType: 'CC' | 'NIT' | 'CE' | 'TI' | 'PASAPORTE' | 'NO_IDENTIFICADO'
  documentNumber: string
  percentage: number | null
  isCurrent: boolean
  historicalNote?: string
}

export interface AcquisitionAct {
  order: number
  actNumber: string
  date: string
  authority: string // Ej. Notaría 25 de Bogotá, Juzgado 1 Civil
  actType: string // Ej. Compraventa, Adjudicación en liquidación conyugal
  details?: string
}

export interface LegalBoundaries {
  north?: string
  south?: string
  east?: string
  west?: string
  rawLiteralText: string
  isLong: boolean
  isIncomplete: boolean
  isSuspiciouslySummarized: boolean
  requiresMandatoryReview: boolean
  reviewReason?: string
}

export interface LegalConditions {
  hasEncumbrances: boolean
  items: string[]
  formalStatement: 'sin condiciones jurídicas vigentes' | 'con limitaciones o gravámenes vigentes'
}

export interface ConsultationFilings {
  snrFiling: string
  territorialDirection: string
  isIdentified: boolean
}

export interface TitleStudyExtraction {
  propertyCode?: string
  folio: string
  cadastralCedula: string
  canonicalName: string
  municipality: string
  department: string
  registryOffice: string // ORIP
  areaNumbers: number | null
  areaLetters: string
  areaUnit: 'ha' | 'm2' | 'ha_m2'
  currentOwners: PropertyOwner[]
  historicalOwners: PropertyOwner[]
  acquisitionChronology: AcquisitionAct[]
  acquisitionNarrative: string
  boundaries: LegalBoundaries
  legalConditions: LegalConditions
  consultations: ConsultationFilings
  sourceDocumentId: string
  sourceFormatChosen: 'docx' | 'pdf'
  sourceFormatRationale?: string
  evidenceMap: Record<string, { source: string; page: string; quote: string }>
}

export interface PlanExtraction {
  propertyCode?: string
  planName: string
  totalArea: {
    numbers: number
    letters: string
    unit: 'm2' | 'ha'
  }
  affectedArea: {
    numbers: number
    letters: string
    unit: 'm2' | 'ha'
  }
  servitudeLengthMeters: number | null
  servitudeLengthLetters?: string
  stripWidthMeters: number | null
  infrastructurePostCount: number
  infrastructureItems: Array<{ identifier: string; type: 'torre' | 'poste' | 'apoyo' }>
  scale: string
  unitsPreserved: string[]
  isAmbiguousOrInconsistent: boolean
  ambiguityReasons: string[]
  evidenceMap: Record<string, { source: string; pageOrQuadrant: string; quote: string }>
}

export interface TitlePlanPairing {
  propertyCode: string
  titleDocument?: SourceDocument
  planDocument?: SourceDocument
  status: 'paired' | 'title_without_plan' | 'orphan_plan'
  preferredTitleDocument?: SourceDocument
  formatPreferenceRationale?: string
}

/**
 * US-075: Preferir documento Word sobre PDF cuando ambos documenten el mismo estudio predial.
 */
export function resolveDocumentFormatPreference(
  docs: SourceDocument[]
): { selectedDoc: SourceDocument; discardedDoc?: SourceDocument; rationale: string } | null {
  if (docs.length === 0) return null
  if (docs.length === 1) return { selectedDoc: docs[0], rationale: 'Único documento disponible para el predio.' }

  const docxDoc = docs.find((d) => d.name.toLowerCase().endsWith('.docx') || d.mimeType?.includes('word'))
  const pdfDoc = docs.find((d) => d.name.toLowerCase().endsWith('.pdf') || d.mimeType?.includes('pdf'))

  if (docxDoc && pdfDoc) {
    return {
      selectedDoc: docxDoc,
      discardedDoc: pdfDoc,
      rationale:
        'US-075: Se prefiere el documento Word (.docx) sobre PDF para preservar la fidelidad tipográfica, evitar fragmentación de linderos y eliminar artefactos de OCR.',
    }
  }

  return { selectedDoc: docs[0], rationale: 'Documento seleccionado por orden de carga.' }
}

/**
 * US-070 & US-071: Validación de transcripción literal de linderos y obligatoriedad de revisión humana.
 */
export function validateLegalBoundaries(rawText: string): LegalBoundaries {
  const clean = rawText.trim()
  const length = clean.length

  const hasNorth = /norte\b/i.test(clean)
  const hasSouth = /sur\b/i.test(clean)
  const hasEast = /(oriente|este)\b/i.test(clean)
  const hasWest = /occidente|oeste\b/i.test(clean)

  const isLong = length > 2000
  const isIncomplete = !(hasNorth && hasSouth && hasEast && hasWest)
  const hasTrailingEllipsis = /\.\.\.$|…$|etc\b|y otros colindantes/i.test(clean)
  const hasSummaryKeywords = /resumen de linderos|lindero aproximado|consta en escritura/i.test(clean)

  const isSuspiciouslySummarized = hasTrailingEllipsis || hasSummaryKeywords
  const requiresMandatoryReview = isLong || isIncomplete || isSuspiciouslySummarized

  const reasons: string[] = []
  if (isLong) reasons.push(`Lindero extenso (${length} caracteres > límite de 2000).`)
  if (isIncomplete) reasons.push('No contiene especificación expresa de los cuatro puntos cardinales.')
  if (isSuspiciouslySummarized) reasons.push('Presenta señales de estar resumido, truncado o con elipses (...).')

  return {
    rawLiteralText: clean,
    isLong,
    isIncomplete,
    isSuspiciouslySummarized,
    requiresMandatoryReview,
    reviewReason: reasons.length > 0 ? reasons.join(' ') : undefined,
  }
}

/**
 * US-069: Separa propietarios actuales de propietarios históricos garantizando que un
 * titular que transfirió sus derechos nunca aparezca como titular vigente.
 */
export function segregateOwners(
  rawOwners: Array<{
    name: string
    documentType?: string
    documentNumber?: string
    percentage?: number | null
    isCurrent: boolean
    historicalNote?: string
  }>
): { current: PropertyOwner[]; historical: PropertyOwner[] } {
  const current: PropertyOwner[] = []
  const historical: PropertyOwner[] = []

  for (const o of rawOwners) {
    const owner: PropertyOwner = {
      name: o.name.trim().toUpperCase(),
      documentType: (o.documentType?.toUpperCase() as any) || 'CC',
      documentNumber: o.documentNumber ? o.documentNumber.replace(/[^\d-]/g, '').trim() : 'NO_IDENTIFICADO',
      percentage: o.percentage ?? null,
      isCurrent: o.isCurrent,
      historicalNote: o.historicalNote,
    }

    if (o.isCurrent) {
      current.push(owner)
    } else {
      historical.push(owner)
    }
  }

  return { current, historical }
}

/**
 * US-068: Reconstrucción cronológica de actos y anotaciones del modo de adquisición.
 */
export function sortAcquisitionActs(acts: AcquisitionAct[]): AcquisitionAct[] {
  return [...acts].sort((a, b) => {
    // Si tienen orden explícito usar orden
    if (a.order !== b.order) return a.order - b.order
    // Sino ordenar cronológicamente por fecha ISO o año
    return a.date.localeCompare(b.date)
  })
}

/**
 * US-072: Clasificación de gravámenes y declaración explícita de "sin condiciones jurídicas vigentes".
 */
export function classifyLegalConditions(encumbrancesFound: string[]): LegalConditions {
  const cleanItems = encumbrancesFound
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && !/ninguno|sin gravamen|paz y salvo|limpio/i.test(e))

  if (cleanItems.length === 0) {
    return {
      hasEncumbrances: false,
      items: [],
      formalStatement: 'sin condiciones jurídicas vigentes',
    }
  }

  return {
    hasEncumbrances: true,
    items: cleanItems,
    formalStatement: 'con limitaciones o gravámenes vigentes',
  }
}

/**
 * US-073: Extracción de radicados y dirección territorial con valor canónico "no identificado".
 */
export function formatConsultationFilings(
  snrFiling?: string | null,
  territorialDir?: string | null
): ConsultationFilings {
  const cleanSnr = snrFiling?.trim()
  const cleanDir = territorialDir?.trim()

  const isSnrValid = cleanSnr && cleanSnr.length > 3 && !/no|sin radicado|ninguno/i.test(cleanSnr)
  const isDirValid = cleanDir && cleanDir.length > 3 && !/no|sin direccion|ninguna/i.test(cleanDir)

  return {
    snrFiling: isSnrValid ? cleanSnr : 'no identificado',
    territorialDirection: isDirValid ? cleanDir : 'no identificado',
    isIdentified: Boolean(isSnrValid && isDirValid),
  }
}

/**
 * US-078 a US-082: Extracción y validación de coherencia de planos técnicos.
 */
export function parseTechnicalPlan(input: {
  planName: string
  totalAreaNumber: number
  totalAreaLetters: string
  totalAreaUnit?: 'm2' | 'ha'
  affectedAreaNumber: number
  affectedAreaLetters: string
  affectedAreaUnit?: 'm2' | 'ha'
  servitudeLengthMeters: number | null
  stripWidthMeters: number | null
  infrastructureItems?: Array<{ identifier: string; type: 'torre' | 'poste' | 'apoyo' }>
  scale?: string
}): PlanExtraction {
  const ambiguityReasons: string[] = []

  // Validar si área de afectación supera área total (Inconsistencia física)
  const totalInM2 = input.totalAreaUnit === 'ha' ? input.totalAreaNumber * 10000 : input.totalAreaNumber
  const affectedInM2 = input.affectedAreaUnit === 'ha' ? input.affectedAreaNumber * 10000 : input.affectedAreaNumber

  if (affectedInM2 > totalInM2 && totalInM2 > 0) {
    ambiguityReasons.push(
      `Área de afectación (${affectedInM2} m²) es mayor al área total del predio (${totalInM2} m²).`
    )
  }

  // Validar coherencia geométrica preliminar si hay largo y ancho
  if (input.servitudeLengthMeters && input.stripWidthMeters && affectedInM2 > 0) {
    const approximateArea = input.servitudeLengthMeters * input.stripWidthMeters
    const ratio = Math.abs(approximateArea - affectedInM2) / affectedInM2
    if (ratio > 0.5) {
      ambiguityReasons.push(
        `Discrepancia geométrica: Franja (${input.stripWidthMeters} m) * Longitud (${input.servitudeLengthMeters} m) = ${approximateArea} m², pero el área de afectación declarada es ${affectedInM2} m².`
      )
    }
  }

  // Validar escala
  const scale = input.scale?.trim() || '1:1.000'
  if (!/^1:\d+[\d.]*$/.test(scale)) {
    ambiguityReasons.push(`Formato de escala cartográfica inusual o no estándar: "${scale}".`)
  }

  const isAmbiguousOrInconsistent = ambiguityReasons.length > 0
  const infrastructureItems = input.infrastructureItems ?? []

  return {
    planName: input.planName.trim(),
    totalArea: {
      numbers: input.totalAreaNumber,
      letters: input.totalAreaLetters.trim(),
      unit: input.totalAreaUnit ?? 'm2',
    },
    affectedArea: {
      numbers: input.affectedAreaNumber,
      letters: input.affectedAreaLetters.trim(),
      unit: input.affectedAreaUnit ?? 'm2',
    },
    servitudeLengthMeters: input.servitudeLengthMeters,
    stripWidthMeters: input.stripWidthMeters,
    infrastructurePostCount: infrastructureItems.length,
    infrastructureItems,
    scale,
    unitsPreserved: ['m', 'm2', 'ha', scale],
    isAmbiguousOrInconsistent,
    ambiguityReasons,
    evidenceMap: {},
  }
}

/**
 * US-083: Conciliación relacional entre planos y estudios de títulos.
 * Detecta planos huérfanos y estudios sin plano correspondiente.
 */
export function reconcileTitlesAndPlans(
  titleDocs: SourceDocument[],
  planDocs: SourceDocument[]
): TitlePlanPairing[] {
  const result: TitlePlanPairing[] = []
  const usedPlanIds = new Set<string>()

  // Extraer código de normalización
  function normalizeCode(name: string): string {
    const match = name.match(/\b([A-Z]{2,4}-[A-Z0-9]+(?:-[0-9]+[A-Z]?)?)\b/i)
    if (match) return match[1].toUpperCase()
    // Si no hay código formal, usar token común del nombre
    return name.split(/[-_.]/)[0].trim().toUpperCase()
  }

  // Agrupar títulos por código predial
  const titleGroups = new Map<string, SourceDocument[]>()
  for (const doc of titleDocs) {
    const code = doc.propertyCode || normalizeCode(doc.name)
    const list = titleGroups.get(code) || []
    list.push(doc)
    titleGroups.set(code, list)
  }

  for (const [code, docs] of titleGroups.entries()) {
    // Aplicar US-075 si hay múltiples formatos para el mismo estudio
    const preference = resolveDocumentFormatPreference(docs)
    const matchingPlan = planDocs.find((p) => {
      const planCode = p.propertyCode || normalizeCode(p.name)
      return planCode === code
    })

    if (matchingPlan) {
      usedPlanIds.add(matchingPlan.id)
      result.push({
        propertyCode: code,
        titleDocument: preference?.selectedDoc,
        planDocument: matchingPlan,
        status: 'paired',
        preferredTitleDocument: preference?.selectedDoc,
        formatPreferenceRationale: preference?.rationale,
      })
    } else {
      result.push({
        propertyCode: code,
        titleDocument: preference?.selectedDoc,
        status: 'title_without_plan',
        preferredTitleDocument: preference?.selectedDoc,
        formatPreferenceRationale: preference?.rationale,
      })
    }
  }

  // Identificar planos huérfanos
  for (const plan of planDocs) {
    if (!usedPlanIds.has(plan.id)) {
      const code = plan.propertyCode || normalizeCode(plan.name)
      result.push({
        propertyCode: code,
        planDocument: plan,
        status: 'orphan_plan',
      })
    }
  }

  return result
}
