import * as tus from 'tus-js-client'
import { config } from '../lib/config'
import { requireSupabase } from '../lib/supabase'
import { DEFAULT_EXTRACTOR_CONFIGS, DEFAULT_PROMPT_VERSIONS } from '../lib/extractorConfig'
import type {
  AiExecutionLog,
  AuditEvent,
  Batch,
  DocumentKind,
  DocumentTask,
  ExtractorConfig,
  JobState,
  PlatformState,
  PreprocessingStatus,
  Project,
  ProjectMember,
  ProjectRole,
  PromptVersion,
  PropertyRecord,
  ReviewState,
  ReviewTask,
  SourceDocument,
  TextOrigin,
  UploadProgress,
} from '../types'

const dbKind: Record<DocumentKind, string> = { estudio_titulos: 'title_study', plano: 'plan', linderos: 'boundaries', negociacion: 'negotiation', soporte: 'support', sin_clasificar: 'unclassified' }
const uiKind: Record<string, DocumentKind> = { title_study: 'estudio_titulos', plan: 'plano', boundaries: 'linderos', negotiation: 'negociacion', support: 'soporte', unclassified: 'sin_clasificar' }
const uiJobState: Record<string, JobState> = { queued: 'pendiente', running: 'en_proceso', needs_review: 'requiere_revision', completed: 'completado', failed: 'fallido', cancelled: 'cancelado' }
const dbReview: Record<ReviewState, string> = { pendiente: 'pending', aprobado: 'approved', devuelto: 'returned' }
const allowedMime = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg'])

