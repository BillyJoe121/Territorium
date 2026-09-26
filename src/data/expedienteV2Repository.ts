import { requireSupabase } from '../lib/supabase'
import { requestExpedienteAnalysis } from './expedienteUpload'
import {
  expedienteGroupKeys,
  type ExpedienteConsolidationStatus,
  type ExpedienteFinalDocumentStatus,
  type ExpedienteGroupKey,
  type ExpedienteGroupStatus,
} from '../lib/expedienteWorkflow'
import { consolidateApprovedGroups } from '../lib/expedienteConsolidation'

export interface ExpedientePropertyIdentity {
  id: string
  projectId: string
  version: number
  folio: string | null
  cadastralId: string | null
  propertyName: string
  municipality: string
  department: string
  village: string | null
}

export interface ExpedienteDocumentGroupSnapshot {
  id: string
  projectId: string
  key: ExpedienteGroupKey
  status: ExpedienteGroupStatus
  inputVersion: number
  approvedResultVersionId: string | null
  currentNegotiationFileId: string | null
}

export interface ExpedienteWorkflowSnapshot {
  identity: ExpedientePropertyIdentity
  groups: Record<ExpedienteGroupKey, ExpedienteDocumentGroupSnapshot>
  consolidation: { status: ExpedienteConsolidationStatus; approvedResultVersionId: string | null }
  finalDocument: { status: ExpedienteFinalDocumentStatus }
}

export interface ExpedienteResultVersionSnapshot {
  id: string
  projectId: string
  scope: 'group' | 'consolidated'
  groupId: string | null
  versionNumber: number
  editRevision: number
  sourceInputVersion?: number | null
  status: 'draft' | 'approved' | 'superseded' | 'stale'
  payload: Record<string, unknown>
  changeSummary: string | null
  createdAt: string
  updatedAt: string
}

export interface ExpedienteDocumentVersionSnapshot {
  id: string
  projectId: string
  sourceConsolidationVersionId: string
  parentDocumentVersionId: string | null
  versionNumber: number
  content: Record<string, unknown>
  changeSummary: string | null
  createdAt: string
  finalizedAt: string | null
}

export interface ExpedienteDocumentAiRevisionSnapshot {
  id: string
  projectId: string
  sourceDocumentVersionId: string
  userComment: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'accepted' | 'discarded'
  proposedContent: Record<string, unknown> | null
  errorCode: string | null
  createdAt: string
}

export interface QueueGroupAnalysisInput {
  groupId: string
  idempotencyKey: string
  extractorSnapshot?: Record<string, unknown>
  promptSnapshot?: Record<string, unknown>
  modelSnapshot?: Record<string, unknown>
}

export class EditConflictError extends Error {
  constructor(message: string, public serverVersion: number) {
    super(message)
    this.name = 'EditConflictError'
  }
}

/**
 * Contrato compartido por el repositorio demo y el repositorio Supabase (Fase 5).
 */
export interface ExpedienteV2Repository {
  load(projectId: string): Promise<ExpedienteWorkflowSnapshot>
  queueGroupAnalysis(input: QueueGroupAnalysisInput): Promise<string>
  saveDraft(
    resultVersionId: string,
    payload: Record<string, unknown>,
    changeSummary?: string,
    expectedVersionNumber?: number,
  ): Promise<number>
  approveResult(resultVersionId: string, note?: string): Promise<string>
  getResultVersion(groupId: string, versionNumber?: number): Promise<ExpedienteResultVersionSnapshot | null>
  getConsolidatedResultVersion(projectId: string, versionNumber?: number): Promise<ExpedienteResultVersionSnapshot | null>
  reprocessGroup(groupId: string): Promise<string>
  consolidate(projectId: string, userId?: string): Promise<string>
  getCurrentDocument(projectId: string): Promise<ExpedienteDocumentVersionSnapshot | null>
  saveDocument(projectId: string, content: Record<string, unknown>, expectedCurrentDocumentId: string | null, changeSummary?: string): Promise<ExpedienteDocumentVersionSnapshot>
  queueDocumentAiRevision(documentVersionId: string, comment: string): Promise<string>
  getDocumentAiRevision(revisionId: string): Promise<ExpedienteDocumentAiRevisionSnapshot | null>
  acceptDocumentAiRevision(revisionId: string): Promise<ExpedienteDocumentVersionSnapshot>
  discardDocumentAiRevision(revisionId: string): Promise<void>
  finalizeDocument(documentVersionId: string): Promise<void>
}

