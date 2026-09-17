import { NegotiationRecord } from '../types'

export interface NegotiationRowInput {
  propertyCode: string
  initialOfferNum?: number | string | null
  initialOfferText?: string | null
  negotiatedOfferNum?: number | string | null
  negotiatedOfferText?: string | null
  finalOfferNum?: number | string | null
  finalOfferText?: string | null
  rowIndex: number
}

export interface TemplateValidationResult {
  isValid: boolean
  matchedColumns: string[]
  missingColumns: string[]
  detectedType: 'plantilla_aprobada' | 'plantilla_invalida'
}

export const APPROVED_NEGOTIATION_COLUMNS = [
  'codigo_predial',
  'oferta_inicial_num',
  'oferta_inicial_letras',
  'oferta_negociada_num',
  'oferta_negociada_letras',
  'oferta_definitiva_num',
  'oferta_definitiva_letras'
]

export function validateNegotiationTemplate(headers: string[]): TemplateValidationResult {
  const normalizedHeaders = headers.map(h =>
    h.toLowerCase().trim().replace(/[\s_-]+/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  )

  const matchedColumns: string[] = []
  const missingColumns: string[] = []

  for (const expected of APPROVED_NEGOTIATION_COLUMNS) {
    const found = normalizedHeaders.some(h => h.includes(expected) || expected.includes(h))
    if (found) {
      matchedColumns.push(expected)
    } else {
      missingColumns.push(expected)
    }
  }

  // Se considera aprobada si tiene al menos código predial y dos ofertas
  const isValid =
    matchedColumns.includes('codigo_predial') &&
    (matchedColumns.includes('oferta_inicial_num') || matchedColumns.includes('oferta_definitiva_num'))

  return {
    isValid,
    matchedColumns,
    missingColumns,
    detectedType: isValid ? 'plantilla_aprobada' : 'plantilla_invalida'
  }
}

export function formatExcelCell(colIndex: number, rowIndex: number): string {
  const colLetter = String.fromCharCode(65 + (colIndex % 26))
  return `${colLetter}${rowIndex + 1}`
}

export function parseMonetaryNumber(val: number | string | null | undefined): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'number') return isNaN(val) ? null : val

  const cleaned = val
    .replace(/[$\s.]/g, '')
    .replace(',', '.')
    .trim()
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? null : parsed
}

export function numberToSpanishWords(n: number): string {
  if (n === 0) return 'cero'
  const units = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
  const teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve']
  const tens = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
  const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

  function convertGroup(num: number): string {
    if (num === 100) return 'cien'
    let res = ''
    const h = Math.floor(num / 100)
    const rem = num % 100
    if (h > 0) res += hundreds[h] + ' '
    if (rem >= 10 && rem < 20) {
      res += teens[rem - 10]
    } else {
      const t = Math.floor(rem / 10)
      const u = rem % 10
      if (t > 0) {
        if (t === 2 && u > 0) res += 'veinti' + units[u]
        else if (u > 0) res += tens[t] + ' y ' + units[u]
        else res += tens[t]
      } else if (u > 0) {
        res += units[u]
      }
    }
    return res.trim()
  }

  let result = ''
  const millions = Math.floor(n / 1000000)
  const remMillions = n % 1000000
  const thousands = Math.floor(remMillions / 1000)
  const unitsGroup = remMillions % 1000

  if (millions > 0) {
    if (millions === 1) result += 'un millon '
    else result += convertGroup(millions) + ' millones '
  }
  if (thousands > 0) {
    if (thousands === 1) result += 'mil '
    else result += convertGroup(thousands) + ' mil '
  }
  if (unitsGroup > 0) {
    result += convertGroup(unitsGroup)
  }

  return result.trim()
}

export function verifyOfferMatch(
  numVal: number | null,
  textVal: string | null | undefined
): 'coinciden' | 'discrepancia' | 'incompleto' {
  if (numVal === null || !textVal || textVal.trim() === '') {
    return 'incompleto'
  }

  const cleanActual = textVal
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/pesos|m\/cte|moneda legal|colombianos|\./gi, '')
    .trim()

  const expectedWords = numberToSpanishWords(numVal)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  if (cleanActual === expectedWords || cleanActual.includes(expectedWords) || expectedWords.includes(cleanActual)) {
    return 'coinciden'
  }

  return 'discrepancia'
}

