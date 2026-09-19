import type { RealtimeChannel } from '@supabase/supabase-js'
import { requireSupabase } from '../lib/supabase'
import type { ExpedienteGroupKey, ExpedienteGroupStatus } from '../lib/expedienteWorkflow'

export interface RemoteExpedienteFile {
  id: string
  name: string
  sizeBytes: number
  validationStatus: 'pending' | 'validated' | 'rejected'
  validationErrorCode: string | null
  createdAt: string
}

export interface RemoteExpedienteExecution {
  id: string
  status: string
  completedUnits: number
  totalUnits: number
  stage: string
  stageMessage: string | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
}

export interface RemoteExpedienteGroup {
  id: string
  key: ExpedienteGroupKey
  status: ExpedienteGroupStatus
  lastErrorCode: string | null
  lastErrorMessage: string | null
  files: RemoteExpedienteFile[]
  execution: RemoteExpedienteExecution | null
}

function groupKey(value: string): ExpedienteGroupKey {
  if (value === 'titles' || value === 'plans' || value === 'negotiation') return value
  throw new Error(`Grupo documental no reconocido: ${value}`)
}

export async function loadRemoteExpedienteProcessing(projectId: string): Promise<Record<ExpedienteGroupKey, RemoteExpedienteGroup>> {
  const client = requireSupabase()
  const [groupsResult, filesResult, executionsResult] = await Promise.all([
    client.from('expediente_document_groups').select('id,group_key,status,last_error_code,last_error_message').eq('project_id', projectId),
    client.from('expediente_document_files').select('id,group_id,original_name,size_bytes,validation_status,validation_error_code,created_at').eq('project_id', projectId).eq('is_current', true).eq('is_active', true).order('created_at'),
    client.from('expediente_executions').select('id,group_id,status,completed_units,total_units,stage,stage_message,error_code,error_message,created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
  ])
  const error = [groupsResult, filesResult, executionsResult].find((result) => result.error)?.error
  if (error) throw new Error(error.message)

  const latestExecution = new Map<string, any>()
  for (const execution of executionsResult.data ?? []) {
    if (!latestExecution.has(execution.group_id)) latestExecution.set(execution.group_id, execution)
  }
  const filesByGroup = new Map<string, RemoteExpedienteFile[]>()
  for (const file of filesResult.data ?? []) {
    const values = filesByGroup.get(file.group_id) ?? []
    values.push({
      id: file.id,
      name: file.original_name,
      sizeBytes: file.size_bytes,
      validationStatus: file.validation_status,
      validationErrorCode: file.validation_error_code ?? null,
      createdAt: file.created_at,
    })
    filesByGroup.set(file.group_id, values)
  }

  const groups = {} as Record<ExpedienteGroupKey, RemoteExpedienteGroup>
  for (const row of groupsResult.data ?? []) {
    const execution = latestExecution.get(row.id)
    groups[groupKey(row.group_key)] = {
      id: row.id,
      key: groupKey(row.group_key),
      status: row.status,
      lastErrorCode: row.last_error_code ?? null,
      lastErrorMessage: row.last_error_message ?? null,
      files: filesByGroup.get(row.id) ?? [],
      execution: execution ? {
        id: execution.id,
        status: execution.status,
        completedUnits: execution.completed_units,
        totalUnits: execution.total_units,
        stage: execution.stage,
        stageMessage: execution.stage_message ?? null,
        errorCode: execution.error_code ?? null,
        errorMessage: execution.error_message ?? null,
        createdAt: execution.created_at,
      } : null,
    }
  }
  for (const key of ['titles', 'plans', 'negotiation'] as const) {
    if (!groups[key]) throw new Error(`El grupo ${key} no fue inicializado; ejecuta el backfill v2.`)
  }
  return groups
}

/** A single project channel is enough: executions persist confirmed progress. */
export function subscribeRemoteExpedienteProcessing(projectId: string, onChange: () => void): () => void {
  const client = requireSupabase()
  const channel: RealtimeChannel = client
    .channel(`expediente-v2:${projectId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expediente_document_groups', filter: `project_id=eq.${projectId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expediente_executions', filter: `project_id=eq.${projectId}` }, onChange)
    .subscribe()
  return () => { void client.removeChannel(channel) }
}
