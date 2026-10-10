/**
 * Cotejo de dos insumos del expediente (p. ej. un plano y su estudio de títulos) con el mismo
 * comparador de archivos: mismos documentos, misma cola, mismo worker y misma IA.
 *
 * El comparador trabaja con sus propios documentos (<project>/comparison/...). Cada insumo se
 * copia allí con la carga del comparador, se encola el cotejo y las copias se retiran de su lista
 * activa: no ocupan los 10 cupos del comparador manual y el worker las sigue leyendo por su id.
 * Si el par ya tiene un cotejo terminado o en curso, se reutiliza sin volver a llamar a la IA.
 */
import { requireSupabase } from '../lib/supabase'
import {
  listComparisonDocuments,
  listComparisonJobs,
  requestComparison,
  retireComparisonDocument,
  uploadComparisonDocument,
  type ComparisonDocument,
  type ComparisonJob,
} from './documentComparison'

export interface ComparisonSourceFile {
  id: string
  name: string
  storagePath: string
  mimeType: string
  sizeBytes: number
}

export interface ComparisonService {
  listDocuments: (projectId: string) => Promise<ComparisonDocument[]>
  listJobs: (projectId: string) => Promise<ComparisonJob[]>
  /** Copia el insumo como documento del comparador. */
  register: (projectId: string, file: ComparisonSourceFile) => Promise<void>
  request: (leftDocumentId: string, rightDocumentId: string) => Promise<string>
  retire: (document: ComparisonDocument) => Promise<void>
  /** Para mostrar los originales; sin él, el visor los descarga de Storage. */
  loadOriginal?: (storagePath: string) => Promise<Blob>
}

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const MIME_BY_EXTENSION: Record<string, string> = { pdf: 'application/pdf', docx: DOCX }

/** El comparador solo acepta PDF y DOCX. */
export function comparableMime(fileName: string): string | null {
  return MIME_BY_EXTENSION[fileName.split('.').pop()?.toLowerCase() ?? ''] ?? null
}

export const supabaseComparisonService: ComparisonService = {
  listDocuments: listComparisonDocuments,
  listJobs: listComparisonJobs,
  async register(projectId, file) {
    const { data, error } = await requireSupabase().storage.from('source-documents').download(file.storagePath)
    if (error || !data) throw new Error(`No se pudo leer "${file.name}" de los insumos: ${error?.message ?? 'sin datos'}`)
    const mime = comparableMime(file.name) ?? file.mimeType
    await uploadComparisonDocument(projectId, new File([data], file.name, { type: mime }), '')
  },
  request: requestComparison,
  retire: retireComparisonDocument,
}

/** Un documento del comparador corresponde a un insumo si tiene su nombre y su tamaño. */
const isCopyOf = (document: ComparisonDocument, file: ComparisonSourceFile) =>
  document.original_name === file.name && document.size_bytes === file.sizeBytes

/** Cotejo más reciente de este par que terminó bien o sigue en curso. */
export function findReusableComparison(documents: ComparisonDocument[], jobs: ComparisonJob[], left: ComparisonSourceFile, right: ComparisonSourceFile): ComparisonJob | null {
  const leftIds = new Set(documents.filter((document) => isCopyOf(document, left)).map((document) => document.id))
  const rightIds = new Set(documents.filter((document) => isCopyOf(document, right)).map((document) => document.id))
  return jobs.find((job) => job.status !== 'failed' && leftIds.has(job.left_document_id) && rightIds.has(job.right_document_id)) ?? null
}

async function runComparison(projectId: string, left: ComparisonSourceFile, right: ComparisonSourceFile, service: ComparisonService): Promise<ComparisonJob> {
  const [documents, jobs] = await Promise.all([service.listDocuments(projectId), service.listJobs(projectId)])
  const reusable = findReusableComparison(documents, jobs, left, right)
  if (reusable) return reusable

  const created: ComparisonDocument[] = []
  const ensure = async (file: ComparisonSourceFile) => {
    // Ya activo en el comparador (p. ej. cargado a mano): se usa tal cual y no se retira.
    const active = documents.find((document) => document.is_active && isCopyOf(document, file))
    if (active) return active
    await service.register(projectId, file)
    const copy = (await service.listDocuments(projectId)).filter((document) => document.is_active && isCopyOf(document, file)).at(-1)
    if (!copy) throw new Error(`No se pudo registrar "${file.name}" en el comparador.`)
    created.push(copy)
    return copy
  }

  try {
    const leftDocument = await ensure(left)
    const rightDocument = await ensure(right)
    const jobId = await service.request(leftDocument.id, rightDocument.id)
    const job = (await service.listJobs(projectId)).find((item) => item.id === jobId)
    return job ?? {
      id: jobId,
      project_id: projectId,
      left_document_id: leftDocument.id,
      right_document_id: rightDocument.id,
      status: 'queued',
      result: null,
      error_code: null,
      created_at: new Date().toISOString(),
    }
  } finally {
    // Las copias propias salen de la lista activa del comparador (el worker las lee por su id).
    await Promise.allSettled(created.map((document) => service.retire(document)))
  }
}

// Un mismo par en curso se comparte: abrir dos veces (o el doble montaje de React) no duplica copias.
const inFlight = new Map<string, Promise<ComparisonJob>>()

export function startPairComparison(projectId: string, left: ComparisonSourceFile, right: ComparisonSourceFile, service: ComparisonService = supabaseComparisonService): Promise<ComparisonJob> {
  const key = `${projectId}|${left.id}|${right.id}`
  const pending = inFlight.get(key)
  if (pending) return pending
  const promise = runComparison(projectId, left, right, service).finally(() => inFlight.delete(key))
  inFlight.set(key, promise)
  return promise
}
