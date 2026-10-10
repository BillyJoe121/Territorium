/**
 * Comportamientos que ResultSpreadsheet instala sobre una hoja de Univer recién creada. Cada
 * instalador devuelve su limpieza; el componente los instala en orden y los libera al desmontar.
 */
import { CommandType, InterceptorEffectEnum, type createUniver, type FUniver, type ICellData } from '@univerjs/presets'
import { INTERCEPTOR_POINT, IRenderManagerService, SheetInterceptorService } from '@univerjs/preset-sheets-core'
import type { MutableRefObject } from 'react'
import { formatPesosWhileTyping } from '../../lib/negotiatedValue'
import {
  freezeWithSelection,
  ID_COLUMN_KEY,
  sheetColumnsOf,
  type DecorationTone,
  type SheetContract,
  type SheetDecoration,
  type SheetLayout,
  type SheetView,
} from '../../lib/spreadsheet/resultSheet'
import type { ResultColumn } from './types'

type Univer = ReturnType<typeof createUniver>['univer']
type FWorkbook = ReturnType<FUniver['createWorkbook']>
export type Dispose = () => void

export interface SheetBehaviorContext {
  univer: Univer
  univerAPI: FUniver
  fWorkbook: FWorkbook
  unitId: string
  /** Nodo donde Univer dibuja la hoja; recibe los eventos del DOM en captura. */
  mount: HTMLElement
  contract: SheetContract
  sheetColumns: ReturnType<typeof sheetColumnsOf>
  layoutRef: MutableRefObject<SheetLayout | null>
  /** Registro por fila de la hoja. */
  rowIdsRef: MutableRefObject<Map<number, string>>
  decorationsRef: MutableRefObject<Map<string, SheetDecoration>>
  viewRef: MutableRefObject<SheetView>
  /** `applying`: escritura del sistema en curso; `undoing`: se deshace un cambio de estructura. */
  flags: { applying: boolean; undoing: boolean }
  /** Escritura del sistema (sin historial de deshacer). */
  writeCells: (subUnitId: string, cellValue: Record<number, Record<number, ICellData | null>>) => void
  /** Aviso flotante breve sobre la hoja. */
  showHint: (text: string) => void
}

const SET_FROZEN = 'sheet.mutation.set-frozen'
const CHECKED = '☑'
const UNCHECKED = '☐'
const KEYBOARD_EVENT = 4 // DeviceInputEventType.Keyboard de @univerjs/engine-render
// Documentos internos de Univer que editan una celda (la casilla y la barra de fórmulas).
const EDITOR_UNIT_PREFIX = '__INTERNAL_EDITOR__'