export function extractNegotiationOffers(
  input: NegotiationRowInput,
  projectId: string,
  batchId: string
): NegotiationRecord {
  const initNum = parseMonetaryNumber(input.initialOfferNum)
  const negNum = parseMonetaryNumber(input.negotiatedOfferNum)
  const finNum = parseMonetaryNumber(input.finalOfferNum)

  const initMatch = verifyOfferMatch(initNum, input.initialOfferText)
  const negMatch = verifyOfferMatch(negNum, input.negotiatedOfferText)
  const finMatch = verifyOfferMatch(finNum, input.finalOfferText)

  let overallMatch: NegotiationRecord['offersMatchStatus'] = 'coinciden'
  if (initMatch === 'discrepancia' || negMatch === 'discrepancia' || finMatch === 'discrepancia') {
    overallMatch = 'discrepancia'
  } else if (initMatch === 'incompleto' && finMatch === 'incompleto') {
    overallMatch = 'incompleto'
  }

  const cellReferences: Record<string, string> = {
    propertyCodeCell: formatExcelCell(0, input.rowIndex),
    initialOfferCell: formatExcelCell(1, input.rowIndex),
    negotiatedOfferCell: formatExcelCell(3, input.rowIndex),
    finalOfferCell: formatExcelCell(5, input.rowIndex)
  }

  const now = new Date().toISOString()

  return {
    id: `neg-${projectId}-${input.propertyCode}`,
    projectId,
    batchId,
    propertyCode: input.propertyCode,
    initialOfferNum: initNum,
    initialOfferText: input.initialOfferText ?? null,
    negotiatedOfferNum: negNum,
    negotiatedOfferText: input.negotiatedOfferText ?? null,
    finalOfferNum: finNum,
    finalOfferText: input.finalOfferText ?? null,
    offersMatchStatus: overallMatch,
    cellReferences,
    isApproved: false,
    correctedManually: false,
    reviewerNotes: null,
    createdAt: now,
    updatedAt: now
  }
}

export interface NegotiationAnomaly {
  propertyCode: string
  anomalyType: 'sin_oferta' | 'oferta_duplicada' | 'rango_invalido' | 'discrepancia_letras'
  description: string
}

export function detectNegotiationAnomalies(records: NegotiationRecord[]): NegotiationAnomaly[] {
  const anomalies: NegotiationAnomaly[] = []
  const seenCodes = new Set<string>()

  for (const rec of records) {
    // 1. Predio duplicado
    if (seenCodes.has(rec.propertyCode)) {
      anomalies.push({
        propertyCode: rec.propertyCode,
        anomalyType: 'oferta_duplicada',
        description: `El predio ${rec.propertyCode} tiene múltiples registros de oferta en la plantilla.`
      })
    }
    seenCodes.add(rec.propertyCode)

    // 2. Sin oferta alguna
    if (!rec.initialOfferNum && !rec.negotiatedOfferNum && !rec.finalOfferNum) {
      anomalies.push({
        propertyCode: rec.propertyCode,
        anomalyType: 'sin_oferta',
        description: `El predio ${rec.propertyCode} no registra ningún valor numérico de oferta.`
      })
    }

    // 3. Rango económico inválido (oferta final menor a inicial)
    if (rec.initialOfferNum && rec.finalOfferNum && rec.finalOfferNum < rec.initialOfferNum) {
      anomalies.push({
        propertyCode: rec.propertyCode,
        anomalyType: 'rango_invalido',
        description: `Inconsistencia económica: la oferta final ($${rec.finalOfferNum}) es menor a la oferta inicial ($${rec.initialOfferNum}).`
      })
    }

    // 4. Discrepancia entre números y letras
    if (rec.offersMatchStatus === 'discrepancia') {
      anomalies.push({
        propertyCode: rec.propertyCode,
        anomalyType: 'discrepancia_letras',
        description: `Discrepancia entre los valores numéricos y la expresión en letras para el predio ${rec.propertyCode}.`
      })
    }
  }

  return anomalies
}

