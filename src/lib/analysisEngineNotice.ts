/**
 * Aviso al terminar un análisis: indica si el resultado se generó CON o SIN IA.
 *
 * El worker guarda en el resultado (`payload.analysis_engine`) qué motor produjo cada
 * documento: la IA o las reglas de respaldo que se usan cuando la IA falla o no está
 * configurada. Las reglas captan menos datos, así que el revisor debe saberlo.
 */

export type AnalysisEngineTone = 'success' | 'warning' | 'info'

export interface AnalysisEngineNotice {
  tone: AnalysisEngineTone
  message: string
}

type DocumentEngine = 'ai' | 'rules' | 'mixed' | 'unread'

interface AnalysisEngine {
  mode: 'ai' | 'rules' | 'mixed' | 'none'
  rules_reason?: 'ai_error' | 'not_configured' | 'spreadsheet' | null
  documents?: { name: string; engine: DocumentEngine }[]
}

const isAnalysisEngine = (value: unknown): value is AnalysisEngine =>
  typeof value === 'object' && value !== null && ['ai', 'rules', 'mixed', 'none'].includes((value as AnalysisEngine).mode)

function nameList(names: string[]): string {
  if (names.length <= 3) return names.join(', ')
  return `${names.slice(0, 3).join(', ')} y ${names.length - 3} más`
}

const RULES_REASON: Record<string, string> = {
  ai_error: 'La IA no respondió y se usaron reglas de lectura, que captan menos datos',
  not_configured: 'La IA no está configurada en el servidor y se usaron reglas de lectura, que captan menos datos',
}

/** Devuelve null si el resultado no trae esta información (resultados anteriores al cambio). */
export function analysisEngineNotice(groupTitle: string, engine: unknown): AnalysisEngineNotice | null {
  if (!isAnalysisEngine(engine)) return null
  const documents = engine.documents ?? []
  const named = (kinds: DocumentEngine[]) => documents.filter((d) => kinds.includes(d.engine)).map((d) => d.name)
  const unread = named(['unread'])
  const unreadNote = unread.length ? ` No se pudo leer texto de: ${nameList(unread)}.` : ''
  const reason = RULES_REASON[engine.rules_reason ?? 'ai_error'] ?? RULES_REASON.ai_error

  if (engine.rules_reason === 'spreadsheet') {
    return { tone: 'info', message: `${groupTitle}: análisis generado SIN IA. La plantilla se lee directamente del Excel con reglas; este paso no usa IA.` }
  }
  if (engine.mode === 'none') {
    return { tone: 'warning', message: `${groupTitle}: no se pudo leer texto de ningún documento, así que el análisis no usó IA. Revisa si son escaneados o están en un formato no admitido.` }
  }
  if (engine.mode === 'ai') {
    const total = named(['ai']).length
    const count = total ? ` (${total} ${total === 1 ? 'documento' : 'documentos'})` : ''
    return { tone: unread.length ? 'warning' : 'success', message: `${groupTitle}: análisis generado CON IA${count}.${unreadNote}` }
  }
  if (engine.mode === 'rules') {
    return { tone: 'warning', message: `${groupTitle}: análisis generado SIN IA. ${reason}. Revisa con cuidado los campos vacíos.${unreadNote}` }
  }
  const withAi = named(['ai'])
  const withoutAi = named(['rules', 'mixed'])
  const total = withAi.length + withoutAi.length
  return {
    tone: 'warning',
    message: `${groupTitle}: análisis generado CON IA en ${withAi.length} de ${total} documentos y SIN IA en ${withoutAi.length} (${nameList(withoutAi)}). ${reason}; revisa esos documentos con cuidado.${unreadNote}`,
  }
}
