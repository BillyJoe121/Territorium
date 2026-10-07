/**
 * Convierte el documento compilado (JSON de TipTap) en un archivo .docx.
 *
 * Este .docx es la única fuente del documento final: la app lo visualiza con
 * docx-preview, lo descarga tal cual y genera el PDF a partir de esa misma
 * visualización. Así lo que se ve, el Word y el PDF son el mismo documento.
 */
import type { JSONContent } from '@tiptap/react'
import JSZip from 'jszip'

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

// Carta (Letter), márgenes de 2,5 cm.
const PAGE_WIDTH = 12240
const PAGE_HEIGHT = 15840
const MARGIN = 1418
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const FONT = 'Arial'
const PX_TO_TWIPS = 15

const escapeXml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Caracteres de control no permitidos en XML 1.0.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')

function runXml(node: JSONContent): string {
  if (node.type === 'hardBreak') return '<w:r><w:br/></w:r>'
  if (node.type !== 'text' || !node.text) return ''
  const marks = new Set((node.marks ?? []).map((mark) => mark.type))
  const props = [
    marks.has('bold') ? '<w:b/>' : '',
    marks.has('italic') ? '<w:i/>' : '',
    marks.has('underline') ? '<w:u w:val="single"/>' : '',
    marks.has('strike') ? '<w:strike/>' : '',
  ].join('')
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${escapeXml(node.text)}</w:t></w:r>`
}

const inlineRuns = (node: JSONContent) => (node.content ?? []).map(runXml).join('')

function paragraphXml(runs: string, props: string): string {
  return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ''}${runs}</w:p>`
}

function listXml(node: JSONContent, ordered: boolean, depth: number): string {
  const indent = 360 * (depth + 1)
  return (node.content ?? [])
    .map((item, index) => {
      const marker = ordered ? `${(node.attrs?.start ?? 1) + index}. ` : '• '
      return (item.content ?? [])
        .map((child, childIndex) => {
          if (child.type === 'bulletList' || child.type === 'orderedList') return listXml(child, child.type === 'orderedList', depth + 1)
          const prefix = childIndex === 0 ? `<w:r><w:t xml:space="preserve">${marker}</w:t></w:r>` : ''
          return paragraphXml(prefix + inlineRuns(child), `<w:pStyle w:val="ListParagraph"/><w:ind w:left="${indent}" w:hanging="${childIndex === 0 ? 280 : 0}"/>`)
        })
        .join('')
    })
    .join('')
}

function tableXml(node: JSONContent): string {
  const rows = node.content ?? []
  const firstRow = rows[0]?.content ?? []
  const rawWidths = firstRow.map((cell) => {
    const width = Array.isArray(cell.attrs?.colwidth) ? Number(cell.attrs?.colwidth[0]) : NaN
    return Number.isFinite(width) && width > 0 ? width * PX_TO_TWIPS : CONTENT_WIDTH / Math.max(1, firstRow.length)
  })
  const total = rawWidths.reduce((sum, width) => sum + width, 0) || 1
  // Ajusta las columnas al ancho útil de la página.
  const widths = rawWidths.map((width) => Math.round((width / total) * CONTENT_WIDTH))
  const grid = widths.map((width) => `<w:gridCol w:w="${width}"/>`).join('')
  const border = (side: string) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="808080"/>`
  const tblPr = `<w:tblPr><w:tblW w:w="${CONTENT_WIDTH}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}</w:tblBorders><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>`

  const rowXml = rows
    .map((row) => {
      const cells = (row.content ?? []).map((cell, index) => {
        const span = Number(cell.attrs?.colspan ?? 1)
        const width = widths.slice(index, index + span).reduce((sum, w) => sum + w, 0) || widths[index] || CONTENT_WIDTH
        const shading = cell.type === 'tableHeader' ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' : ''
        const gridSpan = span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''
        const body = blocksXml(cell.content ?? [], { inTable: true }) || paragraphXml('', '')
        return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${gridSpan}${shading}</w:tcPr>${body}</w:tc>`
      })
      return `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells.join('')}</w:tr>`
    })
    .join('')

  return `<w:tbl>${tblPr}<w:tblGrid>${grid}</w:tblGrid>${rowXml}</w:tbl>${paragraphXml('', '<w:spacing w:after="0"/>')}`
}

function blocksXml(nodes: JSONContent[], context: { inTable?: boolean } = {}): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'heading': {
          const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 1)))
          return paragraphXml(inlineRuns(node), `<w:pStyle w:val="Heading${level}"/>`)
        }
        case 'paragraph':
          return paragraphXml(inlineRuns(node), context.inTable ? '<w:pStyle w:val="TableText"/>' : '')
        case 'bulletList':
          return listXml(node, false, 0)
        case 'orderedList':
          return listXml(node, true, 0)
        case 'table':
          return tableXml(node)
        case 'horizontalRule':
          return paragraphXml('', '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="808080"/></w:pBdr>')
        case 'blockquote':
          return blocksXml(node.content ?? [], context)
        default:
          return node.content ? blocksXml(node.content, context) : ''
      }
    })
    .join('')
}

export function buildDocumentXml(content: JSONContent): string {
  const body = blocksXml(content.content ?? []) || paragraphXml('', '')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="${PAGE_WIDTH}" w:h="${PAGE_HEIGHT}"/><w:pgMar w:top="${MARGIN}" w:right="${MARGIN}" w:bottom="${MARGIN}" w:left="${MARGIN}" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:eastAsia="${FONT}" w:cs="${FONT}"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="es-CO"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="240"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:jc w:val="left"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="100"/><w:jc w:val="left"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="80"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>
</w:styles>`

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`

const DOCUMENT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`

function coreXml(title: string, author: string, createdAt: Date): string {
  const iso = createdAt.toISOString().replace(/\.\d{3}Z$/, 'Z')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(title)}</dc:title><dc:creator>${escapeXml(author)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`
}

export interface DocxBuildOptions {
  title?: string
  author?: string
  /** Fija la fecha de los metadatos para que el archivo sea reproducible. */
  createdAt?: Date
}

function buildZip(content: JSONContent, options: DocxBuildOptions): JSZip {
  const zip = new JSZip()
  // Fecha fija en las entradas ZIP: el mismo contenido produce los mismos bytes.
  const date = options.createdAt ?? new Date('2026-01-01T00:00:00Z')
  const add = (path: string, data: string) => zip.file(path, data, { date })
  add('[Content_Types].xml', CONTENT_TYPES_XML)
  add('_rels/.rels', ROOT_RELS_XML)
  add('word/document.xml', buildDocumentXml(content))
  add('word/styles.xml', STYLES_XML)
  add('word/_rels/document.xml.rels', DOCUMENT_RELS_XML)
  add('docProps/core.xml', coreXml(options.title ?? 'Documento Territorium', options.author ?? 'Territorium', date))
  return zip
}

export function buildDocxBytes(content: JSONContent, options: DocxBuildOptions = {}): Promise<Uint8Array> {
  return buildZip(content, options).generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}

export function buildDocxBlob(content: JSONContent, options: DocxBuildOptions = {}): Promise<Blob> {
  return buildZip(content, options).generateAsync({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' })
}
