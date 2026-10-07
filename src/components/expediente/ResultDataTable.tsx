import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ValidationNotice } from '../../lib/expedienteResultAdapters'
import { READONLY_ROW_FLAG } from '../../lib/planTitleLinking'
import type { EditableResultRow, ResultColumn } from './types'

/** Alerta sobre una casilla concreta (fila + columna). */
export interface CellAlert {
  severity: 'error' | 'warning'
  kind: string
  message: string
}

export const cellAlertKey = (rowId: string, columnKey: string) => `${rowId}::${columnKey}`

const ZOOM_LEVELS = [60, 75, 85, 100, 115, 125, 150]
const DEFAULT_ZOOM = 100

interface EditableTableCellInputProps {
  initialValue: string
  rowId: string
  columnKey: string
  inputMode?: 'text' | 'numeric'
  ariaLabel: string
  hasNotice: boolean
  noticeSeverity?: 'error' | 'warning'
  noticeMessage?: string
  placeholder?: string
  onCommit: (rowId: string, columnKey: string, value: string) => void
}

function EditableTableCellInput({
  initialValue,
  rowId,
  columnKey,
  inputMode,
  ariaLabel,
  hasNotice,
  noticeSeverity,
  noticeMessage,
  placeholder,
  onCommit,
}: EditableTableCellInputProps) {
  const [localValue, setLocalValue] = useState(initialValue)
  const isComposingRef = useRef(false)

  useEffect(() => {
    setLocalValue(initialValue)
  }, [initialValue])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = event.target.value
    setLocalValue(nextVal)
    onCommit(rowId, columnKey, nextVal)
  }

  return (
    <div className="result-table-cell-wrapper">
      <input
        className={`result-table-input ${hasNotice && noticeSeverity ? `has-notice ${noticeSeverity}` : ''}`}
        value={localValue}
        inputMode={inputMode === 'numeric' ? 'decimal' : 'text'}
        aria-label={ariaLabel}
        placeholder={placeholder}
        title={hasNotice && noticeMessage ? noticeMessage : undefined}
        onChange={handleChange}
        onCompositionStart={() => {
          isComposingRef.current = true
        }}
        onCompositionEnd={(e) => {
          isComposingRef.current = false
          handleChange(e as any)
        }}
      />
      {hasNotice && noticeMessage && (
        <span
          className={`cell-notice-indicator ${noticeSeverity}`}
          title={noticeMessage}
          aria-label={noticeMessage}
        >
          {noticeSeverity === 'error' ? <AlertCircle size={13} /> : <AlertTriangle size={13} />}
        </span>
      )}
    </div>
  )
}

interface ResultDataTableProps {
  caption: string
  columns: ResultColumn[]
  rows: EditableResultRow[]
  validationNotices?: ValidationNotice[]
  isLoading?: boolean
  /** Alertas por casilla, indexadas con cellAlertKey(rowId, columnKey). */
  cellAlerts?: Map<string, CellAlert>
  /** Clase CSS adicional por fila (p. ej. filas huérfanas). */
  rowClassName?: (row: EditableResultRow) => string | undefined
  onChange: (rowId: string, key: string, value: string) => void
}

