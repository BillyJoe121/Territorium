import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { AlertCircle, AlertTriangle, ArrowUpDown, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ValidationNotice } from '../../lib/expedienteResultAdapters'
import type { EditableResultRow, ResultColumn } from './types'

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

        const hasCellNotice = fieldNotice !== undefined

        return (
          <div className="result-table-cell-wrapper">
            <input
              className={`result-table-input ${hasCellNotice ? `has-notice ${fieldNotice.severity}` : ''}`}
              value={value}
              inputMode={definition.inputMode === 'numeric' ? 'decimal' : 'text'}
              aria-label={`${definition.label}, fila ${row.index + 1}`}
              onChange={(event) => onChange(row.original.id, definition.key, event.target.value)}
            />
            {hasCellNotice && (
              <span
                className={`cell-notice-indicator ${fieldNotice.severity}`}
                title={fieldNotice.message}
                aria-label={fieldNotice.message}
              >
                {fieldNotice.severity === 'error' ? <AlertCircle size={13} /> : <AlertTriangle size={13} />}
              </span>
            )}
          </div>
        )
      },
    }
  }), [definitions, noticeByField, onChange])

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

  return (
    <div className="result-table-container">
      <div className="result-table-toolbar">
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
            <span>{validationNotices.length} observación(es) de validación detectada(s)</span>
          </div>
        )}
      </div>

      <div className="result-table-scroll" tabIndex={0} aria-label={caption}>
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
  )
}
