import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { buildZip, uniqueFileNames } from './download'

describe('uniqueFileNames', () => {
  it('numera los nombres repetidos sin perder la extensión', () => {
    expect(uniqueFileNames(['Estudio.pdf', 'Plano.pdf', 'Estudio.pdf', 'estudio.PDF', 'Sin extension', 'Sin extension']))
      .toEqual(['Estudio.pdf', 'Plano.pdf', 'Estudio (2).pdf', 'estudio (3).PDF', 'Sin extension', 'Sin extension (2)'])
  })
})

describe('buildZip', () => {
  it('incluye todos los archivos aunque se llamen igual', async () => {
    const blob = await buildZip([
      { name: 'Estudio.pdf', blob: new Blob(['uno']) },
      { name: 'Estudio.pdf', blob: new Blob(['dos']) },
    ])
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(Object.keys(zip.files).sort()).toEqual(['Estudio (2).pdf', 'Estudio.pdf'])
    expect(await zip.file('Estudio (2).pdf')!.async('string')).toBe('dos')
  })
})
