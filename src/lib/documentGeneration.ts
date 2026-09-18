import { DocumentTemplate, GeneratedDocument, TemplateKey } from '../types'
import JSZip from 'jszip'

export const DEFAULT_LEGAL_TEMPLATES: Record<TemplateKey, DocumentTemplate> = {
  oferta_economica: {
    id: 'tmpl-oferta-default',
    templateKey: 'oferta_economica',
    name: 'Oferta Formal de Indemnización y Adquisición',
    version: 1,
    requiredFields: [
      'codigo_predial',
      'propietario_actual',
      'matricula_inmobiliaria',
      'oferta_definitiva_num',
      'oferta_definitiva_letras',
      'municipio'
    ],
    templateBody: `OFERTA FORMAL DE INDEMNIZACIÓN Y ADQUISICIÓN DE DERECHOS

Predio Identificado con Código: {{codigo_predial}}
Municipio: {{municipio}}
Matrícula Inmobiliaria: {{matricula_inmobiliaria}}

Señor(a):
{{propietario_actual}}

Por medio de la presente, la Empresa presenta formal oferta económica voluntaria para la adquisición de la franja de servidumbre requerida para el proyecto eléctrico:

VALOR TOTAL OFRECIDO: $ {{oferta_definitiva_num}} (SON: {{oferta_definitiva_letras}} PESOS M/CTE).

La presente oferta se formula con fundamento en la Ley 56 de 1981 y el avalúo corporativo aprobado.`,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z'
  },
  acta_acuerdo: {
    id: 'tmpl-acta-default',
    templateKey: 'acta_acuerdo',
    name: 'Acta de Acuerdo Voluntario de Servidumbre',
    version: 1,
    requiredFields: [
      'codigo_predial',
      'propietario_actual',
      'matricula_inmobiliaria',
      'oferta_definitiva_num',
      'area_afectada_m2'
    ],
    templateBody: `ACTA DE CONCERTACIÓN Y ACUERDO VOLUNTARIO

En el municipio de {{municipio}}, se reúnen por una parte la Entidad Ejecutora y por otra {{propietario_actual}}, titular del predio {{codigo_predial}} con matrícula {{matricula_inmobiliaria}}.

Las partes convienen:
1. Otorgar el derecho de servidumbre de conducción de energía sobre un área afectada de {{area_afectada_m2}} m2.
2. Reconocer una indemnización total concertada por valor de $ {{oferta_definitiva_num}}.`,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z'
  },
  bitacora: {
    id: 'tmpl-bitacora-default',
    templateKey: 'bitacora',
    name: 'Bitácora Predial Consolidada',
    version: 1,
    requiredFields: ['codigo_predial', 'municipio'],
    templateBody: `BITÁCORA PREDIAL DE GESTIÓN TERRITORIAL

CÓDIGO PREDIAL: {{codigo_predial}}
MUNICIPIO: {{municipio}}
FECHA DE EXPEDIENTE: {{fecha_generacion}}

RESUMEN DE GESTIÓN:
- Estado Jurídico: {{estado_juridico}}
- Gravámenes o Limitaciones: {{gravamenes}}
- Área Servidumbre: {{area_afectada_m2}} m2
- Oferta Económica Final: $ {{oferta_definitiva_num}}`,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z'
  },
  poder: {
    id: 'tmpl-poder-default',
    templateKey: 'poder',
    name: 'Poder Especial Amplio y Suficiente',
    version: 1,
    requiredFields: [
      'propietario_actual',
      'cedula_propietario',
      'apoderado_nombre',
      'apoderado_cedula',
      'matricula_inmobiliaria'
    ],
    templateBody: `PODER ESPECIAL AMPLIO Y SUFICIENTE

Yo, {{propietario_actual}}, mayor de edad, identificado(a) con C.C. No. {{cedula_propietario}}, confiero PODER ESPECIAL a {{apoderado_nombre}}, con C.C. No. {{apoderado_cedula}}, para que en mi nombre y representación suscriba la escritura pública de servidumbre sobre el inmueble con matrícula {{matricula_inmobiliaria}}.`,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z'
  },
  promesa: {
    id: 'tmpl-promesa-default',
    templateKey: 'promesa',
    name: 'Promesa de Constitución de Servidumbre',
    version: 1,
    requiredFields: [
      'propietario_actual',
      'matricula_inmobiliaria',
      'linderos',
      'oferta_definitiva_num',
      'oferta_definitiva_letras'
    ],
    templateBody: `PROMESA DE CONSTITUCIÓN DE SERVIDUMBRE

Entre los suscritos:
PROMITENTE: {{propietario_actual}}
BENEFICIARIO: ISA INTERCOLOMBIA S.A. E.S.P.

INMUEBLE: Matrícula {{matricula_inmobiliaria}}.
LINDEROS DEL ÁREA: {{linderos}}.
PRECIO CONVENIDO: $ {{oferta_definitiva_num}} ({{oferta_definitiva_letras}}).`,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z'
  },
  escritura: {
    id: 'tmpl-escritura-default',
    templateKey: 'escritura',
    name: 'Minuta de Escritura Pública de Servidumbre',
    version: 1,
    requiredFields: [
      'propietario_actual',
      'matricula_inmobiliaria',
      'linderos',
      'oferta_definitiva_num'
    ],
    templateBody: `MINUTA DE ESCRITURA PÚBLICA DE SERVIDUMBRE ELÉCTRICA

Compareció {{propietario_actual}} y declaró que constituye gravamen de servidumbre de conducción de energía eléctrica sobre el predio {{matricula_inmobiliaria}}, delimitado por los siguientes linderos: {{linderos}}, por el valor indemnizatorio de $ {{oferta_definitiva_num}}.`,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z'
  }
}