export type ExpedienteV2RepositoryMode = 'demo' | 'supabase'

export interface CreateExpedienteV2RepositoryOptions {
  mode: ExpedienteV2RepositoryMode
  demoSnapshots?: Map<string, ExpedienteWorkflowSnapshot>
  demoResults?: Map<string, ExpedienteResultVersionSnapshot>
}

function asGroupKey(value: string): ExpedienteGroupKey {
  if ((expedienteGroupKeys as readonly string[]).includes(value)) return value as ExpedienteGroupKey
  throw new Error(`Grupo documental v2 desconocido: ${value}`)
}

function assertCompleteGroups(groups: ExpedienteDocumentGroupSnapshot[]): Record<ExpedienteGroupKey, ExpedienteDocumentGroupSnapshot> {
  const byKey = Object.fromEntries(groups.map((group) => [group.key, group])) as Partial<Record<ExpedienteGroupKey, ExpedienteDocumentGroupSnapshot>>
  for (const key of expedienteGroupKeys) {
    if (!byKey[key]) throw new Error(`El expediente no tiene inicializado el grupo ${key}. Ejecuta el backfill v2.`)
  }
  return byKey as Record<ExpedienteGroupKey, ExpedienteDocumentGroupSnapshot>
}

export class SupabaseExpedienteV2Repository implements ExpedienteV2Repository {
  async load(projectId: string): Promise<ExpedienteWorkflowSnapshot> {
    const client = requireSupabase()
    const [identityResult, groupsResult, consolidationResult, documentResult] = await Promise.all([
      client.from('expediente_property_identities').select('id,project_id,identity_version,folio,cadastral_id,property_name,municipality,department,village').eq('project_id', projectId).single(),
      client.from('expediente_document_groups').select('id,project_id,group_key,status,input_version,approved_result_version_id,current_negotiation_file_id').eq('project_id', projectId),
      client.from('expediente_consolidations').select('status,approved_result_version_id').eq('project_id', projectId).single(),
      client.from('expediente_final_document_states').select('status,current_document_version_id').eq('project_id', projectId).single(),
    ])

    const firstError = [identityResult, groupsResult, consolidationResult, documentResult].find((result) => result.error)?.error
    if (firstError) throw new Error(firstError.message)

    const identity = identityResult.data
    if (!identity) throw new Error('El expediente no tiene identidad predial v2. Ejecuta el backfill v2.')
    if (!consolidationResult.data || !documentResult.data) {
      throw new Error('El expediente no tiene inicializados sus estados v2. Ejecuta el backfill v2.')
    }

    const groups = assertCompleteGroups((groupsResult.data ?? []).map((group: any) => ({
      id: group.id,
      projectId: group.project_id,
      key: asGroupKey(group.group_key),
      status: group.status as ExpedienteGroupStatus,
      inputVersion: group.input_version,
      approvedResultVersionId: group.approved_result_version_id,
      currentNegotiationFileId: group.current_negotiation_file_id,
    })))

    return {
      identity: {
        id: identity.id,
        projectId: identity.project_id,
        version: identity.identity_version,
        folio: identity.folio,
        cadastralId: identity.cadastral_id,
        propertyName: identity.property_name,
        municipality: identity.municipality,
        department: identity.department,
        village: identity.village,
      },
      groups,
      consolidation: {
        status: consolidationResult.data.status as ExpedienteConsolidationStatus,
        approvedResultVersionId: consolidationResult.data.approved_result_version_id ?? null,
      },
      finalDocument: { status: documentResult.data.status as ExpedienteFinalDocumentStatus },
    }
  }

  async queueGroupAnalysis(input: QueueGroupAnalysisInput): Promise<string> {
    return requestExpedienteAnalysis({
      groupId: input.groupId,
      idempotencyKey: input.idempotencyKey,
      extractorSnapshot: input.extractorSnapshot,
      promptSnapshot: input.promptSnapshot,
      modelSnapshot: input.modelSnapshot,
    })
  }

