import type { AttributeChangeHistoryItem } from '../types'
import type {
  PropertyMasterRecord,
  TraceableAttribute
} from './masterRecordReconciliation'

export interface BulkApprovalResult {
  updatedRecord: PropertyMasterRecord
  approvedCount: number
  skippedDueToConflictCount: number
  historyItems: AttributeChangeHistoryItem[]
}

export function createManualPropertyMasterRecord(
  propertyCode: string,
  projectId: string,
  batchId: string,
  justification: string,
  initialFields: Record<string, string>,
  authorName: string,
  authorId?: string
): { record: PropertyMasterRecord; history: AttributeChangeHistoryItem[] } {
  const now = new Date().toISOString()
  const attributes: Record<string, TraceableAttribute> = {}
  const history: AttributeChangeHistoryItem[] = []

  for (const [key, value] of Object.entries(initialFields)) {
    attributes[key] = {
      fieldKey: key,
      label: key,
      category: 'manual',
      sourceState: 'manual',
      aiValue: '',
      manualValue: value,
      approvedValue: null,
      activeValue: value,
      confidence: 1.0,
      hasConflict: false,
      isMandatory: false,
      requiresLegalReview: false,
      lastModifiedAt: now,
      lastModifiedBy: authorName,
      changeMotive: `Registro manual de predio sin fuente procesable: ${justification}`
    }

    history.push({
      id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      projectId,
      propertyCode,
      attributeKey: key,
      previousValue: null,
      newValue: value,
      authorId: authorId ?? null,
      authorName,
      reason: `Creación manual de predio sin fuente procesable: ${justification}`,
      changeType: 'manual_edit',
      createdAt: now
    })
  }

  const record: PropertyMasterRecord = {
    id: `rec-manual-${propertyCode}`,
    propertyCode,
    projectId,
    batchId,
    batchVersion: 1,
    canonicalName: propertyCode,
    folio: '',
    cadastralCedula: '',
    municipality: initialFields['municipio'] || '',
    department: '',
    attributes,
    criticalConflictCount: 0,
    semanticQualityScore: 100,
    qualityWarnings: [`Predio creado manualmente sin fuente procesable: ${justification}`],
    reviewState: 'pendiente',
    isBlockedForExport: false,
    exportBlockReasons: [],
    updatedAt: now
  }

  return { record, history }
}

export function bulkApproveUncontestedAttributes(
  record: PropertyMasterRecord,
  authorName: string,
  authorId?: string
): BulkApprovalResult {
  let approvedCount = 0
  let skippedDueToConflictCount = 0
  const now = new Date().toISOString()
  const historyItems: AttributeChangeHistoryItem[] = []

  const updatedAttributes: Record<string, TraceableAttribute> = {}

  for (const [key, attr] of Object.entries(record.attributes)) {
    // Solo aprobar si no tiene conflicto y no requiere revisión jurídica obligatoria pendiente
    const canBulkApprove =
      !attr.hasConflict &&
      !attr.requiresLegalReview &&
      attr.sourceState !== 'approved' &&
      (attr.aiValue || attr.manualValue)

    if (canBulkApprove) {
      const targetVal = attr.manualValue ?? attr.aiValue ?? ''
      updatedAttributes[key] = {
        ...attr,
        sourceState: 'approved',
        approvedValue: targetVal,
        activeValue: targetVal,
        lastModifiedAt: now,
        lastModifiedBy: authorName,
        changeMotive: 'Aprobación en bloque de atributos sin conflicto ni observaciones.'
      }

      approvedCount++

      historyItems.push({
        id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        projectId: record.projectId,
        propertyCode: record.propertyCode,
        attributeKey: key,
        previousValue: attr.approvedValue,
        newValue: targetVal,
        authorId: authorId ?? null,
        authorName,
        reason: 'Aprobación en bloque (sin conflicto)',
        changeType: 'bulk_approved',
        createdAt: now
      })
    } else {
      if (attr.hasConflict || attr.requiresLegalReview) {
        skippedDueToConflictCount++
      }
      updatedAttributes[key] = attr
    }
  }

  const updatedRecord: PropertyMasterRecord = {
    ...record,
    attributes: updatedAttributes,
    updatedAt: now
  }

  return {
    updatedRecord,
    approvedCount,
    skippedDueToConflictCount,
    historyItems
  }
}