export interface ValidationRequirementsResult {
  canGenerate: boolean
  missingFields: string[]
  conflicts: string[]
  warnings: string[]
}

export function validateTemplateRequirements(
  template: DocumentTemplate,
  propertyData: Record<string, unknown>,
  unresolvedConflicts: string[] = []
): ValidationRequirementsResult {
  const missingFields: string[] = []
  const conflicts: string[] = []
  const warnings: string[] = []

  for (const field of template.requiredFields) {
    const val = propertyData[field]
    if (val === undefined || val === null || String(val).trim() === '') {
      missingFields.push(field)
    }

    if (unresolvedConflicts.includes(field)) {
      conflicts.push(field)
    }
  }

  const canGenerate = missingFields.length === 0 && conflicts.length === 0

  return {
    canGenerate,
    missingFields,
    conflicts,
    warnings
  }
}

export function renderDocumentTemplate(
  template: DocumentTemplate,
  propertyData: Record<string, unknown>
): string {
  let rendered = template.templateBody

  // Reemplazo de variables {{variable}}
  rendered = rendered.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, varName) => {
    const val = propertyData[varName]
    if (val !== undefined && val !== null) {
      return String(val)
    }
    return `[PENDIENTE: ${varName}]`
  })

  return rendered
}

export function generateLegalDocument(
  template: DocumentTemplate,
  projectId: string,
  propertyCode: string,
  propertyData: Record<string, unknown>,
  unresolvedConflicts: string[] = [],
  authorId?: string
): GeneratedDocument {
  const now = new Date().toISOString()
  const valResult = validateTemplateRequirements(template, propertyData, unresolvedConflicts)

  const blockingReasons: string[] = []
  if (valResult.missingFields.length > 0) {
    blockingReasons.push(`Campos obligatorios faltantes: ${valResult.missingFields.join(', ')}`)
  }
  if (valResult.conflicts.length > 0) {
    blockingReasons.push(`Conflictos jurídicos sin resolver en: ${valResult.conflicts.join(', ')}`)
  }

  const status: GeneratedDocument['status'] = valResult.canGenerate ? 'generated' : 'blocked'

  return {
    id: `doc-gen-${propertyCode}-${template.templateKey}-${Date.now()}`,
    projectId,
    propertyCode,
    templateKey: template.templateKey,
    templateVersion: template.version,
    documentTitle: `${template.name} - ${propertyCode}`,
    status,
    blockingReasons,
    storagePath: valResult.canGenerate
      ? `generated/${projectId}/${propertyCode}/${template.templateKey}.txt`
      : null,
    sourceDataSnapshot: { ...propertyData },
    createdBy: authorId ?? null,
    createdAt: now
  }
}

export async function createGeneratedDocumentsZip(
  arg1: any,
  arg2?: any,
  arg3?: any
): Promise<Uint8Array> {
  let docList: any[] = []
  let allowBlocked = false

  if (typeof arg1 === 'string') {
    docList = Array.isArray(arg2) ? arg2 : []
    allowBlocked = Boolean(arg3)
  } else if (Array.isArray(arg1)) {
    docList = arg1
    allowBlocked = Boolean(arg2?.allowBlocked)
  }

  const blockedDocs = docList.filter((d) => {
    if (d.document) return d.document.status === 'blocked' || d.document.isBlockedForExport
    return d.status === 'error' || d.status === 'blocked' || d.isBlockedForExport
  })

  if (blockedDocs.length > 0 && !allowBlocked) {
    throw new Error('Empaquetado ZIP bloqueado: No se puede generar paquete con documentos bloqueados por inconsistencias jurídicas o campos faltantes.')
  }

  const zip = new JSZip()
  for (const item of docList) {
    const docObj = item.document ?? item
    const content = item.content ?? item.rawText ?? `Documento certificado: ${docObj.name || docObj.documentTitle}`
    const fileName = docObj.name || `${docObj.propertyCode || 'PREDIO'}_${docObj.templateKey || 'DOC'}.txt`
    zip.file(fileName, content)
  }

  return await zip.generateAsync({ type: 'uint8array' })
}
