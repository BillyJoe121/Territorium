/**
 * Editor tipo Excel (Univer) para los resultados de un grupo. Se carga con import() diferido
 * desde ReviewDialog: Univer y ExcelJS solo se descargan al abrir un modal que lo usa.
 *
 * La hoja y la revisión se sincronizan en los dos sentidos:
 * - lo que escribe el revisor se lee de la hoja (onRowsChange) y la revisión recalcula cotejo,
 *   alertas y columnas derivadas;
 * - la vista resultante (view) se refleja en la hoja: columnas calculadas, filas de solo lectura
 *   y resaltado. Esas escrituras no entran al historial de deshacer.
 * El resaltado no modifica los datos ni el archivo: se dibuja con un interceptor de celdas.
 */
import { CommandType, createUniver, InterceptorEffectEnum, LocaleType, mergeLocales, type FUniver, type ICellData, type IWorkbookData } from '@univerjs/presets'
import { INTERCEPTOR_POINT, IRenderManagerService, SheetInterceptorService, UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import sheetsCoreEsES from '@univerjs/preset-sheets-core/locales/es-ES'
import '@univerjs/preset-sheets-core/lib/index.css'
import { AlertTriangle, LoaderCircle } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { XLSX_MIME } from '../../data/resultSheetStorage'
import { formatPesosWhileTyping } from '../../lib/negotiatedValue'
import {
  buildResultWorkbook,
  freezeWithSelection,
  ID_COLUMN_KEY,
  planSheetUpdate,
  readResultRows,
  reconcileResultWorkbook,
  recordRowsOf,
  sheetColumnsOf,
  viewValues,
  workbookFingerprint,
  type DecorationTone,
  type SheetContract,
  type SheetDecoration,
  type SheetLayout,
  type SheetView,
} from '../../lib/spreadsheet/resultSheet'
import { workbookDataToXlsx, xlsxToWorkbookData } from '../../lib/spreadsheet/univerXlsx'
import type { EditableResultRow, ResultColumn } from './types'

export type { SheetView } from '../../lib/spreadsheet/resultSheet'

export interface ResultSpreadsheetSource {
  /** Nombre de la hoja de datos y del libro. */
  sheetName: string
  /** Nombre del archivo al descargarlo. */
  fileName: string
  /** Columna visible que identifica cada registro; sin ella se usa una columna oculta de ID. */
  keyColumn?: string
  /** Archivo guardado, o null si aún no existe. */
  load: () => Promise<Blob | null>
  /** Sobreescribe el archivo guardado. */
  save: (file: Blob) => Promise<void>
}

export interface ResultSpreadsheetSnapshot {
  rows: EditableResultRow[]
  errors: string[]
  file: Blob
  fingerprint: string
}

export interface ResultSpreadsheetHandle {
  /** Filas y archivo del estado actual. commitEditing cierra antes la celda en edición. */
  collect: (options?: { commitEditing?: boolean }) => Promise<ResultSpreadsheetSnapshot>
  /** La celda sigue en edición: el autoguardado espera a que termine. */
  isEditing: () => boolean
  /** El estado con esta huella quedó guardado. */
  markSaved: (fingerprint: string) => void
  /** Selecciona y muestra la casilla de un registro (p. ej. desde el panel de alertas). */
  focusCell: (rowId: string, columnKey: string) => void
}

interface ResultSpreadsheetProps {
  source: ResultSpreadsheetSource
  /** Columnas que muestra la hoja (las del cotejo cuando lo hay). */
  columns: ResultColumn[]
  /** Filas, alertas y filas teñidas que calcula la revisión. */
  view: SheetView
  readOnly: boolean
  /** Tras cada edición: si el libro difiere de lo guardado. */
  onChange: (dirty: boolean) => void
  /** Tras cada edición: registros leídos de la hoja, o los errores que impiden leerlos. */
  onRowsChange: (rows: EditableResultRow[], errors: string[]) => void
  /** Valores que se completan mientras se escribe en una columna (p. ej. el valor en letras). */
  liveDerive?: (columnKey: string, text: string) => Record<string, string> | null
  /** Con columna Selección: nuevas filas marcadas tras un clic en una casilla o en el encabezado. */
  onSelectionChange?: (selected: Set<string>) => void
  /** Columna de acción: clic (o Enter/Espacio) en el botón de un registro. */
  onAction?: (rowId: string) => void
  /** Dónde mostrar el resumen de casillas resaltadas (p. ej. junto al título del modal). */
  legendContainer?: HTMLElement | null
  /** Aviso al intentar escribir con la hoja en solo lectura (p. ej. "Pulsa Editar…"). */
  readOnlyHint?: string
}

// Tiempo para que Univer termine de calcular fórmulas y altos tras cargar el libro.
const SETTLE_MS = 800
const READ_DELAY_MS = 250
const SET_RANGE_VALUES = 'sheet.mutation.set-range-values'
const SET_FROZEN = 'sheet.mutation.set-frozen'
const CHECKED = '\u2611'
const UNCHECKED = '\u2610'
const KEYBOARD_EVENT = 4 // DeviceInputEventType.Keyboard de @univerjs/engine-render
// Documentos internos de Univer que editan una celda (la casilla y la barra de fórmulas).
const EDITOR_UNIT_PREFIX = '__INTERNAL_EDITOR__'

/** Posición del cursor tras una edición: final del tramo que cambió entre el texto anterior y el nuevo. */
function caretAfterEdit(previous: string, next: string): number {
  let suffix = 0
  const max = Math.min(previous.length, next.length)
  while (suffix < max && previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix++
  return next.length - suffix
}
// Comandos que quitarían la columna A (Selección) de su lugar si la incluyen.
const COLUMN_REMOVERS = new Set([
  'sheet.command.remove-col', 'sheet.command.remove-col-by-range', 'sheet.command.remove-col-confirm',
  'sheet.command.set-col-hidden', 'sheet.command.hide-col-confirm', 'sheet.command.move-cols',
])
// Comandos que la desplazarían si insertan antes de ella.
const COLUMN_INSERTERS = new Set([
  'sheet.command.insert-col', 'sheet.command.insert-col-by-range', 'sheet.command.insert-col-before', 'sheet.command.insert-multi-cols-before',
])

interface ColumnRange { startColumn: number; endColumn: number }
const asRange = (value: unknown): ColumnRange | null =>
  value && typeof value === 'object' && typeof (value as ColumnRange).startColumn === 'number' ? value as ColumnRange : null
// Ajustes automáticos de Univer que no son ediciones del revisor.
const IGNORED_MUTATIONS = new Set(['sheet.mutation.set-worksheet-row-auto-height', 'sheet.mutation.set-worksheet-row-is-auto-height'])

const TONES: Record<DecorationTone, { bg: string; mark?: { corner: 'tl' | 'tr'; color: string } }> = {
  error: { bg: '#FDE2E4', mark: { corner: 'tr', color: '#D92D20' } },
  warning: { bg: '#FFEBD2', mark: { corner: 'tr', color: '#F79009' } },
  missing: { bg: '#FFF6D9', mark: { corner: 'tl', color: '#CA8A04' } },
  'row-error': { bg: '#FFF4F4' },
  selected: { bg: '#E8F0FB' },
}

interface Counts { error: number; warning: number; missing: number }

function countDecorations(decorations: Map<string, SheetDecoration>): Counts {
  const counts: Counts = { error: 0, warning: 0, missing: 0 }
  for (const [key, decoration] of decorations) {
    if (key.startsWith('0:') || decoration.tone === 'row-error' || decoration.tone === 'selected') continue
    counts[decoration.tone]++
  }
  return counts
}

const columnKeyAt = (layout: SheetLayout | null, col: number) => {
  if (!layout) return undefined
  for (const [key, index] of layout.columnIndex) if (index === col) return key
  return undefined
}

const ResultSpreadsheet = forwardRef<ResultSpreadsheetHandle, ResultSpreadsheetProps>(function ResultSpreadsheet(
  { source, columns, view, readOnly, onChange, onRowsChange, liveDerive, onSelectionChange, onAction, legendContainer, readOnlyHint },
  ref,
) {
  const frameRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<FUniver | null>(null)
  const baselineRef = useRef<string | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onRowsChangeRef = useRef(onRowsChange)
  onRowsChangeRef.current = onRowsChange
  const liveDeriveRef = useRef(liveDerive)
  liveDeriveRef.current = liveDerive
  const onSelectionChangeRef = useRef(onSelectionChange)
  onSelectionChangeRef.current = onSelectionChange
  const onActionRef = useRef(onAction)
  onActionRef.current = onAction
  const viewRef = useRef(view)
  viewRef.current = view
  const readOnlyRef = useRef(readOnly)
  readOnlyRef.current = readOnly
  const readOnlyHintRef = useRef(readOnlyHint)
  readOnlyHintRef.current = readOnlyHint
  // Contrato y registros al abrir: la hoja se carga una sola vez por apertura del modal.
  const openRef = useRef({
    source,
    contract: { title: source.sheetName, columns, keyColumn: source.keyColumn } as SheetContract,
    baseRows: recordRowsOf(view.rows),
  })
  const layoutRef = useRef<SheetLayout | null>(null)
  /** Registro por fila de la hoja, para dibujar y alternar las casillas de selección. */
  const rowIdsRef = useRef(new Map<number, string>())
  const decorationsRef = useRef(new Map<string, SheetDecoration>())
  const lastAppliedRef = useRef(viewValues(view.rows))
  const applyRef = useRef<((includeWrites: boolean) => void) | null>(null)
  const [workbook, setWorkbook] = useState<IWorkbookData | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [tip, setTip] = useState<{ text: string; tone: DecorationTone; x: number; y: number } | null>(null)
  const [counts, setCounts] = useState<Counts>({ error: 0, warning: 0, missing: 0 })

  useEffect(() => {
    let cancelled = false
    const { source, contract } = openRef.current
    const rows = viewRef.current.rows
    void (async () => {
      let next: IWorkbookData
      let message: string | null = null
      try {
        const file = await source.load()
        if (file) {
          const reconciled = reconcileResultWorkbook(await xlsxToWorkbookData(await file.arrayBuffer(), contract.title), contract, rows)
          next = reconciled.workbook
          if (reconciled.regenerated) message = 'El archivo guardado ya no correspondía a los registros de este resultado; se generó de nuevo a partir de los datos.'
        } else {
          next = buildResultWorkbook(contract, rows)
        }
      } catch (error) {
        next = buildResultWorkbook(contract, rows)
        message = `No se pudo abrir el archivo guardado (${error instanceof Error ? error.message : 'error desconocido'}). Se muestra la hoja generada a partir de los datos.`
      }
      if (cancelled) return
      setNotice(message)
      setWorkbook(next)
    })()
    return () => { cancelled = true }
  }, [])

  // Bloquear o habilitar la edición sin volver a montar la hoja (p. ej. "Guardar cambios" / "Editar").
  useEffect(() => {
    apiRef.current?.getActiveWorkbook()?.setEditable(!readOnly)
  }, [readOnly])

  useEffect(() => {
    const host = hostRef.current
    if (!workbook || !host) return
    const { contract, baseRows } = openRef.current
    const sheetColumns = sheetColumnsOf(contract)
    const actionLabel = sheetColumns.find((column) => column.kind === 'action')?.actionLabel ?? 'Abrir'
    // Un nodo propio por instancia: al desmontar (o en el doble montaje de StrictMode) la
    // instancia anterior se libera sin tocar la nueva.
    const mount = document.createElement('div')
    mount.className = 'result-spreadsheet-mount'
    host.appendChild(mount)
    const { univer, univerAPI } = createUniver({
      locale: LocaleType.ES_ES,
      locales: { [LocaleType.ES_ES]: mergeLocales(sheetsCoreEsES) },
      presets: [UniverSheetsCorePreset({
        container: mount,
        header: true,
        toolbar: true,
        ribbonType: 'classic',
        // Folios y cédulas son texto a propósito: sin la marca ni el aviso de "número como texto".
        sheets: { disableForceStringAlert: true, disableForceStringMark: true },
        disableTextFormatAlert: true,
        disableTextFormatMark: true,
      })],
    })
    const fWorkbook = univerAPI.createWorkbook(workbook)
    const unitId = fWorkbook.getId()
    if (readOnlyRef.current) fWorkbook.setEditable(false)
    apiRef.current = univerAPI

    // Escrituras del sistema (columnas calculadas, filas de solo lectura): sin historial de deshacer.
    let applying = false
    const writeCells = (subUnitId: string, cellValue: Record<number, Record<number, ICellData | null>>) => {
      applying = true
      try {
        univerAPI.syncExecuteCommand(SET_RANGE_VALUES, { unitId, subUnitId, cellValue })
      } finally {
        applying = false
      }
    }

    // Resaltado de alertas: estilo y marca de esquina sin tocar los datos de la celda.
    // La casilla de selección también se dibuja aquí: la celda sigue vacía en los datos.
    const interceptor = univer.__getInjector().get(SheetInterceptorService).intercept(INTERCEPTOR_POINT.CELL_CONTENT, {
      priority: 100,
      effect: InterceptorEffectEnum.Style | InterceptorEffectEnum.Value,
      handler: (cell, pos, next) => {
        const layout = layoutRef.current
        if (pos.unitId !== unitId || pos.subUnitId !== layout?.sheetId) return next(cell)
        let result = cell
        const rowId = pos.col === layout.selectionColumn ? rowIdsRef.current.get(pos.row) : undefined
        if (rowId) result = { ...(result ?? {}), v: viewRef.current.selected?.has(rowId) ? CHECKED : UNCHECKED, t: 1 }
        const actionRowId = pos.col === layout.actionColumn ? rowIdsRef.current.get(pos.row) : undefined
        if (actionRowId) {
          const available = viewRef.current.actions?.get(actionRowId) === null
          result = {
            ...(result ?? {}),
            v: available ? actionLabel : '—',
            t: 1,
            interceptorStyle: available ? { ...result?.interceptorStyle, cl: { rgb: '#1D4ED8' }, bl: 1, ul: { s: 1 } } : { ...result?.interceptorStyle, cl: { rgb: '#9CA3AF' }, bl: 0 },
          }
        }
        const decoration = decorationsRef.current.get(`${pos.row}:${pos.col}`)
        if (!decoration) return next(result)
        const tone = TONES[decoration.tone]
        const base = result ?? {}
        return next({
          ...base,
          interceptorStyle: { ...base.interceptorStyle, bg: { rgb: tone.bg } },
          ...(tone.mark ? { markers: { ...base.markers, [tone.mark.corner]: { color: tone.mark.color, size: 7 } } } : {}),
        })
      },
    })

    // Al desplazarse, Univer reutiliza lo ya pintado y solo dibuja la franja nueva; con escalas de
    // pantalla no enteras (125 %, 150 %) esas copias dejan líneas blancas entre columnas. Cuando el
    // desplazamiento se detiene, la hoja se vuelve a pintar completa desde cero.
    let repaintTimer: number | undefined
    const repaintAll = () => {
      const render = univer.__getInjector().get(IRenderManagerService).getRenderUnitById(unitId)
      if (!render) return
      // Lo mismo que hace Univer al redimensionar o cambiar el zoom: sin reutilizar lo ya pintado.
      render.components.forEach((component) => (component as { makeForceDirty?: (state: boolean) => void }).makeForceDirty?.(true))
      for (const viewport of render.scene.getViewports()) viewport.markForceDirty(true)
      render.scene.makeDirty(true)
    }
    const scrolled = univerAPI.addEvent(univerAPI.Event.Scroll, () => {
      window.clearTimeout(repaintTimer)
      repaintTimer = window.setTimeout(repaintAll, 120)
    })

    const apply = (includeWrites: boolean, snapshot = fWorkbook.save()) => {
      const plan = planSheetUpdate(snapshot, contract, viewRef.current, lastAppliedRef.current, includeWrites)
      layoutRef.current = plan.layout
      rowIdsRef.current = new Map([...plan.layout.records].map(([id, row]) => [row, id]))
      decorationsRef.current = plan.decorations
      if (includeWrites) lastAppliedRef.current = viewValues(viewRef.current.rows)
      if (plan.hasWrites) writeCells(plan.layout.sheetId, plan.writes)
      try {
        fWorkbook.getSheetBySheetId(plan.layout.sheetId)?.refreshCanvas()
      } catch {
        // Aún no hay lienzo (recién creado el libro): el primer dibujo ya usa el resaltado.
      }
      setCounts(countDecorations(plan.decorations))
    }
    applyRef.current = apply
    apply(true)

    const fingerprint = () => workbookFingerprint(fWorkbook.save())
    baselineRef.current = fingerprint()
    let userActed = false
    const markActed = () => { userActed = true }
    mount.addEventListener('pointerdown', markActed, true)
    mount.addEventListener('keydown', markActed, true)
    // Lo que Univer ajusta al cargar no es una edición del revisor.
    const settle = window.setTimeout(() => { if (!userActed) baselineRef.current = fingerprint() }, SETTLE_MS)

    // Tras cada edición: leer los registros, avisar a la revisión y recolocar el resaltado.
    const read = () => {
      const snapshot = fWorkbook.save()
      const result = readResultRows(snapshot, contract, baseRows)
      onRowsChangeRef.current(result.rows, result.errors)
      apply(false, snapshot)
      onChangeRef.current(workbookFingerprint(snapshot) !== baselineRef.current)
    }
    let readTimer: number | undefined
    const listener = univerAPI.addEvent(univerAPI.Event.CommandExecuted, (event) => {
      if (applying || event.type !== CommandType.MUTATION || IGNORED_MUTATIONS.has(event.id)) return
      window.clearTimeout(readTimer)
      readTimer = window.setTimeout(read, READ_DELAY_MS)
    })

    // Encabezados, columnas que calcula el sistema y filas informativas no se escriben a mano.
    // Pegar o borrar sobre ellos lo detiene la validación al guardar.
    let hintTimer: number | undefined
    const showHint = (text: string) => {
      setHint(text)
      window.clearTimeout(hintTimer)
      hintTimer = window.setTimeout(() => setHint(null), 4000)
    }
    const guard = univerAPI.addEvent(univerAPI.Event.BeforeSheetEditStart, (params) => {
      const layout = layoutRef.current
      if (!layout || params.worksheet.getSheetId() !== layout.sheetId) return
      const key = columnKeyAt(layout, params.column)
      const column = sheetColumns.find((c) => c.key === key)
      if (column?.kind === 'selection') {
        // La casilla no se escribe: la barra espaciadora la alterna (el clic ya lo hace).
        params.cancel = true
        if (params.eventType === KEYBOARD_EVENT) toggleSelection(params.row)
      } else if (column?.kind === 'action') {
        // El botón no se escribe: Enter o Espacio lo usan (el clic ya lo hace).
        params.cancel = true
        if (params.eventType === KEYBOARD_EVENT) runAction(params.row)
      } else if (params.row === 0 && column) {
        params.cancel = true
        showHint('Los encabezados de la fila 1 identifican las columnas del resultado y no se editan.')
      } else if (layout.readonly.some((row) => row.rowIndex === params.row)) {
        params.cancel = true
        showHint('Esta fila es informativa (no es un registro de este resultado) y no se edita.')
      } else if (column?.editable === false) {
        params.cancel = true
        const identifies = column.key === ID_COLUMN_KEY || column.key === contract.keyColumn
        showHint(identifies ? `"${column.label}" identifica cada registro y no se edita.` : `"${column.label}" lo completa el sistema y no se edita.`)
      }
    })

    // Selección: clic en una casilla la alterna; en el encabezado marca o desmarca todas.
    const toggleSelection = (row: number) => {
      const notify = onSelectionChangeRef.current
      if (!notify || layoutRef.current?.selectionColumn === undefined) return
      const current = viewRef.current.selected ?? new Set<string>()
      const recordIds = [...(layoutRef.current?.records.keys() ?? [])]
      if (row === 0) {
        notify(current.size === recordIds.length ? new Set() : new Set(recordIds))
        return
      }
      const rowId = rowIdsRef.current.get(row)
      if (!rowId) return
      const next = new Set(current)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      notify(next)
    }
    // Columna de acción: el botón de cada registro (sin botón, se explica por qué).
    const runAction = (row: number) => {
      const rowId = rowIdsRef.current.get(row)
      if (!rowId) return
      const reason = viewRef.current.actions?.get(rowId)
      if (reason === null) onActionRef.current?.(rowId)
      else if (reason) showHint(reason)
    }
    const clicks = univerAPI.addEvent(univerAPI.Event.CellClicked, (params) => {
      const layout = layoutRef.current
      if (!layout || params.worksheet.getSheetId() !== layout.sheetId) return
      if (params.column === layout.selectionColumn) toggleSelection(params.row)
      else if (params.column === layout.actionColumn) runAction(params.row)
    })

    // La columna Selección siempre está en A, visible e inmovilizada: lo que la quite se deshace.
    const plain = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
    const pinnedLabel = sheetColumns[0]?.kind ? sheetColumns[0].label : undefined
    const pinnedMessage = `La columna "${pinnedLabel}" siempre va en la columna A: no se puede quitar, mover ni ocultar.`
    let structureTimer: number | undefined
    let undoing = false
    const setFrozen = (subUnitId: string, freeze: ReturnType<typeof freezeWithSelection>) => {
      if (!freeze) return
      applying = true
      try {
        univerAPI.syncExecuteCommand(SET_FROZEN, { unitId, subUnitId, ...freeze })
      } finally {
        applying = false
      }
    }
    const checkStructure = () => {
      const layout = layoutRef.current
      const worksheet = layout ? fWorkbook.getSheetBySheetId(layout.sheetId) : null
      if (!pinnedLabel || !layout || !worksheet) return
      const header = plain(String(worksheet.getRange(0, 0).getValue() ?? ''))
      if (header !== plain(pinnedLabel) || !worksheet.getSheet().getColVisible(0)) {
        undoing = true
        showHint(pinnedMessage)
        void univerAPI.undo().finally(() => {
          // Univer no recalcula la zona inmovilizada al deshacer: se vuelve a aplicar y se redibuja.
          window.setTimeout(() => {
            const sheet = worksheet.getSheet()
            setFrozen(layout.sheetId, freezeWithSelection(sheet.getFreeze()) ?? sheet.getFreeze())
            try {
              worksheet.refreshCanvas()
            } catch {
              // Sin lienzo todavía: el siguiente dibujo ya es correcto.
            }
            undoing = false
          }, 50)
        })
        return
      }
      setFrozen(layout.sheetId, freezeWithSelection(worksheet.getSheet().getFreeze()))
    }
    // Antes de ejecutar: no se elimina, oculta ni mueve la columna A, ni se inserta delante de ella.
    const blockStructure = univerAPI.addEvent(univerAPI.Event.BeforeCommandExecute, (event) => {
      if (!pinnedLabel || (!COLUMN_REMOVERS.has(event.id) && !COLUMN_INSERTERS.has(event.id))) return
      const layout = layoutRef.current
      const params = (event.params ?? {}) as { subUnitId?: string; range?: unknown; ranges?: unknown[]; fromRange?: unknown; toRange?: unknown }
      const sheetId = params.subUnitId ?? fWorkbook.getActiveSheet()?.getSheetId()
      if (!layout || sheetId !== layout.sheetId) return
      const fromParams = [params.range, ...(params.ranges ?? []), params.fromRange].map(asRange).filter((range): range is ColumnRange => Boolean(range))
      const ranges = fromParams.length
        ? fromParams
        : (fWorkbook.getActiveSheet()?.getSelection()?.getActiveRangeList() ?? []).map((range) => range.getRange())
      const target = asRange(params.toRange)
      const touchesA = COLUMN_INSERTERS.has(event.id)
        ? ranges.some((range) => range.startColumn <= 0)
        : ranges.some((range) => range.startColumn <= 0) || target?.startColumn === 0
      if (!touchesA) return
      event.cancel = true
      showHint(pinnedMessage)
    })

    // Solo lectura: en lugar del diálogo de permisos de Univer ("contacta al creador"), un aviso
    // propio que explica cómo volver a editar. Univer cancela la edición antes de emitir sus
    // eventos, así que el intento (escribir o doble clic en una celda) se detecta en el DOM.
    univerAPI.setPermissionDialogVisible(false)
    const readOnlyNotice = () => showHint(readOnlyHintRef.current ?? 'Esta hoja está en solo lectura.')
    const onReadOnlyKey = (event: KeyboardEvent) => {
      if (!readOnlyRef.current || (event.target as HTMLElement | null)?.closest('input, textarea')) return
      const typing = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
      if (typing || event.key === 'F2' || event.key === 'Backspace' || event.key === 'Delete') readOnlyNotice()
    }
    const onReadOnlyDoubleClick = (event: MouseEvent) => {
      if (readOnlyRef.current && event.target instanceof HTMLCanvasElement) readOnlyNotice()
    }
    mount.addEventListener('keydown', onReadOnlyKey, true)
    mount.addEventListener('dblclick', onReadOnlyDoubleClick, true)

    const structure = univerAPI.addEvent(univerAPI.Event.CommandExecuted, (event) => {
      if (applying || undoing || !pinnedLabel || event.type !== CommandType.COMMAND) return
      window.clearTimeout(structureTimer)
      structureTimer = window.setTimeout(checkStructure, 0)
    })

    // Mientras se escribe: da formato a la cifra (p. ej. "$ 93.468.040") y completa columnas
    // derivadas (p. ej. el valor negociado en letras).
    let typedText = ''
    let formatting = false
    const formatWhileTyping = (column: ResultColumn | undefined, text: string): string => {
      if (column?.liveFormat !== 'pesos' || formatting) return text
      const formatted = formatPesosWhileTyping(text, caretAfterEdit(typedText, text))
      if (formatted.text === text) return text
      // El editor de la celda es un documento de Univer: se reemplaza su texto y se recoloca el cursor.
      const editor = univerAPI.getActiveDocument()
      if (!editor?.getId().startsWith(EDITOR_UNIT_PREFIX)) return text
      formatting = true
      try {
        if (!editor.getTextRange(0, text.length).setText(formatted.text)) return text
        editor.setSelection(formatted.caret, formatted.caret)
        return formatted.text
      } catch {
        return text // Sin formato en vivo: la cifra se valida igual al guardar.
      } finally {
        formatting = false
      }
    }
    const editStarted = univerAPI.addEvent(univerAPI.Event.SheetEditStarted, () => {
      typedText = ''
    })
    const live = univerAPI.addEvent(univerAPI.Event.SheetEditChanging, (params) => {
      const layout = layoutRef.current
      if (!layout || params.row === 0 || params.worksheet.getSheetId() !== layout.sheetId) return
      const key = columnKeyAt(layout, params.column)
      const text = formatWhileTyping(sheetColumns.find((c) => c.key === key), params.value.toPlainText())
      typedText = text
      const derive = liveDeriveRef.current
      const targets = key && derive ? derive(key, text) : null
      if (!targets) return
      const line: Record<number, ICellData> = {}
      for (const [targetKey, text] of Object.entries(targets)) {
        const col = layout.columnIndex.get(targetKey)
        if (col !== undefined) line[col] = text ? { v: text, t: 1, p: null, f: null } : { v: null, p: null, f: null }
      }
      if (Object.keys(line).length) writeCells(layout.sheetId, { [params.row]: line })
    })

    // Detalle de la alerta al pasar el cursor sobre una casilla resaltada.
    const pointer = { x: 0, y: 0 }
    const trackPointer = (event: PointerEvent) => {
      const rect = frameRef.current?.getBoundingClientRect()
      if (rect) Object.assign(pointer, { x: event.clientX - rect.left, y: event.clientY - rect.top })
    }
    const hideTip = () => setTip(null)
    // En captura: Univer detiene la propagación de los eventos del lienzo.
    mount.addEventListener('pointermove', trackPointer, true)
    mount.addEventListener('pointerleave', hideTip)
    for (const type of ['pointerdown', 'keydown', 'wheel'] as const) mount.addEventListener(type, hideTip, true)
    const hover = univerAPI.addEvent(univerAPI.Event.CellHover, (params) => {
      const layout = layoutRef.current
      const onSheet = Boolean(layout) && params.worksheet.getSheetId() === layout!.sheetId
      const actionRowId = onSheet && params.column === layout!.actionColumn ? rowIdsRef.current.get(params.row) : undefined
      const reason = actionRowId ? viewRef.current.actions?.get(actionRowId) : undefined
      if (reason) {
        setTip({ text: reason, tone: 'warning', x: pointer.x, y: pointer.y })
        return
      }
      const decoration = onSheet ? decorationsRef.current.get(`${params.row}:${params.column}`) : undefined
      setTip(decoration?.message ? { text: decoration.message, tone: decoration.tone, x: pointer.x, y: pointer.y } : null)
    })

    return () => {
      window.clearTimeout(settle)
      window.clearTimeout(readTimer)
      window.clearTimeout(hintTimer)
      window.clearTimeout(structureTimer)
      window.clearTimeout(repaintTimer)
      for (const disposable of [guard, editStarted, live, hover, listener, interceptor, clicks, structure, blockStructure, scrolled]) disposable.dispose()
      mount.removeEventListener('keydown', onReadOnlyKey, true)
      mount.removeEventListener('dblclick', onReadOnlyDoubleClick, true)
      mount.removeEventListener('pointerdown', markActed, true)
      mount.removeEventListener('keydown', markActed, true)
      mount.removeEventListener('pointermove', trackPointer, true)
      mount.removeEventListener('pointerleave', hideTip)
      for (const type of ['pointerdown', 'keydown', 'wheel'] as const) mount.removeEventListener(type, hideTip, true)
      if (applyRef.current === apply) applyRef.current = null
      if (apiRef.current === univerAPI) apiRef.current = null
      // Univer desmonta su propia raíz de React: hacerlo fuera del commit de React.
      window.setTimeout(() => {
        univer.dispose()
        mount.remove()
      }, 0)
    }
  }, [workbook])

  // La revisión recalculó la vista (cotejo, letras, alertas): reflejarla en la hoja.
  useEffect(() => {
    applyRef.current?.(true)
  }, [view])

  useImperativeHandle(ref, () => ({
    async collect({ commitEditing = false } = {}) {
      const fWorkbook = apiRef.current?.getActiveWorkbook()
      if (!fWorkbook) throw new Error('La hoja de cálculo aún se está cargando.')
      if (commitEditing && fWorkbook.isCellEditing()) await fWorkbook.endEditingAsync(true)
      const snapshot = fWorkbook.save()
      const { contract, baseRows } = openRef.current
      const read = readResultRows(snapshot, contract, baseRows)
      const bytes = await workbookDataToXlsx(snapshot)
      return { ...read, file: new Blob([bytes as BlobPart], { type: XLSX_MIME }), fingerprint: workbookFingerprint(snapshot) }
    },
    isEditing: () => Boolean(apiRef.current?.getActiveWorkbook()?.isCellEditing()),
    markSaved(fingerprint) {
      baselineRef.current = fingerprint
      const fWorkbook = apiRef.current?.getActiveWorkbook()
      if (fWorkbook) onChangeRef.current(workbookFingerprint(fWorkbook.save()) !== fingerprint)
    },
    focusCell(rowId, columnKey) {
      const layout = layoutRef.current
      const fWorkbook = apiRef.current?.getActiveWorkbook()
      if (!layout || !fWorkbook) return
      const row = layout.records.get(rowId) ?? layout.readonly.find((item) => item.id === rowId)?.rowIndex
      if (row === undefined) return
      const col = layout.columnIndex.get(columnKey) ?? 0
      const worksheet = fWorkbook.getSheetBySheetId(layout.sheetId)
      if (!worksheet) return
      worksheet.activate()
      worksheet.getRange(row, col).activate()
      worksheet.scrollToCell(row, col)
    },
  }), [])

  const total = counts.error + counts.warning + counts.missing

  const legend = (
    <div className="result-spreadsheet-legend" role="status" aria-live="polite">
      {total === 0 ? (
        <span className="is-ok">Sin casillas resaltadas.</span>
      ) : (
        <>
          {counts.error > 0 && <span className="is-error"><i aria-hidden="true" />{counts.error} con error</span>}
          {counts.warning > 0 && <span className="is-warning"><i aria-hidden="true" />{counts.warning} con advertencia</span>}
          {counts.missing > 0 && <span className="is-missing"><i aria-hidden="true" />{counts.missing} sin dato</span>}
          <span className="result-spreadsheet-legend-help">Pasa el cursor sobre una casilla resaltada para ver el detalle.</span>
        </>
      )}
    </div>
  )

  return (
    <div className="result-spreadsheet">
      {notice && (
        <div className="result-spreadsheet-notice" role="status">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}
      {legendContainer ? createPortal(legend, legendContainer) : legend}
      <div ref={frameRef} className="result-spreadsheet-frame">
        <div ref={hostRef} className="result-spreadsheet-host" />
        {tip && (
          <div
            className={`result-spreadsheet-tip is-${tip.tone}`}
            role="tooltip"
            style={{ left: Math.min(tip.x + 14, (frameRef.current?.clientWidth ?? 600) - 340), top: tip.y + 18 }}
          >
            {tip.text}
          </div>
        )}
        {/* Flotante: no mueve la cuadrícula mientras se hace clic. */}
        <div className="result-spreadsheet-hint" role="status" aria-live="polite">
          {hint && (
            <span>
              <AlertTriangle size={14} aria-hidden="true" />
              {hint}
            </span>
          )}
        </div>
        {!workbook && (
          <div className="result-spreadsheet-loading" role="status">
            <LoaderCircle size={18} className="spin" aria-hidden="true" />
            <span>Cargando hoja de cálculo…</span>
          </div>
        )}
      </div>
    </div>
  )
})

export default ResultSpreadsheet
