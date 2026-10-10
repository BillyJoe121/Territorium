import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { fillCustomTemplate, readCustomTemplate } from './customTemplate'

const body = (paragraphs: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>`

async function docx(paragraphs: string, name = 'Plantilla.docx'): Promise<File> {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types/>')
  zip.file('word/document.xml', body(paragraphs))
  return new File([await zip.generateAsync({ type: 'arraybuffer' })], name)
}

async function documentXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  return zip.file('word/document.xml')!.async('string')
}

const row = { id: 'corr-350-108418', A: 'TOL-ANZ-045', B: '350-108418', D: 'MARTHA LUCÍA BERNAL & HIJOS', I: '' }

describe('plantilla personalizada', () => {
  it('reemplaza marcadores aunque Word los haya partido en varias corridas', async () => {
    const file = await docx(
      '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Folio: {{FOLIO </w:t></w:r><w:r><w:t>DE MATRÍCULA}}</w:t></w:r><w:r><w:t xml:space="preserve"> carpeta {{carpeta}}.</w:t></w:r></w:p>',
    )
    const template = await readCustomTemplate(file)
    expect(template.placeholders).toEqual(['FOLIO DE MATRÍCULA', 'carpeta'])
    expect(template.unknownPlaceholders).toEqual([])

    const { blob, missing } = await fillCustomTemplate(template, row)
    const xml = await documentXml(blob)
    expect(missing).toBe(0)
    // El valor queda en la primera corrida (con su negrita) y el resto del marcador desaparece.
    expect(xml).toContain('<w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Folio: 350-108418</w:t>')
    expect(xml).toContain('carpeta TOL-ANZ-045.')
    expect(xml).not.toContain('{{')
  })

  it('escapa los caracteres especiales de XML y marca los datos vacíos', async () => {
    const template = await readCustomTemplate(await docx('<w:p><w:r><w:t>{{PROPIETARIOS DEL PREDIO}} · {{NOMBRE DEL PREDIO}}</w:t></w:r></w:p>'))
    const { blob, missing } = await fillCustomTemplate(template, row)
    expect(await documentXml(blob)).toContain('MARTHA LUCÍA BERNAL &amp; HIJOS · —')
    expect(missing).toBe(1)
  })

  it('informa los marcadores que no son columnas del consolidado y los deja intactos', async () => {
    const template = await readCustomTemplate(await docx('<w:p><w:r><w:t>{{FOLIO DE MATRICULA}} {{FIRMA NOTARIO}}</w:t></w:r></w:p>'))
    expect(template.unknownPlaceholders).toEqual(['FIRMA NOTARIO'])
    const xml = await documentXml((await fillCustomTemplate(template, row)).blob)
    expect(xml).toContain('350-108418 {{FIRMA NOTARIO}}')
  })

  it('rechaza archivos que no son Word o que no tienen marcadores', async () => {
    await expect(readCustomTemplate(new File(['x'], 'plantilla.pdf'))).rejects.toThrow('archivo Word (.docx)')
    await expect(readCustomTemplate(new File(['no es zip'], 'plantilla.docx'))).rejects.toThrow('dañado')
    await expect(readCustomTemplate(await docx('<w:p><w:r><w:t>Sin marcadores</w:t></w:r></w:p>'))).rejects.toThrow('no tiene marcadores')
  })
})
