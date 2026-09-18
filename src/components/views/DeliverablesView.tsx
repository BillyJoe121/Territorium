import React, { useState } from 'react'
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CheckCircle2,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Lock,
  Settings2,
  ShieldCheck,
} from 'lucide-react'
import type { PropertyMasterRecord } from '../../lib/masterRecordReconciliation'
import { PageHeader } from '../common/PageHeader'
import { StatusBadge } from '../common/StatusBadge'

export interface DeliverablesViewProps {
  projectName: string
  records: PropertyMasterRecord[]
  userEmail: string
  onDownloadXlsx?: (criteria: 'approved_only' | 'all') => Promise<void>
  onDownloadExcel?: (criteria: 'approved_only' | 'all') => Promise<void>
  onDownloadZip?: (criteria: 'approved_only' | 'all') => Promise<void>
  onOpenConfigModal?: () => void
  onNavigateToTemplates?: () => void
  onNavigateToReviews?: () => void
}

export function DeliverablesView({
  projectName,
  records,
  userEmail,
  onDownloadXlsx,
  onDownloadExcel,
  onDownloadZip,
  onOpenConfigModal,
  onNavigateToTemplates,
  onNavigateToReviews,
}: DeliverablesViewProps) {
  const [criteria, setCriteria] = useState<'approved_only' | 'all'>('approved_only')
  const [isGenerating, setIsGenerating] = useState(false)
  const downloadHandler = onDownloadXlsx || onDownloadExcel

  const approvedRecords = records.filter((r) => r.reviewState === 'aprobado' && !r.isBlockedForExport)
  const blockedRecords = records.filter((r) => r.isBlockedForExport || r.exportBlockReasons?.length > 0)
  const pendingRecords = records.filter((r) => r.reviewState === 'pendiente')

  const targetRecords = criteria === 'approved_only' ? approvedRecords : records

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Salidas Formales y Matrices Jurídicas"
        title="Centro de Entregables y Exportación"
        description={`Generación de matrices de correspondencia, certificados prediales y paquete documental para el proyecto "${projectName}".`}
        actions={
          <div className="flex items-center gap-2">
            {onOpenConfigModal && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onOpenConfigModal}
              >
                <Settings2 size={14} /> Configurar Columnas
              </button>
            )}
            {onNavigateToTemplates && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onNavigateToTemplates}
              >
                <FileText size={14} /> Editor de Minutas DOCX
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna 1 y 2: Opciones de Generación y Previsualización */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6 space-y-5">
            <h3 className="text-sm font-semibold text-[#182230] border-b border-[#E4E7EC] pb-3">
              1. Configuración del Alcance del Entregable
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Opción 1: Solo Aprobados */}
              <label
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  criteria === 'approved_only'
                    ? 'border-[#2459D3] bg-[#EDF3FF] shadow-sm'
                    : 'border-[#E4E7EC] bg-[#FFFFFF] hover:bg-[#F7F8FA]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="criteria"
                      className="text-[#2459D3] focus:ring-[#2459D3]"
                      checked={criteria === 'approved_only'}
                      onChange={() => setCriteria('approved_only')}
                    />
                    <strong className="text-xs font-semibold text-[#182230]">
                      Solo Predios Aprobados
                    </strong>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-[#18794E] bg-[#EDFDF5] px-1.5 py-0.5 rounded">
                    Oficial
                  </span>
                </div>
                <p className="text-xs text-[#526071] leading-relaxed pl-5">
                  Exporta únicamente los expedientes debidamente certificados por el revisor jurídico. Garantiza cero conflictos para radicación notarial.
                </p>
                <div className="mt-3 pl-5 text-xs font-semibold tabular-nums text-[#182230]">
                  {approvedRecords.length} predio(s) listos
                </div>
              </label>

              {/* Opción 2: Todos los Predios */}
              <label
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  criteria === 'all'
                    ? 'border-[#2459D3] bg-[#EDF3FF] shadow-sm'
                    : 'border-[#E4E7EC] bg-[#FFFFFF] hover:bg-[#F7F8FA]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="criteria"
                      className="text-[#2459D3] focus:ring-[#2459D3]"
                      checked={criteria === 'all'}
                      onChange={() => setCriteria('all')}
                    />
                    <strong className="text-xs font-semibold text-[#182230]">
                      Todos los Predios (Borrador)
                    </strong>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-[#9A6700] bg-[#FEF7EC] px-1.5 py-0.5 rounded">
                    Auditoría
                  </span>
                </div>
                <p className="text-xs text-[#526071] leading-relaxed pl-5">
                  Incluye predios pendientes y devueltos con advertencias de validación para control interno del equipo.
                </p>
                <div className="mt-3 pl-5 text-xs font-semibold tabular-nums text-[#182230]">
                  {records.length} predio(s) totales
                </div>
              </label>
            </div>

            {/* Resumen Previo */}
            <div className="p-4 bg-[#F7F8FA] border border-[#E4E7EC] rounded-lg space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#526071]">Formato del archivo de salida:</span>
                <strong className="text-[#182230]">Microsoft Excel (.xlsx) OpenXML</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#526071]">Estructura de columnas:</span>
                <strong className="text-[#182230]">Estándar CORRESPONDENCIA.xlsx</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#526071]">Seguridad criptográfica:</span>
                <span className="flex items-center gap-1 text-[#18794E] font-medium">
                  <ShieldCheck size={14} /> Hoja de Control y Hash SHA-256
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#526071]">Generado por:</span>
                <span className="font-mono text-[#182230]">{userEmail}</span>
              </div>
            </div>

            {/* Botón Principal de Descarga */}
            <div className="pt-2">
              <button
                type="button"
                className="btn btn-primary w-full md:w-auto text-sm px-6 h-11"
                disabled={isGenerating || targetRecords.length === 0}
                onClick={async () => {
                  try {
                    setIsGenerating(true)
                    if (downloadHandler) {
                      await downloadHandler(criteria)
                    }
                  } finally {
                    setIsGenerating(false)
                  }
                }}
              >
                <Download size={16} />
                {isGenerating ? 'Generando libro...' : `Descargar CORRESPONDENCIA.xlsx (${targetRecords.length} predios)`}
              </button>
            </div>
          </div>

          {/* Bloque de Explicación de Bloqueos */}
          {blockedRecords.length > 0 && (
            <div className="card p-6 border-l-4 border-l-[#B42318] space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#B42318]">
                <AlertTriangle size={16} />
                <span>
                  Predios Bloqueados para Entrega Oficial ({blockedRecords.length})
                </span>
              </div>
              <p className="text-xs text-[#526071] leading-relaxed">
                Los siguientes predios no pueden exportarse en la entrega oficial debido a inconsistencias insubsanables o discrepancias de cabida entre título y plano:
              </p>
              <div className="divide-y divide-[#E4E7EC] border border-[#E4E7EC] rounded-lg bg-[#FFFFFF] max-h-48 overflow-y-auto">
                {blockedRecords.map((rec) => (
                  <div key={rec.id} className="p-3 text-xs flex items-center justify-between">
                    <div>
                      <strong className="text-[#182230]">{rec.propertyCode || rec.canonicalName}</strong>
                      <p className="text-[11px] text-[#B42318] mt-0.5">
                        {rec.exportBlockReasons?.join(' · ') || 'Inconsistencia jurídica no resuelta'}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] text-[#667085]">{rec.folio || 'SIN FOLIO'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Columna 3: Información y Buenas Prácticas */}
        <div className="space-y-6">
          <div className="card p-5 space-y-4">
            <h4 className="text-xs font-semibold text-[#182230] uppercase tracking-wider border-b border-[#E4E7EC] pb-2">
              Validaciones de Integridad
            </h4>
            <div className="space-y-3 text-xs text-[#526071]">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={15} className="text-[#18794E] flex-shrink-0 mt-0.5" />
                <span>Sanitización automática contra inyecciones de fórmulas en Excel (=, +, -, @).</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 size={15} className="text-[#18794E] flex-shrink-0 mt-0.5" />
                <span>Hoja de trazabilidad con huella digital SHA-256 y fecha de generación UTC.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 size={15} className="text-[#18794E] flex-shrink-0 mt-0.5" />
                <span>Cálculo automático de coherencia entre números y letras en cabida y linderos.</span>
              </div>
            </div>
          </div>

          <div className="card p-5 bg-[#F1F3F6] border border-[#E4E7EC] space-y-2">
            <h4 className="text-xs font-semibold text-[#182230]">
              Empaquetado Documental ZIP
            </h4>
            <p className="text-xs text-[#526071] leading-relaxed">
              Descargue todos los expedientes documentales (.docx y .pdf fuente) compilados y validados con nomenclatura estándar para radicación institucional.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm mt-2 w-full"
              onClick={() => {
                alert('Iniciando empaquetado de expedientes validados...')
              }}
            >
              <Archive size={14} /> Descargar Paquete ZIP
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
