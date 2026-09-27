import { describe, expect, it } from 'vitest'
import {
  buildIndexFromPoints,
  findBestEvidenceMatch,
  foldChar,
  normalizeCompact,
  normalizeFolded,
  type DomPoint,
} from './highlight'

function createPoints(text: string): DomPoint[] {
  // Mock Text node
  const mockNode = { data: text } as unknown as Text
  const points: DomPoint[] = []
  for (let i = 0; i < text.length; i++) {
    points.push({ node: mockNode, offset: i, char: text[i] })
  }
  return points
}

describe('highlight character & string normalization', () => {
  it('folds quotes, dashes and diacritics', () => {
    expect(foldChar('“')).toBe('"')
    expect(foldChar('”')).toBe('"')
    expect(foldChar('«')).toBe('"')
    expect(foldChar('»')).toBe('"')
    expect(foldChar('‘')).toBe("'")
    expect(foldChar('’')).toBe("'")
    expect(foldChar('–')).toBe('-')
    expect(foldChar('—')).toBe('-')
    expect(foldChar('Á')).toBe('a')
    expect(foldChar('é')).toBe('e')
    expect(foldChar('Í')).toBe('i')
    expect(foldChar('Ó')).toBe('o')
    expect(foldChar('Ú')).toBe('u')
    expect(foldChar('ñ')).toBe('n')
  })

  it('normalizes folded strings', () => {
    expect(normalizeFolded('  El   nombre “LA AURORA”  ')).toBe('el nombre "la aurora"')
    expect(normalizeFolded('Vereda  \nFagua')).toBe('vereda fagua')
    expect(normalizeFolded('050N - 1234567')).toBe('050n - 1234567')
  })

  it('normalizes compact alphanumeric strings', () => {
    expect(normalizeCompact('25-175-00-01-00-00-0007-0000-0')).toBe('2517500010000000700000')
    expect(normalizeCompact('050N-1234567')).toBe('050n1234567')
    expect(normalizeCompact('$980.000.000 COP')).toBe('980000000cop')
  })
})

describe('highlight matching and index resolution', () => {
  it('finds exact property name inside curly quotes without capturing surrounding quotes or text', () => {
    const raw = 'El nombre tradicional declarado es “LA AURORA”. Su identificación principal es 050N-1234567.'
    const index = buildIndexFromPoints(createPoints(raw))

    const match = findBestEvidenceMatch(index, {
      value: 'LA AURORA',
      quote: 'El  \nnombre tradicional declarado es “LA AURORA”',
      fragment_id: 'f1',
      page: 2,
      location: 'Página 2',
    })

    expect(match).not.toBeNull()
    if (!match) return
    const matchedText = index.points.slice(match.start, match.end + 1).map((p) => p.char).join('')
    expect(matchedText).toBe('LA AURORA')
  })

  it('resolves value with newline and multi-space across text nodes', () => {
    const raw = 'El predio se ubica en la Vereda Fagua en zona rural.'
    const index = buildIndexFromPoints(createPoints(raw))

    const match = findBestEvidenceMatch(index, {
      value: 'Vereda  \nFagua',
      quote: 'en la Vereda  \nFagua',
      fragment_id: 'f2',
      page: 2,
      location: 'Página 2',
    })

    expect(match).not.toBeNull()
    if (!match) return
    const matchedText = index.points.slice(match.start, match.end + 1).map((p) => p.char).join('')
    expect(matchedText).toBe('Vereda Fagua')
  })

  it('resolves hyphenated catastral number against compact text in document', () => {
    const raw = 'Se utiliza el código predial 25175000100000070000 como referencia catastral compacta.'
    const index = buildIndexFromPoints(createPoints(raw))

    const match = findBestEvidenceMatch(index, {
      value: '25-175-00-01-00-00-0007-0000-0',
      quote: 'código predial 25175000100000070000 como referencia',
      fragment_id: 'f3',
      page: 2,
      location: 'Página 2',
    })

    expect(match).not.toBeNull()
    if (!match) return
    const matchedText = index.points.slice(match.start, match.end + 1).map((p) => p.char).join('')
    expect(matchedText).toBe('25175000100000070000')
  })

  it('resolves catastral code with line break after hyphen', () => {
    const raw = 'Identificado bajo la forma 25-175-00-01-00-00-\n0007-0000-0 para todos los efectos.'
    const index = buildIndexFromPoints(createPoints(raw))

    const match = findBestEvidenceMatch(index, {
      value: '25-175-00-01-00-00-\n0007-0000-0',
      quote: 'forma 25-175-00-01-00-00-\n0007-0000-0',
      fragment_id: 'f4',
      page: 4,
      location: 'Página 4',
    })

    expect(match).not.toBeNull()
    if (!match) return
    const matchedText = index.points.slice(match.start, match.end + 1).map((p) => p.char).join('')
    expect(matchedText).toContain('25-175-00-01-00-00')
    expect(matchedText).toContain('0007-0000-0')
  })

  it('disambiguates repeated words using quote anchor rather than failing', () => {
    const raw = 'PRIMERO. Se individualiza como Lote 7 en la primera cláusula. SEGUNDO. Más adelante se menciona de nuevo Lote 7 como referencia secundaria.'
    const index = buildIndexFromPoints(createPoints(raw))

    // Should find the second occurrence if quote points to the second paragraph
    const matchSecond = findBestEvidenceMatch(index, {
      value: 'Lote 7',
      quote: 'Más adelante se menciona de nuevo Lote 7',
      fragment_id: 'f5',
      page: 1,
      location: 'Página 1',
    })

    expect(matchSecond).not.toBeNull()
    if (!matchSecond) return
    const matchedText = index.points.slice(matchSecond.start, matchSecond.end + 1).map((p) => p.char).join('')
    expect(matchedText).toBe('Lote 7')
    // Ensure it chose the second occurrence (offset > 50)
    expect(matchSecond.start).toBeGreaterThan(50)
  })

  it('highlights ONLY the attribute value and never the full preamble paragraph', () => {
    const raw = 'Compareció igualmente ANA MARÍA TORRES, mayor de edad, con cédula de ciudadanía No. 52.123.456, soltera.'
    const index = buildIndexFromPoints(createPoints(raw))

    const match = findBestEvidenceMatch(index, {
      value: 'ANA MARÍA TORRES',
      quote: 'Compareció igualmente ANA MARÍA TORRES, mayor de edad',
      fragment_id: 'f6',
      page: 1,
      location: 'Página 1',
    })

    expect(match).not.toBeNull()
    if (!match) return
    const matchedText = index.points.slice(match.start, match.end + 1).map((p) => p.char).join('')
    expect(matchedText).toBe('ANA MARÍA TORRES')
    expect(matchedText).not.toContain('Compareció')
    expect(matchedText).not.toContain('mayor de edad')
  })
})
