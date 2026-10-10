/**
 * Pantalla de resultados del comparador ("Lectura paralela"): atributos detectados con sus
 * diferencias y los dos originales con el resaltado de la evidencia. La usan el comparador de
 * archivos y el modal de planos (botón "Comparar"), así ambos muestran exactamente lo mismo.
 */
import { useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, ChevronDown, CircleAlert, LoaderCircle, Scale } from 'lucide-react'
import type { ComparedField, ComparisonJob } from '../../data/documentComparison'
import { OriginalViewer, type ViewerDocument } from './OriginalViewer'
import './document-comparison.css'

export type VisualStatus = 'exact' | 'near' | 'different' | 'absent'

const SPANISH_MONTHS: Record<string, number> = {
  enero: 1, ene: 1,
  febrero: 2, feb: 2,
  marzo: 3, mar: 3,
  abril: 4, abr: 4,
  mayo: 5, may: 5,
  junio: 6, jun: 6,
  julio: 7, jul: 7,
  agosto: 8, ago: 8,
  septiembre: 9, setiembre: 9, sep: 9,
  octubre: 10, oct: 10,
  noviembre: 11, nov: 11,
  diciembre: 12, dic: 12,
}

export function parseSpanishDate(str: string): { year: number; month: number; day: number } | null {
  if (!str) return null
  const clean = str.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ')

  // Format: "15 de marzo de 2024" or "15 de marzo del 2024" or "15 marzo 2024"
  const textMatch = clean.match(/^(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)(?:\s+(?:de|del))?\s+(\d{4})$/i)
  if (textMatch) {
    const day = parseInt(textMatch[1], 10)
    const monthName = textMatch[2].normalize('NFD').replace(/[̀-ͯ]/g, '')
    const month = SPANISH_MONTHS[monthName]
    const year = parseInt(textMatch[3], 10)
    if (month && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      return { year, month, day }
    }
  }

  // Format: "15/03/2024" or "15-03-2024" (DD/MM/YYYY)
  const slashMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10)
    const month = parseInt(slashMatch[2], 10)
    const year = parseInt(slashMatch[3], 10)
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      return { year, month, day }
    }
  }

  // ISO Format: "2024-03-15" (YYYY-MM-DD)
  const isoMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10)
    const month = parseInt(isoMatch[2], 10)
    const day = parseInt(isoMatch[3], 10)
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      return { year, month, day }
    }
  }

  return null
}

export function areValuesSemanticallyEqual(a: string, b: string): boolean {
  if (a === b) return true

  const normA = a.trim().replace(/\s+/g, ' ')
  const normB = b.trim().replace(/\s+/g, ' ')

  // 1. Case-insensitive equality (e.g. ALL CAPS vs Title Case)
  if (normA.toLowerCase() === normB.toLowerCase()) {
    return true
  }

  // 2. Date equality (e.g. "15 de marzo de 2024" vs "15/03/2024")
  const dateA = parseSpanishDate(normA)
  const dateB = parseSpanishDate(normB)
  if (dateA && dateB) {
    return dateA.year === dateB.year && dateA.month === dateB.month && dateA.day === dateB.day
  }

  // 3. Monetary / pure number format equality (e.g. "$ 10.000.000" vs "10.000.000")
  const cleanDigitsA = normA.replace(/[$\s,.]/g, '')
  const cleanDigitsB = normB.replace(/[$\s,.]/g, '')
  if (cleanDigitsA && cleanDigitsB && cleanDigitsA === cleanDigitsB && /^\d+$/.test(cleanDigitsA)) {
    return true
  }

  return false
}

export function getFieldVisualStatus(field: ComparedField): VisualStatus {
  const leftVal = field.left?.value?.trim() ?? ''
  const rightVal = field.right?.value?.trim() ?? ''

  if (!leftVal || !rightVal) {
    return 'absent'
  }

  // If semantically equal (case insensitivity, date equivalents, formatting) -> exact
  if (areValuesSemanticallyEqual(leftVal, rightVal)) {
    return 'exact'
  }

  // If both are dates but they differ in day/month/year -> different
  const dateA = parseSpanishDate(leftVal)
  const dateB = parseSpanishDate(rightVal)
  if (dateA && dateB && (dateA.year !== dateB.year || dateA.month !== dateB.month || dateA.day !== dateB.day)) {
    return 'different'
  }

  return field.status
}

