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
import { CommandType, createUniver, LocaleType, mergeLocales, type FUniver, type ICellData, type IWorkbookData } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import sheetsCoreEsES from '@univerjs/preset-sheets-core/locales/es-ES'
import '@univerjs/preset-sheets-core/lib/index.css'
import { AlertTriangle, LoaderCircle } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { XLSX_MIME } from '../../data/resultSheetStorage'
import {
  buildResultWorkbook,
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
} from '../../lib/spreadsheet/resultSheet'
import { workbookDataToXlsx, xlsxToWorkbookData } from '../../lib/spreadsheet/univerXlsx'
import type { ResultSpreadsheetHandle, ResultSpreadsheetProps } from './resultSpreadsheetTypes'
import {
  installCellDecorations,
  installEditGuards,
  installHoverTips,
  installLiveTyping,
  installPinnedFirstColumn,
  installReadOnlyNotice,
  installRepaintOnScroll,
  type Dispose,
  type SheetBehaviorContext,
} from './univerSheetBehaviors'

export type { SheetView } from '../../lib/spreadsheet/resultSheet'
export type { ResultSpreadsheetHandle, ResultSpreadsheetProps, ResultSpreadsheetSnapshot, ResultSpreadsheetSource } from './resultSpreadsheetTypes'

// Tiempo para que Univer termine de calcular fórmulas y altos tras cargar el libro.
const SETTLE_MS = 800
const READ_DELAY_MS = 250
const SET_RANGE_VALUES = 'sheet.mutation.set-range-values'
// Ajustes automáticos de Univer que no son ediciones del revisor.
const IGNORED_MUTATIONS = new Set(['sheet.mutation.set-worksheet-row-auto-height', 'sheet.mutation.set-worksheet-row-is-auto-height'])

interface Counts { error: number; warning: number; missing: number }

function countDecorations(decorations: Map<string, SheetDecoration>): Counts {
  const counts: Counts = { error: 0, warning: 0, missing: 0 }
  for (const [key, decoration] of decorations) {
    if (key.startsWith('0:') || decoration.tone === 'row-error' || decoration.tone === 'selected') continue
    counts[decoration.tone]++
  }
  return counts
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
    const flags = { applying: false, undoing: false }
    const writeCells = (subUnitId: string, cellValue: Record<number, Record<number, ICellData | null>>) => {
      flags.applying = true
      try {
        univerAPI.syncExecuteCommand(SET_RANGE_VALUES, { unitId, subUnitId, cellValue })
      } finally {
        flags.applying = false
      }
    }

    // Aviso flotante breve (p. ej. por qué una casilla no se edita).
    let hintTimer: number | undefined
    const showHint = (text: string) => {
      setHint(text)
      window.clearTimeout(hintTimer)
      hintTimer = window.setTimeout(() => setHint(null), 4000)
    }
    const ctx: SheetBehaviorContext = {
      univer, univerAPI, fWorkbook, unitId, mount, contract, sheetColumns,
      layoutRef, rowIdsRef, decorationsRef, viewRef, flags, writeCells, showHint,
    }
    const disposers: Dispose[] = [installCellDecorations(ctx), installRepaintOnScroll(ctx)]

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
      if (flags.applying || event.type !== CommandType.MUTATION || IGNORED_MUTATIONS.has(event.id)) return
      window.clearTimeout(readTimer)
      readTimer = window.setTimeout(read, READ_DELAY_MS)
    })

    disposers.push(
      installEditGuards(ctx, { onSelectionChangeRef, onActionRef }),
      installPinnedFirstColumn(ctx),
      installReadOnlyNotice(ctx, readOnlyRef, readOnlyHintRef),
      installLiveTyping(ctx, liveDeriveRef),
      installHoverTips(ctx, frameRef, setTip),
    )

    return () => {
      window.clearTimeout(settle)
      window.clearTimeout(readTimer)
      window.clearTimeout(hintTimer)
      listener.dispose()
      for (const dispose of disposers) dispose()
      mount.removeEventListener('pointerdown', markActed, true)
      mount.removeEventListener('keydown', markActed, true)
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
