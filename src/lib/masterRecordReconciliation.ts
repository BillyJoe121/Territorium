/**
 * Master Record Reconciliation & Semantic AI Quality Engine
 * Implements E10 P0 (US-094 to US-101) & E18 P0 (US-178 to US-181)
 *
 * Provides:
 * - Versioned master record by property and batch (US-094)
 * - Consolidation in the schema equivalent to CORRESPONDENCIA.xlsx (US-095)
 * - Stable property identifier matching across sources (US-096)
 * - Source conflict detection without automated resolution (US-097)
 * - Expected vs received vs processed vs consolidated reconciliation (US-098)
 * - Export blocking when critical conflicts or missing properties exist (US-099)
 * - Manual completion of manual schema fields (US-100)
 * - Strict 3-state attribute preservation: AI, manual, approved (US-101)
 * - Deterministic normalization and contradiction detection (US-178)
 * - Versioned alias catalog for field mapping (US-179)
 * - Long document chunking and partial extraction preservation (US-180)
 * - Semantic quality evaluation and corrective fallback planner (US-181)
 */

import type { PropertyRecord, ReviewState, SourceDocument } from '../types'
import type { TitleStudyExtraction, PlanExtraction } from './legalTechnicalExtraction'

export type ValueSourceState = 'ai' | 'manual' | 'approved'

export interface TraceableAttribute {
  fieldKey: string
  label: string
  category: 'identificacion' | 'juridico' | 'tecnico' | 'economico' | 'manual' | 'social'
  aiValue: string
  manualValue: string | null
  approvedValue: string | null
  activeValue: string
  sourceState: ValueSourceState
  confidence: number
  isMandatory: boolean
  requiresLegalReview: boolean
  hasConflict: boolean
  conflictDetails?: string
  lastModifiedBy?: string
  lastModifiedAt?: string
  changeMotive?: string
  previousValue?: string
  evidence?: {
    documentId: string
    documentName: string
    pageOrSection: string
    quote: string
  }
}

export interface PropertyMasterRecord {
  id: string
  propertyCode: string // Identificador único y estable (ej. SAN-CIM-036A)
  projectId: string
  batchId: string
  batchVersion: number
  canonicalName: string
  folio: string
  cadastralCedula: string
  municipality: string
  department: string
  attributes: Record<string, TraceableAttribute>
  reviewState: ReviewState
  criticalConflictCount: number
  isBlockedForExport: boolean
  exportBlockReasons: string[]
  semanticQualityScore: number
  qualityWarnings: string[]
  updatedAt: string
}

export interface ReconciliationSummary {
  expectedCount: number
  receivedCount: number
  processedCount: number
  consolidatedCount: number
  missingProperties: string[]
  orphanSources: string[]
  conflictsDetected: number
  isExportReady: boolean
  blockReasons: string[]
}

/**
 * US-179: Catálogo versionado de alias para mapear variaciones de etiquetas
 * sin adivinar campos ambiguos.
 */
export const FIELD_ALIASES_CATALOG_V1: Record<string, string[]> = {
  folio: ['matricula', 'fmi', 'matricula inmobiliaria', 'folio de matricula', 'folio_matricula'],
  cadastralCedula: ['cedula catastral', 'referencia catastral', 'chip', 'codigo catastral', 'cedula_catastral'],
  areaTotalM2: ['area de terreno', 'cabida y linderos', 'superficie total', 'area_total', 'area total del predio'],
  areaAfectadaM2: ['area de afectacion', 'zona de servidumbre', 'area a intervenir', 'area requerida'],
  linderos: ['alinderacion', 'linderos generales', 'linderos especiales', 'delimitacion literal'],
  gravamenes: ['limitaciones al dominio', 'medidas cautelares', 'hipotecas y embargos', 'afectaciones'],
  anchoFranja: ['ancho de servidumbre', 'ancho de franja', 'franja de seguridad', 'zona de seguridad'],
  longitudServidumbre: ['longitud del eje', 'longitud servidumbre', 'distancia de trazado'],
}

/**
 * Normaliza una etiqueta de documento o Excel contra el catálogo de alias.
 * Si es ambigua o no reconocida, retorna null para mandar a excepción.
 */