export function cleanFileName(name: string) {
  const extension = name.includes('.') ? `.${name.split('.').pop()!.toLowerCase()}` : ''
  const base = name.slice(0, extension ? -extension.length : undefined).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'documento'
  return `${base}${extension}`
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function validateFiles(files: File[]) {
  if (!files.length) throw new Error('Selecciona al menos un archivo.')
  for (const file of files) {
    if (!allowedMime.has(file.type)) throw new Error(`${file.name}: tipo de archivo no permitido.`)
    if (file.size <= 0 || file.size > config.maxUploadBytes) throw new Error(`${file.name}: supera el límite de ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB.`)
  }
}

async function uploadResumable(file: File, path: string, onProgress: (percent: number) => void) {
  const client = requireSupabase()
  const { data: { session } } = await client.auth.getSession()
  if (!session || !config.supabaseUrl) throw new Error('La sesión expiró. Inicia sesión nuevamente.')
  const projectId = new URL(config.supabaseUrl).hostname.split('.')[0]
  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${session.access_token}`, 'x-upsert': 'false' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: 'source-documents', objectName: path, contentType: file.type, cacheControl: '3600' },
      chunkSize: 6 * 1024 * 1024,
      onError: reject,
      onProgress: (uploaded, total) => onProgress(total ? Math.round((uploaded / total) * 100) : 0),
      onSuccess: () => resolve(),
    })
    upload.findPreviousUploads().then((previous) => { if (previous[0]) upload.resumeFromPreviousUpload(previous[0]); upload.start() }).catch(reject)
  })
}

export async function loadPlatformState(): Promise<PlatformState> {
  const client = requireSupabase()
  const projectsResult = await client.from('projects').select('id,name,client_name,municipality,department,power_line,is_archived,archived_at,created_at,updated_at,project_members!inner(role)').order('created_at', { ascending: false })
  if (projectsResult.error) throw new Error(projectsResult.error.message)
  const projects: Project[] = (projectsResult.data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    clientName: row.client_name ?? undefined,
    municipality: row.municipality ?? 'Sin definir',
    department: row.department ?? 'Sin definir',
    powerLine: row.power_line ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isArchived: Boolean(row.is_archived),
    archivedAt: row.archived_at ?? null,
    role: row.project_members?.[0]?.role,
  }))
  if (!projects.length) {
    return {
      projects,
      batches: [],
      documents: [],
      records: [],
      reviews: [],
      audit: [],
      tasks: [],
      extractorConfigs: [...DEFAULT_EXTRACTOR_CONFIGS],
      promptVersions: [...DEFAULT_PROMPT_VERSIONS],
      aiLogs: [],
    }
  }
  const projectIds = projects.map((project) => project.id)
  const [
    batchesResult,
    documentsResult,
    jobsResult,
    recordsResult,
    reviewsResult,
    auditResult,
    tasksResult,
    configsResult,
    promptsResult,
    aiLogsResult,
  ] = await Promise.all([
    client.from('batches').select('*').in('project_id', projectIds).order('created_at', { ascending: false }),
    client.from('source_documents').select('*').in('project_id', projectIds).order('created_at', { ascending: false }),
    client.from('jobs').select('*').in('project_id', projectIds).order('created_at', { ascending: false }),
    client.from('property_records').select('*,extracted_attributes(attribute_key,value_json,confidence,evidence),source_documents(original_name)').in('project_id', projectIds).order('updated_at', { ascending: false }),
    client.from('review_tasks').select('*').in('project_id', projectIds).order('created_at', { ascending: false }),
    client.from('audit_events').select('*').in('project_id', projectIds).order('created_at', { ascending: false }).limit(500),
    client.from('document_tasks').select('*').in('project_id', projectIds).order('created_at', { ascending: false }),
    client.from('extractor_configs').select('*'),
    client.from('prompt_versions').select('*').order('extractor_key').order('version', { ascending: false }),
    client.from('ai_execution_logs').select('*').in('project_id', projectIds).order('created_at', { ascending: false }).limit(200),
  ])
  const firstError = [batchesResult, documentsResult, jobsResult, recordsResult, reviewsResult, auditResult].find((result) => result.error)?.error
  if (firstError) throw new Error(firstError.message)
  const latestJob = new Map<string, any>()
  for (const job of jobsResult.data ?? []) if (!latestJob.has(job.batch_id)) latestJob.set(job.batch_id, job)
  const tasks: DocumentTask[] = (tasksResult?.data ?? []).map((row: any) => ({
    id: row.id,
    jobId: row.job_id ?? null,
    batchId: row.batch_id,
    projectId: row.project_id,
    sourceDocumentId: row.source_document_id,
    propertyCode: row.property_code ?? null,
    extractorKey: row.extractor_key,
    status: row.status,
    dependencyStatus: row.dependency_status ?? 'ready',
    dependsOnExtractors: row.depends_on_extractors ?? [],
    attemptCount: row.attempt_count ?? 0,
    maxAttempts: row.max_attempts ?? 3,
    errorCode: row.error_code ?? null,
    errorMessage: row.error_message ?? null,
    exceptionCategory: row.exception_category ?? null,
    suggestedAction: row.suggested_action ?? null,
    tokensUsed: row.tokens_used ?? 0,
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
  const documents: SourceDocument[] = (documentsResult.data ?? []).map((row: any) => ({
    id: row.id,
    projectId: row.project_id,
    batchId: row.batch_id,
    name: row.original_name,
    kind: uiKind[row.kind] ?? 'sin_clasificar',
    size: row.size_bytes,
    uploadedAt: row.created_at,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sha256: row.sha256,
    propertyCode: row.property_code ?? null,
    duplicateDecision: row.duplicate_decision ?? null,
    duplicateOfDocumentId: row.duplicate_of_document_id ?? null,
    pageCount: row.page_count ?? null,
    isScanned: row.is_scanned ?? null,
    needsOcr: row.needs_ocr ?? null,
    ocrApplied: row.ocr_applied ?? null,
    textOrigin: row.text_origin ?? null,
    isEncrypted: row.is_encrypted ?? null,
    workingText: row.working_text ?? null,
    preprocessingStatus: row.preprocessing_status ?? null,
    exceptionReason: row.exception_reason ?? null,
  }))
  const batches: Batch[] = (batchesResult.data ?? []).map((row: any) => {
    const job = latestJob.get(row.id)
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      createdAt: row.created_at,
      jobState: uiJobState[job?.status ?? row.status] ?? 'pendiente',
      progress: job?.progress ?? 0,
      runId: job?.run_id ?? null,
      error: job?.error_message ?? null,
      attempts: job?.attempt_count ?? 0,
      documentCount: documents.filter((document) => document.batchId === row.id).length,
      expectedProperties: row.expected_properties ?? [],
      manifestSummary: row.manifest_summary ?? null,
      tasks: tasks.filter((task) => task.batchId === row.id),
    }
  })
  const records: PropertyRecord[] = (recordsResult.data ?? []).map((row: any) => ({ id: row.id, projectId: row.project_id, sourceDocumentId: row.source_document_id, name: row.canonical_name, folio: row.folio ?? 'POR VALIDAR', municipality: row.municipality ?? 'Por definir', reviewState: row.review_status === 'approved' ? 'aprobado' : row.review_status === 'returned' ? 'devuelto' : 'pendiente', confidence: Number(row.confidence ?? 0), updatedAt: row.updated_at, sourceName: row.source_documents?.original_name, fields: Object.fromEntries((row.extracted_attributes ?? []).map((attribute: any) => [attribute.attribute_key, typeof attribute.value_json === 'string' ? attribute.value_json : attribute.value_json?.value ?? JSON.stringify(attribute.value_json)])) }))
  const reviews: ReviewTask[] = (reviewsResult.data ?? []).map((row: any) => ({ id: row.id, recordId: row.property_record_id, title: row.title, reason: row.reason, severity: row.severity === 'high' ? 'alta' : row.severity === 'low' ? 'baja' : 'media', state: row.status === 'approved' ? 'aprobado' : row.status === 'returned' ? 'devuelto' : 'pendiente', createdAt: row.created_at, resolvedAt: row.resolved_at }))
  const audit: AuditEvent[] = (auditResult.data ?? []).map((row: any) => ({ id: String(row.id), projectId: row.project_id, at: row.created_at, action: row.action, detail: String(row.metadata?.detail ?? row.entity_type), actorId: row.actor_id }))

  const extractorConfigs: ExtractorConfig[] = (configsResult.data && configsResult.data.length > 0)
    ? configsResult.data.map((row: any) => ({
        extractorKey: row.extractor_key,
        provider: row.provider,
        primaryModel: row.primary_model,
        fallbackModel: row.fallback_model ?? null,
        fallbackProvider: row.fallback_provider ?? null,
        temperature: Number(row.temperature ?? 0),
        maxTokens: Number(row.max_tokens ?? 4096),
        timeoutSeconds: Number(row.timeout_seconds ?? 120),
        isEnabled: Boolean(row.is_enabled),
        updatedAt: row.updated_at,
      }))
    : [...DEFAULT_EXTRACTOR_CONFIGS]

  const promptVersions: PromptVersion[] = (promptsResult.data && promptsResult.data.length > 0)
    ? promptsResult.data.map((row: any) => ({
        id: row.id,
        extractorKey: row.extractor_key,
        version: row.version,
        name: row.name,
        prompt: row.prompt,
        schema: row.output_schema ?? {},
        active: Boolean(row.is_active),
        createdAt: row.created_at,
      }))
    : [...DEFAULT_PROMPT_VERSIONS]

  const aiLogs: AiExecutionLog[] = (aiLogsResult.data ?? []).map((row: any) => ({
    id: row.id,
    projectId: row.project_id ?? null,
    batchId: row.batch_id ?? null,
    taskId: row.task_id ?? null,
    documentId: row.document_id ?? null,
    extractorKey: row.extractor_key,
    promptVersionId: row.prompt_version_id ?? null,
    promptVersionNumber: row.prompt_version_number ?? null,
    requestedModel: row.requested_model,
    usedModel: row.used_model,
    fallbackTriggered: Boolean(row.fallback_triggered),
    fallbackReason: row.fallback_reason ?? null,
    status: row.status,
    latencyMs: Number(row.latency_ms ?? 0),
    promptTokens: Number(row.prompt_tokens ?? 0),
    completionTokens: Number(row.completion_tokens ?? 0),
    totalTokens: Number(row.total_tokens ?? 0),
    estimatedCostUsd: Number(row.estimated_cost_usd ?? 0),
    errorMessage: row.error_message ?? null,
    isTestRun: Boolean(row.is_test_run),
    createdAt: row.created_at,
  }))

  return { projects, batches, documents, records, reviews, audit, tasks, extractorConfigs, promptVersions, aiLogs }
}

export async function createRemoteProject(input: {
  name: string
  clientName?: string
  municipality: string
  department: string
  powerLine?: string
}) {
  const client = requireSupabase(); const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) throw new Error('La sesión expiró.')
  const payload: Record<string, any> = {
    name: input.name.trim(),
    municipality: input.municipality.trim(),
    department: input.department.trim(),
    created_by: user.id,
  }
  if (input.clientName?.trim()) payload.client_name = input.clientName.trim()
  if (input.powerLine?.trim()) payload.power_line = input.powerLine.trim()

  const { data, error } = await client.from('projects').insert(payload).select('id').single()
  if (error) throw new Error(error.message)

  await client.from('audit_events').insert({
    project_id: data.id,
    actor_id: user.id,
    action: 'project.created',
    entity_type: 'project',
    entity_id: data.id,
    metadata: {
      name: input.name,
      clientName: input.clientName,
      municipality: input.municipality,
      department: input.department,
      powerLine: input.powerLine,
      detail: `Expediente creado con metadatos completos para ${input.name}.`
    }
  })

  return data.id as string
}

export async function updateRemoteProject(projectId: string, input: {
  name?: string
  clientName?: string
  municipality?: string
  department?: string
  powerLine?: string
}) {
  const client = requireSupabase(); const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) throw new Error('La sesión expiró.')

  const payload: Record<string, any> = {}
  if (input.name !== undefined) payload.name = input.name.trim()
  if (input.clientName !== undefined) payload.client_name = input.clientName.trim() || null
  if (input.municipality !== undefined) payload.municipality = input.municipality.trim()
  if (input.department !== undefined) payload.department = input.department.trim()
  if (input.powerLine !== undefined) payload.power_line = input.powerLine.trim() || null

  const { error } = await client.from('projects').update(payload).eq('id', projectId)
  if (error) throw new Error(error.message)

  await client.from('audit_events').insert({
    project_id: projectId,
    actor_id: user.id,
    action: 'project.metadata_updated',
    entity_type: 'project',
    entity_id: projectId,
    metadata: { ...input, detail: 'Metadatos del expediente actualizados sin alterar extracciones históricas.' }
  })
}

export async function toggleArchiveRemoteProject(projectId: string, isArchived: boolean) {
  const client = requireSupabase(); const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) throw new Error('La sesión expiró.')

  const { error } = await client
    .from('projects')
    .update({
      is_archived: isArchived,
      archived_at: isArchived ? new Date().toISOString() : null,
    })
    .eq('id', projectId)

  if (error) throw new Error(error.message)

  await client.from('audit_events').insert({
    project_id: projectId,
    actor_id: user.id,
    action: isArchived ? 'project.archived' : 'project.restored',
    entity_type: 'project',
    entity_id: projectId,
    metadata: { isArchived, detail: isArchived ? 'Expediente archivado de forma recuperable.' : 'Expediente restaurado a estado activo.' }
  })
}

export interface BatchUploadItemInput {
  file: File
  kind: DocumentKind
  propertyCode?: string
  duplicateDecision?: 'omit' | 'replace' | 'keep_version'
  pageCount?: number | null
  isScanned?: boolean | null
  needsOcr?: boolean | null
  ocrApplied?: boolean | null
  textOrigin?: TextOrigin | null
  isEncrypted?: boolean | null
  workingText?: string | null
  preprocessingStatus?: PreprocessingStatus | null
  exceptionReason?: string | null
}

export async function uploadRemoteBatch(
  projectId: string,
  itemsOrFiles: Array<BatchUploadItemInput | File>,
  kindOrDefault: DocumentKind | ((progress: UploadProgress) => void),
  progressCallback?: (progress: UploadProgress) => void,
  expectedProperties: string[] = [],
  manifestSummary: any = null
) {
  // Normalizar items
  const onProgress = typeof kindOrDefault === 'function' ? kindOrDefault : progressCallback ?? (() => {})
  const defaultKind: DocumentKind = typeof kindOrDefault === 'string' ? kindOrDefault : 'sin_clasificar'

  const normalizedItems: BatchUploadItemInput[] = itemsOrFiles.map((entry) => {
    if (entry instanceof File) {
      return { file: entry, kind: defaultKind }
    }
    return entry
  })

  // Filtrar los que el operador decidió omitir (US-024)
  const activeItems = normalizedItems.filter((item) => item.duplicateDecision !== 'omit')
  if (!activeItems.length) {
    throw new Error('No hay archivos válidos para procesar (todos los seleccionados fueron omitidos).')
  }

  validateFiles(activeItems.map((it) => it.file))
  const client = requireSupabase(); const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) throw new Error('La sesión expiró.')

  const { data: batch, error: batchError } = await client
    .from('batches')
    .insert({
      project_id: projectId,
      name: `Lote ${new Date().toLocaleString('es-CO')}`,
      status: 'queued',
      created_by: user.id,
      expected_properties: expectedProperties,
      manifest_summary: manifestSummary ?? {},
    })
    .select('id')
    .single()

  if (batchError) throw new Error(batchError.message)
  const uploadedPaths: string[] = []

  try {
    for (let index = 0; index < activeItems.length; index += 1) {
      const item = activeItems[index]
      const { file, kind: itemKind, propertyCode, duplicateDecision } = item
      const path = `${projectId}/${batch.id}/${crypto.randomUUID()}-${cleanFileName(file.name)}`

      if (file.size > 6 * 1024 * 1024) {
        await uploadResumable(file, path, (percent) =>
          onProgress({ fileName: file.name, percent, completedFiles: index, totalFiles: activeItems.length })
        )
      } else {
        const { error } = await client.storage.from('source-documents').upload(path, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
          cacheControl: '3600',
        })
        if (error) throw error
      }
      uploadedPaths.push(path)

      const hash = await sha256(file)
      const resolvedKind = itemKind === 'sin_clasificar' ? classifyFileName(file.name) : itemKind

      const { error: documentError } = await client.from('source_documents').insert({
        project_id: projectId,
        batch_id: batch.id,
        storage_path: path,
        original_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        kind: dbKind[resolvedKind] || 'unclassified',
        sha256: hash,
        property_code: propertyCode || null,
        duplicate_decision: duplicateDecision || null,
        page_count: item.pageCount ?? null,
        is_scanned: item.isScanned ?? null,
        needs_ocr: item.needsOcr ?? null,
        ocr_applied: item.ocrApplied ?? false,
        text_origin: item.textOrigin ?? 'native',
        is_encrypted: item.isEncrypted ?? false,
        working_text: item.workingText ?? null,
        preprocessing_status: item.preprocessingStatus ?? 'ready',
        exception_reason: item.exceptionReason ?? null,
        created_by: user.id,
      })
      if (documentError) throw documentError
      onProgress({ fileName: file.name, percent: 100, completedFiles: index + 1, totalFiles: activeItems.length })
    }

    await client.from('audit_events').insert({
      project_id: projectId,
      actor_id: user.id,
      action: 'batch.uploaded',
      entity_type: 'batch',
      entity_id: batch.id,
      metadata: {
        detail: `${activeItems.length} documento(s) cargado(s) con manifiesto verificado y metadatos preprocesados.`,
        expectedCount: expectedProperties.length,
        receivedCount: activeItems.length,
      },
    })
    return batch.id as string
  } catch (error) {
    // US-035: Compensatory cleanup on failure - remove storage objects, partial documents, and batch
    if (uploadedPaths.length) {
      try {
        await client.storage.from('source-documents').remove(uploadedPaths)
      } catch (storageCleanupErr) {
        console.warn('Compensatory cleanup: Failed to remove some storage files', storageCleanupErr)
      }
    }
    try {
      await client.from('source_documents').delete().eq('batch_id', batch.id)
    } catch (dbCleanupErr) {
      console.warn('Compensatory cleanup: Failed to delete partial documents', dbCleanupErr)
    }
    try {
      await client.from('batches').delete().eq('id', batch.id)
    } catch (batchCleanupErr) {
      console.warn('Compensatory cleanup: Failed to delete batch', batchCleanupErr)
    }
    throw new Error(error instanceof Error ? error.message : 'Falló la carga del lote.')
  }
}

export function classifyFileName(name: string): DocumentKind {
  const lower = name.toLowerCase()
  if (/(estudio|titulo|título|matricula|matrícula)/.test(lower)) return 'estudio_titulos'
  if (/(lindero|cabida|linderos|mojon)/.test(lower)) return 'linderos'
  if (/(plano|topogr|cartogr|levantamiento)/.test(lower)) return 'plano'
  if (/(oferta|negocia|avalúo|avaluo|servidumbre)/.test(lower)) return 'negociacion'
  return 'sin_clasificar'
}

export async function startRemoteBatch(projectId: string, batchId: string) {
  const { data, error } = await requireSupabase().functions.invoke('create-batch-job', { body: { projectId, batchId } })
  if (error) throw new Error(error.message)
  return data as { jobId: string; runId: string; status: string }
}

export async function cancelRemoteBatch(batchId: string) {
  const client = requireSupabase()
  const { data: job, error } = await client.from('jobs').select('id').eq('batch_id', batchId).in('status', ['queued', 'running']).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error(error.message)
  if (job) { const result = await client.from('jobs').update({ status: 'cancelled', completed_at: new Date().toISOString() }).eq('id', job.id); if (result.error) throw new Error(result.error.message) }
  const batchResult = await client.from('batches').update({ status: 'cancelled' }).eq('id', batchId)
  if (batchResult.error) throw new Error(batchResult.error.message)
}

export async function updateRemoteReview(recordId: string, state: ReviewState) {
  const client = requireSupabase(); const { data: { user } } = await client.auth.getUser(); if (!user) throw new Error('La sesión expiró.')
  const reviewStatus = dbReview[state]
  const { data: record, error } = await client.from('property_records').update({ review_status: reviewStatus }).eq('id', recordId).select('project_id,canonical_name').single()
  if (error) throw new Error(error.message)
  const taskResult = await client.from('review_tasks').update({ status: reviewStatus, resolved_by: user.id, resolved_at: new Date().toISOString() }).eq('property_record_id', recordId).eq('status', 'pending')
  if (taskResult.error) throw new Error(taskResult.error.message)
  await client.from('audit_events').insert({ project_id: record.project_id, actor_id: user.id, action: `review.${reviewStatus}`, entity_type: 'property_record', entity_id: recordId, metadata: { detail: `${record.canonical_name}: ${reviewStatus}` } })
}

export async function updateRemoteAttributes(
  recordId: string,
  fields: Record<string, string>,
  changeMotive?: string
) {
  const client = requireSupabase()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('La sesión expiró.')

  // US-114: Validar estado del registro y permisos antes de modificar
  const { data: currentRecord, error: checkError } = await client
    .from('property_records')
    .select('id, project_id, canonical_name, review_status')
    .eq('id', recordId)
    .single()
  if (checkError) throw new Error(checkError.message)

  if (currentRecord.review_status === 'approved') {
    const { data: member } = await client
      .from('project_members')
      .select('role')
      .eq('project_id', currentRecord.project_id)
      .eq('user_id', user.id)
      .single()
    const role = (member?.role || '').toLowerCase()
    const isPrivileged = role === 'owner' || role === 'administrador' || role === 'aprobador'
    if (!isPrivileged) {
      throw new Error('El predio ya está aprobado. Solo un Aprobador o Administrador puede modificar sus atributos.')
    }
  }

  const { data: attributes, error: readError } = await client
    .from('extracted_attributes')
    .select('id,attribute_key,value_json')
    .eq('property_record_id', recordId)
  if (readError) throw new Error(readError.message)

  const effectiveMotive = changeMotive || 'Corrección de atributos en mesa de revisión'
  for (const attribute of attributes ?? []) {
    if (!(attribute.attribute_key in fields)) continue
    const prevVal = attribute.value_json?.value ?? ''
    const { error } = await client.from('extracted_attributes').update({
      value_json: {
        value: fields[attribute.attribute_key],
        previous_value: prevVal,
        change_motive: effectiveMotive,
        corrected_by: user.id,
        corrected_at: new Date().toISOString()
      }
    }).eq('id', attribute.id)
    if (error) throw new Error(error.message)
  }

  const newStatus = currentRecord.review_status === 'approved' ? 'approved' : 'pending'
  const { data: record, error: recordError } = await client
    .from('property_records')
    .update({ review_status: newStatus })
    .eq('id', recordId)
    .select('project_id,canonical_name')
    .single()
  if (recordError) throw new Error(recordError.message)

  await client.from('audit_events').insert({
    project_id: record.project_id,
    actor_id: user.id,
    action: 'record.corrected',
    entity_type: 'property_record',
    entity_id: recordId,
    metadata: {
      detail: `${record.canonical_name}: atributos corregidos`,
      motive: effectiveMotive,
      keys: Object.keys(fields)
    }
  })
}

export async function getSignedDocumentUrl(storagePath: string) {
  const { data, error } = await requireSupabase().storage.from('source-documents').createSignedUrl(storagePath, 300)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

export async function listPromptVersions(): Promise<PromptVersion[]> {
  const { data, error } = await requireSupabase().from('prompt_versions').select('*').order('extractor_key').order('version', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row: any) => ({ id: row.id, extractorKey: row.extractor_key, version: row.version, name: row.name, prompt: row.prompt, schema: row.output_schema, active: row.is_active, createdAt: row.created_at }))
}

export async function listProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('project_members')
    .select('project_id, user_id, role, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row: any) => ({
    projectId: row.project_id,
    userId: row.user_id,
    role: row.role as ProjectRole,
    createdAt: row.created_at,
    isActive: true,
  }))
}

export async function addProjectMember(projectId: string, userId: string, role: ProjectRole): Promise<void> {
  const client = requireSupabase()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('La sesión expiró.')

  const { error } = await client
    .from('project_members')
    .insert({ project_id: projectId, user_id: userId, role })

  if (error) throw new Error(error.message)

  await client.from('audit_events').insert({
    project_id: projectId,
    actor_id: user.id,
    action: 'member.added',
    entity_type: 'project_member',
    entity_id: projectId,
    metadata: { userId, role, detail: `Usuario añadido con rol de mínimo privilegio: ${role}` }
  })
}

export async function updateMemberRole(projectId: string, userId: string, role: ProjectRole): Promise<void> {
  const client = requireSupabase()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('La sesión expiró.')

  const { error } = await client
    .from('project_members')
    .update({ role })
    .eq('project_id', projectId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)

  await client.from('audit_events').insert({
    project_id: projectId,
    actor_id: user.id,
    action: 'member.role_updated',
    entity_type: 'project_member',
    entity_id: projectId,
    metadata: { userId, role, detail: `Rol actualizado a ${role}` }
  })
}

export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  const client = requireSupabase()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('La sesión expiró.')

  const { error } = await client
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)

  await client.from('audit_events').insert({
    project_id: projectId,
    actor_id: user.id,
    action: 'member.removed',
    entity_type: 'project_member',
    entity_id: projectId,
    metadata: { userId, detail: 'Acceso revocado del expediente' }
  })
}

export async function inviteOrRecoverUser(input: {
  action: 'invite' | 'recover' | 'deactivate'
  email: string
  role?: ProjectRole
  projectId?: string
}): Promise<{ success: boolean; message: string }> {
  const client = requireSupabase()
  const { data, error } = await client.functions.invoke('manage-users', {
    body: input
  })

  if (error) throw new Error(error.message)
  return data as { success: boolean; message: string }
}

export async function reprocessRemoteTask(taskId: string, projectId: string): Promise<void> {
  const client = requireSupabase()
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) throw new Error('La sesión expiró.')

  const { error } = await client
    .from('document_tasks')
    .update({
      status: 'queued',
      dependency_status: 'ready',
      attempt_count: 0,
      error_code: null,
      error_message: null,
      exception_category: null,
      suggested_action: null,
      started_at: null,
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)

  if (error) throw new Error(error.message)

  await client.from('audit_events').insert({
    project_id: projectId,
    actor_id: user.id,
    action: 'task.reprocessed',
    entity_type: 'document_task',
    entity_id: taskId,
    metadata: { detail: 'Reproceso selectivo de tarea solicitado por el operador.' },
  })
}

export async function updateRemoteExtractorConfig(config: ExtractorConfig): Promise<void> {
  const client = requireSupabase()
  const { data: { user } } = await client.auth.getUser()

  const { error } = await client
    .from('extractor_configs')
    .upsert({
      extractor_key: config.extractorKey,
      provider: config.provider,
      primary_model: config.primaryModel,
      fallback_model: config.fallbackModel ?? null,
      fallback_provider: config.fallbackProvider ?? null,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      timeout_seconds: config.timeoutSeconds,
      is_enabled: config.isEnabled,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    })

  if (error) throw new Error(error.message)
}

export async function createRemotePromptVersion(input: {
  extractorKey: 'title_study' | 'plan' | 'negotiation'
  name: string
  prompt: string
  schema: Record<string, unknown>
  setActive?: boolean
}): Promise<PromptVersion> {
  const client = requireSupabase()
  const { data: { user } } = await client.auth.getUser()

  // Buscar última versión existente
  const { data: existing } = await client
    .from('prompt_versions')
    .select('version')
    .eq('extractor_key', input.extractorKey)
    .order('version', { ascending: false })
    .limit(1)

  const nextVersionNumber = ((existing?.[0]?.version as number) ?? 0) + 1
  const shouldBeActive = input.setActive ?? true

  if (shouldBeActive) {
    await client
      .from('prompt_versions')
      .update({ is_active: false })
      .eq('extractor_key', input.extractorKey)
  }

  const { data, error } = await client
    .from('prompt_versions')
    .insert({
      extractor_key: input.extractorKey,
      version: nextVersionNumber,
      name: input.name.trim(),
      prompt: input.prompt.trim(),
      output_schema: input.schema,
      is_active: shouldBeActive,
      created_by: user?.id ?? null,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)

  return {
    id: data.id,
    extractorKey: data.extractor_key,
    version: data.version,
    name: data.name,
    prompt: data.prompt,
    schema: data.output_schema ?? {},
    active: Boolean(data.is_active),
    createdAt: data.created_at,
  }
}

export async function activateRemotePromptVersion(versionId: string, extractorKey: string): Promise<void> {
  const client = requireSupabase()

  // Desactivar las demás versiones del mismo extractor
  await client
    .from('prompt_versions')
    .update({ is_active: false })
    .eq('extractor_key', extractorKey)

  // Activar la versión seleccionada
  const { error } = await client
    .from('prompt_versions')
    .update({ is_active: true })
    .eq('id', versionId)

  if (error) throw new Error(error.message)
}

export async function recordRemoteAiExecutionLog(log: AiExecutionLog): Promise<void> {
  const client = requireSupabase()

  const { error } = await client.from('ai_execution_logs').insert({
    id: log.id.startsWith('ailog-') ? undefined : log.id,
    project_id: log.projectId ?? null,
    batch_id: log.batchId ?? null,
    task_id: log.taskId ?? null,
    document_id: log.documentId ?? null,
    extractor_key: log.extractorKey,
    prompt_version_id: log.promptVersionId ?? null,
    prompt_version_number: log.promptVersionNumber ?? null,
    requested_model: log.requestedModel,
    used_model: log.usedModel,
    fallback_triggered: log.fallbackTriggered,
    fallback_reason: log.fallbackReason ?? null,
    status: log.status,
    latency_ms: log.latencyMs,
    prompt_tokens: log.promptTokens,
    completion_tokens: log.completionTokens,
    total_tokens: log.totalTokens,
    estimated_cost_usd: log.estimatedCostUsd,
    error_message: log.errorMessage ?? null,
    is_test_run: log.isTestRun,
  })

  if (error) throw new Error(error.message)
}

export function subscribeToProject(projectId: string, onChange: () => void) {
  const client = requireSupabase()
  const channel = client.channel(`project:${projectId}`)
  for (const table of [
    'batches',
    'source_documents',
    'jobs',
    'property_records',
    'review_tasks',
    'audit_events',
    'project_members',
    'document_tasks',
    'extractor_configs',
    'prompt_versions',
    'ai_execution_logs',
  ]) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
  }
  channel.subscribe()
  return () => { client.removeChannel(channel) }
}