export function correctNegotiationOfferManually(
  record: NegotiationRecord,
  updates: Partial<Pick<NegotiationRecord, 'initialOfferNum' | 'initialOfferText' | 'negotiatedOfferNum' | 'negotiatedOfferText' | 'finalOfferNum' | 'finalOfferText'>>,
  reviewerNotes: string
): NegotiationRecord {
  const updated: NegotiationRecord = {
    ...record,
    ...updates,
    correctedManually: true,
    reviewerNotes,
    updatedAt: new Date().toISOString()
  }

  // Re-evaluar coincidencia
  const matchInit = verifyOfferMatch(updated.initialOfferNum ?? null, updated.initialOfferText)
  const matchFin = verifyOfferMatch(updated.finalOfferNum ?? null, updated.finalOfferText)

  if (matchInit === 'discrepancia' || matchFin === 'discrepancia') {
    updated.offersMatchStatus = 'discrepancia'
  } else if (matchInit === 'coinciden' || matchFin === 'coinciden') {
    updated.offersMatchStatus = 'coinciden'
  }

  return updated
}

// US-076: Comparación visual de linderos
export interface BoundaryDiffResult {
  similarityRatio: number
  matchedTokensCount: number
  missingInExtracted: string[]
  isCloseMatch: boolean
}

export function compareBoundariesVisualDiff(
  extractedBoundaries: string,
  sourceDocumentText: string
): BoundaryDiffResult {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 3)

  const extractedTokens = normalize(extractedBoundaries)
  const sourceTokens = new Set(normalize(sourceDocumentText))

  let matched = 0
  const missing: string[] = []

  for (const token of extractedTokens) {
    if (sourceTokens.has(token)) {
      matched++
    } else {
      missing.push(token)
    }
  }

  const similarityRatio = extractedTokens.length > 0 ? matched / extractedTokens.length : 0

  return {
    similarityRatio: Math.round(similarityRatio * 100) / 100,
    matchedTokensCount: matched,
    missingInExtracted: missing.slice(0, 10),
    isCloseMatch: similarityRatio >= 0.7
  }
}

// US-085: Validación geométrica configurable de planos
export interface GeometricValidationResult {
  isCoherent: boolean
  calculatedArea: number
  declaredArea: number
  deviationPercent: number
  warning?: string
}

export function validateGeometricCoherenceConfigurable(
  lengthMeters: number,
  widthMeters: number,
  declaredAreaM2: number,
  tolerancePercent: number = 15
): GeometricValidationResult {
  const calculatedArea = lengthMeters * widthMeters
  if (declaredAreaM2 <= 0 || calculatedArea <= 0) {
    return {
      isCoherent: false,
      calculatedArea,
      declaredArea: declaredAreaM2,
      deviationPercent: 100,
      warning: 'Medidas nulas o negativas.'
    }
  }

  const diff = Math.abs(calculatedArea - declaredAreaM2)
  const deviationPercent = Math.round((diff / declaredAreaM2) * 1000) / 10

  const isCoherent = deviationPercent <= tolerancePercent

  return {
    isCoherent,
    calculatedArea,
    declaredArea: declaredAreaM2,
    deviationPercent,
    warning: isCoherent
      ? undefined
      : `Desviación geométrica del ${deviationPercent}% entre área declarada (${declaredAreaM2} m2) y largo x ancho (${calculatedArea} m2) supera la tolerancia del ${tolerancePercent}%.`
  }
}

// US-086: Procesamiento masivo y consolidación de grupos de planos
export interface PlanBatchSummary {
  totalPlans: number
  totalAffectedAreaM2: number
  averageServitudeWidthM: number
  totalInfrastructureElements: number
  plansWithAnomaliesCount: number
}

export function aggregateTechnicalPlansSummary(
  plans: Array<{
    areaM2: number | null
    widthM: number | null
    infrastructureCount: number
    hasAnomaly: boolean
  }>
): PlanBatchSummary {
  let totalArea = 0
  let totalWidth = 0
  let widthCount = 0
  let totalInfra = 0
  let anomalies = 0

  for (const p of plans) {
    if (p.areaM2) totalArea += p.areaM2
    if (p.widthM) {
      totalWidth += p.widthM
      widthCount++
    }
    totalInfra += p.infrastructureCount
    if (p.hasAnomaly) anomalies++
  }

  return {
    totalPlans: plans.length,
    totalAffectedAreaM2: Math.round(totalArea * 100) / 100,
    averageServitudeWidthM: widthCount > 0 ? Math.round((totalWidth / widthCount) * 100) / 100 : 0,
    totalInfrastructureElements: totalInfra,
    plansWithAnomaliesCount: anomalies
  }
}
