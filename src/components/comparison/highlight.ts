import type { Evidence, MatchStatus } from '../../data/documentComparison'

type HighlightRegistry = Map<string, Highlight>

function normalizedText(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const points: Array<{ node: Text; offset: number }> = []
  let text = ''
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    for (let offset = 0; offset < node.data.length; offset++) {
      const char = node.data[offset]
      if (/\s/.test(char)) {
        if (text.endsWith(' ')) continue
        text += ' '
      } else {
        text += char
      }
      points.push({ node, offset })
    }
  }
  return { text, points }
}

function normalizedNeedle(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function highlightEvidence(root: HTMLElement, evidence: Evidence | null, status: MatchStatus, side: 'left' | 'right') {
  const name = `comparison-${side}-${status}`
  const registry = (CSS as unknown as { highlights?: HighlightRegistry }).highlights
  for (const state of ['exact', 'near', 'different']) registry?.delete(`comparison-${side}-${state}`)
  if (!evidence || !registry || typeof Highlight === 'undefined') return false

  const { text, points } = normalizedText(root)
  const candidates = [evidence.quote, evidence.value].map(normalizedNeedle).filter(Boolean)
  let start = -1
  let length = 0
  for (const candidate of candidates) {
    const found = text.indexOf(candidate)
    if (found !== -1 && text.indexOf(candidate, found + 1) === -1) {
      start = found; length = candidate.length; break
    }
  }
  if (start < 0 || !points[start] || !points[start + length - 1]) return false
  const range = document.createRange()
  range.setStart(points[start].node, points[start].offset)
  range.setEnd(points[start + length - 1].node, points[start + length - 1].offset + 1)
  registry.set(name, new Highlight(range))
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  points[start].node.parentElement?.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' })
  return true
}

export function clearEvidence(side: 'left' | 'right') {
  const registry = (CSS as unknown as { highlights?: HighlightRegistry }).highlights
  for (const state of ['exact', 'near', 'different']) registry?.delete(`comparison-${side}-${state}`)
}
