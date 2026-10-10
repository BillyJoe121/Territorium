import { useCallback, useEffect, useRef, useState } from 'react'
import { deriveNegotiationRow } from '../../lib/negotiationLinking'
import type { ResultSpreadsheetHandle, ResultSpreadsheetSource } from './ResultSpreadsheet'
import type { ReviewDialogProps } from './reviewDialogTypes'
import type { EditableResultRow, ResultColumn } from './types'

const SHEET_AUTOSAVE_MS = 2000

const cloneRows = (rows: EditableResultRow[]) => rows.map((row) => ({ ...row }))

/** Ofertas cuyo cambio obliga a revisar de nuevo si números y letras coinciden. */
const NEGOTIATION_OFFER_FIELDS = ['firstOfferNumbers', 'firstOfferLetters', 'secondOfferNumbers', 'secondOfferLetters']

/**
 * Borrador editable a partir de las filas guardadas. En negociación las letras se redactan
 * desde los números, también en borradores antiguos escritos a mano; una versión aprobada
 * se muestra tal cual se aprobó.
 */
const draftFrom = (rows: EditableResultRow[], groupKey: ReviewDialogProps['groupKey'], isApproved: boolean) =>
  groupKey === 'negotiation' && !isApproved ? rows.map(deriveNegotiationRow) : cloneRows(rows)

const timeNow = () => new Intl.DateTimeFormat('es-CO', { timeStyle: 'medium' }).format(new Date())

interface Options {
  open: boolean
  rows: EditableResultRow[]
  columns: ResultColumn[]
  groupKey: ReviewDialogProps['groupKey']
  isApproved: boolean
  /** Solo lectura: versión aprobada o edición bloqueada. */
  locked: boolean
  deriveRow?: (row: EditableResultRow) => EditableResultRow
  onSave: (rows: EditableResultRow[]) => Promise<void> | void
  spreadsheet?: ResultSpreadsheetSource
}

/**
 * Borrador del modal de resultados y su guardado, en tabla o en hoja de cálculo: autoguardado,
 * reglas de edición (ofertas, letras, columnas comunes, derivados) y conflictos de versión.
 */