export function ResultDataTable({
  caption,
  columns: definitions,
  rows,
  validationNotices = [],
  isLoading = false,
  cellAlerts,
  rowClassName,
  onChange,
}: ResultDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  // Vista flotante del texto completo de una casilla recortada.
  const [preview, setPreview] = useState<{ text: string; top: number; left: number; above: boolean } | null>(null)

  const showPreview = useCallback((cell: HTMLElement) => {
    const target = cell.querySelector<HTMLElement>('.result-table-input, .result-table-text')
    if (!target || target === document.activeElement) return
    const text = target instanceof HTMLInputElement ? target.value : target.textContent ?? ''
    // Solo cuando el texto no cabe en la casilla.
    if (!text.trim() || target.scrollWidth <= target.clientWidth + 1) return
    const rect = cell.getBoundingClientRect()
    const above = rect.bottom > window.innerHeight * 0.6
    setPreview({ text, left: Math.max(8, Math.min(rect.left, window.innerWidth - 460)), top: above ? rect.top - 6 : rect.bottom + 6, above })
  }, [])
  const hidePreview = useCallback(() => setPreview(null), [])
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const handleCommit = useCallback((rowId: string, key: string, value: string) => {
    onChangeRef.current(rowId, key, value)
  }, [])

  const handleZoomIn = () => {
    setZoom((prev) => {
      const idx = ZOOM_LEVELS.indexOf(prev)
      if (idx < ZOOM_LEVELS.length - 1) return ZOOM_LEVELS[idx + 1]
      return prev
    })
  }

  const handleZoomOut = () => {
    setZoom((prev) => {
      const idx = ZOOM_LEVELS.indexOf(prev)
      if (idx > 0) return ZOOM_LEVELS[idx - 1]
      return prev
    })
  }

  const handleResetZoom = () => setZoom(DEFAULT_ZOOM)

  const handleScrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -320, behavior: 'smooth' })
  }

  const handleScrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 320, behavior: 'smooth' })
  }

  // Columnas con textos largos: se muestran ~60 caracteres antes del "…".
  const LONG_TEXT_WIDTH = 440
  const longColumns = useMemo(() => {
    const set = new Set<string>()
    for (const definition of definitions) {
      if (rows.some((row) => String(row[definition.key] ?? '').length > 60)) set.add(definition.key)
    }
    return set
  }, [definitions, rows])
  const columnWidth = (key: string, width: number | undefined) => (longColumns.has(key) ? Math.max(width ?? 160, LONG_TEXT_WIDTH) : width ?? 160)
  const tableMinWidth = definitions.reduce((total, definition) => total + columnWidth(definition.key, definition.width), 0)

  // Map notices by field key
  const noticeByField = useMemo(() => {
    const map = new Map<string, ValidationNotice>()
    for (const notice of validationNotices) {
      map.set(notice.fieldName.toLowerCase(), notice)
    }
    return map
  }, [validationNotices])

  const columns = useMemo<ColumnDef<EditableResultRow>[]>(() => definitions.map((definition) => {
    const fieldNotice = noticeByField.get(definition.key.toLowerCase())

    return {
      accessorKey: definition.key,
      header: ({ column }) => (
        <button
          type="button"
          className="result-table-sort-btn"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          aria-label={`Ordenar por ${definition.label}`}
          title={definition.hint}
        >
          <span>{definition.label}{definition.required && <span className="result-table-required" aria-hidden="true"> *</span>}</span>
          <ArrowUpDown size={13} className="result-table-sort-icon" />
          {fieldNotice && (
            <span
              className={`result-table-header-notice ${fieldNotice.severity}`}
              title={fieldNotice.message}
              aria-label={fieldNotice.message}
            >
              {fieldNotice.severity === 'error' ? <AlertCircle size={13} /> : <AlertTriangle size={13} />}
            </span>
          )}
        </button>
      ),
      size: definition.width,
      cell: ({ getValue, row }) => {
        const value = String(getValue() ?? '')
        const cellAlert = cellAlerts?.get(cellAlertKey(row.original.id, definition.key))
        if (definition.editable === false || row.original[READONLY_ROW_FLAG] === 'true') {
          return (
            <span
              className={`result-table-readonly${cellAlert ? ` has-alert ${cellAlert.severity} kind-${cellAlert.kind}` : ''}`}
              title={cellAlert?.message}
            >
              {cellAlert && (
                <span className={`cell-notice-indicator ${cellAlert.severity}`} aria-label={cellAlert.message}>
                  {cellAlert.severity === 'error' ? <AlertCircle size={13} /> : <AlertTriangle size={13} />}
                </span>
              )}
              <span className="result-table-text">{value || '—'}</span>
            </span>
          )
        }

        const notice = cellAlert ?? fieldNotice
        return (
          <EditableTableCellInput
            initialValue={value}
            rowId={row.original.id}
            columnKey={definition.key}
            inputMode={definition.inputMode}
            ariaLabel={`${definition.label}, fila ${row.index + 1}`}
            hasNotice={notice !== undefined}
            noticeSeverity={notice?.severity}
            noticeMessage={notice?.message}
            placeholder={definition.placeholder}
            onCommit={handleCommit}
          />
        )
      },
    }
  }), [definitions, noticeByField, handleCommit, cellAlerts])

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
  })

  const currentZoomIndex = ZOOM_LEVELS.indexOf(zoom)
  const canZoomIn = currentZoomIndex < ZOOM_LEVELS.length - 1
  const canZoomOut = currentZoomIndex > 0

  return (
    <div className="result-table-container">
      <div className="result-table-toolbar">
        <div className="result-table-toolbar-left">
          <div className="result-table-search-box">
            <Search size={14} className="search-icon" />
            <input
              type="search"
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Buscar en resultados..."
              aria-label="Filtrar resultados de la tabla"
            />
          </div>

          {validationNotices.length > 0 && (
            <div className="result-table-notices-summary" role="status">
              <AlertTriangle size={14} />
              <span>{validationNotices.length} observación(es)</span>
            </div>
          )}
        </div>

        <div className="result-table-toolbar-right">
          {/* Scroll lateral rápido */}
          <div className="result-table-nav-controls" role="group" aria-label="Navegación horizontal de la tabla">
            <button
              type="button"
              className="result-table-toolbar-btn"
              onClick={handleScrollLeft}
              title="Desplazar tabla a la izquierda"
              aria-label="Desplazar tabla a la izquierda"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              className="result-table-toolbar-btn"
              onClick={handleScrollRight}
              title="Desplazar tabla a la derecha"
              aria-label="Desplazar tabla a la derecha"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Controles de Zoom */}
          <div className="result-table-zoom-toolbar" role="group" aria-label="Controles de zoom de la tabla">
            <button
              type="button"
              className="result-table-toolbar-btn"
              onClick={handleZoomOut}
              disabled={!canZoomOut}
              title="Reducir zoom (Zoom -)"
              aria-label="Reducir zoom de tabla"
            >
              <ZoomOut size={14} />
            </button>
            <button
              type="button"
              className="result-table-zoom-badge"
              onClick={handleResetZoom}
              title="Restablecer zoom al 100%"
              aria-label={`Zoom actual ${zoom}%. Clic para restablecer al 100%`}
            >
              <span>{zoom}%</span>
            </button>
            <button
              type="button"
              className="result-table-toolbar-btn"
              onClick={handleZoomIn}
              disabled={!canZoomIn}
              title="Aumentar zoom (Zoom +)"
              aria-label="Aumentar zoom de tabla"
            >
              <ZoomIn size={14} />
            </button>
            {zoom !== DEFAULT_ZOOM && (
              <button
                type="button"
                className="result-table-toolbar-btn reset-btn"
                onClick={handleResetZoom}
                title="Restablecer tamaño original (100%)"
                aria-label="Restablecer tamaño original al 100%"
              >
                <RotateCcw size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {preview && createPortal(
        <div
          className={`result-cell-preview${preview.above ? ' is-above' : ''}`}
          style={{ left: preview.left, top: preview.top }}
          role="tooltip"
        >
          {preview.text}
        </div>,
        document.body,
      )}
      <div className="result-table-scroll" ref={scrollContainerRef} onScroll={hidePreview} tabIndex={0} aria-label={caption}>
        <div
          className="result-table-zoom-container"
          style={{
            zoom: `${zoom}%`,
          }}
        >
          <table className="result-data-table" style={{ minWidth: tableMinWidth }}>
            <caption className="sr-only">{caption}</caption>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} style={{ minWidth: columnWidth(header.column.id, header.getSize()) }} scope="col">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={definitions.length} className="result-table-empty-cell">
                    <div className="table-loading-spinner">Cargando resultados...</div>
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={definitions.length} className="result-table-empty-cell">
                    <span>No hay registros para mostrar en esta vista.</span>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className={rowClassName?.(row.original)}>
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        onMouseEnter={(event) => showPreview(event.currentTarget)}
                        onMouseLeave={hidePreview}
                        onFocusCapture={hidePreview}
                      >
                        {/*
                          La celda se invoca como función y no como componente: las definiciones de
                          columna se recrean cuando cambian las alertas, y como componente React
                          desmontaría el input en cada tecla (se perdía el foco).
                        */}
                        {typeof cell.column.columnDef.cell === 'function'
                          ? cell.column.columnDef.cell(cell.getContext())
                          : flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
