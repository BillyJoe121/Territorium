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
import type { ValidationNotice } from '../../lib/expedienteResultAdapters'
import type { EditableResultRow, ResultColumn } from './types'

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
  onChange: (rowId: string, key: string, value: string) => void
}

export function ResultDataTable({
  caption,
  columns: definitions,
  rows,
  validationNotices = [],
  isLoading = false,
  onChange,
}: ResultDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
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

  const tableMinWidth = definitions.reduce((total, definition) => total + (definition.width ?? 160), 0)

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
        >
          <span>{definition.label}</span>
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
        if (definition.editable === false) {
          return <span className="result-table-readonly">{value || '—'}</span>
        }

        return (
          <EditableTableCellInput
            initialValue={value}
            rowId={row.original.id}
            columnKey={definition.key}
            inputMode={definition.inputMode}
            ariaLabel={`${definition.label}, fila ${row.index + 1}`}
            hasNotice={fieldNotice !== undefined}
            noticeSeverity={fieldNotice?.severity}
            noticeMessage={fieldNotice?.message}
            onCommit={handleCommit}
          />
        )
      },
    }
  }), [definitions, noticeByField, handleCommit])

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

      <div className="result-table-scroll" ref={scrollContainerRef} tabIndex={0} aria-label={caption}>
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
                    <th key={header.id} style={{ minWidth: header.getSize() }} scope="col">
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
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
