import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { FileSpreadsheet, CheckSquare, Square, Download, X } from 'lucide-react'

export interface ExcelSheetConfig {
  id: string
  name: string
  description: string
  defaultSelected: boolean
  columns: { key: string; label: string; defaultSelected: boolean }[]
}

export const DEFAULT_EXCEL_SHEETS: ExcelSheetConfig[] = [
  {
    id: 'correspondencia',
    name: 'CORRESPONDENCIA',
    description: 'Matriz consolidada con columnas maestras (Folio, Cédula, Áreas, Propietario)',
    defaultSelected: true,
    columns: [
      { key: 'propertyCode', label: 'Código Predial', defaultSelected: true },
      { key: 'folio', label: 'Folio Matrícula', defaultSelected: true },
      { key: 'cadastralCedula', label: 'Cédula Catastral', defaultSelected: true },
      { key: 'canonicalName', label: 'Nombre Predio', defaultSelected: true },
      { key: 'municipality', label: 'Municipio', defaultSelected: true },
      { key: 'areaTotal', label: 'Área Total (m²)', defaultSelected: true },
      { key: 'status', label: 'Estado de Revisión', defaultSelected: true },
    ],
  },
  {
    id: 'linderos',
    name: 'LINDEROS_Y_MEDIDAS',
    description: 'Transcripción perimetral y colindancias por punto cardinal',
    defaultSelected: true,
    columns: [
      { key: 'norte', label: 'Lindero Norte', defaultSelected: true },
      { key: 'sur', label: 'Lindero Sur', defaultSelected: true },
      { key: 'oriente', label: 'Lindero Oriente', defaultSelected: true },
      { key: 'occidente', label: 'Lindero Occidente', defaultSelected: true },
    ],
  },
  {
    id: 'gravamenes',
    name: 'GRAVAMENES_Y_LIMITACIONES',
    description: 'Relación de servidumbres, hipotecas, embargos y medidas cautelares',
    defaultSelected: false,
    columns: [
      { key: 'tipoGravamen', label: 'Tipo de Carga', defaultSelected: true },
      { key: 'beneficiario', label: 'Beneficiario / Entidad', defaultSelected: true },
      { key: 'estadoVigencia', label: 'Vigencia', defaultSelected: true },
    ],
  },
  {
    id: 'trazabilidad',
    name: 'AUDITORIA_FORENSE',
    description: 'Historial inmutable con autor, timestamp y hash SHA-256 por cada atributo',
    defaultSelected: false,
    columns: [
      { key: 'atributo', label: 'Campo Modificado', defaultSelected: true },
      { key: 'autor', label: 'Usuario Responsable', defaultSelected: true },
      { key: 'fechaHora', label: 'Marca de Tiempo (UTC)', defaultSelected: true },
      { key: 'motivo', label: 'Motivo del Cambio', defaultSelected: true },
    ],
  },
]

interface ExcelExportConfigModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirmExport: (config: { selectedSheets: string[]; selectedColumns: Record<string, string[]> }) => Promise<void>
  totalProperties: number
  disablePortal?: boolean
}

/**
 * US-266: Modal accesible para seleccionar qué hojas y columnas incluir en el libro Excel.
 * Ofrece selección total / deselección y estimación de registros.
 */
export const ExcelExportConfigModal: React.FC<ExcelExportConfigModalProps> = ({
  open,
  onOpenChange,
  onConfirmExport,
  totalProperties,
  disablePortal = false,
}) => {
  const PortalWrapper = disablePortal ? React.Fragment : Dialog.Portal
  const [selectedSheets, setSelectedSheets] = useState<Record<string, boolean>>(() =>
    DEFAULT_EXCEL_SHEETS.reduce((acc, s) => ({ ...acc, [s.id]: s.defaultSelected }), {})
  )

  const [isExporting, setIsExporting] = useState(false)

  const toggleSheet = (sheetId: string) => {
    setSelectedSheets((prev) => ({ ...prev, [sheetId]: !prev[sheetId] }))
  }

  const selectAll = () => {
    setSelectedSheets(DEFAULT_EXCEL_SHEETS.reduce((acc, s) => ({ ...acc, [s.id]: true }), {}))
  }

  const selectNone = () => {
    setSelectedSheets(DEFAULT_EXCEL_SHEETS.reduce((acc, s) => ({ ...acc, [s.id]: false }), {}))
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const activeSheetIds = Object.keys(selectedSheets).filter((k) => selectedSheets[k])
      const columnsMap: Record<string, string[]> = {}
      for (const sheet of DEFAULT_EXCEL_SHEETS) {
        if (selectedSheets[sheet.id]) {
          columnsMap[sheet.id] = sheet.columns.map((c) => c.key)
        }
      }
      await onConfirmExport({ selectedSheets: activeSheetIds, selectedColumns: columnsMap })
      onOpenChange(false)
    } finally {
      setIsExporting(false)
    }
  }

  const activeCount = Object.values(selectedSheets).filter(Boolean).length

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <PortalWrapper>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg p-5 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/90 focus:outline-none">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              <Dialog.Title className="text-sm font-semibold text-slate-100">
                Configurar Libro Excel de Exportación
              </Dialog.Title>
            </div>
            <Dialog.Close className="p-1 text-slate-400 hover:text-slate-200 rounded-lg">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-xs text-slate-400 mt-2">
            Personaliza qué matrices de datos incluir para optimizar el tamaño y la confidencialidad de la
            exportación ({totalProperties} predios en lote).
          </Dialog.Description>

          <div className="flex items-center justify-between mt-4 pb-2">
            <span className="text-xs font-medium text-slate-300">Pestañas del Documento</span>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={selectAll}
                className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
              >
                Todas
              </button>
              <span className="text-slate-600">|</span>
              <button
                type="button"
                onClick={selectNone}
                className="text-slate-400 hover:text-slate-300 underline underline-offset-2"
              >
                Ninguna
              </button>
            </div>
          </div>

          <div className="mt-2 space-y-2 max-h-64 overflow-y-auto pr-1">
            {DEFAULT_EXCEL_SHEETS.map((sheet) => {
              const checked = !!selectedSheets[sheet.id]
              return (
                <div
                  key={sheet.id}
                  onClick={() => toggleSheet(sheet.id)}
                  className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    checked
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-slate-100'
                      : 'bg-slate-800/40 border-slate-800 text-slate-400 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="mt-0.5 text-emerald-400">
                    {checked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{sheet.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {sheet.columns.length} col.
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{sheet.description}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800">
            <span className="text-xs text-slate-400">
              {activeCount} de {DEFAULT_EXCEL_SHEETS.length} hojas seleccionadas
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={activeCount === 0 || isExporting}
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-950"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExporting ? 'Generando...' : 'Exportar Libro Excel'}</span>
              </button>
            </div>
          </div>
        </Dialog.Content>
      </PortalWrapper>
    </Dialog.Root>
  )
}
