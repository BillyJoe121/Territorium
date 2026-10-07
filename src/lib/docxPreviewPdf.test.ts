import { describe, expect, it } from 'vitest'
import { computePageBreaks } from './docxPreviewPdf'

describe('computePageBreaks', () => {
  it('keeps everything on one page when it fits', () => {
    expect(computePageBreaks([0, 100, 200], [90, 190, 290], 500)).toEqual([0])
  })

  it('starts a new page at the first block that overflows', () => {
    // Bloques de 100 px, 250 px disponibles por página.
    const tops = [0, 100, 200, 300, 400, 500]
    const bottoms = tops.map((top) => top + 100)
    expect(computePageBreaks(tops, bottoms, 250)).toEqual([0, 2, 4])
  })

  it('moves a trailing heading to the next page', () => {
    const tops = [0, 100, 200, 300]
    const bottoms = tops.map((top) => top + 100)
    expect(computePageBreaks(tops, bottoms, 300, [false, false, true, false])).toEqual([0, 2])
  })

  it('gives an oversized block its own page', () => {
    expect(computePageBreaks([0, 100, 200], [100, 200, 900], 300)).toEqual([0, 2])
  })
})