export function restoreAttributeValueFromHistory(
  record: PropertyMasterRecord,
  attributeKey: string,
  historyItem: AttributeChangeHistoryItem,
  authorName: string,
  authorId?: string
): { updatedRecord: PropertyMasterRecord; historyItem: AttributeChangeHistoryItem } {
  const now = new Date().toISOString()
  const currentAttr = record.attributes[attributeKey]
  const targetValue = historyItem.previousValue ?? historyItem.newValue ?? ''

  const newHistory: AttributeChangeHistoryItem = {
    id: `hist-restore-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    projectId: record.projectId,
    propertyCode: record.propertyCode,
    attributeKey,
    previousValue: currentAttr?.manualValue ?? currentAttr?.approvedValue ?? null,
    newValue: targetValue,
    authorId: authorId ?? null,
    authorName,
    reason: `Restauración de versión anterior desde historial (ref: ${historyItem.id})`,
    changeType: 'restored',
    createdAt: now
  }

  const updatedAttr: TraceableAttribute = {
    ...currentAttr,
    sourceState: 'manual',
    manualValue: targetValue,
    activeValue: targetValue,
    lastModifiedAt: now,
    lastModifiedBy: authorName,
    changeMotive: `Restauración controlada a valor de versión ${historyItem.createdAt}`
  }

  const updatedRecord: PropertyMasterRecord = {
    ...record,
    attributes: {
      ...record.attributes,
      [attributeKey]: updatedAttr
    },
    updatedAt: now
  }

  return {
    updatedRecord,
    historyItem: newHistory
  }
}

export interface MasterRecordVersionDiff {
  propertyCode: string
  versionA: number
  versionB: number
  changedAttributes: Array<{
    key: string
    label: string
    valA: string | null
    valB: string | null
  }>
  hasMaterialChanges: boolean
}

export function compareMasterRecordVersions(
  recA: PropertyMasterRecord,
  recB: PropertyMasterRecord
): MasterRecordVersionDiff {
  const allKeys = Array.from(
    new Set([...Object.keys(recA.attributes || {}), ...Object.keys(recB.attributes || {})])
  )

  const changedAttributes: MasterRecordVersionDiff['changedAttributes'] = []

  for (const key of allKeys) {
    const attrA = recA.attributes?.[key]
    const attrB = recB.attributes?.[key]

    const valA = attrA?.approvedValue ?? attrA?.manualValue ?? attrA?.aiValue ?? null
    const valB = attrB?.approvedValue ?? attrB?.manualValue ?? attrB?.aiValue ?? null

    if (valA !== valB) {
      changedAttributes.push({
        key,
        label: attrB?.label || attrA?.label || key,
        valA,
        valB
      })
    }
  }

  return {
    propertyCode: recB.propertyCode || recA.propertyCode,
    versionA: recA.batchVersion ?? 1,
    versionB: recB.batchVersion ?? 2,
    changedAttributes,
    hasMaterialChanges: changedAttributes.length > 0
  }
}

export interface ColumnMappingDefinition {
  sourceColumn: string
  targetAttributeKey: string
  transform?: (val: string) => string
}

export function mapExternalMasterDataToRecord(
  record: PropertyMasterRecord,
  externalRow: Record<string, string>,
  mapping: ColumnMappingDefinition[],
  authorName: string,
  authorId?: string
): { updatedRecord: PropertyMasterRecord; history: AttributeChangeHistoryItem[] } {
  const now = new Date().toISOString()
  const history: AttributeChangeHistoryItem[] = []
  const updatedAttributes = { ...record.attributes }

  for (const m of mapping) {
    const rawVal = externalRow[m.sourceColumn]
    if (rawVal !== undefined && rawVal !== null && rawVal.trim() !== '') {
      const transformedVal = m.transform ? m.transform(rawVal.trim()) : rawVal.trim()
      const existing = updatedAttributes[m.targetAttributeKey]

      history.push({
        id: `hist-import-${Date.now()}-${m.targetAttributeKey}`,
        projectId: record.projectId,
        propertyCode: record.propertyCode,
        attributeKey: m.targetAttributeKey,
        previousValue: existing?.manualValue ?? existing?.aiValue ?? null,
        newValue: transformedVal,
        authorId: authorId ?? null,
        authorName,
        reason: `Importación desde base externa (columna '${m.sourceColumn}')`,
        changeType: 'manual_edit',
        createdAt: now
      })

      updatedAttributes[m.targetAttributeKey] = {
        ...existing,
        fieldKey: m.targetAttributeKey,
        label: existing?.label || m.targetAttributeKey,
        category: existing?.category || 'manual',
        sourceState: 'manual',
        aiValue: existing?.aiValue || '',
        manualValue: transformedVal,
        approvedValue: existing?.approvedValue || null,
        activeValue: transformedVal,
        confidence: existing?.confidence ?? 1.0,
        hasConflict: false,
        isMandatory: existing?.isMandatory || false,
        requiresLegalReview: existing?.requiresLegalReview || false,
        lastModifiedAt: now,
        lastModifiedBy: authorName,
        changeMotive: `Importación asignada desde columna '${m.sourceColumn}'`
      }
    }
  }

  return {
    updatedRecord: {
      ...record,
      attributes: updatedAttributes,
      updatedAt: now
    },
    history
  }
}

export interface WordReviewAnnotation {
  id: string
  propertyCode: string
  attributeKey: string
  selectedText: string
  comment: string
  proposedValue: string
  authorName: string
  createdAt: string
  status: 'pending' | 'applied' | 'rejected'
}

export function createWordAnnotation(
  propertyCode: string,
  attributeKey: string,
  selectedText: string,
  comment: string,
  proposedValue: string,
  authorName: string
): WordReviewAnnotation {
  return {
    id: `annot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    propertyCode,
    attributeKey,
    selectedText,
    comment,
    proposedValue,
    authorName,
    createdAt: new Date().toISOString(),
    status: 'pending'
  }
}
