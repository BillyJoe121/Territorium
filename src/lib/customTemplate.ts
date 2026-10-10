/**
 * Plantilla personalizada: un .docx con marcadores {{COLUMNA}} que se llenan con una fila del
 * consolidado CORRESPONDENCIA, p. ej. {{FOLIO DE MATRICULA}} o {{PROPIETARIOS DEL PREDIO}}.
 *
 * Word suele partir el texto de un párrafo en varias "corridas" (<w:t>), así que un marcador
 * puede quedar repartido entre varias; se reemplaza sobre el texto completo del párrafo y el
 * resultado se devuelve a sus corridas, conservando el formato de la primera.
 */
import JSZip from 'jszip'
import type { EditableResultRow } from '../components/expediente/types'
import { CORRESPONDENCIA_COLUMNS, correspondenciaTableColumns } from './correspondencia'
import { isEmptyValue } from './planTitleLinking'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PLACEHOLDER = /\{\{\s*([^{}]+?)\s*\}\}/g
const TEXT_RUN = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:t(?:\s[^>]*)?\/>/g
const PARAGRAPH = /<w:p[\s>][\s\S]*?<\/w:p>/g
/** Cuerpo, encabezados y pies de página. */
const TEXT_PARTS = /^word\/(document|header\d*|footer\d*)\.xml$/

const normalizeName = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

const decodeXml = (text: string) =>
  text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
const encodeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Columna de CORRESPONDENCIA por nombre de marcador: el encabezado del modal o el de la plantilla Excel. */
const COLUMN_BY_NAME: Map<string, string> = (() => {
  const map = new Map<string, string>()
  for (const column of correspondenciaTableColumns()) map.set(normalizeName(column.label), column.key)
  for (const column of CORRESPONDENCIA_COLUMNS) if (!map.has(normalizeName(column.header))) map.set(normalizeName(column.header), column.letter)
  return map
})()

export const CUSTOM_TEMPLATE_EXAMPLE = '{{FOLIO DE MATRICULA}}'

/** Valor de un marcador para una fila, o undefined si el marcador no es una columna conocida. */
export function placeholderValue(row: EditableResultRow, name: string): string | undefined {
  const key = COLUMN_BY_NAME.get(normalizeName(name))
  if (!key) return undefined
  const value = row[key]
  return isEmptyValue(value) ? '—' : String(value)
}

interface Run {
  /** Posición de la etiqueta <w:t> completa dentro del párrafo. */
  start: number
  end: number
  text: string
}

/** Reemplaza los marcadores de un párrafo. Devuelve el párrafo y los marcadores desconocidos. */
function fillParagraph(paragraph: string, resolve: (name: string) => string | undefined, unknown: Set<string>): string {
  const runs: Run[] = []
  for (const match of paragraph.matchAll(TEXT_RUN)) {
    runs.push({ start: match.index!, end: match.index! + match[0].length, text: decodeXml(match[1] ?? '') })
  }
  const full = runs.map((run) => run.text).join('')
  if (!full.includes('{{')) return paragraph

  // Cada carácter del texto completo pertenece a una corrida; el reemplazo va a la corrida del inicio.
  const texts = runs.map((run) => run.text.split(''))
  const owner: [number, number][] = []
  texts.forEach((chars, runIndex) => chars.forEach((_, charIndex) => owner.push([runIndex, charIndex])))
  const matches = [...full.matchAll(PLACEHOLDER)]
  for (const match of matches.reverse()) {
    const value = resolve(match[1])
    if (value === undefined) {
      unknown.add(match[1].trim())
      continue
    }
    const first = match.index!
    const last = first + match[0].length - 1
    for (let position = last; position > first; position--) {
      const [runIndex, charIndex] = owner[position]
      texts[runIndex][charIndex] = ''
    }
    const [runIndex, charIndex] = owner[first]
    texts[runIndex][charIndex] = value
  }

  let result = ''
  let cursor = 0
  runs.forEach((run, index) => {
    result += paragraph.slice(cursor, run.start)
    result += `<w:t xml:space="preserve">${encodeXml(texts[index].join(''))}</w:t>`
    cursor = run.end
  })
  return result + paragraph.slice(cursor)
}

export interface CustomTemplate {
  name: string
  /** Contenido original del .docx. */
  bytes: ArrayBuffer
  /** Marcadores que contiene, sin repetir, en el orden en que aparecen. */
  placeholders: string[]
  /** Marcadores que no corresponden a ninguna columna del consolidado. */
  unknownPlaceholders: string[]
}

async function textParts(zip: JSZip): Promise<[string, string][]> {
  const names = Object.keys(zip.files).filter((name) => TEXT_PARTS.test(name))
  return Promise.all(names.map(async (name) => [name, await zip.file(name)!.async('string')] as [string, string]))
}

/** Lee la plantilla subida y verifica que sea un Word con al menos un marcador. */
export async function readCustomTemplate(file: File): Promise<CustomTemplate> {
  if (!file.name.toLowerCase().endsWith('.docx')) throw new Error('La plantilla debe ser un archivo Word (.docx).')
  const bytes = await file.arrayBuffer()
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(bytes)
  } catch {
    throw new Error('No se pudo abrir la plantilla: el archivo .docx está dañado o no es un documento de Word.')
  }
  const parts = await textParts(zip)
  if (!parts.some(([name]) => name === 'word/document.xml')) throw new Error('El archivo no es un documento de Word (.docx).')

  const placeholders: string[] = []
  for (const [, xml] of parts) {
    for (const paragraph of xml.match(PARAGRAPH) ?? []) {
      const text = [...paragraph.matchAll(TEXT_RUN)].map((match) => decodeXml(match[1] ?? '')).join('')
      for (const match of text.matchAll(PLACEHOLDER)) {
        const name = match[1].trim()
        if (!placeholders.includes(name)) placeholders.push(name)
      }
    }
  }
  if (!placeholders.length) {
    throw new Error(`La plantilla no tiene marcadores. Escribe el nombre de una columna del consolidado entre llaves dobles, por ejemplo ${CUSTOM_TEMPLATE_EXAMPLE}.`)
  }
  const unknownPlaceholders = placeholders.filter((name) => !COLUMN_BY_NAME.has(normalizeName(name)))
  return { name: file.name, bytes, placeholders, unknownPlaceholders }
}

/** Documento de un predio: la plantilla con sus marcadores reemplazados por los valores de la fila. */
export async function fillCustomTemplate(template: CustomTemplate, row: EditableResultRow): Promise<{ blob: Blob; missing: number }> {
  const zip = await JSZip.loadAsync(template.bytes)
  const unknown = new Set<string>()
  let missing = 0
  const resolve = (name: string) => {
    const value = placeholderValue(row, name)
    if (value === '—') missing++
    return value
  }
  for (const [name, xml] of await textParts(zip)) {
    zip.file(name, xml.replace(PARAGRAPH, (paragraph) => fillParagraph(paragraph, resolve, unknown)))
  }
  const blob = await zip.generateAsync({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' })
  return { blob, missing }
}