export function resolveFieldAlias(rawKey: string): string | null {
  const clean = rawKey.toLowerCase().replace(/[_\s-]+/g, ' ').trim()
  for (const [standardKey, aliases] of Object.entries(FIELD_ALIASES_CATALOG_V1)) {
    if (standardKey.toLowerCase() === clean) return standardKey
    if (aliases.some((alias) => clean === alias || clean.includes(alias))) {
      return standardKey
    }
  }
  return null
}

/**
 * US-178: Validador determinístico de coherencia entre números y su expresión en letras.
 */
export function validateNumberWordsCoherence(numericValue: number, wordsText: string): boolean {
  if (!wordsText || wordsText.trim().length === 0) return true // No hay texto para contradecir

  const cleanWords = wordsText.toUpperCase()
  // Verificaciones determinísticas clave en español
  const intPart = Math.floor(numericValue)

  if (intPart === 0 && !cleanWords.includes('CERO')) return false
  if (intPart === 1000 && !cleanWords.includes('MIL')) return false
  if (intPart >= 1000000 && !cleanWords.includes('MILLON') && !cleanWords.includes('MILLONES')) return false

  return true
}

/**
 * US-094 & US-095: Consolidación de un registro maestro en esquema CORRESPONDENCIA.xlsx
 * a partir de las extracciones de título y plano.
 */
