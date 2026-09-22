import * as tus from 'tus-js-client'
import { config } from '../lib/config'
import type { ExpedienteGroupKey } from '../lib/expedienteWorkflow'
import { requireSupabase } from '../lib/supabase'

export type DuplicateDecision = 'omit' | 'keep_version' | 'replace'

export interface ExpedienteUploadProgress {
  groupKey: ExpedienteGroupKey
  fileName: string
  fileIndex: number
  totalFiles: number
  percent: number
}

export interface UploadedExpedienteFile {
  fileName: string
  documentFileId: string | null
  duplicateOfDocumentFileId: string | null
  skipped: boolean
}

interface UploadReservation {
  reservation_id: string | null
  storage_path: string | null
  skip_upload: boolean
  duplicate_of_document_file_id: string | null
  expires_at: string | null
}

const allowedByGroup: Record<ExpedienteGroupKey, ReadonlySet<string>> = {
  titles: new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]),
  plans: new Set(['application/pdf', 'image/png', 'image/jpeg']),
  negotiation: new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
}

const extensionMime: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
}

function extensionOf(file: File): string {
  return file.name.trim().toLowerCase().split('.').pop() ?? ''
}

export function resolveExpedienteMime(file: File): string {
  const expected = extensionMime[extensionOf(file)]
  if (!expected) throw new Error(`${file.name}: extensión no permitida.`)
  if (file.type && file.type !== expected) throw new Error(`${file.name}: el tipo declarado no corresponde con su extensión.`)
  return expected
}

export async function validateExpedienteFile(file: File, groupKey: ExpedienteGroupKey): Promise<string> {
  if (!file.name.trim()) throw new Error('Cada archivo debe tener un nombre.')
  if (file.size <= 0) throw new Error(`${file.name}: el archivo está vacío.`)
  if (file.size > config.maxUploadBytes) throw new Error(`${file.name}: supera el límite de ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB.`)
  const mime = resolveExpedienteMime(file)
  if (!allowedByGroup[groupKey].has(mime)) throw new Error(`${file.name}: no pertenece al grupo ${groupKey}.`)

  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const startsWith = (...bytes: number[]) => bytes.every((byte, index) => header[index] === byte)
  const validHeader = mime === 'application/pdf'
    ? startsWith(0x25, 0x50, 0x44, 0x46, 0x2d)
    : mime.includes('openxmlformats')
        ? startsWith(0x50, 0x4b, 0x03, 0x04)
        : mime === 'image/png'
          ? startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
          : startsWith(0xff, 0xd8, 0xff)
  if (!validHeader) throw new Error(`${file.name}: el contenido no corresponde al formato permitido.`)
  return mime
}

export async function sha256File(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function expedienteTusEndpoint(supabaseUrl: string): string {
  const url = new URL(supabaseUrl)
  if (url.hostname.endsWith('.supabase.co')) {
    const projectRef = url.hostname.replace(/\.supabase\.co$/, '')
    return `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`
  }
  return `${url.origin}/storage/v1/upload/resumable`
}

async function uploadResumable(file: File, storagePath: string, mime: string, onProgress: (percent: number) => void): Promise<void> {
  const client = requireSupabase()
  const { data: { session } } = await client.auth.getSession()
  const supabaseUrl = config.supabaseUrl
  if (!session || !supabaseUrl) throw new Error('La sesión expiró. Inicia sesión nuevamente.')

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: expedienteTusEndpoint(supabaseUrl),
      retryDelays: [0, 3_000, 5_000, 10_000, 20_000],
      headers: { authorization: `Bearer ${session.access_token}`, 'x-upsert': 'false' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: 'source-documents', objectName: storagePath, contentType: mime, cacheControl: '3600' },
      chunkSize: 6 * 1024 * 1024,
      onError: (error) => reject(error),
      onProgress: (uploaded, total) => onProgress(total > 0 ? Math.round((uploaded / total) * 100) : 0),
      onSuccess: () => resolve(),
    })
    upload.findPreviousUploads()
      .then((previous) => {
        if (previous[0]) upload.resumeFromPreviousUpload(previous[0])
        upload.start()
      })
      .catch(reject)
  })
}

