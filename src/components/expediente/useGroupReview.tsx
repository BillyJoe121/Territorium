import { useMemo, useState } from 'react'
import { toast } from '../ui/ToastLayer'
import type { Project } from '../../types'
import type { RemoteExpedienteGroup } from '../../data/expedienteProcessing'
import type { ExpedienteResultVersionSnapshot, ExpedienteV2Repository } from '../../data/expedienteV2Repository'
import { comparableMime } from '../../data/pairComparison'
import {
  adaptCanonicalPayloadToTable,
  adaptTableRowsToPayload,
  type ValidationNotice,
} from '../../lib/expedienteResultAdapters'
import type { ExpedienteGroupKey } from '../../lib/expedienteWorkflow'
import { buildPlanTitleLinkage, linkageSnapshot } from '../../lib/planTitleLinking'
import {
  buildNegotiationLinkage,
  negotiationLinkageSnapshot,
  pairsFromPlanRecords,
  type LinkedPair,
} from '../../lib/negotiationLinking'
import { PairComparisonPanel } from '../comparison/PairComparisonPanel'
import { groupInfo, resultSheetSource } from './expedienteGroups'
import type { ReviewRowAction } from './ReviewDialog'
import type { EditableResultRow, ResultColumn } from './types'

export interface GroupResult {
  version: ExpedienteResultVersionSnapshot
  rows: EditableResultRow[]
  columns: ResultColumn[]
  validationNotices: ValidationNotice[]
  /** Planos: filas del estudio de títulos aprobado para vincular por FMI. */
  titleRows?: EditableResultRow[]
  /** Negociación: parejas estudio ↔ plano aprobadas. */
  pairs?: LinkedPair[]
}

interface Options {
  project: Project
  repo: ExpedienteV2Repository
  groups: Record<ExpedienteGroupKey, RemoteExpedienteGroup> | null
  setBusyGroup: (key: ExpedienteGroupKey | null) => void
  refresh: () => Promise<void>
}