export function useReviewDraft({ open, rows, columns, groupKey, isApproved, locked, deriveRow, onSave, spreadsheet }: Options) {
  const [draft, setDraft] = useState(() => draftFrom(rows, groupKey, isApproved))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [conflictError, setConflictError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [sheetErrors, setSheetErrors] = useState<string[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [sheetKey, setSheetKey] = useState(0)
  const saveTimeoutRef = useRef<number | null>(null)
  const sheetRef = useRef<ResultSpreadsheetHandle>(null)
  const sheetMode = Boolean(spreadsheet)

  // Los datos se cargan al abrir el modal. Mientras está abierto, el borrador manda: si el
  // autoguardado devuelve una versión anterior, no debe pisar lo que se sigue escribiendo.
  const loadedOnOpenRef = useRef(false)
  useEffect(() => {
    if (!open) {
      loadedOnOpenRef.current = false
      return
    }
    if (loadedOnOpenRef.current) return
    loadedOnOpenRef.current = true
    setDraft(draftFrom(rows, groupKey, isApproved))
    setDirty(false)
    setSaving(false)
    setConflictError(null)
    setLastSaved(null)
    setSheetErrors([])
    setFileError(null)
  }, [open, rows, groupKey, isApproved])

  const triggerSave = useCallback(async (rowsToSave: EditableResultRow[]) => {
    setSaving(true)
    try {
      await onSave(rowsToSave)
      setDirty(false)
      setSaving(false)
      setLastSaved(timeNow())
    } catch (err: any) {
      setSaving(false)
      if (err?.name === 'EditConflictError' || err?.message?.includes('Conflicto')) {
        setConflictError(err.message)
      }
    }
  }, [onSave])

  const lockedRef = useRef(locked)
  lockedRef.current = locked
  const columnsRef = useRef(columns)
  columnsRef.current = columns
  const deriveRef = useRef(deriveRow)
  deriveRef.current = deriveRow
  const groupKeyRef = useRef(groupKey)
  groupKeyRef.current = groupKey

  /** Una edición con las mismas reglas en tabla y hoja: datos comunes, ofertas, letras y derivados. */
  const applyCellEdit = useCallback((current: EditableResultRow[], rowId: string, key: string, value: string) => {
    const hasNegotiationComparison = columnsRef.current.some((column) => column.key === 'valuesMatch')
    // Columnas comunes (datos del proyecto): editar una fila actualiza todas.
    const broadcast = columnsRef.current.some((column) => column.key === key && column.broadcast)
    return current.map((row) => {
      if (row.id !== rowId && !broadcast) return row
      let nextRow = { ...row, [key]: value }
      if (hasNegotiationComparison && NEGOTIATION_OFFER_FIELDS.includes(key)) nextRow = { ...nextRow, valuesMatch: 'Requiere revisión' }
      if (groupKeyRef.current === 'negotiation' && key === 'negotiatedValueNumbers') nextRow = deriveNegotiationRow(nextRow)
      return deriveRef.current ? deriveRef.current(nextRow) : nextRow
    })
  }, [])

  /** Columnas visibles de la hoja; el modal las actualiza en cada render. */
  const displayColumnsRef = useRef<ResultColumn[]>(columns)
  /** Lleva al borrador lo que cambió en la hoja (comparado con el borrador antes de aplicar nada). */
  const applySheetRows = useCallback((current: EditableResultRow[], sheetRows: EditableResultRow[]) => {
    const editable = displayColumnsRef.current.filter((column) => column.editable !== false).map((column) => column.key)
    const byId = new Map(current.map((row) => [row.id, row]))
    const changes: [string, string, string][] = []
    for (const sheetRow of sheetRows) {
      const before = byId.get(sheetRow.id)
      if (!before) continue
      for (const key of editable) {
        if (key in sheetRow && String(sheetRow[key] ?? '') !== String(before[key] ?? '')) changes.push([sheetRow.id, key, String(sheetRow[key] ?? '')])
      }
    }
    return changes.reduce((acc, [rowId, key, value]) => applyCellEdit(acc, rowId, key, value), current)
  }, [applyCellEdit])

  const updateCell = useCallback((rowId: string, key: string, value: string) => {
    if (lockedRef.current) return
    setDraft((currentDraft) => {
      const nextDraft = applyCellEdit(currentDraft, rowId, key, value)

      // Debounced autosave (HU-V2-043)
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = window.setTimeout(() => {
        void triggerSave(nextDraft)
      }, 1200)

      return nextDraft
    })
    setDirty(true)
  }, [triggerSave, applyCellEdit])

  // Hoja de cálculo: hoja → filas (contrato) → onSave (base de datos primero) → .xlsx a Storage.
  const spreadsheetRef = useRef(spreadsheet)
  spreadsheetRef.current = spreadsheet
  const sheetSavingRef = useRef(false)
  const scheduleSheetSaveRef = useRef<() => void>(() => {})
  const draftRef = useRef(draft)
  draftRef.current = draft

  /** Guarda la hoja. Devuelve las filas guardadas, o null si no se guardó. */
  const saveSheet = useCallback(async (manual: boolean): Promise<EditableResultRow[] | null> => {
    const sheet = sheetRef.current
    const source = spreadsheetRef.current
    if (!sheet || !source || lockedRef.current) return null
    // Sin interrumpir a quien escribe: el autoguardado espera a que cierre la celda.
    if (sheetSavingRef.current || (!manual && sheet.isEditing())) {
      scheduleSheetSaveRef.current()
      return null
    }
    sheetSavingRef.current = true
    setSaving(true)
    try {
      const snapshot = await sheet.collect({ commitEditing: manual })
      if (snapshot.errors.length) {
        setSheetErrors(snapshot.errors)
        return null
      }
      setSheetErrors([])
      // Las filas de la hoja pasan por las mismas reglas que una edición en la tabla.
      const nextDraft = applySheetRows(draftRef.current, snapshot.rows)
      await onSave(nextDraft)
      setDraft(nextDraft)
      try {
        await source.save(snapshot.file)
        setFileError(null)
      } catch (error) {
        setFileError(`Los datos quedaron guardados, pero el archivo Excel no se actualizó. ${error instanceof Error ? error.message : ''}`.trim())
      }
      sheet.markSaved(snapshot.fingerprint)
      setLastSaved(timeNow())
      return nextDraft
    } catch (err: any) {
      if (err?.name === 'EditConflictError' || err?.message?.includes('Conflicto')) setConflictError(err.message)
      else setSheetErrors([err?.message ?? 'No se pudo guardar la hoja de cálculo.'])
      return null
    } finally {
      sheetSavingRef.current = false
      setSaving(false)
    }
  }, [onSave, applySheetRows])

  scheduleSheetSaveRef.current = () => {
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = window.setTimeout(() => void saveSheet(false), SHEET_AUTOSAVE_MS)
  }

  const handleSheetChange = useCallback((nextDirty: boolean) => {
    if (lockedRef.current) return
    setDirty(nextDirty)
    if (nextDirty) {
      scheduleSheetSaveRef.current()
      return
    }
    // De vuelta a lo guardado (p. ej. con deshacer): ya no hay nada que corregir ni guardar.
    setSheetErrors([])
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
  }, [])

  // Lo que escribe el revisor en la hoja llega al borrador: el cotejo, las letras y las alertas
  // se recalculan y vuelven a la hoja como vista.
  const handleSheetRows = useCallback((sheetRows: EditableResultRow[], errors: string[]) => {
    setSheetErrors(errors)
    if (errors.length || lockedRef.current) return
    setDraft((current) => applySheetRows(current, sheetRows))
  }, [applySheetRows])

  const saveManual = async () => {
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    if (sheetMode) await saveSheet(true)
    else await triggerSave(draft)
  }

  /**
   * Con autoguardado como único guardado: guarda ya lo pendiente (incluida la celda que se está
   * escribiendo) y devuelve las filas vigentes; null si la hoja tiene errores o no se pudo guardar.
   */
  const flushPendingSheet = async (): Promise<EditableResultRow[] | null> => {
    if (!sheetMode || !sheetRef.current) return draftRef.current
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    while (sheetSavingRef.current) await new Promise((resolve) => window.setTimeout(resolve, 100))
    if (!dirty && !sheetRef.current.isEditing()) return draftRef.current
    return saveSheet(true)
  }

  const reloadFromServer = () => {
    setDraft(draftFrom(rows, groupKey, isApproved))
    setConflictError(null)
    setDirty(false)
    // La hoja se vuelve a abrir desde el archivo y las filas guardadas.
    setSheetKey((key) => key + 1)
  }

  return {
    draft,
    dirty,
    setDirty,
    saving,
    conflictError,
    lastSaved,
    sheetErrors,
    fileError,
    sheetKey,
    sheetRef,
    displayColumnsRef,
    updateCell,
    handleSheetChange,
    handleSheetRows,
    saveManual,
    flushPendingSheet,
    reloadFromServer,
  }
}