  async saveDraft(
    resultVersionId: string,
    payload: Record<string, unknown>,
    changeSummary?: string,
    expectedVersionNumber?: number,
  ): Promise<number> {
    const client = requireSupabase()
    if (expectedVersionNumber === undefined) throw new Error('Falta el token de edición para guardar el borrador.')
    const { data, error } = await client.rpc('save_expediente_result_draft', {
      p_result_version_id: resultVersionId,
      p_payload: payload,
      p_change_summary: changeSummary ?? null,
      p_expected_edit_revision: expectedVersionNumber,
    })
    if (error) {
      if (error.code === '40001' || error.message.includes('EDIT_CONFLICT')) {
        const match = error.message.match(/(\d+)/)
        throw new EditConflictError('Otro revisor guardó cambios antes que tú. Recarga el resultado antes de continuar.', Number(match?.[1] ?? 0))
      }
      throw new Error(error.message)
    }
    return Number(data)
  }

  async approveResult(resultVersionId: string, note?: string): Promise<string> {
    const client = requireSupabase()
    const { data, error } = await client.rpc('approve_expediente_result_version', {
      p_result_version_id: resultVersionId,
      p_note: note ?? null,
    })
    if (error) throw new Error(error.message)
    return String(data)
  }

  async getResultVersion(groupId: string, versionNumber?: number): Promise<ExpedienteResultVersionSnapshot | null> {
    const client = requireSupabase()
    let query = client
      .from('expediente_result_versions')
      .select('*')
      .eq('group_id', groupId)

    if (versionNumber !== undefined) {
      query = query.eq('version_number', versionNumber)
    } else {
      query = query.order('version_number', { ascending: false }).limit(1)
    }

    const { data, error } = await query.maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null

    return {
      id: data.id,
      projectId: data.project_id,
      scope: data.scope,
      groupId: data.group_id,
      versionNumber: data.version_number,
      editRevision: data.edit_revision ?? 1,
      sourceInputVersion: data.source_input_version,
      status: data.status,
      payload: data.payload ?? {},
      changeSummary: data.change_summary,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  }

  async getConsolidatedResultVersion(projectId: string, versionNumber?: number): Promise<ExpedienteResultVersionSnapshot | null> {
    const client = requireSupabase()
    let query = client
      .from('expediente_result_versions')
      .select('*')
      .eq('project_id', projectId)
      .eq('scope', 'consolidated')

    if (versionNumber !== undefined) {
      query = query.eq('version_number', versionNumber)
    } else {
      query = query.order('version_number', { ascending: false }).limit(1)
    }

    const { data, error } = await query.maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null

    return {
      id: data.id,
      projectId: data.project_id,
      scope: data.scope,
      groupId: data.group_id,
      versionNumber: data.version_number,
      editRevision: data.edit_revision ?? 1,
      status: data.status,
      payload: data.payload ?? {},
      changeSummary: data.change_summary,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  }

  async reprocessGroup(groupId: string): Promise<string> {
    const client = requireSupabase()
    try {
      await client
        .from('expediente_document_groups')
        .update({ status: 'stale' })
        .eq('id', groupId)
        .in('status', ['review_ready', 'approved'])
    } catch {
      // Direct update may be restricted by RLS; the RPC handles re-processing transition
    }

    return this.queueGroupAnalysis({
      groupId,
      idempotencyKey: `expediente-v2:${groupId}:${crypto.randomUUID()}`,
      extractorSnapshot: { phase: '3-and-4', validation: 'binary-integrity-v1' },
      promptSnapshot: { schema: { phase: '4-orchestrated' } },
      modelSnapshot: { provider: 'default', model: 'pipeline-phase4' },
    })
  }

  async consolidate(projectId: string, userId?: string): Promise<string> {
    const client = requireSupabase()

    // 1. Fetch the 3 approved versions
    const { data: groups, error: groupsErr } = await client
      .from('expediente_document_groups')
      .select('id, group_key, status, approved_result_version_id')
      .eq('project_id', projectId)

    if (groupsErr) throw new Error(groupsErr.message)
    if (!groups || groups.length < 3) throw new Error('El expediente no tiene los 3 grupos configurados.')

    const approvedGroups = groups.filter((g) => g.status === 'approved' && g.approved_result_version_id)
    if (approvedGroups.length !== 3) {
      throw new Error(`Se requieren los 3 grupos aprobados para consolidar. Actualmente aprobados: ${approvedGroups.length}/3.`)
    }

    const titlesGroup = groups.find((g) => g.group_key === 'titles')!
    const plansGroup = groups.find((g) => g.group_key === 'plans')!
    const negGroup = groups.find((g) => g.group_key === 'negotiation')!

    const [tRes, pRes, nRes] = await Promise.all([
      client.from('expediente_result_versions').select('*').eq('id', titlesGroup.approved_result_version_id).single(),
      client.from('expediente_result_versions').select('*').eq('id', plansGroup.approved_result_version_id).single(),
      client.from('expediente_result_versions').select('*').eq('id', negGroup.approved_result_version_id).single(),
    ])

    if (tRes.error || pRes.error || nRes.error) {
      throw new Error('Error al recuperar las versiones aprobadas para consolidación.')
    }

    // 2. Consolidate deterministically
    const masterRecord = consolidateApprovedGroups({
      titlesApprovedPayload: tRes.data.payload ?? {},
      titlesVersionId: tRes.data.id,
      plansApprovedPayload: pRes.data.payload ?? {},
      plansVersionId: pRes.data.id,
      negotiationApprovedPayload: nRes.data.payload ?? {},
      negotiationVersionId: nRes.data.id,
      userId,
    })

    // 3. Get next consolidated version number
    const { data: existingCons } = await client
      .from('expediente_result_versions')
      .select('version_number')
      .eq('project_id', projectId)
      .eq('scope', 'consolidated')
      .order('version_number', { ascending: false })
      .limit(1)

    const nextVer = existingCons && existingCons.length > 0 ? existingCons[0].version_number + 1 : 1

    const userRes = await client.auth.getUser()
    const currentUserId = userId || userRes.data?.user?.id

    // 4. Try save_expediente_consolidation_version RPC, fallback to direct insert with created_by
    const rpcRes = await client.rpc('save_expediente_consolidation_version', {
      p_project_id: projectId,
      p_payload: masterRecord as unknown as Record<string, unknown>,
      p_change_summary: `Consolidación automática v${nextVer}`,
    })

    if (!rpcRes.error && rpcRes.data) {
      return String(rpcRes.data)
    }

    // Direct insert fallback
    const { data: created, error: insertErr } = await client
      .from('expediente_result_versions')
      .insert({
        project_id: projectId,
        scope: 'consolidated',
        group_id: null,
        version_number: nextVer,
        status: 'draft',
        payload: masterRecord as unknown as Record<string, unknown>,
        change_summary: `Consolidación automática v${nextVer}`,
        created_by: currentUserId,
      })
      .select('id')
      .single()

    if (insertErr) throw new Error(insertErr.message)

    // 5. Update expediente_consolidations status to review_ready
    await client
      .from('expediente_consolidations')
      .update({ status: 'review_ready', updated_at: new Date().toISOString() })
      .eq('project_id', projectId)

    return created.id
  }

  async getCurrentDocument(projectId: string): Promise<ExpedienteDocumentVersionSnapshot | null> {
    const client = requireSupabase()
    const { data, error } = await client
      .from('expediente_document_versions')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_current', true)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? mapDocumentVersion(data) : null
  }

  async saveDocument(projectId: string, content: Record<string, unknown>, expectedCurrentDocumentId: string | null, changeSummary?: string): Promise<ExpedienteDocumentVersionSnapshot> {
    const client = requireSupabase()
    const { data: id, error } = await client.rpc('save_expediente_document_version', {
      p_project_id: projectId,
      p_content: content,
      p_expected_current_document_id: expectedCurrentDocumentId,
      p_change_summary: changeSummary ?? null,
    })
    if (error) throw new Error(error.code === '40001' ? 'El documento cambió en otro dispositivo. Recarga antes de guardar.' : error.message)
    const { data, error: fetchError } = await client.from('expediente_document_versions').select('*').eq('id', id).single()
    if (fetchError) throw new Error(fetchError.message)
    return mapDocumentVersion(data)
  }

  async queueDocumentAiRevision(documentVersionId: string, comment: string): Promise<string> {
    const client = requireSupabase()
    const { data, error } = await client.rpc('queue_expediente_document_ai_revision', {
      p_document_version_id: documentVersionId,
      p_user_comment: comment,
    })
    if (error) throw new Error(error.message)
    return String(data)
  }

  async getDocumentAiRevision(revisionId: string): Promise<ExpedienteDocumentAiRevisionSnapshot | null> {
    const client = requireSupabase()
    const { data, error } = await client.from('expediente_document_ai_revisions').select('*').eq('id', revisionId).maybeSingle()
    if (error) throw new Error(error.message)
    return data ? mapDocumentAiRevision(data) : null
  }

  async acceptDocumentAiRevision(revisionId: string): Promise<ExpedienteDocumentVersionSnapshot> {
    const client = requireSupabase()
    const { data: id, error } = await client.rpc('accept_expediente_document_ai_revision', { p_revision_id: revisionId })
    if (error) throw new Error(error.code === '40001' ? 'El documento cambió antes de aceptar la propuesta. Recarga y revisa de nuevo.' : error.message)
    const { data, error: fetchError } = await client.from('expediente_document_versions').select('*').eq('id', id).single()
    if (fetchError) throw new Error(fetchError.message)
    return mapDocumentVersion(data)
  }

  async discardDocumentAiRevision(revisionId: string): Promise<void> {
    const client = requireSupabase()
    const { error } = await client.rpc('discard_expediente_document_ai_revision', { p_revision_id: revisionId })
    if (error) throw new Error(error.message)
  }

  async finalizeDocument(documentVersionId: string): Promise<void> {
    const client = requireSupabase()
    const { error } = await client.rpc('finalize_expediente_document', { p_document_version_id: documentVersionId })
    if (error) throw new Error(error.message)
  }
}

function mapDocumentVersion(data: any): ExpedienteDocumentVersionSnapshot {
  return {
    id: data.id,
    projectId: data.project_id,
    sourceConsolidationVersionId: data.source_consolidation_version_id,
    parentDocumentVersionId: data.parent_document_version_id ?? null,
    versionNumber: data.version_number,
    content: data.content ?? {},
    changeSummary: data.change_summary ?? null,
    createdAt: data.created_at,
    finalizedAt: data.finalized_at ?? null,
  }
}

function mapDocumentAiRevision(data: any): ExpedienteDocumentAiRevisionSnapshot {
  return {
    id: data.id,
    projectId: data.project_id,
    sourceDocumentVersionId: data.source_document_version_id,
    userComment: data.user_comment,
    status: data.status,
    proposedContent: data.proposed_content ?? null,
    errorCode: data.error_code ?? null,
    createdAt: data.created_at,
  }
}

/** Repositorio determinista para pruebas de interfaz y modo demo aislado. */
export class DemoExpedienteV2Repository implements ExpedienteV2Repository {
  private readonly results: Map<string, ExpedienteResultVersionSnapshot>
  private readonly documents = new Map<string, ExpedienteDocumentVersionSnapshot>()
  private readonly aiRevisions = new Map<string, ExpedienteDocumentAiRevisionSnapshot>()

  constructor(
    private readonly snapshots: Map<string, ExpedienteWorkflowSnapshot>,
    initialResults?: Map<string, ExpedienteResultVersionSnapshot>,
  ) {
    this.results = initialResults ? new Map(initialResults) : new Map()
  }

  async load(projectId: string): Promise<ExpedienteWorkflowSnapshot> {
    const snapshot = this.snapshots.get(projectId)
    if (!snapshot) throw new Error(`No existe un escenario demo v2 para el expediente ${projectId}.`)
    return structuredClone(snapshot)
  }

  async queueGroupAnalysis(input: QueueGroupAnalysisInput): Promise<string> {
    if (input.idempotencyKey.trim().length < 16) throw new Error('La clave de idempotencia debe tener al menos 16 caracteres.')
    return `demo-execution-${input.groupId}`
  }

  async saveDraft(
    resultVersionId: string,
    payload: Record<string, unknown>,
    changeSummary?: string,
    expectedVersionNumber?: number,
  ): Promise<number> {
    const existing = this.results.get(resultVersionId)
    if (existing && expectedVersionNumber !== undefined && existing.editRevision !== expectedVersionNumber) {
      throw new EditConflictError(
        `Conflicto en demo: revisión esperada ${expectedVersionNumber}, servidor tiene ${existing.editRevision}.`,
        existing.editRevision,
      )
    }

    if (existing) {
      existing.payload = { ...payload }
      existing.changeSummary = changeSummary ?? null
      existing.updatedAt = new Date().toISOString()
      existing.editRevision += 1
      return existing.editRevision
    } else {
      this.results.set(resultVersionId, {
        id: resultVersionId,
        projectId: 'project-1',
        scope: 'group',
        groupId: 'titles-1',
        versionNumber: expectedVersionNumber ?? 1,
        editRevision: 2,
        status: 'draft',
        payload,
        changeSummary: changeSummary ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      return 2
    }
  }

  async approveResult(resultVersionId: string): Promise<string> {
    const existing = this.results.get(resultVersionId)
    if (existing) {
      existing.status = 'approved'
    }
    return `demo-approval-${resultVersionId}`
  }

  async getResultVersion(groupId: string): Promise<ExpedienteResultVersionSnapshot | null> {
    for (const res of this.results.values()) {
      if (res.groupId === groupId) return structuredClone(res)
    }
    return null
  }

  async getConsolidatedResultVersion(projectId: string): Promise<ExpedienteResultVersionSnapshot | null> {
    for (const res of this.results.values()) {
      if (res.projectId === projectId && res.scope === 'consolidated') return structuredClone(res)
    }
    return null
  }

  async reprocessGroup(groupId: string): Promise<string> {
    return `demo-reprocess-${groupId}`
  }

  async consolidate(projectId: string): Promise<string> {
    const consId = `demo-cons-${projectId}`
    this.results.set(consId, {
      id: consId,
      projectId,
      scope: 'consolidated',
      groupId: null,
      versionNumber: 1,
      editRevision: 1,
      status: 'draft',
      payload: { consolidated: true },
      changeSummary: 'Consolidación demo v1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    return consId
  }

  async getCurrentDocument(projectId: string): Promise<ExpedienteDocumentVersionSnapshot | null> {
    return structuredClone([...this.documents.values()].find((document) => document.projectId === projectId && !document.finalizedAt) ?? null)
  }

  async saveDocument(projectId: string, content: Record<string, unknown>, expectedCurrentDocumentId: string | null, changeSummary?: string): Promise<ExpedienteDocumentVersionSnapshot> {
    const current = await this.getCurrentDocument(projectId)
    if ((current?.id ?? null) !== expectedCurrentDocumentId) throw new EditConflictError('El documento demo cambió antes de guardar.', current?.versionNumber ?? 0)
    const version: ExpedienteDocumentVersionSnapshot = {
      id: `demo-document-${crypto.randomUUID()}`,
      projectId,
      sourceConsolidationVersionId: 'demo-consolidated-1',
      parentDocumentVersionId: current?.id ?? null,
      versionNumber: (current?.versionNumber ?? 0) + 1,
      content: structuredClone(content),
      changeSummary: changeSummary ?? null,
      createdAt: new Date().toISOString(),
      finalizedAt: null,
    }
    if (current) this.documents.delete(current.id)
    this.documents.set(version.id, version)
    return structuredClone(version)
  }

  async queueDocumentAiRevision(documentVersionId: string, comment: string): Promise<string> {
    const source = [...this.documents.values()].find((document) => document.id === documentVersionId)
    if (!source) throw new Error('Documento demo inexistente.')
    const id = `demo-ai-${crypto.randomUUID()}`
    this.aiRevisions.set(id, {
      id,
      projectId: source.projectId,
      sourceDocumentVersionId: source.id,
      userComment: comment,
      status: 'queued',
      proposedContent: null,
      errorCode: null,
      createdAt: new Date().toISOString(),
    })
    return id
  }

  async getDocumentAiRevision(revisionId: string): Promise<ExpedienteDocumentAiRevisionSnapshot | null> {
    const revision = this.aiRevisions.get(revisionId)
    return revision ? structuredClone(revision) : null
  }

  async acceptDocumentAiRevision(revisionId: string): Promise<ExpedienteDocumentVersionSnapshot> {
    const revision = this.aiRevisions.get(revisionId)
    if (!revision?.proposedContent || revision.status !== 'completed') throw new Error('La propuesta demo no está lista.')
    const document = await this.saveDocument(revision.projectId, revision.proposedContent, revision.sourceDocumentVersionId, 'Propuesta IA aceptada')
    revision.status = 'accepted'
    return document
  }

  async discardDocumentAiRevision(revisionId: string): Promise<void> {
    const revision = this.aiRevisions.get(revisionId)
    if (revision) revision.status = 'discarded'
  }

  async finalizeDocument(documentVersionId: string): Promise<void> {
    const document = this.documents.get(documentVersionId)
    if (!document) throw new Error('Documento demo inexistente.')
    document.finalizedAt = new Date().toISOString()
  }
}

export function createExpedienteV2Repository(options: CreateExpedienteV2RepositoryOptions): ExpedienteV2Repository {
  if (options.mode === 'supabase') return new SupabaseExpedienteV2Repository()
  return new DemoExpedienteV2Repository(options.demoSnapshots ?? new Map(), options.demoResults)
}
