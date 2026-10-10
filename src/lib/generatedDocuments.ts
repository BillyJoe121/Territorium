/**
 * Documentos finales que se generan desde el consolidado: uno por predio (fila de
 * CORRESPONDENCIA) y por tipo de documento: las plantillas oficiales, una plantilla
 * personalizada que sube el usuario y el documento tipo EPM (aún sin plantilla).
 */
import type { EditableResultRow } from '../components/expediente/types'
import { OFFICIAL_FINAL_DOCUMENT_TEMPLATES, type ExpedienteDocumentTemplate } from './expedienteDocumentTemplates'
import { isEmptyValue } from './planTitleLinking'

export type GeneratedDocumentKind = 'escritura' | 'linderos' | 'minuta' | 'epm' | 'personalizada'

export interface GeneratedDocumentType {
  kind: GeneratedDocumentKind
  /**
   * official: plantilla oficial transcrita en el código (templateId).
   * custom: .docx con marcadores que sube el usuario.
   * upcoming: visible pero sin plantilla todavía; no se puede generar.
   */
  source: 'official' | 'custom' | 'upcoming'
  templateId?: string
  /** Para los botones: "Generar escritura pública para todos". */
  label: string
  /** Título de la sección en el panel de documentos generados. */
  sectionTitle: string
  /** Inicio del nombre del archivo: "ESCRITURA TOL-ANZ-045.docx". */
  filePrefix: string
}

export const GENERATED_DOCUMENT_TYPES: GeneratedDocumentType[] = [
  { kind: 'escritura', source: 'official', templateId: 'tpl-escritura-publica', label: 'escritura pública', sectionTitle: 'Escrituras públicas', filePrefix: 'ESCRITURA' },
  { kind: 'linderos', source: 'official', templateId: 'tpl-descripcion-linderos', label: 'descripción de linderos', sectionTitle: 'Descripción de linderos', filePrefix: 'DESCRIPCION LINDEROS' },
  { kind: 'minuta', source: 'official', templateId: 'tpl-minuta-tipo', label: 'minuta tipo', sectionTitle: 'Minutas tipo', filePrefix: 'MINUTA' },
  { kind: 'epm', source: 'upcoming', label: 'documento tipo EPM', sectionTitle: 'Documentos tipo EPM', filePrefix: 'EPM' },
  { kind: 'personalizada', source: 'custom', label: 'plantilla personalizada', sectionTitle: 'Plantilla personalizada', filePrefix: 'PERSONALIZADA' },
]

export function templateForDocumentType(type: GeneratedDocumentType): ExpedienteDocumentTemplate {
  const template = type.source === 'official' ? OFFICIAL_FINAL_DOCUMENT_TEMPLATES.find((item) => item.id === type.templateId) : undefined
  if (!template) throw new Error(`"${type.label}" no tiene una plantilla oficial.`)
  return template
}

export function generateButtonLabel(type: GeneratedDocumentType, selectedCount: number): string {
  if (selectedCount <= 0) return `Generar ${type.label} para todos`
  return `Generar ${type.label} para ${selectedCount} ${selectedCount === 1 ? 'seleccionado' : 'seleccionados'}`
}

/** Solo caracteres que Storage acepta en una ruta (sin tildes ni símbolos). */
export function storageSafe(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ._()-]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-{2,}/g, '-')
    .trim()
    .replace(/^[-. ]+|[-. ]+$/g, '')
}

const folderOf = (row: EditableResultRow) => (isEmptyValue(row.A) ? '' : storageSafe(String(row.A)))

/**
 * Nombre del archivo de un predio: "ESCRITURA TOL-ANZ-045.docx". Si la carpeta se repite en el
 * consolidado se agrega el FMI; sin carpeta se usa el FMI. El nombre es estable: regenerar el
 * documento de un predio reemplaza su archivo.
 */
export function generatedDocumentName(type: GeneratedDocumentType, row: EditableResultRow, allRows: EditableResultRow[]): string {
  const folder = folderOf(row)
  const fmi = isEmptyValue(row.B) ? '' : storageSafe(String(row.B))
  const repeated = folder !== '' && allRows.filter((other) => folderOf(other) === folder).length > 1
  const base = folder ? (repeated && fmi ? `${folder} (FMI ${fmi})` : folder) : fmi ? `FMI ${fmi}` : storageSafe(row.id) || 'predio'
  return `${type.filePrefix} ${base}.docx`
}