export const TONES: Record<DecorationTone, { bg: string; mark?: { corner: 'tl' | 'tr'; color: string } }> = {
  error: { bg: '#FDE2E4', mark: { corner: 'tr', color: '#D92D20' } },
  warning: { bg: '#FFEBD2', mark: { corner: 'tr', color: '#F79009' } },
  missing: { bg: '#FFF6D9', mark: { corner: 'tl', color: '#CA8A04' } },
  'row-error': { bg: '#FFF4F4' },
  selected: { bg: '#E8F0FB' },
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

export const columnKeyAt = (layout: SheetLayout | null, col: number) => {
  if (!layout) return undefined
  for (const [key, index] of layout.columnIndex) if (index === col) return key
  return undefined
}

/** Posición del cursor tras una edición: final del tramo que cambió entre el texto anterior y el nuevo. */
function caretAfterEdit(previous: string, next: string): number {
  let suffix = 0
  const max = Math.min(previous.length, next.length)
  while (suffix < max && previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix++
  return next.length - suffix
}

/**
 * Resaltado de alertas: estilo y marca de esquina sin tocar los datos de la celda. La casilla de
 * selección y el botón de la columna de acción también se dibujan aquí: la celda sigue vacía.
 */
export function installCellDecorations(ctx: SheetBehaviorContext): Dispose {
  const { univer, unitId, layoutRef, rowIdsRef, viewRef, decorationsRef } = ctx
  const actionLabel = ctx.sheetColumns.find((column) => column.kind === 'action')?.actionLabel ?? 'Abrir'
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
  return () => interceptor.dispose()
}

/**
 * Al desplazarse, Univer reutiliza lo ya pintado y solo dibuja la franja nueva; con escalas de
 * pantalla no enteras (125 %, 150 %) esas copias dejan líneas blancas entre columnas. Cuando el
 * desplazamiento se detiene, la hoja se vuelve a pintar completa desde cero.
 */
export function installRepaintOnScroll(ctx: SheetBehaviorContext): Dispose {
  const { univer, univerAPI, unitId } = ctx
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
  return () => {
    window.clearTimeout(repaintTimer)
    scrolled.dispose()
  }
}

/**
 * Encabezados, columnas que calcula el sistema y filas informativas no se escriben a mano (pegar o
 * borrar sobre ellos lo detiene la validación al guardar). La columna Selección se alterna con clic
 * o barra espaciadora, y el botón de la columna de acción con clic, Enter o Espacio.
 */
export function installEditGuards(
  ctx: SheetBehaviorContext,
  callbacks: {
    onSelectionChangeRef: MutableRefObject<((selected: Set<string>) => void) | undefined>
    onActionRef: MutableRefObject<((rowId: string) => void) | undefined>
  },
): Dispose {
  const { univerAPI, contract, sheetColumns, layoutRef, rowIdsRef, viewRef, showHint } = ctx

  // Selección: clic en una casilla la alterna; en el encabezado marca o desmarca todas.
  const toggleSelection = (row: number) => {
    const notify = callbacks.onSelectionChangeRef.current
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
    if (reason === null) callbacks.onActionRef.current?.(rowId)
    else if (reason) showHint(reason)
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

  const clicks = univerAPI.addEvent(univerAPI.Event.CellClicked, (params) => {
    const layout = layoutRef.current
    if (!layout || params.worksheet.getSheetId() !== layout.sheetId) return
    if (params.column === layout.selectionColumn) toggleSelection(params.row)
    else if (params.column === layout.actionColumn) runAction(params.row)
  })

  return () => {
    guard.dispose()
    clicks.dispose()
  }
}

/**
 * La columna Selección (o de acción) siempre está en A, visible e inmovilizada: se bloquea lo que
 * la quitaría, movería u ocultaría, y lo que aun así la saque de su lugar se deshace.
 */
export function installPinnedFirstColumn(ctx: SheetBehaviorContext): Dispose {
  const { univerAPI, fWorkbook, unitId, sheetColumns, layoutRef, flags, showHint } = ctx
  const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
  const pinnedLabel = sheetColumns[0]?.kind ? sheetColumns[0].label : undefined
  const pinnedMessage = `La columna "${pinnedLabel}" siempre va en la columna A: no se puede quitar, mover ni ocultar.`
  let structureTimer: number | undefined
  const setFrozen = (subUnitId: string, freeze: ReturnType<typeof freezeWithSelection>) => {
    if (!freeze) return
    flags.applying = true
    try {
      univerAPI.syncExecuteCommand(SET_FROZEN, { unitId, subUnitId, ...freeze })
    } finally {
      flags.applying = false
    }
  }
  const checkStructure = () => {
    const layout = layoutRef.current
    const worksheet = layout ? fWorkbook.getSheetBySheetId(layout.sheetId) : null
    if (!pinnedLabel || !layout || !worksheet) return
    const header = plain(String(worksheet.getRange(0, 0).getValue() ?? ''))
    if (header !== plain(pinnedLabel) || !worksheet.getSheet().getColVisible(0)) {
      flags.undoing = true
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
          flags.undoing = false
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
  // Después de cada comando del revisor se comprueba que la columna siga en su lugar.
  const structure = univerAPI.addEvent(univerAPI.Event.CommandExecuted, (event) => {
    if (flags.applying || flags.undoing || !pinnedLabel || event.type !== CommandType.COMMAND) return
    window.clearTimeout(structureTimer)
    structureTimer = window.setTimeout(checkStructure, 0)
  })
  return () => {
    window.clearTimeout(structureTimer)
    blockStructure.dispose()
    structure.dispose()
  }
}

/**
 * Solo lectura: en lugar del diálogo de permisos de Univer ("contacta al creador"), un aviso
 * propio que explica cómo volver a editar. Univer cancela la edición antes de emitir sus
 * eventos, así que el intento (escribir o doble clic en una celda) se detecta en el DOM.
 */
export function installReadOnlyNotice(
  ctx: SheetBehaviorContext,
  readOnlyRef: MutableRefObject<boolean>,
  readOnlyHintRef: MutableRefObject<string | undefined>,
): Dispose {
  const { univerAPI, mount, showHint } = ctx
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
  return () => {
    mount.removeEventListener('keydown', onReadOnlyKey, true)
    mount.removeEventListener('dblclick', onReadOnlyDoubleClick, true)
  }
}

/**
 * Mientras se escribe: da formato a la cifra (p. ej. "$ 93.468.040") y completa columnas
 * derivadas (p. ej. el valor negociado en letras).
 */
export function installLiveTyping(
  ctx: SheetBehaviorContext,
  liveDeriveRef: MutableRefObject<((columnKey: string, text: string) => Record<string, string> | null) | undefined>,
): Dispose {
  const { univerAPI, sheetColumns, layoutRef, writeCells } = ctx
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
    for (const [targetKey, value] of Object.entries(targets)) {
      const col = layout.columnIndex.get(targetKey)
      if (col !== undefined) line[col] = value ? { v: value, t: 1, p: null, f: null } : { v: null, p: null, f: null }
    }
    if (Object.keys(line).length) writeCells(layout.sheetId, { [params.row]: line })
  })
  return () => {
    editStarted.dispose()
    live.dispose()
  }
}

/** Detalle de la alerta (o del motivo sin botón de acción) al pasar el cursor sobre una casilla. */
export function installHoverTips(
  ctx: SheetBehaviorContext,
  frameRef: MutableRefObject<HTMLDivElement | null>,
  setTip: (tip: { text: string; tone: DecorationTone; x: number; y: number } | null) => void,
): Dispose {
  const { univerAPI, mount, layoutRef, rowIdsRef, viewRef, decorationsRef } = ctx
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
    hover.dispose()
    mount.removeEventListener('pointermove', trackPointer, true)
    mount.removeEventListener('pointerleave', hideTip)
    for (const type of ['pointerdown', 'keydown', 'wheel'] as const) mount.removeEventListener(type, hideTip, true)
  }
}