const statusText: Record<VisualStatus, string> = {
  exact: 'Coincide exactamente',
  near: 'Coincidencia cercana',
  different: 'No coincide (valores distintos)',
  absent: 'No coincide (no encontrado en un documento)',
}
export const jobText = { queued: 'En cola', running: 'Analizando', completed: 'Terminado', failed: 'Falló' }
const errorText: Record<string, string> = {
  SOURCE_NOT_FOUND: 'Uno de los originales ya no está disponible. Vuelva a seleccionar los documentos.',
  SOURCE_DOWNLOAD_FAILED: 'No se pudo descargar un original desde el almacenamiento. Vuelva a intentar.',
  UNSUPPORTED_FORMAT: 'Uno de los originales no es PDF ni DOCX.',
  NO_EXTRACTABLE_TEXT: 'No hay texto extraíble. Un PDF escaneado requiere OCR antes de compararse.',
  DOCUMENT_TOO_LONG: 'El texto excede el límite de esta primera versión (60 000 caracteres por documento).',
  NO_VERIFIABLE_FIELDS: 'La IA no encontró atributos con citas comprobables en los originales.',
  INVALID_AI_RESPONSE: 'La IA devolvió una respuesta inválida. Intente de nuevo.',
  AI_NOT_CONFIGURED: 'El proveedor de IA no está configurado en el worker.',
  AI_RATE_LIMITED: 'El proveedor de IA limitó las solicitudes. Espere un momento y vuelva a intentar.',
  AI_AUTH_FAILED: 'El proveedor de IA rechazó la clave del worker. Revise su configuración.',
  AI_MODEL_UNAVAILABLE: 'El modelo de IA configurado no está disponible para esta clave.',
  AI_PROVIDER_UNAVAILABLE: 'El proveedor de IA tuvo un error temporal. Vuelva a intentar.',
  AI_CONNECTION_FAILED: 'El worker no pudo comunicarse con el proveedor de IA. Vuelva a intentar.',
  AI_REQUEST_REJECTED: 'El proveedor de IA rechazó la solicitud. Revise su configuración.',
  WORKER_RETRIES_EXHAUSTED: 'El worker se interrumpió varias veces durante este análisis.',
}

export interface ComparisonResultsProps {
  job: Pick<ComparisonJob, 'status' | 'result' | 'error_code'>
  left?: ViewerDocument
  right?: ViewerDocument
  /** Botón "Volver al comparador" de la barra; sin él la barra no lo muestra. */
  onBack?: () => void
  /** Error previo al análisis (p. ej. al preparar los documentos). */
  errorMessage?: string | null
  /** Carga de los originales; sin ella, el visor los descarga de Storage. */
  loadOriginal?: (document: ViewerDocument) => Promise<Blob>
}