/** Modal de resultados de un grupo: carga, vínculos por FMI, borrador, aprobación y reproceso. */
export function useGroupReview({ project, repo, groups, setBusyGroup, refresh }: Options) {
  const [activeGroupKey, setActiveGroupKey] = useState<ExpedienteGroupKey | null>(null)
  const [groupResult, setGroupResult] = useState<GroupResult | null>(null)

  const close = () => {
    setActiveGroupKey(null)
    setGroupResult(null)
  }

  const { id: projectId, name: projectName } = project
  const resultVersionId = groupResult?.version.id
  const spreadsheet = useMemo(
    () => (activeGroupKey && resultVersionId
      ? resultSheetSource({ id: projectId, name: projectName }, activeGroupKey, resultVersionId, groupInfo[activeGroupKey].title)
      : undefined),
    [activeGroupKey, resultVersionId, projectId, projectName],
  )

  // Planos: columna "Comparador" con el comparador de archivos (plano ↔ su estudio de títulos).
  const rowAction = useMemo<ReviewRowAction | undefined>(() => {
    if (activeGroupKey !== 'plans' || !groups) return undefined
    const sameName = (a: string, b: string) => a.normalize('NFC').trim().toLowerCase() === b.normalize('NFC').trim().toLowerCase()
    const filesFor = (row: EditableResultRow) => ({
      plan: row.planSourceDocument ? groups.plans.files.find((file) => sameName(file.name, row.planSourceDocument)) : undefined,
      study: row.t_sourceDocument ? groups.titles.files.find((file) => sameName(file.name, row.t_sourceDocument)) : undefined,
    })
    return {
      columnLabel: 'Comparador',
      buttonLabel: 'Comparar',
      unavailableReason: (row) => {
        if (!row.t_sourceDocument) return 'Este plano no está vinculado por FMI a un estudio de títulos: no hay con qué compararlo.'
        const { plan, study } = filesFor(row)
        if (!plan) return `No se encontró el archivo del plano "${row.planSourceDocument}" entre los insumos cargados.`
        if (!study) return `No se encontró el estudio de títulos "${row.t_sourceDocument}" entre los insumos cargados.`
        if (!comparableMime(plan.name) || !comparableMime(study.name)) return 'El comparador solo admite archivos PDF o DOCX.'
        return null
      },
      renderPanel: (row) => {
        const { plan, study } = filesFor(row)
        return {
          title: `Comparador · ${row.planName || row.planSourceDocument}`,
          content: plan && study ? <PairComparisonPanel projectId={projectId} left={plan} right={study} /> : null,
        }
      },
    }
  }, [activeGroupKey, groups, projectId])

  /** Parejas estudio ↔ plano de la versión aprobada de planos (su tabla resultante congelada). */
  async function loadApprovedPairs(): Promise<LinkedPair[]> {
    if (!groups || groups.plans.status !== 'approved') return []
    const plansVersion = await repo.getApprovedResultVersion(groups.plans.id)
    const records = plansVersion?.payload?.linked_records
    if (Array.isArray(records) && records.length) return pairsFromPlanRecords(records as EditableResultRow[])
    // Aprobaciones anteriores al cotejo: se recalcula el vínculo con los estudios aprobados.
    const titlesVersion = groups.titles.status === 'approved' ? await repo.getApprovedResultVersion(groups.titles.id) : null
    if (!plansVersion?.payload || !titlesVersion?.payload) return []
    const planRows = adaptCanonicalPayloadToTable('plans', plansVersion.payload).rows
    const titleRows = adaptCanonicalPayloadToTable('titles', titlesVersion.payload).rows
    return pairsFromPlanRecords(buildPlanTitleLinkage(planRows, titleRows).rows)
  }

  async function openReview(group: RemoteExpedienteGroup) {
    setBusyGroup(group.key)
    try {
      let snap = await repo.getResultVersion(group.id)

      // Reintentar brevemente si la versión aún se está sincronizando o el payload está vacío
      let attempts = 0
      while (
        attempts < 4 &&
        (!snap || !snap.payload || Object.keys(snap.payload).length === 0)
      ) {
        attempts++
        await new Promise((resolve) => setTimeout(resolve, 600))
        snap = await repo.getResultVersion(group.id)
      }

      if (!snap || !snap.payload || Object.keys(snap.payload).length === 0) {
        toast.error('Los resultados del análisis aún se están sincronizando con el servidor. Por favor espera unos momentos y vuelve a hacer clic en "Analizar resultados".')
        return
      }

      const payload = snap.payload
      const adapted = adaptCanonicalPayloadToTable(group.key, payload)
      let titleRows: EditableResultRow[] | undefined
      if (group.key === 'plans' && groups) {
        const titlesVersion = groups.titles.status === 'approved' ? await repo.getApprovedResultVersion(groups.titles.id) : null
        titleRows = titlesVersion?.payload ? adaptCanonicalPayloadToTable('titles', titlesVersion.payload).rows : []
      }
      let pairs: LinkedPair[] | undefined
      if (group.key === 'negotiation' && groups) {
        pairs = await loadApprovedPairs()
        if (!Array.isArray(payload.negotiations)) {
          // Resultado de un worker anterior: trae un solo predio y sin FMI, así que no puede vincularse.
          toast.error('Este resultado de negociación lo generó una versión anterior del worker (sin las filas por predio ni su FMI). Usa "Reprocesar" para extraerlo de nuevo con la versión actual.')
        }
      }
      setGroupResult({
        version: snap,
        rows: adapted.rows,
        columns: adapted.columns,
        validationNotices: adapted.validationNotices,
        titleRows,
        pairs,
      })
      setActiveGroupKey(group.key)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'No fue posible cargar los resultados para revisión.')
    } finally {
      setBusyGroup(null)
    }
  }

  async function saveDraft(rows: EditableResultRow[]) {
    if (!activeGroupKey || !groupResult) return
    const key = activeGroupKey
    const existing = groupResult.version
    const updatedPayload = adaptTableRowsToPayload(key, rows, existing.payload)
    if (existing.id) {
      const editRevision = await repo.saveDraft(existing.id, updatedPayload, 'Edición manual de revisor', existing.editRevision)
      existing.editRevision = editRevision
    }
    setGroupResult((curr) =>
      curr
        ? {
            ...curr,
            rows,
            version: { ...curr.version, payload: updatedPayload, editRevision: existing.editRevision },
          }
        : null,
    )
    toast.success(`Borrador de ${groupInfo[key].title} guardado exitosamente.`)
  }

  async function approve(rows: EditableResultRow[]) {
    if (!activeGroupKey || !groupResult) return
    const key = activeGroupKey
    const existing = groupResult.version
    let updatedPayload = adaptTableRowsToPayload(key, rows, existing.payload)
    if (key === 'plans') {
      if (groups?.titles.status !== 'approved') {
        toast.error('El Estudio de Títulos debe estar aprobado para aprobar los planos.')
        return
      }
      // Tabla resultante = planos + estudio de títulos, con sus alertas, congelada al aprobar.
      updatedPayload = { ...updatedPayload, ...linkageSnapshot(buildPlanTitleLinkage(rows, groupResult.titleRows ?? [])) }
    }
    if (key === 'negotiation') {
      if (groups?.plans.status !== 'approved') {
        toast.error('Los Planos deben estar aprobados para aprobar la plantilla de negociación.')
        return
      }
      const linkage = buildNegotiationLinkage(rows, groupResult.pairs ?? [])
      if (linkage.summary.missingValues > 0) {
        toast.error('Cada predio vinculado debe tener su valor negociado en números y letras que coincidan.')
        return
      }
      updatedPayload = { ...updatedPayload, ...negotiationLinkageSnapshot(linkage) }
    }

    if (existing.id) {
      await repo.saveDraft(existing.id, updatedPayload, 'Edición previa a aprobación', existing.editRevision)
      await repo.approveResult(existing.id, 'Aprobado formalmente por revisor jurídico')
    }

    toast.success(`${groupInfo[key].title} quedó formalmente aprobado para consolidación.`)
    close()
    await refresh()
  }

  async function reprocess() {
    if (!activeGroupKey || !groups) return
    const group = groups[activeGroupKey]
    try {
      await repo.reprocessGroup(group.id)
      close()
      toast.success(`Se solicitó reanálisis para ${groupInfo[group.key].title}.`)
      await refresh()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'No fue posible reintentar el análisis.')
    }
  }

  return { activeGroupKey, groupResult, spreadsheet, rowAction, openReview, close, saveDraft, approve, reprocess }
}
