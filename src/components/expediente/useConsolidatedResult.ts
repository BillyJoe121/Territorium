import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../ui/ToastLayer'
import type { Project } from '../../types'
import type { ExpedienteResultVersionSnapshot, ExpedienteV2Repository } from '../../data/expedienteV2Repository'
import { adaptCanonicalPayloadToTable, adaptTableRowsToPayload } from '../../lib/expedienteResultAdapters'
import { downloadCorrespondenciaExcel } from '../../lib/consolidatedExcelGenerator'
import { CORRESPONDENCIA_COLUMNS, type CorrespondenciaExclusion } from '../../lib/correspondencia'
import { resultSheetSource } from './expedienteGroups'
import type { EditableResultRow, PrototypeConsolidationStatus, ResultColumn } from './types'

interface Options {
  project: Project
  repo: ExpedienteV2Repository
  allGroupsApproved: boolean
}

/**
 * Consolidado CORRESPONDENCIA del proyecto: una fila por predio (estudio + plano + negociación),
 * su versión remota, el bloqueo de edición (`edit_locked` en el payload) y la exportación a Excel.
 */
export function useConsolidatedResult({ project, repo, allGroupsApproved }: Options) {
  const [status, setStatus] = useState<PrototypeConsolidationStatus>('blocked')
  const [versionNumber, setVersionNumber] = useState<number>(1)
  const [consolidating, setConsolidating] = useState(false)
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<EditableResultRow[]>([])
  const [columns, setColumns] = useState<ResultColumn[]>([])
  const [excluded, setExcluded] = useState<CorrespondenciaExclusion[]>([])
  const [resultVersion, setResultVersion] = useState<ExpedienteResultVersionSnapshot | null>(null)

  const applySnapshot = useCallback((snap: ExpedienteResultVersionSnapshot) => {
    setResultVersion(snap)
    setVersionNumber(snap.versionNumber)
    const adapted = adaptCanonicalPayloadToTable('consolidated', snap.payload)
    setRows(adapted.rows)
    setColumns(adapted.columns)
    setExcluded(Array.isArray(snap.payload.excluded) ? (snap.payload.excluded as CorrespondenciaExclusion[]) : [])
  }, [])

  /** Carga la última versión remota del consolidado; no bloquea si aún no existe. */
  const reload = useCallback(async () => {
    try {
      const snap = await repo.getConsolidatedResultVersion(project.id)
      if (!snap) return
      applySnapshot(snap)
      setStatus(snap.status === 'approved' ? 'approved' : 'review_ready')
    } catch {
      // Non-blocking if table not populated yet
    }
  }, [applySnapshot, project.id, repo])

  useEffect(() => {
    setStatus((curr) => {
      if (curr === 'approved') return curr
      if (allGroupsApproved && curr === 'blocked') return 'available'
      if (!allGroupsApproved && ['available', 'processing', 'review_ready'].includes(curr)) return 'stale'
      return curr
    })
  }, [allGroupsApproved])

  // Depende de id y nombre, no del objeto: cada sincronización trae un `project` nuevo y la hoja
  // no debe recargarse por eso.
  const { id: projectId, name: projectName } = project
  const versionId = resultVersion?.id
  const spreadsheet = useMemo(
    () => (versionId ? resultSheetSource({ id: projectId, name: projectName }, 'consolidated', versionId, 'Consolidado CORRESPONDENCIA') : undefined),
    [versionId, projectId, projectName],
  )
  const canOpen = Boolean(resultVersion) && (status === 'review_ready' || status === 'approved')
  const correspondenciaRows = useMemo(() => rows.filter((row) => 'B' in row && 'BE' in row), [rows])

  async function consolidate() {
    if (!allGroupsApproved) return
    setConsolidating(true)
    try {
      await repo.consolidate(project.id, undefined, { projectName: project.name })
      const snap = await repo.getConsolidatedResultVersion(project.id)
      if (snap) {
        applySnapshot(snap)
        setStatus('review_ready')
        setOpen(true)
        const count = Array.isArray(snap.payload.correspondencia) ? snap.payload.correspondencia.length : 0
        toast.success(`Consolidado CORRESPONDENCIA generado: ${count} predio(s).`)
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Error al consolidar el proyecto.')
    } finally {
      setConsolidating(false)
    }
  }

  // Revisión vigente del consolidado: el autoguardado la actualiza antes de que el estado se
  // vuelva a dibujar, así aprobar justo después de un guardado no choca con un conflicto.
  const revisionRef = useRef<{ id: string; editRevision: number } | null>(null)
  useEffect(() => {
    if (resultVersion) revisionRef.current = { id: resultVersion.id, editRevision: resultVersion.editRevision }
  }, [resultVersion])
  const currentRevision = (version: ExpedienteResultVersionSnapshot) =>
    revisionRef.current?.id === version.id ? revisionRef.current.editRevision : version.editRevision

  async function persist(nextRows: EditableResultRow[], payload: Record<string, unknown>, summary: string) {
    if (!resultVersion) return
    const editRevision = await repo.saveDraft(resultVersion.id, payload, summary, currentRevision(resultVersion))
    revisionRef.current = { id: resultVersion.id, editRevision }
    setResultVersion((current) => current ? { ...current, payload, editRevision } : current)
    setRows(nextRows)
  }

  // Autoguardado del modal: el pie del modal muestra la hora del último guardado (sin avisos emergentes).
  async function saveDraft(nextRows: EditableResultRow[]) {
    if (!resultVersion) return
    await persist(nextRows, adaptTableRowsToPayload('consolidated', nextRows, resultVersion.payload), 'Edición manual en consolidado')
  }

  /** Guarda el consolidado con la edición bloqueada o habilitada (`edit_locked` en el payload). */
  async function saveLock(nextRows: EditableResultRow[], locked: boolean, summary: string) {
    if (!resultVersion) return
    await persist(nextRows, { ...adaptTableRowsToPayload('consolidated', nextRows, resultVersion.payload), edit_locked: locked }, summary)
  }

  async function saveAndLock(nextRows: EditableResultRow[]) {
    try {
      await saveLock(nextRows, true, 'Cambios guardados; edición bloqueada')
      toast.success('Cambios guardados. La edición quedó bloqueada; usa "Editar" para modificar el consolidado.')
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'No fue posible guardar el consolidado.')
    }
  }

  async function unlock() {
    if (!resultVersion) return
    try {
      if (resultVersion.status === 'approved') {
        // Versión aprobada con el flujo anterior: se reabre como borrador con el mismo contenido.
        await repo.reopenConsolidatedVersion(project.id, { ...resultVersion.payload, edit_locked: false })
        await reload()
      } else {
        await saveLock(rows, false, 'Edición habilitada')
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'No fue posible habilitar la edición del consolidado.')
    }
  }

  /** Desde el modal llegan las filas recién guardadas; desde la Ficha, las del último guardado. */
  async function downloadExcel(sourceRows: EditableResultRow[] = correspondenciaRows) {
    try {
      const exportRows = sourceRows.filter((row) => 'B' in row && 'BE' in row)
      if (!exportRows.length) throw new Error('No hay predios consolidados para exportar a CORRESPONDENCIA.')
      const safeName = project.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')
      await downloadCorrespondenciaExcel(exportRows, `CORRESPONDENCIA_${safeName}_v${versionNumber}.xlsx`)
      toast.success(`CORRESPONDENCIA descargado: ${exportRows.length} predio(s) con las ${CORRESPONDENCIA_COLUMNS.length} columnas de la plantilla.`)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Error al descargar archivo Excel.')
    }
  }

  return {
    status,
    versionNumber,
    consolidating,
    open,
    setOpen,
    rows,
    columns,
    excluded,
    resultVersion,
    spreadsheet,
    canOpen,
    correspondenciaRows,
    reload,
    consolidate,
    saveDraft,
    saveAndLock,
    unlock,
    downloadExcel,
  }
}