export function ComparisonResults({ job, left, right, onBack, errorMessage, loadOriginal }: ComparisonResultsProps) {
  const [activeFieldKey, setActiveFieldKey] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const fields = job.result?.fields ?? []
  const activeField = fields.find((field) => field.key === activeFieldKey) ?? null

  const visualCounts = useMemo(() => {
    let exact = 0, near = 0, different = 0, absent = 0
    for (const f of fields) {
      const s = getFieldVisualStatus(f)
      if (s === 'exact') exact++
      else if (s === 'near') near++
      else if (s === 'different') different++
      else if (s === 'absent') absent++
    }
    return { exact, near, different, absent }
  }, [fields])

  return (
    <div className="comparison-workspace is-results-screen">
      <section className="comparison-results" aria-live="polite">
        <div className="comparison-results-toolbar">
          <div className="comparison-toolbar-left">
            {onBack && (
              <>
                <button
                  type="button"
                  className="comparison-back-btn"
                  onClick={onBack}
                  title="Volver a la selección de documentos"
                >
                  <ArrowLeft size={13} />
                  <span>Volver al comparador</span>
                </button>
                <div className="comparison-toolbar-separator" aria-hidden="true" />
              </>
            )}
            <div className="comparison-toolbar-title-group">
              <span className="comparison-kicker-tag"><Scale size={12} /> ANÁLISIS</span>
              <h2 className="comparison-toolbar-title">Lectura paralela</h2>
              <span className={`comparison-job-status is-${job.status}`}>
                {job.status === 'completed' ? <CheckCircle2 size={13} /> : job.status === 'failed' ? <CircleAlert size={13} /> : <LoaderCircle size={13} className="spin" />}
                {jobText[job.status]}
              </span>
            </div>
          </div>

          {job.result && (
            <div className="comparison-counts">
              <span className="is-exact">{visualCounts.exact} exactos</span>
              <span className="is-near">{visualCounts.near} cercanos</span>
              {visualCounts.different > 0 && <span className="is-different">{visualCounts.different} distintos</span>}
              {visualCounts.absent > 0 && <span className="is-absent">{visualCounts.absent} no encontrados</span>}
            </div>
          )}
        </div>

        {errorMessage && <div className="comparison-error" role="alert">{errorMessage}</div>}
        {job.status === 'failed' && !errorMessage && <div className="comparison-error" role="alert">{errorText[job.error_code ?? ''] ?? 'No se pudo completar. Intente de nuevo o revise el worker.'}</div>}
        {job.result && Object.values(job.result.documents).some((document) => document.scan_status !== 'textual') && <div className="comparison-notice" role="status"><CircleAlert size={17} />Algunas páginas pueden no tener texto extraíble. El cotejo solo cubre la evidencia que pudo leerse; revise también las páginas escaneadas.</div>}

        <div className="comparison-review-grid">
          <aside className="comparison-findings">
            <div className="comparison-findings-heading">
              <strong>Atributos detectados</strong>
              <span>{fields.length}</span>
            </div>
            {fields.length ? (
              <ul className="comparison-findings-list">
                {fields.map((field: ComparedField) => {
                  const isSelected = field.key === activeFieldKey
                  const isExpanded = expandedKeys.has(field.key)
                  const visualStatus = getFieldVisualStatus(field)
                  return (
                    <li key={field.key} className={`comparison-finding-item ${isSelected ? 'is-selected' : ''} ${isExpanded ? 'is-expanded' : ''}`}>
                      <div className={`comparison-finding-row ${isSelected ? 'is-selected' : ''}`}>
                        <button
                          type="button"
                          className="comparison-finding-select"
                          onClick={() => setActiveFieldKey(field.key)}
                          aria-pressed={isSelected}
                        >
                          <span className={`comparison-status-dot is-${visualStatus}`} aria-hidden="true" />
                          <span className="comparison-finding-title" title={field.label}>{field.label}</span>
                        </button>
                        <button
                          type="button"
                          className={`comparison-toggle-arrow ${isExpanded ? 'is-open' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedKeys((prev) => {
                              const next = new Set(prev)
                              if (next.has(field.key)) next.delete(field.key)
                              else next.add(field.key)
                              return next
                            })
                          }}
                          title={isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
                          aria-label={isExpanded ? `Ocultar detalles de ${field.label}` : `Ver detalles de ${field.label}`}
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="comparison-finding-details">
                          <div className="comparison-detail-attribute">
                            <span className="comparison-detail-attribute-label">Atributo completo</span>
                            <strong className="comparison-detail-full-name">{field.label}</strong>
                          </div>
                          <div className="comparison-detail-status">
                            <span className={`comparison-status-tag is-${visualStatus}`}>
                              {visualStatus === 'absent'
                                ? (!field.left?.value ? 'No encontrado en Doc A' : !field.right?.value ? 'No encontrado en Doc B' : statusText.absent)
                                : statusText[visualStatus]}
                            </span>
                          </div>
                          <div className="comparison-values">
                            <div className="comparison-value-row">
                              <span className="comparison-val-label">Doc A:</span>
                              <span className={`comparison-val-text ${!field.left?.value ? 'is-missing' : ''}`} title={field.left?.value ?? 'No encontrado'}>
                                {field.left?.value ?? 'No encontrado'}
                              </span>
                            </div>
                            <div className="comparison-value-row">
                              <span className="comparison-val-label">Doc B:</span>
                              <span className={`comparison-val-text ${!field.right?.value ? 'is-missing' : ''}`} title={field.right?.value ?? 'No encontrado'}>
                                {field.right?.value ?? 'No encontrado'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="comparison-empty">Los atributos aparecerán aquí cuando termine el análisis.</p>
            )}
            {job.result && <p className="comparison-review-note">{job.result.disclaimer}</p>}
          </aside>

          <div className="comparison-originals">
            {left ? (
              <OriginalViewer key={left.id} document={left} evidence={activeField?.left ?? null} status={activeField?.status ?? null} side="left" activeFieldLabel={activeField?.label} loadBlob={loadOriginal ? () => loadOriginal(left) : undefined} />
            ) : (
              <div className="comparison-missing">El documento A ya no está en la lista activa.</div>
            )}
            {right ? (
              <OriginalViewer key={right.id} document={right} evidence={activeField?.right ?? null} status={activeField?.status ?? null} side="right" activeFieldLabel={activeField?.label} loadBlob={loadOriginal ? () => loadOriginal(right) : undefined} />
            ) : (
              <div className="comparison-missing">El documento B ya no está en la lista activa.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
