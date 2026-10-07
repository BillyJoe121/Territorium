/**
 * Paginación y exportación a PDF de un .docx renderizado con docx-preview.
 *
 * docx-preview solo corta páginas en saltos explícitos, así que un documento
 * generado se ve como una única hoja larga. paginateRenderedDocx() lo divide en
 * hojas Carta con los mismos márgenes del .docx, y exportPagesToPdf() captura
 * esas mismas hojas: el PDF es exactamente lo que se visualizó.
 */

const PAGE_WIDTH_PT = 612
const PAGE_HEIGHT_PT = 792

const isHeading = (element: Element) => /heading/i.test(element.className) || /^H[1-6]$/.test(element.tagName)

/**
 * Calcula en qué hijo empieza cada página.
 * `tops`/`bottoms` son posiciones relativas al inicio del contenido.
 */
export function computePageBreaks(
  tops: number[],
  bottoms: number[],
  available: number,
  headingFlags: boolean[] = [],
): number[] {
  const starts = [0]
  let offset = tops[0] ?? 0
  for (let index = 1; index < tops.length; index++) {
    if (bottoms[index] - offset <= available) continue
    let breakAt = index
    // No dejar un título huérfano al final de la página.
    if (headingFlags[index - 1] && index - 1 > starts[starts.length - 1]) breakAt = index - 1
    starts.push(breakAt)
    offset = tops[breakAt]
    // Un bloque más alto que la página ocupa la suya completa.
    if (breakAt !== index && bottoms[index] - offset > available) {
      starts.push(index)
      offset = tops[index]
    }
  }
  return starts
}

/** Divide las secciones renderizadas en hojas; devuelve las hojas en orden. */
export function paginateRenderedDocx(root: HTMLElement): HTMLElement[] {
  const pages: HTMLElement[] = []
  for (const section of Array.from(root.querySelectorAll<HTMLElement>('section.docx'))) {
    const article = section.querySelector<HTMLElement>(':scope > article')
    const children = article ? (Array.from(article.children) as HTMLElement[]) : []
    if (!article || children.length < 2) {
      pages.push(section)
      continue
    }

    const style = getComputedStyle(section)
    const pageHeight = parseFloat(style.minHeight) || (section.offsetWidth * PAGE_HEIGHT_PT) / PAGE_WIDTH_PT
    const available = pageHeight - (parseFloat(style.paddingTop) || 0) - (parseFloat(style.paddingBottom) || 0)
    // Las medidas en pantalla incluyen el zoom del visor; se normalizan a escala 100 %.
    const sectionWidth = section.getBoundingClientRect().width
    const scale = sectionWidth / (parseFloat(style.width) || sectionWidth) || 1
    const origin = article.getBoundingClientRect().top
    const rects = children.map((child) => child.getBoundingClientRect())
    const starts = computePageBreaks(
      rects.map((rect) => (rect.top - origin) / scale),
      rects.map((rect) => (rect.bottom - origin) / scale),
      available,
      children.map(isHeading),
    )

    pages.push(section)
    let previous = section
    for (let page = 1; page < starts.length; page++) {
      const nextSection = section.cloneNode(false) as HTMLElement
      const nextArticle = article.cloneNode(false) as HTMLElement
      nextSection.appendChild(nextArticle)
      const end = starts[page + 1] ?? children.length
      for (const child of children.slice(starts[page], end)) nextArticle.appendChild(child)
      previous.after(nextSection)
      previous = nextSection
      pages.push(nextSection)
    }
  }
  return pages
}

/** Captura cada hoja tal como se ve (a escala 100 %) y arma el PDF Carta. */
export async function exportPagesToPdf(pages: HTMLElement[], filename: string): Promise<Blob> {
  if (!pages.length) throw new Error('No hay páginas renderizadas para exportar.')
  const [{ jsPDF }, html2canvasModule] = await Promise.all([import('jspdf'), import('html2canvas')])
  const html2canvas = html2canvasModule.default

  // Copia fuera de pantalla sin el zoom del visor; los estilos de docx-preview son globales.
  const stage = document.createElement('div')
  stage.setAttribute('aria-hidden', 'true')
  stage.style.cssText = 'position:fixed;left:-20000px;top:0;zoom:1;transform:none;background:#fff;'
  document.body.appendChild(stage)

  try {
    const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait', compress: true })
    for (const [index, page] of pages.entries()) {
      const clone = page.cloneNode(true) as HTMLElement
      clone.style.margin = '0'
      clone.style.boxShadow = 'none'
      clone.style.background = '#fff'
      stage.replaceChildren(clone)
      const canvas = await html2canvas(clone, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false })
      if (index > 0) pdf.addPage('letter', 'portrait')
      // Una hoja más alta que Carta (bloque indivisible) se reduce sin deformarse.
      const height = Math.min(PAGE_HEIGHT_PT, (canvas.height / canvas.width) * PAGE_WIDTH_PT)
      const width = (canvas.width / canvas.height) * height
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (PAGE_WIDTH_PT - width) / 2, 0, width, height, undefined, 'FAST')
    }
    pdf.setProperties({ title: filename.replace(/\.pdf$/i, ''), creator: 'Territorium' })
    const blob = pdf.output('blob')
    pdf.save(filename)
    return blob
  } finally {
    stage.remove()
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
