import type { Evidence, MatchStatus } from '../../data/documentComparison'

type HighlightRegistry = Map<string, Highlight>

export interface DomPoint {
  node: Text
  offset: number
  char: string
}

export interface DomIndex {
  points: DomPoint[]
  spacedStr: string
  spacedMap: number[]
  foldedStr: string
  compactStr: string
  compactMap: number[]
}

export function foldChar(c: string): string {
  if (c === '“' || c === '”' || c === '«' || c === '»') return '"'
  if (c === '‘' || c === '’' || c === '`') return "'"
  if (c === '–' || c === '—' || c === '_') return '-'
  const nfd = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return (nfd[0] || c).toLowerCase()
}

export function buildIndexFromPoints(points: DomPoint[]): DomIndex {
  // Layer 1: Spaced string (collapses multiple consecutive whitespace characters)
  let spacedStr = ''
  const spacedMap: number[] = []
  for (let i = 0; i < points.length; i++) {
    const c = points[i].char
    if (/\s/.test(c)) {
      if (!spacedStr.endsWith(' ') && spacedStr.length > 0) {
        spacedStr += ' '
        spacedMap.push(i)
      }
    } else {
      spacedStr += c
      spacedMap.push(i)
    }
  }

  // Layer 2: Folded string (1:1 with spacedStr: lowercase, stripped accents, canonical quotes/dashes)
  let foldedStr = ''
  for (let i = 0; i < spacedStr.length; i++) {
    foldedStr += foldChar(spacedStr[i])
  }

  // Layer 3: Compact alphanumeric string (only a-z and 0-9 for punctuation/hyphen-agnostic matching)
  let compactStr = ''
  const compactMap: number[] = []
  for (let i = 0; i < spacedStr.length; i++) {
    const fc = foldChar(spacedStr[i])
    if (/[a-z0-9]/i.test(fc)) {
      compactStr += fc
      compactMap.push(spacedMap[i])
    }
  }

  return { points, spacedStr, spacedMap, foldedStr, compactStr, compactMap }
}

export function buildDomIndex(root: HTMLElement): DomIndex {
  const points: DomPoint[] = []
  if (typeof document !== 'undefined' && document.createTreeWalker) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let node: Text | null
    while ((node = walker.nextNode() as Text | null)) {
      const parentTag = node.parentElement?.tagName?.toLowerCase()
      if (parentTag === 'script' || parentTag === 'style' || parentTag === 'noscript') continue
      const data = node.data
      for (let offset = 0; offset < data.length; offset++) {
        points.push({ node, offset, char: data[offset] })
      }
    }
  }
  return buildIndexFromPoints(points)
}

export function normalizeFolded(str: string): string {
  let res = ''
  for (let i = 0; i < str.length; i++) {
    const c = str[i]
    if (/\s/.test(c)) {
      if (!res.endsWith(' ') && res.length > 0) res += ' '
    } else {
      res += foldChar(c)
    }
  }
  return res.trim()
}

export function normalizeCompact(str: string): string {
  let res = ''
  for (let i = 0; i < str.length; i++) {
    const fc = foldChar(str[i])
    if (/[a-z0-9]/i.test(fc)) res += fc
  }
  return res
}

export interface MatchCandidate {
  start: number
  end: number
  score: number
  type: string
}

export function findMatchesInIndex(index: DomIndex, rawNeedle: string | null | undefined): MatchCandidate[] {
  if (!rawNeedle || typeof rawNeedle !== 'string') return []
  const needle = rawNeedle.trim()
  if (!needle) return []

  const folded = normalizeFolded(needle)
  const compact = normalizeCompact(needle)
  const results: MatchCandidate[] = []

  // 1. Folded exact substring match (highest fidelity: matches exact words & phrases, case/accent/quote-normalized)
  if (folded && folded.length >= 2) {
    let pos = 0
    while ((pos = index.foldedStr.indexOf(folded, pos)) !== -1) {
      const start = index.spacedMap[pos]
      const end = index.spacedMap[pos + folded.length - 1]
      results.push({ start, end, score: 100, type: 'folded-exact' })
      pos += 1
    }
  }

  if (results.length > 0) return results

  // 2. Compact alphanumeric match (ignores spaces, hyphens, periods, formatting differences e.g. 050N-1234567 vs 050N1234567)
  if (compact && compact.length >= 3) {
    let pos = 0
    while ((pos = index.compactStr.indexOf(compact, pos)) !== -1) {
      const start = index.compactMap[pos]
      const end = index.compactMap[pos + compact.length - 1]
      results.push({ start, end, score: 90, type: 'compact-exact' })
      pos += 1
    }
  }

  if (results.length > 0) return results

  // 3. Multi-word token sequence match (words separated by varying punctuation or line breaks)
  const tokens = folded.split(/[\s,.;:/\-_]+/).filter((t) => t.length > 1)
  if (tokens.length >= 2) {
    const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const pattern = new RegExp(escaped.join('[\\s,.;:/\\-_]+'), 'g')
    let m: RegExpExecArray | null
    while ((m = pattern.exec(index.foldedStr)) !== null) {
      const start = index.spacedMap[m.index]
      const end = index.spacedMap[m.index + m[0].length - 1]
      results.push({ start, end, score: 85, type: 'token-sequence' })
    }
  }

  if (results.length > 0) return results

  // 4. Long alphanumeric prefix / subsequence (for IDs, catastral codes >= 8 digits with differing zero-padding or length)
  if (compact && compact.length >= 8) {
    for (const len of [16, 14, 12, 10, 8]) {
      if (compact.length >= len) {
        const prefix = compact.slice(0, len)
        const pos = index.compactStr.indexOf(prefix)
        if (pos !== -1) {
          let tokenEnd = pos + len
          const isDigitsOnly = /^[0-9]+$/.test(prefix)
          while (tokenEnd < index.compactStr.length) {
            const nextChar = index.compactStr[tokenEnd]
            if (isDigitsOnly && !/[0-9]/.test(nextChar)) break
            if (!isDigitsOnly && !/[a-z0-9]/i.test(nextChar)) break
            if (tokenEnd >= pos + compact.length + 6) break
            tokenEnd++
          }
          const start = index.compactMap[pos]
          const end = index.compactMap[tokenEnd - 1]
          results.push({ start, end, score: 70, type: 'compact-prefix' })
          break
        }
      }
    }
  }

  return results
}

