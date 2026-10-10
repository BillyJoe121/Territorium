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
  Project,
  PromptVersion,
  PropertyRecord,
  ReviewTask,
  SourceDocument,
} from '../types'
const uiKind: Record<string, DocumentKind> = { title_study: 'estudio_titulos', plan: 'plano', boundaries: 'linderos', negotiation: 'negociacion', support: 'soporte', unclassified: 'sin_clasificar' }
const uiJobState: Record<string, JobState> = { queued: 'pendiente', running: 'en_proceso', needs_review: 'requiere_revision', completed: 'completado', failed: 'fallido', cancelled: 'cancelado' }

const PROJECT_COLUMNS = 'id,name,client_name,municipality,department,power_line,is_archived,archived_at,created_at,updated_at,project_members!inner(role)'
const MISSING_RESPONSIBLE_COLUMN_MESSAGE =
  'Falta la columna "responsible_name" en la tabla "projects". Ejecuta la migración 20261004120000_project_responsible_name.sql en el editor SQL de Supabase.'

/** Postgres (42703) o PostgREST (PGRST204) indican que la columna aún no existe. */
export function isMissingResponsibleColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return (error.code === '42703' || error.code === 'PGRST204') && (error.message ?? '').includes('responsible_name')
}

export async function loadPlatformState(): Promise<PlatformState> {
  const client = requireSupabase()
  let projectsResult: { data: any[] | null; error: { code?: string; message: string } | null } = await client
    .from('projects')
    .select(`${PROJECT_COLUMNS},responsible_name`)
    .order('created_at', { ascending: false })
  // Tolera bases de datos donde la migración del responsable aún no se ha aplicado.
  if (isMissingResponsibleColumnError(projectsResult.error)) {
    projectsResult = await client.from('projects').select(PROJECT_COLUMNS).order('created_at', { ascending: false })
  }
  if (projectsResult.error) throw new Error(projectsResult.error.message)
  const projects: Project[] = (projectsResult.data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    clientName: row.client_name ?? undefined,
    municipality: row.municipality ?? 'Sin definir',
    department: row.department ?? 'Sin definir',
    powerLine: row.power_line ?? undefined,
    responsibleName: row.responsible_name ?? undefined,
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
    client.from('property_records').select('*,extracted_attributes(attribute_key,value_json,confidence,evidence)').in('project_id', projectIds).order('updated_at', { ascending: false }),
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
  const docNameMap = new Map<string, string>()
  for (const doc of documentsResult.data ?? []) {
    if (doc.id) docNameMap.set(doc.id, doc.original_name)
  }
  const records: PropertyRecord[] = (recordsResult.data ?? []).map((row: any) => ({
    id: row.id,
    projectId: row.project_id,
    sourceDocumentId: row.source_document_id,
    name: row.canonical_name,
    folio: row.folio ?? 'POR VALIDAR',
    municipality: row.municipality ?? 'Por definir',
    reviewState: row.review_status === 'approved' ? 'aprobado' : row.review_status === 'returned' ? 'devuelto' : 'pendiente',
    confidence: Number(row.confidence ?? 0),
    updatedAt: row.updated_at,
    sourceName: row.source_document_id ? docNameMap.get(row.source_document_id) ?? row.source_documents?.original_name : row.source_documents?.original_name,
    fields: Object.fromEntries(
      (row.extracted_attributes ?? []).map((attribute: any) => [
        attribute.attribute_key,
        typeof attribute.value_json === 'string' ? attribute.value_json : attribute.value_json?.value ?? JSON.stringify(attribute.value_json),
      ])
    ),
  }))
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
  responsibleName: string
}) {
  if (!input.responsibleName?.trim()) {
    throw new Error('Debes registrar el nombre del profesional responsable del proyecto.')
  }
  const client = requireSupabase()
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) {
    throw new Error('Debes iniciar sesión para crear un proyecto.')
  }
  const projectId = crypto.randomUUID()
  const payload: Record<string, any> = {
    id: projectId,
    name: input.name.trim(),
    municipality: input.municipality.trim(),
    department: input.department.trim(),
    created_by: user.id,
  }
  if (input.clientName?.trim()) payload.client_name = input.clientName.trim()
  payload.responsible_name = input.responsibleName.trim()

  const { error } = await client.from('projects').insert(payload)
  if (error) {
    if (isMissingResponsibleColumnError(error)) throw new Error(MISSING_RESPONSIBLE_COLUMN_MESSAGE)
    if (error.message.includes('row-level security') || error.code === '42501') {
      throw new Error(
        'Error de seguridad RLS en la tabla "projects". Asegúrate de ejecutar el script de actualización de políticas RLS en el editor SQL de Supabase.'
      )
    }
    throw new Error(error.message)
  }

  await client.from('audit_events').insert({
    project_id: projectId,
    actor_id: user.id,
    action: 'project.created',
    entity_type: 'project',
    entity_id: projectId,
    metadata: {
      name: input.name,
      clientName: input.clientName,
      municipality: input.municipality,
      department: input.department,
      responsibleName: input.responsibleName,
      detail: `Proyecto creado por ${input.responsibleName} para ${input.name}.`
    }
  })

  return projectId
}

export async function updateRemoteProject(projectId: string, input: {
  name?: string
  clientName?: string
  municipality?: string
  department?: string
  responsibleName?: string
}) {
  const client = requireSupabase(); const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) throw new Error('La sesión expiró.')

  const payload: Record<string, any> = {}
  if (input.name !== undefined) payload.name = input.name.trim()
  if (input.clientName !== undefined) payload.client_name = input.clientName.trim() || null
  if (input.municipality !== undefined) payload.municipality = input.municipality.trim()
  if (input.department !== undefined) payload.department = input.department.trim()
  if (input.responsibleName !== undefined) {
    if (!input.responsibleName.trim()) throw new Error('El profesional responsable es obligatorio.')
    payload.responsible_name = input.responsibleName.trim()
  }

  const { error } = await client.from('projects').update(payload).eq('id', projectId)
  if (isMissingResponsibleColumnError(error)) throw new Error(MISSING_RESPONSIBLE_COLUMN_MESSAGE)
  if (error) throw new Error(error.message)

  await client.from('audit_events').insert({
    project_id: projectId,
    actor_id: user.id,
    action: 'project.metadata_updated',
    entity_type: 'project',
    entity_id: projectId,
    metadata: { ...input, detail: 'Metadatos del proyecto actualizados sin alterar extracciones históricas.' }
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

export async function recordRemoteAiExecutionLog(log: AiExecutionLog): Promise<void> {
  const client = requireSupabase()
  const isUuid = (val?: string | null) =>
    Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val))

  const payload = {
    id: isUuid(log.id) ? log.id : undefined,
    project_id: isUuid(log.projectId) ? log.projectId : null,
    batch_id: isUuid(log.batchId) ? log.batchId : null,
    task_id: isUuid(log.taskId) ? log.taskId : null,
    document_id: isUuid(log.documentId) ? log.documentId : null,
    extractor_key: log.extractorKey,
    prompt_version_id: isUuid(log.promptVersionId) ? log.promptVersionId : null,
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
  }

  let { error } = await client.from('ai_execution_logs').insert(payload)
  if (error && (error.code === '23503' || error.message?.includes('foreign key')) && payload.document_id) {
    const retryResult = await client.from('ai_execution_logs').insert({ ...payload, document_id: null })
    error = retryResult.error
  }

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