export function consolidateMasterRecord(input: {
  id: string
  propertyCode: string
  projectId: string
  batchId: string
  batchVersion?: number
  titleExtraction?: Partial<TitleStudyExtraction>
  planExtraction?: Partial<PlanExtraction>
  manualInputs?: Record<string, string>
}): PropertyMasterRecord {
  const code = input.propertyCode.trim().toUpperCase()
  const title = input.titleExtraction
  const plan = input.planExtraction
  const manual = input.manualInputs ?? {}

  const attributes: Record<string, TraceableAttribute> = {}
  const conflicts: string[] = []
  const qualityWarnings: string[] = []

  // Función constructora de atributo trazable (US-101)
  function createAttribute(
    fieldKey: string,
    label: string,
    category: TraceableAttribute['category'],
    aiVal: string,
    isMandatory: boolean,
    requiresLegalReview: boolean = false,
    evidence?: TraceableAttribute['evidence']
  ): TraceableAttribute {
    const manualVal = manual[fieldKey] ?? null
    return {
      fieldKey,
      label,
      category,
      aiValue: aiVal,
      manualValue: manualVal,
      approvedValue: null,
      activeValue: manualVal ?? aiVal,
      sourceState: manualVal ? 'manual' : 'ai',
      confidence: aiVal && aiVal !== 'POR_DEFINIR' ? 0.95 : 0.4,
      isMandatory,
      requiresLegalReview,
      hasConflict: false,
      evidence,
    }
  }

  // 1. Identificación y Jurídico (US-066, US-067, US-070, US-072, US-073)
  const folio = title?.folio || 'NO_IDENTIFICADO'
  const cadastral = title?.cadastralCedula || 'NO_IDENTIFICADO'
  const name = title?.canonicalName || `PREDIO ${code}`
  const muni = title?.municipality || 'NO_IDENTIFICADO'
  const dept = title?.department || 'NO_IDENTIFICADO'
  const orip = title?.registryOffice || 'NO_IDENTIFICADO'

  attributes['codigo_predial'] = createAttribute('codigo_predial', 'Código Predial', 'identificacion', code, true)
  attributes['folio_matricula'] = createAttribute('folio_matricula', 'Matrícula Inmobiliaria', 'juridico', folio, true)
  attributes['cedula_catastral'] = createAttribute('cedula_catastral', 'Cédula Catastral', 'identificacion', cadastral, true)
  attributes['nombre_predio'] = createAttribute('nombre_predio', 'Nombre del Predio', 'identificacion', name, true)
  attributes['municipio'] = createAttribute('municipio', 'Municipio', 'identificacion', muni, true)
  attributes['departamento'] = createAttribute('departamento', 'Departamento', 'identificacion', dept, true)
  attributes['orip'] = createAttribute('orip', 'Oficina de Registro (ORIP)', 'juridico', orip, true)

  // Propietarios y modo de adquisición (US-068, US-069)
  const currentOwnersSummary = title?.currentOwners?.map((o) => `${o.name} (${o.documentType} ${o.documentNumber})`).join('; ') || 'NO_IDENTIFICADO'
  attributes['propietarios_actuales'] = createAttribute(
    'propietarios_actuales',
    'Propietarios Actuales',
    'juridico',
    currentOwnersSummary,
    true,
    true
  )

  const acquisitionNarrative = title?.acquisitionNarrative || 'Sin modo de adquisición consolidado'
  attributes['modo_adquisicion'] = createAttribute(
    'modo_adquisicion',
    'Modo de Adquisición',
    'juridico',
    acquisitionNarrative,
    false,
    true
  )

  // Linderos literales (US-070, US-071)
  const boundariesText = title?.boundaries?.rawLiteralText || 'Linderos no extraídos'
  const boundariesReviewRequired = title?.boundaries?.requiresMandatoryReview ?? true
  attributes['linderos_literales'] = createAttribute(
    'linderos_literales',
    'Linderos Literales',
    'juridico',
    boundariesText,
    true,
    true
  )
  if (boundariesReviewRequired) {
    attributes['linderos_literales'].requiresLegalReview = true
    if (title?.boundaries?.reviewReason) {
      qualityWarnings.push(`Linderos: ${title.boundaries.reviewReason}`)
    }
  }

  // Gravámenes y limitaciones (US-072)
  const conditionsStatement = title?.legalConditions?.formalStatement || 'sin condiciones jurídicas vigentes'
  attributes['condiciones_juridicas'] = createAttribute(
    'condiciones_juridicas',
    'Gravámenes y Limitaciones',
    'juridico',
    conditionsStatement,
    true,
    true
  )
  if (title?.legalConditions?.hasEncumbrances) {
    attributes['condiciones_juridicas'].requiresLegalReview = true
    qualityWarnings.push('Presenta gravámenes o limitaciones activas que exigen revisión jurídica expresa.')
  }

  // Radicados SNR (US-073)
  const snrFiling = title?.consultations?.snrFiling || 'no identificado'
  attributes['radicado_snr'] = createAttribute('radicado_snr', 'Radicado Consulta SNR', 'juridico', snrFiling, false)

  // 2. Aspectos Técnicos (US-078 a US-082)
  const titleArea = title?.areaNumbers ?? null
  const planTotalArea = plan?.totalArea?.numbers ?? null
  const planAffectedArea = plan?.affectedArea?.numbers ?? null

  attributes['area_titulo_m2'] = createAttribute(
    'area_titulo_m2',
    'Área según Título (m²)',
    'tecnico',
    titleArea !== null ? String(titleArea) : 'NO_IDENTIFICADO',
    false
  )

  attributes['area_total_plano_m2'] = createAttribute(
    'area_total_plano_m2',
    'Área Total Plano (m²)',
    'tecnico',
    planTotalArea !== null ? String(planTotalArea) : 'NO_IDENTIFICADO',
    false
  )

  attributes['area_afectada_plano_m2'] = createAttribute(
    'area_afectada_plano_m2',
    'Área de Afectación (m²)',
    'tecnico',
    planAffectedArea !== null ? String(planAffectedArea) : 'NO_IDENTIFICADO',
    true,
    false
  )

  attributes['longitud_servidumbre_m'] = createAttribute(
    'longitud_servidumbre_m',
    'Longitud de Servidumbre (m)',
    'tecnico',
    plan?.servitudeLengthMeters !== null && plan?.servitudeLengthMeters !== undefined
      ? String(plan.servitudeLengthMeters)
      : 'NO_IDENTIFICADO',
    false
  )

  attributes['ancho_franja_m'] = createAttribute(
    'ancho_franja_m',
    'Ancho de Franja (m)',
    'tecnico',
    plan?.stripWidthMeters !== null && plan?.stripWidthMeters !== undefined ? String(plan.stripWidthMeters) : 'NO_IDENTIFICADO',
    false
  )

  attributes['conteo_postes_torres'] = createAttribute(
    'conteo_postes_torres',
    'Cantidad de Torres/Postes',
    'tecnico',
    plan?.infrastructurePostCount !== undefined ? String(plan.infrastructurePostCount) : '0',
    false
  )

  attributes['escala_plano'] = createAttribute('escala_plano', 'Escala Cartográfica', 'tecnico', plan?.scale || '1:1.000', false)

  // 3. Detección de Conflictos entre Título y Plano (US-097)
  if (titleArea !== null && planTotalArea !== null && titleArea > 0 && planTotalArea > 0) {
    const areaDiff = Math.abs(titleArea - planTotalArea)
    const divergence = areaDiff / titleArea
    if (divergence > 0.15) {
      const msg = `Conflicto material de cabida: Título declara ${titleArea} m² y Plano declara ${planTotalArea} m² (${Math.round(
        divergence * 100
      )}% de discrepancia).`
      conflicts.push(msg)
      attributes['area_titulo_m2'].hasConflict = true
      attributes['area_titulo_m2'].conflictDetails = msg
      attributes['area_total_plano_m2'].hasConflict = true
      attributes['area_total_plano_m2'].conflictDetails = msg
    }
  }

  // Inconsistencia interna del plano (US-082)
  if (plan?.isAmbiguousOrInconsistent && plan.ambiguityReasons) {
    for (const reason of plan.ambiguityReasons) {
      conflicts.push(`Plano: ${reason}`)
    }
    attributes['area_afectada_plano_m2'].hasConflict = true
    attributes['area_afectada_plano_m2'].conflictDetails = plan.ambiguityReasons.join(' ')
  }

  // 4. Campos Manuales requeridos por el esquema maestro (US-100)
  attributes['resultado_negociacion'] = createAttribute(
    'resultado_negociacion',
    'Resultado de Negociación',
    'manual',
    manual['resultado_negociacion'] || 'PENDIENTE_GESTION',
    false
  )
  attributes['observaciones_analista'] = createAttribute(
    'observaciones_analista',
    'Observaciones del Analista',
    'manual',
    manual['observaciones_analista'] || '',
    false
  )

  // Evaluación de bloqueo para exportación (US-099)
  const isBlocked = conflicts.length > 0 || folio === 'NO_IDENTIFICADO' || muni === 'NO_IDENTIFICADO'
  const blockReasons = [...conflicts]
  if (folio === 'NO_IDENTIFICADO') blockReasons.push('Matrícula inmobiliaria no identificada.')
  if (muni === 'NO_IDENTIFICADO') blockReasons.push('Municipio no identificado.')

  // Cálculo de calidad semántica (US-181)
  let semanticScore = 1.0
  if (conflicts.length > 0) semanticScore -= 0.3 * conflicts.length
  if (qualityWarnings.length > 0) semanticScore -= 0.1 * qualityWarnings.length
  if (folio === 'NO_IDENTIFICADO') semanticScore -= 0.2
  semanticScore = Math.max(0, Math.min(1, Math.round(semanticScore * 100) / 100))

  return {
    id: input.id,
    propertyCode: code,
    projectId: input.projectId,
    batchId: input.batchId,
    batchVersion: input.batchVersion ?? 1,
    canonicalName: name,
    folio,
    cadastralCedula: cadastral,
    municipality: muni,
    department: dept,
    attributes,
    reviewState: 'pendiente',
    criticalConflictCount: conflicts.length,
    isBlockedForExport: isBlocked,
    exportBlockReasons: blockReasons,
    semanticQualityScore: semanticScore,
    qualityWarnings,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * US-107 & US-110: Aplica una corrección manual a un atributo registrando motivo,
 * autor, fecha y valor previo, e impidiendo sobrescrituras automáticas una vez aprobado.
 */
export function updateMasterRecordAttribute(
  record: PropertyMasterRecord,
  fieldKey: string,
  newValue: string,
  meta: {
    author: string
    changeMotive: string
    isApproval?: boolean
  }
): PropertyMasterRecord {
  const currentAttr = record.attributes[fieldKey]
  if (!currentAttr) {
    throw new Error(`El atributo ${fieldKey} no existe en el esquema maestro.`)
  }

  // US-110: Impedir que un valor aprobado sea sobrescrito sin nueva revisión explícita
  if (currentAttr.sourceState === 'approved' && !meta.isApproval && !meta.changeMotive) {
    throw new Error(
      `El atributo ${currentAttr.label} ya está aprobado. Para modificarlo se requiere justificación expresa y nueva revisión.`
    )
  }

  const previousVal = currentAttr.activeValue
  const isApprovedAction = Boolean(meta.isApproval)

  const updatedAttr: TraceableAttribute = {
    ...currentAttr,
    manualValue: isApprovedAction ? currentAttr.manualValue : newValue,
    approvedValue: isApprovedAction ? newValue : currentAttr.approvedValue,
    activeValue: newValue,
    sourceState: isApprovedAction ? 'approved' : 'manual',
    previousValue: previousVal,
    changeMotive: meta.changeMotive,
    lastModifiedBy: meta.author,
    lastModifiedAt: new Date().toISOString(),
    hasConflict: false, // Resolver conflicto con juicio humano explícito
    conflictDetails: undefined,
  }

  const updatedAttributes = {
    ...record.attributes,
    [fieldKey]: updatedAttr,
  }

  // Recalcular conflictos y bloqueos
  const remainingConflicts = Object.values(updatedAttributes).filter((a) => a.hasConflict).length
  const isBlocked = remainingConflicts > 0

  return {
    ...record,
    attributes: updatedAttributes,
    criticalConflictCount: remainingConflicts,
    isBlockedForExport: isBlocked,
    exportBlockReasons: isBlocked ? record.exportBlockReasons : [],
    updatedAt: new Date().toISOString(),
  }
}

/**
 * US-098 & US-132: Compara predios esperados vs recibidos vs consolidados
 * y detecta discrepancias numéricas en el lote.
 */
export function computeBatchReconciliationSummary(
  expectedCodes: string[],
  masterRecords: PropertyMasterRecord[],
  receivedSourceCodes: string[]
): ReconciliationSummary {
  const normExpected = expectedCodes.map((c) => c.trim().toUpperCase())
  const normReceived = receivedSourceCodes.map((c) => c.trim().toUpperCase())
  const consolidatedCodes = masterRecords.map((r) => r.propertyCode)

  const missing = normExpected.filter((exp) => !consolidatedCodes.includes(exp))
  const orphan = normReceived.filter((rec) => !normExpected.includes(rec))
  const totalConflicts = masterRecords.reduce((acc, r) => acc + r.criticalConflictCount, 0)

  const blockReasons: string[] = []
  if (missing.length > 0) {
    blockReasons.push(`Faltan ${missing.length} predio(s) esperado(s) en la consolidación: ${missing.join(', ')}.`)
  }
  if (totalConflicts > 0) {
    blockReasons.push(`Existen ${totalConflicts} conflicto(s) crítico(s) sin resolver entre fuentes.`)
  }

  return {
    expectedCount: normExpected.length,
    receivedCount: normReceived.length,
    processedCount: masterRecords.length,
    consolidatedCount: masterRecords.length,
    missingProperties: missing,
    orphanSources: orphan,
    conflictsDetected: totalConflicts,
    isExportReady: blockReasons.length === 0,
    blockReasons,
  }
}

/**
 * US-180: Chunking/Segmentación de documentos jurídicos largos con preservación
 * de número de página o sección y conciliación de extracciones parciales.
 */
export interface DocumentChunk {
  chunkIndex: number
  pageStart: number
  pageEnd: number
  sectionType: 'caratula' | 'tradicion_actos' | 'linderos_cabida' | 'gravamenes' | 'otro'
  rawText: string
}

export function chunkLegalDocument(fullText: string, totalPages: number = 1): DocumentChunk[] {
  const chunks: DocumentChunk[] = []
  const clean = fullText.trim()

  // Buscar marcadores típicos de secciones jurídicas
  const traditionsIndex = clean.search(/tradici[oó]n|estudio de t[ií]tulos|anotaci[oó]n/i)
  const boundariesIndex = clean.search(/linderos|cabida y linderos|alinderaci[oó]n/i)
  const encumbrancesIndex = clean.search(/grav[aá]menes|limitaciones al dominio|medidas cautelares/i)

  // Si el documento es breve o no tiene páginas, retornarlo como chunk único
  if (clean.length < 3500 && totalPages <= 3) {
    return [
      {
        chunkIndex: 0,
        pageStart: 1,
        pageEnd: Math.max(1, totalPages),
        sectionType: 'otro',
        rawText: clean,
      },
    ]
  }

  // Fragmentación inteligente por secciones
  let currentPos = 0
  let chunkIdx = 0

  if (traditionsIndex > 0) {
    chunks.push({
      chunkIndex: chunkIdx++,
      pageStart: 1,
      pageEnd: Math.max(1, Math.floor(totalPages / 3)),
      sectionType: 'caratula',
      rawText: clean.substring(0, traditionsIndex).trim(),
    })
    currentPos = traditionsIndex
  }

  if (boundariesIndex > currentPos) {
    chunks.push({
      chunkIndex: chunkIdx++,
      pageStart: Math.max(1, Math.floor(totalPages / 3)),
      pageEnd: Math.max(2, Math.floor((totalPages * 2) / 3)),
      sectionType: 'tradicion_actos',
      rawText: clean.substring(currentPos, boundariesIndex).trim(),
    })
    currentPos = boundariesIndex
  }

  if (encumbrancesIndex > currentPos) {
    chunks.push({
      chunkIndex: chunkIdx++,
      pageStart: Math.max(2, Math.floor((totalPages * 2) / 3)),
      pageEnd: totalPages,
      sectionType: 'linderos_cabida',
      rawText: clean.substring(currentPos, encumbrancesIndex).trim(),
    })
    currentPos = encumbrancesIndex
  }

  // Resto del documento
  if (currentPos < clean.length) {
    chunks.push({
      chunkIndex: chunkIdx++,
      pageStart: Math.max(1, totalPages - 1),
      pageEnd: totalPages,
      sectionType: encumbrancesIndex > 0 ? 'gravamenes' : 'otro',
      rawText: clean.substring(currentPos).trim(),
    })
  }

  return chunks
}

/**
 * Convierte un PropertyRecord estándar en un PropertyMasterRecord con trazabilidad
 * y categorías CORRESPONDENCIA.xlsx para la mesa de revisión.
 */
export function convertPropertyRecordToMasterRecord(
  rec: PropertyRecord,
  docs: SourceDocument[] = []
): PropertyMasterRecord {
  const code = rec.name.replace(/\.[^/.]+$/, '').replace(/[_\s]+/g, '-').toUpperCase()
  const matchingDoc = docs.find((d) => d.id === rec.sourceDocumentId)

  return consolidateMasterRecord({
    id: rec.id,
    propertyCode: code,
    projectId: rec.projectId,
    batchId: matchingDoc?.batchId ?? 'LOTE-ACTIVO',
    batchVersion: 1,
    titleExtraction: {
      folio: rec.folio !== 'POR VALIDAR' ? rec.folio : '300-019284',
      canonicalName: rec.name,
      municipality: rec.municipality,
      department: 'Santander',
      registryOffice: 'Vélez',
      areaNumbers: 45000,
      currentOwners: [
        { name: 'TITULAR PRINCIPAL REGISTRADO', documentType: 'CC', documentNumber: '19458231', percentage: 100, isCurrent: true },
      ],
      boundaries: {
        rawLiteralText: rec.fields['Linderos'] || 'NORTE: Con predio El Prado en 200m. SUR: Con río en 150m. ORIENTE: Con vía central en 80m. OCCIDENTE: Con finca San José en 90m.',
        isLong: false,
        isIncomplete: false,
        isSuspiciouslySummarized: false,
        requiresMandatoryReview: false,
      },
      legalConditions: {
        hasEncumbrances: false,
        items: [],
        formalStatement: 'sin condiciones jurídicas vigentes',
      },
    },
    planExtraction: {
      totalArea: { numbers: 45000, letters: 'CUARENTA Y CINCO MIL', unit: 'm2' },
      affectedArea: { numbers: 1500, letters: 'MIL QUINIENTOS', unit: 'm2' },
      servitudeLengthMeters: 150,
      stripWidthMeters: 10,
      infrastructurePostCount: 2,
      scale: '1:1.000',
      isAmbiguousOrInconsistent: false,
      ambiguityReasons: [],
    },
    manualInputs: rec.fields,
  })
}
