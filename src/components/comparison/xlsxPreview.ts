import JSZip from 'jszip'

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// Límites de la vista previa: suficientes para una plantilla de negociación sin congelar el navegador.
const MAX_ROWS = 1000
const MAX_COLUMNS = 80

const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

const parseXml = (text: string) => new DOMParser().parseFromString(text, 'application/xml')
const byName = (node: Document | Element, name: string) => Array.from(node.getElementsByTagNameNS('*', name))

/** "AB12" → 27 (índice de columna en base 0). */
export function columnIndex(reference: string): number {
  const letters = reference.replace(/[^A-Z]/gi, '').toUpperCase()
  let index = 0
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64)
  return index - 1
}

export function columnName(index: number): string {
  let name = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}

const numberFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })

function cellText(cell: Element, sharedStrings: string[]): string {
  const type = cell.getAttribute('t')
  if (type === 'inlineStr') return byName(cell, 't').map((node) => node.textContent ?? '').join('')
  const raw = byName(cell, 'v')[0]?.textContent ?? ''
  if (type === 's') return sharedStrings[Number(raw)] ?? ''
  if (type === 'b') return raw === '1' ? 'VERDADERO' : 'FALSO'
  if (type === 'str' || type === 'e' || raw === '') return raw
  const value = Number(raw)
  return Number.isFinite(value) ? numberFormat.format(value) : raw
}

function resolveSheetPath(target: string): string {
  const clean = target.replace(/^\//, '')
  return clean.startsWith('xl/') ? clean : `xl/${clean}`
}

/** Representa cada hoja del libro como una tabla HTML dentro de `container`. */
export async function renderXlsxPreview(blob: Blob, container: HTMLElement): Promise<void> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const read = (path: string) => zip.file(path)?.async('string') ?? Promise.resolve(null)

  const workbookXml = await read('xl/workbook.xml')
  if (!workbookXml) throw new Error('El archivo no es un libro XLSX válido.')
  const relsXml = await read('xl/_rels/workbook.xml.rels')
  const sharedXml = await read('xl/sharedStrings.xml')

  const targets = new Map<string, string>()
  if (relsXml) {
    for (const rel of byName(parseXml(relsXml), 'Relationship')) {
      targets.set(rel.getAttribute('Id') ?? '', rel.getAttribute('Target') ?? '')
    }
  }
  const sharedStrings = sharedXml
    ? byName(parseXml(sharedXml), 'si').map((item) => byName(item, 't').map((node) => node.textContent ?? '').join(''))
    : []

  const book = document.createElement('div')
  book.className = 'xlsx-preview'
  const sheets = byName(parseXml(workbookXml), 'sheet')
  for (const [position, sheet] of sheets.entries()) {
    const relId = sheet.getAttributeNS(REL_NS, 'id') ?? sheet.getAttribute('r:id') ?? ''
    const target = targets.get(relId)
    const sheetXml = await read(target ? resolveSheetPath(target) : `xl/worksheets/sheet${position + 1}.xml`)
    if (!sheetXml) continue

    const grid: string[][] = []
    let width = 0
    for (const row of byName(parseXml(sheetXml), 'row')) {
      const rowIndex = Number(row.getAttribute('r') ?? grid.length + 1) - 1
      if (rowIndex >= MAX_ROWS) break
      const values: string[] = []
      let nextColumn = 0
      for (const cell of byName(row, 'c')) {
        const reference = cell.getAttribute('r')
        const column = reference ? columnIndex(reference) : nextColumn
        nextColumn = column + 1
        if (column >= MAX_COLUMNS) continue
        values[column] = cellText(cell, sharedStrings)
      }
      if (values.some((value) => value)) {
        grid[rowIndex] = values
        width = Math.max(width, values.length)
      }
    }

    const section = document.createElement('section')
    section.className = 'xlsx-preview-sheet'
    const heading = document.createElement('h4')
    heading.textContent = sheet.getAttribute('name') ?? `Hoja ${position + 1}`
    section.append(heading)

    const table = document.createElement('table')
    const head = table.createTHead().insertRow()
    head.append(document.createElement('th'))
    for (let column = 0; column < width; column++) {
      const th = document.createElement('th')
      th.textContent = columnName(column)
      head.append(th)
    }
    const body = table.createTBody()
    grid.forEach((values, rowIndex) => {
      if (!values) return
      const tr = body.insertRow()
      const number = document.createElement('th')
      number.textContent = String(rowIndex + 1)
      tr.append(number)
      for (let column = 0; column < width; column++) tr.insertCell().textContent = values[column] ?? ''
    })
    section.append(table)
    book.append(section)
  }
  if (!book.childElementCount) throw new Error('El libro no contiene hojas legibles.')
  container.replaceChildren(book)
}
