import React, { useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  FileQuestion,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  MapPin,
  Scale,
  ShieldAlert,
} from 'lucide-react'
import type { Project, PropertyRecord } from '../../types'
import type { PropertyMasterRecord } from '../../lib/masterRecordReconciliation'
import { PageHeader } from '../common/PageHeader'
import { StatusBadge } from '../common/StatusBadge'

export interface DiscrepanciesViewProps {
  project?: Project
  projectName?: string
  masterRecords?: PropertyMasterRecord[]
  records?: PropertyMasterRecord[]
  onResolveDiscrepancy?: (
    recordId: string,
    fieldKey: string,
    resolvedValue: string,
    motive: string
  ) => Promise<void>
  onNavigateToRecord?: (recordId: string) => void
  onOpenEvidence?: (docId: string) => void
}

export function DiscrepanciesView({
  project,
  projectName,
  masterRecords,
  records,
  onResolveDiscrepancy,
  onNavigateToRecord,
  onOpenEvidence,
}: DiscrepanciesViewProps) {
  const allRecords = masterRecords || records || []
  const resolvedProjectName = projectName || project?.name || 'Expediente Activo'
  const [selectedRecordId, setSelectedRecordId] = useState<string>(
    allRecords[0]?.id ?? ''
  )
  const [motiveInput, setMotiveInput] = useState('')
  const [resolvingField, setResolvingField] = useState<string | null>(null)

  // Identificar predios con discrepancias o bloqueos críticos
  const conflictedRecords = allRecords.filter(
    (r) => r.criticalConflictCount > 0 || r.isBlockedForExport || (r.exportBlockReasons?.length ?? 0) > 0
  )

  const activeRecord =
    conflictedRecords.find((r) => r.id === selectedRecordId) || conflictedRecords[0]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Resolución de Conflictos Jurídicos y Técnicos"
        title="Bandeja de Excepciones y Discrepancias"
        description={`Identifique inconsistencias entre estudios de títulos, escrituras y planos topográficos para el expediente "${resolvedProjectName}".`}
        meta={
          <span className="text-xs text-[#526071] flex items-center gap-1.5 font-medium">
            <ShieldAlert size={14} className="text-[#B42318]" />
            {conflictedRecords.length} predio(s) requieren resolución manual
          </span>
        }
      />

      {conflictedRecords.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[#EDFDF5] text-[#18794E] flex items-center justify-center mx-auto">
            <CheckCircle2 size={24} />
          </div>
          <h3 className="text-base font-semibold text-[#182230]">
            Sin discrepancias detectadas
          </h3>
          <p className="text-xs text-[#526071] max-w-md mx-auto leading-relaxed">
            No existen conflictos críticos de área, linderos o gravámenes sin resolver en este expediente. Todos los registros cumplen con las reglas de consistencia técnica.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna 1: Lista de Predios en Conflicto */}
          <div className="card p-0 overflow-hidden space-y-0">
            <div className="p-4 border-b border-[#E4E7EC] bg-[#F7F8FA]">
              <h3 className="text-xs font-semibold text-[#667085] uppercase tracking-wider">
                Predios con Conflictos ({conflictedRecords.length})
              </h3>
            </div>

            <div className="divide-y divide-[#E4E7EC] max-h-[600px] overflow-y-auto">
              {conflictedRecords.map((record) => {
                const isSelected = activeRecord?.id === record.id
                return (
                  <button
                    key={record.id}
                    type="button"
                    className={`w-full p-4 text-left transition-colors flex items-start justify-between ${
                      isSelected ? 'bg-[#EDF3FF] border-l-2 border-l-[#2459D3]' : 'hover:bg-[#F7F8FA]'
                    }`}
                    onClick={() => setSelectedRecordId(record.id)}
                  >
                    <div className="space-y-1">
                      <strong className="text-xs font-semibold text-[#182230] block">
                        {record.propertyCode || record.canonicalName}
                      </strong>
                      <p className="text-[11px] text-[#526071]">
                        Folio: <span className="font-mono">{record.folio || 'POR VALIDAR'}</span>
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <StatusBadge
                          status="discrepancia"
                          label={`${record.exportBlockReasons?.length || 1} bloqueo(s)`}
                          size="sm"
                        />
                      </div>
                    </div>
                    <ChevronRight size={15} className="text-[#98A2B3] mt-1" />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Columna 2 y 3: Detalle y Resolución del Conflicto */}
          <div className="lg:col-span-2 space-y-6">
            {activeRecord && (
              <div className="card p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-4">
                  <div>
                    <span className="text-[10px] font-semibold text-[#667085] uppercase tracking-wider block">
                      Expediente Predial
                    </span>
                    <h3 className="text-lg font-semibold text-[#182230]">
                      {activeRecord.propertyCode} · {activeRecord.canonicalName}
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onNavigateToRecord && onNavigateToRecord(activeRecord.id)}
                  >
                    Ver en Mesa de Revisión <ArrowRight size={13} />
                  </button>
                </div>

                {/* Motivos de Bloqueo Detectados */}
                <div className="p-4 bg-[#FDF2F2] border border-[#F9C3C0] rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#B42318]">
                    <AlertTriangle size={15} />
                    <span>Razones de Inconsistencia y Bloqueo de Exportación:</span>
                  </div>
                  <ul className="list-disc list-inside text-xs text-[#7A271A] space-y-1 pl-1">
                    {(activeRecord.exportBlockReasons || []).map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>

                {/* Comparativa Lado a Lado: Título vs Plano */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-[#182230] uppercase tracking-wider">
                    Contraste Multifuente de Atributos Críticos
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Tarjeta Fuente 1: Estudio de Títulos */}
                    <div className="p-4 border border-[#E4E7EC] rounded-lg bg-[#FFFFFF] space-y-3">
                      <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-2">
                        <span className="text-xs font-semibold text-[#182230] flex items-center gap-1.5">
                          <FileText size={14} className="text-[#2459D3]" /> Estudio de Títulos
                        </span>
                        <span className="text-[10px] text-[#667085]">Fuente Jurídica</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-[#667085] block">Área de Terreno Registrada:</span>
                          <strong className="text-sm font-semibold text-[#182230] tabular-nums">
                            {activeRecord.attributes['area_titulo_m2']?.activeValue || 'NO IDENTIFICADO'} m²
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#667085] block">Folio de Matrícula:</span>
                          <span className="font-mono text-[#182230]">
                            {activeRecord.attributes['folio_matricula']?.activeValue || 'POR VALIDAR'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#667085] block">Linderos Extraídos:</span>
                          <p className="text-[11px] text-[#526071] line-clamp-2 italic">
                            {activeRecord.attributes['linderos_literales']?.activeValue || 'Sin descripción'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm w-full mt-2"
                        onClick={() => {
                          setResolvingField('area_titulo_m2')
                        }}
                      >
                        Adoptar valor de título
                      </button>
                    </div>

                    {/* Tarjeta Fuente 2: Levantamiento Topográfico */}
                    <div className="p-4 border border-[#E4E7EC] rounded-lg bg-[#FFFFFF] space-y-3">
                      <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-2">
                        <span className="text-xs font-semibold text-[#182230] flex items-center gap-1.5">
                          <Layers size={14} className="text-[#026AA2]" /> Plano Topográfico
                        </span>
                        <span className="text-[10px] text-[#667085]">Fuente Técnica</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-[#667085] block">Área Medida en Campo:</span>
                          <strong className="text-sm font-semibold text-[#182230] tabular-nums">
                            {activeRecord.attributes['area_plano_m2']?.activeValue || 'NO IDENTIFICADO'} m²
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#667085] block">Cédula Catastral:</span>
                          <span className="font-mono text-[#182230]">
                            {activeRecord.attributes['cedula_catastral']?.activeValue || 'POR VALIDAR'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#667085] block">Alinderación Planimétrica:</span>
                          <p className="text-[11px] text-[#526071] line-clamp-2 italic">
                            {activeRecord.attributes['linderos_plano']?.activeValue || 'Conforme a coordenadas'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm w-full mt-2"
                        onClick={() => {
                          setResolvingField('area_plano_m2')
                        }}
                      >
                        Adoptar valor de plano
                      </button>
                    </div>
                  </div>
                </div>

                {/* Formulario de Justificación y Resolución */}
                {resolvingField && (
                  <div className="p-4 bg-[#F7F8FA] border border-[#E4E7EC] rounded-lg space-y-3">
                    <h4 className="text-xs font-semibold text-[#182230]">
                      Confirmar Resolución de Discrepancia: {resolvingField}
                    </h4>
                    <p className="text-xs text-[#526071]">
                      Para garantizar la trazabilidad forense, ingrese el motivo jurídico o técnico que justifica la selección de este valor.
                    </p>
                    <textarea
                      rows={2}
                      className="w-full text-xs p-2.5 rounded-md border border-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#2459D3] bg-white"
                      placeholder="Ej: Se adopta el área del plano topográfico por actualización predial catastral IGAC..."
                      value={motiveInput}
                      onChange={(e) => setMotiveInput(e.target.value)}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setResolvingField(null)
                          setMotiveInput('')
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={!motiveInput.trim()}
                        onClick={async () => {
                          if (onResolveDiscrepancy && resolvingField) {
                            await onResolveDiscrepancy(
                              activeRecord.id,
                              resolvingField,
                              activeRecord.attributes[resolvingField]?.activeValue || '',
                              motiveInput
                            )
                            setResolvingField(null)
                            setMotiveInput('')
                          }
                        }}
                      >
                        Guardar Decisión con Firma
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
