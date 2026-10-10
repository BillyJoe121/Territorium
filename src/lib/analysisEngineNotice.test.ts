import { describe, expect, it } from 'vitest'
import { analysisEngineNotice } from './analysisEngineNotice'

const docs = (...entries: [string, string][]) => entries.map(([name, engine]) => ({ name, engine }))

describe('analysisEngineNotice', () => {
  it('ignora resultados sin la información del motor', () => {
    expect(analysisEngineNotice('Planos', undefined)).toBeNull()
    expect(analysisEngineNotice('Planos', { mode: 'otro' })).toBeNull()
  })

  it('anuncia análisis CON IA', () => {
    const notice = analysisEngineNotice('Estudio de Títulos', { mode: 'ai', documents: docs(['a.pdf', 'ai'], ['b.pdf', 'ai']) })
    expect(notice).toEqual({ tone: 'success', message: 'Estudio de Títulos: análisis generado CON IA (2 documentos).' })
  })

  it('anuncia análisis SIN IA y su motivo', () => {
    const failed = analysisEngineNotice('Planos', { mode: 'rules', rules_reason: 'ai_error', documents: docs(['a.pdf', 'rules']) })
    expect(failed?.tone).toBe('warning')
    expect(failed?.message).toContain('SIN IA. La IA no respondió')
    const missing = analysisEngineNotice('Planos', { mode: 'rules', rules_reason: 'not_configured', documents: docs(['a.pdf', 'rules']) })
    expect(missing?.message).toContain('La IA no está configurada')
  })

  it('detalla qué documentos se analizaron sin IA', () => {
    const notice = analysisEngineNotice('Planos', {
      mode: 'mixed',
      rules_reason: 'ai_error',
      documents: docs(['A.pdf', 'ai'], ['B.pdf', 'rules'], ['C.pdf', 'mixed']),
    })
    expect(notice?.message).toContain('CON IA en 1 de 3 documentos y SIN IA en 2 (B.pdf, C.pdf)')
  })

  it('explica que la negociación nunca usa IA', () => {
    const notice = analysisEngineNotice('Plantilla de Negociación', { mode: 'rules', rules_reason: 'spreadsheet' })
    expect(notice).toEqual({
      tone: 'info',
      message: 'Plantilla de Negociación: análisis generado SIN IA. La plantilla se lee directamente del Excel con reglas; este paso no usa IA.',
    })
  })

  it('menciona los documentos sin texto legible', () => {
    const notice = analysisEngineNotice('Planos', { mode: 'ai', documents: docs(['A.pdf', 'ai'], ['B.png', 'unread']) })
    expect(notice?.tone).toBe('warning')
    expect(notice?.message).toContain('No se pudo leer texto de: B.png.')
    expect(analysisEngineNotice('Planos', { mode: 'none', documents: docs(['B.png', 'unread']) })?.message).toContain('no se pudo leer texto de ningún documento')
  })
})
