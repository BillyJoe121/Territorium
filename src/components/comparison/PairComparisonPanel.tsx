/**
 * Cotejo directo de dos insumos del expediente con el comparador de archivos: sin pantalla de
 * carga ni selección. Muestra de inmediato la "Lectura paralela" del comparador con sus dos
 * originales (en cola / analizando) y, al terminar, los atributos con sus diferencias.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../ui/ToastLayer'
import { describeComparisonError, type ComparisonJob } from '../../data/documentComparison'
import { startPairComparison, supabaseComparisonService, type ComparisonService, type ComparisonSourceFile } from '../../data/pairComparison'
import { ComparisonResults } from './ComparisonResults'
import type { ViewerDocument } from './OriginalViewer'

const POLL_MS = 4000

interface PairComparisonPanelProps {
  projectId: string
  /** Documento A (p. ej. el plano). */
  left: ComparisonSourceFile
  /** Documento B (p. ej. el estudio de títulos). */
  right: ComparisonSourceFile
  service?: ComparisonService
}

const viewerDocument = (file: ComparisonSourceFile): ViewerDocument => ({
  id: file.id,
  storage_path: file.storagePath,
  original_name: file.name,
  mime_type: file.mimeType,
})

export function PairComparisonPanel({ projectId, left, right, service = supabaseComparisonService }: PairComparisonPanelProps) {
  const [job, setJob] = useState<ComparisonJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const serviceRef = useRef(service)
  serviceRef.current = service
  const filesRef = useRef({ left, right })
  filesRef.current = { left, right }

  useEffect(() => {
    let cancelled = false
    setJob(null)
    setError(null)
    startPairComparison(projectId, filesRef.current.left, filesRef.current.right, serviceRef.current)
      .then((next) => { if (!cancelled) setJob(next) })
      .catch((caught) => { if (!cancelled) setError(describeComparisonError(caught, 'No fue posible iniciar la comparación.')) })
    return () => { cancelled = true }
  }, [projectId, left.id, right.id])

  // Igual que el comparador: se consulta el avance mientras el cotejo está en cola o analizando.
  const pending = job?.status === 'queued' || job?.status === 'running'
  useEffect(() => {
    if (!job || !pending) return
    const interval = window.setInterval(() => {
      void serviceRef.current.listJobs(projectId).then((jobs) => {
        const next = jobs.find((item) => item.id === job.id)
        if (next) setJob(next)
      }).catch(() => undefined)
    }, POLL_MS)
    return () => window.clearInterval(interval)
  }, [job?.id, pending, projectId])

  const previousStatus = useRef<string | null>(null)
  useEffect(() => {
    if (job && previousStatus.current && (previousStatus.current === 'queued' || previousStatus.current === 'running') && job.status === 'completed') {
      toast.success('Cotejo completado exitosamente.')
    }
    previousStatus.current = job?.status ?? null
  }, [job])

  const leftDocument = useMemo(() => viewerDocument(filesRef.current.left), [left.id])
  const rightDocument = useMemo(() => viewerDocument(filesRef.current.right), [right.id])
  const loadOriginal = service.loadOriginal
    ? (document: ViewerDocument) => serviceRef.current.loadOriginal!(document.storage_path)
    : undefined
  const shown = job ?? { status: error ? 'failed' as const : 'queued' as const, result: null, error_code: null }

  // Sin key por cotejo: los visores ya muestran los originales mientras se prepara el análisis.
  return (
    <ComparisonResults
      job={shown}
      left={leftDocument}
      right={rightDocument}
      errorMessage={error}
      loadOriginal={loadOriginal}
    />
  )
}