export async function uploadExpedienteFiles(
  groupId: string,
  groupKey: ExpedienteGroupKey,
  files: File[],
  duplicateDecision: DuplicateDecision,
  onProgress: (progress: ExpedienteUploadProgress) => void,
): Promise<UploadedExpedienteFile[]> {
  if (!files.length) throw new Error('Selecciona al menos un archivo.')
  const client = requireSupabase()
  const results: UploadedExpedienteFile[] = []

  for (const [fileIndex, file] of files.entries()) {
    const mime = await validateExpedienteFile(file, groupKey)
    const hash = await sha256File(file)
    const { data, error } = await client.rpc('reserve_expediente_document_upload', {
      p_group_id: groupId,
      p_original_name: file.name,
      p_mime_type: mime,
      p_size_bytes: file.size,
      p_sha256: hash,
      p_duplicate_decision: duplicateDecision,
    })
    if (error) throw new Error(error.message)
    const reservation = (data?.[0] ?? null) as UploadReservation | null
    if (!reservation) throw new Error('No fue posible reservar una ruta de carga.')
    if (reservation.skip_upload) {
      results.push({ fileName: file.name, documentFileId: null, duplicateOfDocumentFileId: reservation.duplicate_of_document_file_id, skipped: true })
      onProgress({ groupKey, fileName: file.name, fileIndex, totalFiles: files.length, percent: 100 })
      continue
    }
    if (!reservation.reservation_id || !reservation.storage_path) throw new Error('La reserva de carga no contiene una ruta válida.')

    try {
      await uploadResumable(file, reservation.storage_path, mime, (percent) => onProgress({ groupKey, fileName: file.name, fileIndex, totalFiles: files.length, percent }))
      const { data: documentId, error: commitError } = await client.rpc('commit_expediente_document_upload', { p_reservation_id: reservation.reservation_id })
      if (commitError) throw new Error(commitError.message)
      results.push({ fileName: file.name, documentFileId: String(documentId), duplicateOfDocumentFileId: reservation.duplicate_of_document_file_id, skipped: false })
    } catch (caught) {
      // The worker deletes the private object from the cancelled reservation.
      await client.rpc('cancel_expediente_document_upload', { p_reservation_id: reservation.reservation_id })
      throw caught
    }
  }
  return results
}

export async function requestExpedienteAnalysis(input: {
  groupId: string
  idempotencyKey: string
  extractorSnapshot?: Record<string, unknown>
  promptSnapshot?: Record<string, unknown>
  modelSnapshot?: Record<string, unknown>
}): Promise<string> {
  const client = requireSupabase()

  // 1. Intento por Edge Function (si está desplegada en Supabase)
  try {
    const { data, error } = await client.functions.invoke('expediente-analysis-request', {
      body: input,
    })
    if (!error && data?.executionId) {
      return String(data.executionId)
    }
  } catch {
    // La Edge Function no está desplegada en el proyecto; recurrir al RPC directo
  }

  // 2. Ejecución directa por RPC en PostgreSQL (seguro e idempotente)
  const { data, error } = await client.rpc('queue_expediente_group_execution', {
    p_group_id: input.groupId,
    p_idempotency_key: input.idempotencyKey.trim(),
    p_extractor_snapshot: input.extractorSnapshot ?? {},
    p_prompt_snapshot: input.promptSnapshot ?? {},
    p_model_snapshot: input.modelSnapshot ?? {},
  })
  if (error) throw new Error(error.message)
  return String(data)
}

export async function deleteExpedienteFile(fileId: string): Promise<void> {
  const client = requireSupabase()

  // 1. Intentar primero por RPC directo en Supabase
  try {
    const { data, error } = await client.rpc('delete_expediente_document_file', {
      p_file_id: fileId,
    })
    if (!error && data !== false) {
      return
    }
  } catch {
    // Continuar al fallback del worker si el RPC no existe
  }

  // 2. Fallback mediante el worker local que cuenta con clave de servicio
  const workerUrl = 'http://127.0.0.1:8080/api/expediente/delete-file'
  const resp = await fetch(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  })
  if (resp.ok) {
    return
  }
  const errData = await resp.json().catch(() => ({}))
  throw new Error(errData.detail || 'Error al eliminar el archivo.')
}