function trimPointsRange(points: DomPoint[], start: number, end: number): { start: number; end: number } {
  const isPunctuationOrSpace = (c: string) => /[\s"'“”«»‘’`.,:;!?()[\]{}]/.test(c)
  while (start < end && isPunctuationOrSpace(points[start].char)) {
    start++
  }
  while (end > start && isPunctuationOrSpace(points[end].char)) {
    end--
  }
  return { start, end }
}

export function findBestEvidenceMatch(index: DomIndex, evidence: Evidence): { start: number; end: number } | null {
  if (!evidence) return null

  // 1. Search quote anchor (if quote exists)
  let quoteMatches: MatchCandidate[] = []
  if (evidence.quote) {
    quoteMatches = findMatchesInIndex(index, evidence.quote)
  }

  // 2. Search value
  const valueMatches = findMatchesInIndex(index, evidence.value)

  if (valueMatches.length > 0) {
    // If we found quote matches, pick the value occurrence located inside or closest to the quote
    if (quoteMatches.length > 0) {
      const q = quoteMatches[0]
      let bestMatch = valueMatches[0]
      let minDistance = Infinity

      for (const vm of valueMatches) {
        if (vm.start >= q.start && vm.end <= q.end) {
          return trimPointsRange(index.points, vm.start, vm.end)
        }
        const qCenter = (q.start + q.end) / 2
        const vCenter = (vm.start + vm.end) / 2
        const dist = Math.abs(qCenter - vCenter)
        if (dist < minDistance) {
          minDistance = dist
          bestMatch = vm
        }
      }
      return trimPointsRange(index.points, bestMatch.start, bestMatch.end)
    }
    // If no quote anchor, take the first occurrence of the value
    return trimPointsRange(index.points, valueMatches[0].start, valueMatches[0].end)
  }

  // 3. Value was not directly matched on its own, but quote was matched:
  if (quoteMatches.length > 0) {
    const q = quoteMatches[0]
    // If evidence.value has a prominent number or phrase, look for that inside the quote
    if (evidence.value) {
      const numberMatches = evidence.value.match(/\d+([.,]\d+)?/g)
      if (numberMatches && numberMatches.length > 0) {
        for (const num of numberMatches) {
          const numCandidates = findMatchesInIndex(index, num)
          const inQuote = numCandidates.find((c) => c.start >= q.start && c.end <= q.end)
          if (inQuote) {
            return trimPointsRange(index.points, inQuote.start, inQuote.end)
          }
        }
      }
    }
    return trimPointsRange(index.points, q.start, q.end)
  }

  return null
}

export function highlightEvidence(root: HTMLElement, evidence: Evidence | null, status: MatchStatus, side: 'left' | 'right'): boolean {
  const name = `comparison-${side}-${status}`
  const registry = (CSS as unknown as { highlights?: HighlightRegistry }).highlights
  for (const state of ['exact', 'near', 'different']) registry?.delete(`comparison-${side}-${state}`)
  if (!evidence || !registry || typeof Highlight === 'undefined') return false

  const index = buildDomIndex(root)
  if (index.points.length === 0) return false

  const match = findBestEvidenceMatch(index, evidence)
  if (!match || match.start < 0 || match.end < match.start || !index.points[match.start] || !index.points[match.end]) {
    return false
  }

  const range = document.createRange()
  range.setStart(index.points[match.start].node, index.points[match.start].offset)
  range.setEnd(index.points[match.end].node, index.points[match.end].offset + 1)
  registry.set(name, new Highlight(range))

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  index.points[match.start].node.parentElement?.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' })
  return true
}

export function clearEvidence(side: 'left' | 'right') {
  const registry = (CSS as unknown as { highlights?: HighlightRegistry }).highlights
  for (const state of ['exact', 'near', 'different']) registry?.delete(`comparison-${side}-${state}`)
}
