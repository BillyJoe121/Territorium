import * as tus from 'tus-js-client'
import { config } from '../lib/config'
import { requireSupabase } from '../lib/supabase'
import { expedienteTusEndpoint } from './expedienteUpload'

export type MatchStatus = 'exact' | 'near' | 'different'
export interface Evidence {
  value: string
  quote: string
  fragment_id: string
  page: number | null
  location: string
}
export interface ComparedField {
  key: string
  label: string
  status: MatchStatus
  left: Evidence | null
  right: Evidence | null
}
export interface ComparisonResult {
  version: number
  fields: ComparedField[]
  counts: Record<MatchStatus, number>
  documents: Record<'left' | 'right', { sha256: string; scan_status: string }>
  disclaimer: string
}
export interface ComparisonDocument {
  id: string
  project_id: string
  storage_path: string
  original_name: string
  mime_type: string
  size_bytes: number
  document_label: string | null
  is_active: boolean
  created_at: string
}
export interface ComparisonJob {
  id: string
  project_id: string
  left_document_id: string
  right_document_id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  result: ComparisonResult | null
  error_code: string | null
  created_at: string
}

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const allowed = new Map([['pdf', 'application/pdf'], ['docx', DOCX]])

export function describeComparisonError(caught: unknown, fallback: string): string {
  if (typeof caught !== 'object' || caught === null) return fallback
  const details = caught as { code?: unknown; message?: unknown }
  if (details.code === 'PGRST205' || details.code === '42P01') {
    return 'El comparador aún no está activado en Supabase. Falta aplicar su migración; encender el worker no crea las tablas.'
  }
  const msg = typeof details.message === 'string' ? details.message : ''
  if (msg.includes('comparison_documents_not_available')) {
    return 'Los documentos seleccionados no están disponibles o no cuentas con permisos de operador o revisor jurídico en este proyecto.'
  }
  if (msg.includes('comparison_queue_full')) {
    return 'La cola de comparaciones está llena (máximo 2 análisis en curso por proyecto). Espera a que termine el anterior.'
  }
  if (msg.includes('comparison_already_running')) {
    return 'Ya existe una comparación en curso para este mismo par de documentos.'
  }
  if (msg.includes('comparison_requires_two_documents')) {
    return 'Debes seleccionar dos documentos distintos para comparar.'
  }
  if (msg.includes('comparison_document_limit_reached')) {
    return 'Se alcanzó el límite máximo de 10 documentos activos por proyecto.'
  }
  return msg.trim() ? msg : fallback
}

export function validateComparisonFile(file: File) {
  if (!file.name.trim() || file.name.length > 255) throw new Error('El nombre del archivo debe tener entre 1 y 255 caracteres.')
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const mime = allowed.get(extension)
  if (!mime || (file.type && file.type !== mime)) throw new Error('Solo se aceptan archivos PDF o DOCX válidos.')
  if (file.size < 1 || file.size > 50 * 1024 * 1024) throw new Error('Cada archivo debe ocupar entre 1 B y 50 MB.')
  return mime
}

export async function listComparisonDocuments(projectId: string): Promise<ComparisonDocument[]> {
  const { data, error } = await requireSupabase().from('comparison_documents')
    .select('id,project_id,storage_path,original_name,mime_type,size_bytes,document_label,is_active,created_at')
    .eq('project_id', projectId).order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ComparisonDocument[]
}

export async function listComparisonJobs(projectId: string): Promise<ComparisonJob[]> {
  const { data, error } = await requireSupabase().from('comparison_jobs')
    .select('id,project_id,left_document_id,right_document_id,status,result,error_code,created_at')
    .eq('project_id', projectId).order('created_at', { ascending: false }).limit(20)
  if (error) throw error
  return (data ?? []) as ComparisonJob[]
}

export async function uploadComparisonDocument(projectId: string, file: File, label: string, onProgress?: (percent: number) => void): Promise<void> {
  const client = requireSupabase()
  const mime = validateComparisonFile(file)
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  const validSignature = mime === 'application/pdf'
    ? [0x25, 0x50, 0x44, 0x46, 0x2d].every((byte, index) => header[index] === byte)
    : [0x50, 0x4b, 0x03, 0x04].every((byte, index) => header[index] === byte)
  if (!validSignature) throw new Error('El contenido del archivo no corresponde con su extensión.')
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) throw new Error('Inicia sesión para cargar documentos.')
  const { data: { session } } = await client.auth.getSession()
  if (!session || !config.supabaseUrl) throw new Error('La sesión expiró. Inicia sesión nuevamente.')
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-160)
  const path = `${projectId}/comparison/${crypto.randomUUID()}/${safeName}`
  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: expedienteTusEndpoint(config.supabaseUrl!),
      retryDelays: [0, 3_000, 5_000, 10_000, 20_000],
      headers: { authorization: `Bearer ${session.access_token}`, 'x-upsert': 'false' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: 'source-documents', objectName: path, contentType: mime, cacheControl: '3600' },
      chunkSize: 6 * 1024 * 1024,
      onError: reject,
      onProgress: (uploaded, total) => onProgress?.(total ? Math.round(uploaded / total * 100) : 0),
      onSuccess: () => resolve(),
    })
    upload.start()
  })
  const { error: rowError } = await client.from('comparison_documents').insert({
    project_id: projectId, storage_path: path, original_name: file.name,
    mime_type: mime, size_bytes: file.size, document_label: label.trim() || null,
    created_by: user.id,
  })
  if (rowError) {
    await client.storage.from('source-documents').remove([path])
    throw rowError
  }
}

export async function retireComparisonDocument(document: ComparisonDocument): Promise<void> {
  const { error } = await requireSupabase().from('comparison_documents')
    .update({ is_active: false }).eq('id', document.id).eq('project_id', document.project_id)
  if (error) throw error
}

export async function requestComparison(leftDocumentId: string, rightDocumentId: string): Promise<string> {
  const client = requireSupabase()

  // 1. Intentar por la Edge Function (que despierta al worker en Render si está configurada)
  try {
    const { data, error } = await client.functions.invoke('document-comparison-request', {
      body: { leftDocumentId, rightDocumentId },
    })
    if (!error && data?.jobId) {
      return data.jobId as string
    }
    // Si la función respondió con detalle de rechazo de negocio (422), propagarlo
    if (error && 'context' in error && error.context instanceof Response) {
      try {
        const body = await error.context.clone().json()
        if (body?.detail) {
          throw new Error(body.detail)
        }
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message && !parseError.message.includes('JSON')) {
          throw parseError
        }
      }
    }
  } catch (fnError) {
    if (fnError instanceof Error && (
      fnError.message.includes('comparison_') ||
      fnError.message.includes('permisos')
    )) {
      throw fnError
    }
  }

  // 2. Fallback directo por RPC en Supabase
  const { data: rpcJobId, error: rpcError } = await client.rpc('queue_comparison', {
    p_left_document_id: leftDocumentId,
    p_right_document_id: rightDocumentId,
  })

  if (rpcError) {
    throw rpcError
  }

  if (!rpcJobId) {
    throw new Error('No se pudo iniciar el cotejo. Verifica permisos, cupo de la cola y despliegue del procesamiento.')
  }

  return rpcJobId as string
}

export async function downloadComparisonOriginal(document: ComparisonDocument): Promise<Blob> {
  const { data, error } = await requireSupabase().storage.from('source-documents').download(document.storage_path)
  if (error || !data) throw error ?? new Error('No se pudo abrir el archivo original.')
  return data
}
