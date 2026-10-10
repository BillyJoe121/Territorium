import { requireSupabase } from '../lib/supabase'
import { requestExpedienteAnalysis } from './expedienteUpload'
import {
  expedienteGroupKeys,
  type ExpedienteConsolidationStatus,
  type ExpedienteFinalDocumentStatus,
  type ExpedienteGroupKey,
  type ExpedienteGroupStatus,
} from '../lib/expedienteWorkflow'
import { buildCorrespondencia, defaultProjectConstants, type ProjectConstants } from '../lib/correspondencia'

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
  /** Última versión aprobada del grupo (ignora borradores posteriores). */
  getApprovedResultVersion(groupId: string): Promise<ExpedienteResultVersionSnapshot | null>
  getConsolidatedResultVersion(projectId: string, versionNumber?: number): Promise<ExpedienteResultVersionSnapshot | null>
  reprocessGroup(groupId: string): Promise<string>
  consolidate(projectId: string, userId?: string, options?: ConsolidateOptions): Promise<string>
  /**
   * Nueva versión en borrador del consolidado con el contenido indicado (p. ej. para volver a
   * editar un consolidado que quedó aprobado, sin reconstruirlo desde las fuentes).
   */
  reopenConsolidatedVersion(projectId: string, payload: Record<string, unknown>): Promise<string>
}

export interface ConsolidateOptions {
  /** Nombre del proyecto para la columna AL de CORRESPONDENCIA. */
  projectName?: string
}

/**
 * Payload del consolidado: una fila CORRESPONDENCIA por predio (estudio + plano + negociación),
 * los predios excluidos con su motivo y los datos comunes del proyecto (AL–AX).
 */
export function buildConsolidatedPayload(input: {
  titles: Record<string, unknown>
  plans: Record<string, unknown>
  negotiation: Record<string, unknown>
  versionIds: { titles: string; plans: string; negotiation: string }
  previous?: Record<string, unknown> | null
  projectName?: string
  userId?: string
}): Record<string, unknown> {
  // Los datos del proyecto editados en un consolidado anterior se conservan al reconsolidar.
  const constants = { ...defaultProjectConstants(input.projectName), ...((input.previous?.constants as Partial<ProjectConstants>) ?? {}) }
  const { rows, excluded } = buildCorrespondencia({
    titlesPayload: input.titles,
    plansPayload: input.plans,
    negotiationPayload: input.negotiation,
    constants,
  })
  return {
    correspondencia: rows,
    excluded,
    constants,
    metadata: {
      titles_result_version_id: input.versionIds.titles,
      plans_result_version_id: input.versionIds.plans,
      negotiation_result_version_id: input.versionIds.negotiation,
      consolidated_at: new Date().toISOString(),
      consolidated_by: input.userId,
      is_valid: true,
    },
  }
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

  async getApprovedResultVersion(groupId: string): Promise<ExpedienteResultVersionSnapshot | null> {
    const client = requireSupabase()
    const { data, error } = await client
      .from('expediente_result_versions')
      .select('version_number')
      .eq('group_id', groupId)
      .eq('status', 'approved')
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? this.getResultVersion(groupId, data.version_number) : null
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

  async consolidate(projectId: string, userId?: string, options: ConsolidateOptions = {}): Promise<string> {
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

    // 2. Consolidate deterministically: una fila CORRESPONDENCIA por predio
    const previous = await this.getConsolidatedResultVersion(projectId).catch(() => null)
    const masterRecord = buildConsolidatedPayload({
      titles: tRes.data.payload ?? {},
      plans: pRes.data.payload ?? {},
      negotiation: nRes.data.payload ?? {},
      versionIds: { titles: tRes.data.id, plans: pRes.data.id, negotiation: nRes.data.id },
      previous: previous?.payload ?? null,
      projectName: options.projectName,
      userId,
    })

    return this.saveConsolidationVersion(projectId, masterRecord as unknown as Record<string, unknown>, 'Consolidación automática', userId)
  }

  async reopenConsolidatedVersion(projectId: string, payload: Record<string, unknown>): Promise<string> {
    return this.saveConsolidationVersion(projectId, payload, 'Reapertura para edición')
  }

  /** Guarda una nueva versión en borrador del consolidado y devuelve su id. */
  private async saveConsolidationVersion(projectId: string, payload: Record<string, unknown>, summary: string, userId?: string): Promise<string> {
    const client = requireSupabase()

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
      p_payload: payload,
      p_change_summary: `${summary} v${nextVer}`,
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
        payload,
        change_summary: `${summary} v${nextVer}`,
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
}

/** Repositorio determinista para pruebas de interfaz y modo demo aislado. */
export class DemoExpedienteV2Repository implements ExpedienteV2Repository {
  private readonly results: Map<string, ExpedienteResultVersionSnapshot>

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

  async getApprovedResultVersion(groupId: string): Promise<ExpedienteResultVersionSnapshot | null> {
    for (const res of this.results.values()) {
      if (res.groupId === groupId && res.status === 'approved') return structuredClone(res)
    }
    return null
  }

  async getConsolidatedResultVersion(projectId: string): Promise<ExpedienteResultVersionSnapshot | null> {
    const versions = [...this.results.values()].filter((res) => res.projectId === projectId && res.scope === 'consolidated')
    const latest = versions.sort((a, b) => b.versionNumber - a.versionNumber)[0]
    return latest ? structuredClone(latest) : null
  }

  async reprocessGroup(groupId: string): Promise<string> {
    return `demo-reprocess-${groupId}`
  }

  async consolidate(projectId: string, userId?: string, options: ConsolidateOptions = {}): Promise<string> {
    const consId = `demo-cons-${projectId}`
    const approved = (key: string) => [...this.results.values()].find((res) => res.projectId === projectId && res.groupId?.includes(key) && res.status === 'approved')
    const t = approved('titles')
    const pl = approved('plans')
    const n = approved('negotiation')
    const payload = t && pl && n
      ? buildConsolidatedPayload({
          titles: t.payload, plans: pl.payload, negotiation: n.payload,
          versionIds: { titles: t.id, plans: pl.id, negotiation: n.id }, projectName: options.projectName, userId,
        })
      : { consolidated: true }
    this.results.set(consId, {
      id: consId,
      projectId,
      scope: 'consolidated',
      groupId: null,
      versionNumber: 1,
      editRevision: 1,
      status: 'draft',
      payload,
      changeSummary: 'Consolidación demo v1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    return consId
  }

  async reopenConsolidatedVersion(projectId: string, payload: Record<string, unknown>): Promise<string> {
    const current = await this.getConsolidatedResultVersion(projectId)
    const id = `demo-cons-${projectId}-${(current?.versionNumber ?? 0) + 1}`
    this.results.set(id, {
      id,
      projectId,
      scope: 'consolidated',
      groupId: null,
      versionNumber: (current?.versionNumber ?? 0) + 1,
      editRevision: 1,
      status: 'draft',
      payload: structuredClone(payload),
      changeSummary: 'Reapertura para edición',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    return id
  }
}

export function createExpedienteV2Repository(options: CreateExpedienteV2RepositoryOptions): ExpedienteV2Repository {
  if (options.mode === 'supabase') return new SupabaseExpedienteV2Repository()
  return new DemoExpedienteV2Repository(options.demoSnapshots ?? new Map(), options.demoResults)
}
