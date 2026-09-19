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
    <div className="discrepancies-view">
      <PageHeader
        eyebrow="Resolución de Conflictos Jurídicos y Técnicos"
        title="Bandeja de Excepciones y Discrepancias"
        description={`Identifique inconsistencias entre estudios de títulos, escrituras y planos topográficos para el expediente "${resolvedProjectName}".`}
        meta={
          <span className="discrepancies-meta-counter">
            <ShieldAlert size={14} className="text-danger" />
            {conflictedRecords.length} predio(s) requieren resolución manual
          </span>
        }
      />

      {conflictedRecords.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon-circle">
            <CheckCircle2 size={28} />
          </div>
          <h3>Sin discrepancias detectadas</h3>
          <p>
            No existen conflictos críticos de área, linderos o gravámenes sin resolver en este expediente. Todos los registros cumplen con las reglas de consistencia técnica.
          </p>
        </div>
      ) : (
        <div className="discrepancies-layout">
          {/* Columna 1: Lista de Predios en Conflicto */}
          <div className="card discrepancies-tray-card">
            <div className="tray-header">
              <h3>Predios con Conflictos ({conflictedRecords.length})</h3>
            </div>

            <div className="tray-list">
              {conflictedRecords.map((record) => {
                const isSelected = activeRecord?.id === record.id
                return (
                  <button
                    key={record.id}
                    type="button"
                    className={`tray-item-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedRecordId(record.id)}
                  >
                    <div className="tray-item-info">
                      <strong>{record.propertyCode || record.canonicalName}</strong>
                      <p>Folio: <code>{record.folio || 'POR VALIDAR'}</code></p>
                      <div className="tray-item-badge">
                        <StatusBadge
                          status="discrepancia"
                          label={`${record.exportBlockReasons?.length || 1} bloqueo(s)`}
                          size="sm"
                        />
                      </div>
                    </div>
                    <ChevronRight size={16} className="tray-chevron" />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Columna 2: Detalle y Resolución del Conflicto */}
          <div className="discrepancies-main-column">
            {activeRecord && (
              <div className="card discrepancy-detail-card">
                <div className="discrepancy-card-header">
                  <div>
                    <span className="eyebrow">Expediente Predial</span>
                    <h3>{activeRecord.propertyCode} · {activeRecord.canonicalName}</h3>
                  </div>
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={() => onNavigateToRecord && onNavigateToRecord(activeRecord.id)}
                  >
                    Ver en Mesa de Revisión <ArrowRight size={14} />
                  </button>
                </div>

                {/* Motivos de Bloqueo Detectados */}
                <div className="discrepancy-alert-box">
                  <div className="alert-box-title">
                    <AlertTriangle size={16} />
                    <span>Razones de Inconsistencia y Bloqueo de Exportación:</span>
                  </div>
                  <ul>
                    {(activeRecord.exportBlockReasons || []).map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>

                {/* Comparativa Lado a Lado: Título vs Plano */}
                <div className="discrepancy-comparison-section">
                  <h4>Contraste Multifuente de Atributos Críticos</h4>

                  <div className="discrepancy-compare-grid">
                    {/* Tarjeta Fuente 1: Estudio de Títulos */}
                    <div className="compare-card">
                      <div className="compare-card-top">
                        <span className="source-name">
                          <FileText size={15} className="text-accent" /> Estudio de Títulos
                        </span>
                        <span className="source-tag">Fuente Jurídica</span>
                      </div>
                      <div className="compare-fields">
                        <div className="field-block">
                          <span className="field-label">Área de Terreno Registrada:</span>
                          <strong className="field-val tabular-nums">
                            {activeRecord.attributes['area_titulo_m2']?.activeValue || 'NO IDENTIFICADO'} m²
                          </strong>
                        </div>
                        <div className="field-block">
                          <span className="field-label">Folio de Matrícula:</span>
                          <span className="field-code font-mono">
                            {activeRecord.attributes['folio_matricula']?.activeValue || 'POR VALIDAR'}
                          </span>
                        </div>
                        <div className="field-block">
                          <span className="field-label">Linderos Extraídos:</span>
                          <p className="field-quote">
                            {activeRecord.attributes['linderos_literales']?.activeValue || 'Sin descripción'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="button secondary small full-width"
                        onClick={() => {
                          setResolvingField('area_titulo_m2')
                        }}
                      >
                        Adoptar valor de título
                      </button>
                    </div>

                    {/* Tarjeta Fuente 2: Levantamiento Topográfico */}
                    <div className="compare-card">
                      <div className="compare-card-top">
                        <span className="source-name">
                          <Layers size={15} className="text-info" /> Plano Topográfico
                        </span>
                        <span className="source-tag">Fuente Técnica</span>
                      </div>
                      <div className="compare-fields">
                        <div className="field-block">
                          <span className="field-label">Área Medida en Campo:</span>
                          <strong className="field-val tabular-nums">
                            {activeRecord.attributes['area_plano_m2']?.activeValue || 'NO IDENTIFICADO'} m²
                          </strong>
                        </div>
                        <div className="field-block">
                          <span className="field-label">Cédula Catastral:</span>
                          <span className="field-code font-mono">
                            {activeRecord.attributes['cedula_catastral']?.activeValue || 'POR VALIDAR'}
                          </span>
                        </div>
                        <div className="field-block">
                          <span className="field-label">Alinderación Planimétrica:</span>
                          <p className="field-quote">
                            {activeRecord.attributes['linderos_plano']?.activeValue || 'Conforme a coordenadas'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="button secondary small full-width"
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
                  <div className="discrepancy-resolve-box">
                    <h4>Confirmar Resolución de Discrepancia: <code>{resolvingField}</code></h4>
                    <p>
                      Para garantizar la trazabilidad forense, ingrese el motivo jurídico o técnico que justifica la selección de este valor.
                    </p>
                    <textarea
                      rows={3}
                      className="resolve-textarea"
                      placeholder="Ej: Se adopta el área del plano topográfico por actualización predial catastral IGAC..."
                      value={motiveInput}
                      onChange={(e) => setMotiveInput(e.target.value)}
                    />
                    <div className="resolve-actions">
                      <button
                        type="button"
                        className="button secondary small"
                        onClick={() => {
                          setResolvingField(null)
                          setMotiveInput('')
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="button primary small"
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
