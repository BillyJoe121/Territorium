import React, { useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  Edit3,
  FileCheck,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Layers,
  MapPin,
  Maximize2,
  MessageSquare,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  UserCheck,
  X,
  Columns,
  LayoutGrid,
} from 'lucide-react'
import type { PropertyMasterRecord, TraceableAttribute } from '../lib/masterRecordReconciliation'
import { updateMasterRecordAttribute, validateNumberWordsCoherence } from '../lib/masterRecordReconciliation'
import type { ReviewState, SourceDocument } from '../types'
import { SplitReviewStation } from './ui/SplitReviewStation'

interface ReviewStationProps {
  records: PropertyMasterRecord[]
  documents: SourceDocument[]
  activeUserEmail: string
  canReview: boolean
  onUpdateRecord: (updated: PropertyMasterRecord) => Promise<void>
  onOpenSignedUrl: (docId: string) => Promise<void>
  onNotice?: (msg: string) => void
  onError?: (msg: string) => void
}

export function ReviewStationView({
  records,
  documents,
  activeUserEmail,
  canReview,
  onUpdateRecord,
  onOpenSignedUrl,
  onNotice,
  onError,
}: ReviewStationProps) {
  // 1. Estados de selección y filtros
  const [selectedId, setSelectedId] = useState<string>(records[0]?.id ?? '')
  const [viewMode, setViewMode] = useState<'split' | 'standard'>('split')
  const [activeTab, setActiveTab] = useState<'todos' | 'identificacion' | 'juridico' | 'tecnico' | 'manual'>('todos')
  const [filterState, setFilterState] = useState<'all' | 'pendientes' | 'conflictos' | 'aprobados' | 'devueltos'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeAttributeKey, setActiveAttributeKey] = useState<string | null>(null)

  // 2. Estados de edición modal de atributo (US-107, US-159, US-160)
  const [editingAttr, setEditingAttr] = useState<TraceableAttribute | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editMotive, setEditMotive] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  // 3. Comentarios a nivel de campo (US-111)
  const [fieldComments, setFieldComments] = useState<Record<string, Array<{ author: string; date: string; text: string }>>>({})
  const [newCommentText, setNewCommentText] = useState('')
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)

  // Predio activo
  const selected = records.find((r) => r.id === selectedId) ?? records[0]

  // Filtrado de bandeja
  const filteredRecords = records.filter((r) => {
    if (filterState === 'pendientes' && r.reviewState !== 'pendiente') return false
    if (filterState === 'conflictos' && r.criticalConflictCount === 0) return false
    if (filterState === 'aprobados' && r.reviewState !== 'aprobado') return false
    if (filterState === 'devueltos' && r.reviewState !== 'devuelto') return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchCode = r.propertyCode.toLowerCase().includes(q)
      const matchName = r.canonicalName.toLowerCase().includes(q)
      const matchFolio = r.folio.toLowerCase().includes(q)
      const matchMuni = r.municipality.toLowerCase().includes(q)
      return matchCode || matchName || matchFolio || matchMuni
    }
    return true
  })

  // Documento asociado al predio
  const relatedDoc = documents.find((d) => d.propertyCode === selected?.propertyCode) || documents[0]

  // Abrir editor de atributo
  function handleOpenEditor(attr: TraceableAttribute) {
    setEditingAttr(attr)
    setEditValue(attr.activeValue)
    setEditMotive('')
    setEditError(null)
  }

  // Guardar edición manual (US-107, US-160, US-162)
  async function handleSaveAttributeEdit() {
    if (!selected || !editingAttr) return

    // Validar motivo obligatorio (US-107)
    if (!editMotive.trim()) {
      setEditError('El motivo del cambio es estrictamente obligatorio para la trazabilidad jurídica.')
      return
    }

    try {
      const updated = updateMasterRecordAttribute(selected, editingAttr.fieldKey, editValue, {
        author: activeUserEmail,
        changeMotive: editMotive,
      })
      await onUpdateRecord(updated)
      setEditingAttr(null)
      onNotice?.(`Atributo ${editingAttr.label} actualizado con trazabilidad de autor y motivo.`)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Error al guardar el atributo.')
    }
  }

  // Aprobar predio completo (US-108, US-109)
  async function handleApproveRecord() {
    if (!selected) return

    // Verificar si hay conflictos no resueltos (US-099, US-109)
    if (selected.criticalConflictCount > 0) {
      onError?.('No se puede aprobar el predio mientras existan conflictos materiales entre título y plano.')
      return
    }

    // Verificar revisión jurídica obligatoria
    const pendingLegalReviews = Object.values(selected.attributes).filter(
      (a) => a.requiresLegalReview && a.sourceState !== 'approved' && a.sourceState !== 'manual'
    )
    if (pendingLegalReviews.length > 0) {
      onError?.(
        `Existen ${pendingLegalReviews.length} atributos con revisión jurídica obligatoria (linderos, gravámenes o titularidad) que deben ser confirmados.`
      )
      return
    }

    const approvedRecord: PropertyMasterRecord = {
      ...selected,
      reviewState: 'aprobado',
      updatedAt: new Date().toISOString(),
    }
    await onUpdateRecord(approvedRecord)
    onNotice?.(`Predio ${selected.propertyCode} aprobado jurídicamente. Listo para exportación.`)
  }

  // Devolver predio para reproceso (US-108)
  async function handleDevolveRecord() {
    if (!selected) return
    const returnedRecord: PropertyMasterRecord = {
      ...selected,
      reviewState: 'devuelto',
      updatedAt: new Date().toISOString(),
    }
    await onUpdateRecord(returnedRecord)
    onNotice?.(`Predio ${selected.propertyCode} marcado como devuelto para reproceso selectivo.`)
  }

  // Agregar comentario a campo (US-111)
  function handleAddComment() {
    if (!activeAttributeKey || !newCommentText.trim()) return
    const commentList = fieldComments[activeAttributeKey] || []
    setFieldComments({
      ...fieldComments,
      [activeAttributeKey]: [
        ...commentList,
        {
          author: activeUserEmail,
          date: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
          text: newCommentText.trim(),
        },
      ],
    })
    setNewCommentText('')
    onNotice?.('Comentario registrado en el contexto del atributo.')
  }

  const [attrSearchQuery, setAttrSearchQuery] = useState('')

  if (!selected) {
    return (
      <div className="card empty-state" style={{ padding: '3rem', textAlign: 'center' }}>
        <FileSpreadsheet size={48} style={{ color: 'var(--color-primary)', margin: '0 auto 1rem' }} />
        <h3>No hay registros disponibles para la mesa de revisión</h3>
        <p>Procesa un lote o carga insumos en el expediente para habilitar la conciliación de títulos y planos.</p>
      </div>
    )
  }

  // Filtrado y conteo de atributos para la ficha tradicional
  const categoryCounts = {
    todos: Object.values(selected.attributes).length,
    identificacion: Object.values(selected.attributes).filter((a) => a.category === 'identificacion').length,
    juridico: Object.values(selected.attributes).filter((a) => a.category === 'juridico').length,
    tecnico: Object.values(selected.attributes).filter((a) => a.category === 'tecnico').length,
    manual: Object.values(selected.attributes).filter((a) => a.category === 'manual').length,
  }

  const visibleAttributes = Object.values(selected.attributes).filter((attr) => {
    if (activeTab !== 'todos' && attr.category !== activeTab) return false
    if (attrSearchQuery.trim()) {
      const q = attrSearchQuery.toLowerCase()
      const matchLabel = attr.label.toLowerCase().includes(q)
      const matchKey = attr.fieldKey.toLowerCase().includes(q)
      const matchVal = String(attr.activeValue || '').toLowerCase().includes(q)
      return matchLabel || matchKey || matchVal
    }
    return true
  })

  const currentIndex = filteredRecords.findIndex((r) => r.id === selected.id)

  return (
    <div className="review-station-wrapper">
      {/* NAVBAR FLOTANTE PERMANENTE: VISTA DE REVISIÓN */}
      <div className="review-mode-toolbar">
        <div className="mode-toggle-group">
          <span className="mode-label">VISTA DE REVISIÓN:</span>
          <button
            type="button"
            className={`button small ${viewMode === 'split' ? 'primary active' : 'secondary'}`}
            onClick={() => setViewMode('split')}
            id="btn-mode-split"
          >
            <Columns size={13} /> Visor Split-View (US-246)
          </button>
          <button
            type="button"
            className={`button small ${viewMode === 'standard' ? 'primary active' : 'secondary'}`}
            onClick={() => setViewMode('standard')}
            id="btn-mode-standard"
          >
            <LayoutGrid size={13} /> Ficha Tradicional
          </button>
        </div>

        <div className="active-property-meta">
          <span className="property-meta-pill">
            Predio activo: <strong>{selected.propertyCode}</strong> — {selected.canonicalName} ({selected.folio})
          </span>
          <span className={`status ${selected.reviewState}`}>
            {selected.reviewState.toUpperCase()}
          </span>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL SEGÚN EL MODO SELECCIONADO */}
      {viewMode === 'split' ? (
        <SplitReviewStation
          propertyFolio={selected.folio}
          propertyName={selected.canonicalName}
          documentName={relatedDoc?.name || 'Estudio_Titulos_Consolidado.pdf'}
          propertiesList={records.map((r) => ({
            id: r.id,
            folio: r.folio,
            code: r.propertyCode,
            name: r.canonicalName,
            status: r.reviewState === 'aprobado' ? 'aprobado' : r.criticalConflictCount > 0 ? 'discrepancia' : 'en_revision',
          }))}
          onSelectPropertyFromList={(id) => setSelectedId(id)}
          attributes={Object.values(selected.attributes).map((attr) => ({
            id: attr.fieldKey,
            key: attr.fieldKey,
            label: attr.label,
            value: attr.activeValue,
            sourceDocumentKind: 'estudio_titulos',
            confidence: attr.confidence ? Math.round(attr.confidence * 100) : 92,
            evidenceText: attr.evidence?.quote || `Valor extraído de ${attr.label} para el predio ${selected.propertyCode}`,
            evidencePage: attr.evidence?.pageOrSection ? parseInt(attr.evidence.pageOrSection) || 1 : 1,
            hasDiscrepancy: attr.hasConflict,
            isEdited: attr.sourceState === 'manual' || !!attr.previousValue,
          }))}
          onSaveAttribute={async (attrKey, newVal) => {
            const updated = updateMasterRecordAttribute(selected, attrKey, newVal, {
              author: activeUserEmail,
              changeMotive: 'Corrección directa inline desde estación Split-View (US-249)',
            })
            await onUpdateRecord(updated)
            onNotice?.(`Atributo ${attrKey} actualizado inline.`)
          }}
          onApproveProperty={handleApproveRecord}
          onFlagDiscrepancy={handleDevolveRecord}
          onNextProperty={() => {
            if (currentIndex >= 0 && currentIndex < filteredRecords.length - 1) {
              setSelectedId(filteredRecords[currentIndex + 1].id)
            }
          }}
          onPrevProperty={() => {
            if (currentIndex > 0) {
              setSelectedId(filteredRecords[currentIndex - 1].id)
            }
          }}
        />
      ) : (
        /* VISTA FICHA TRADICIONAL: 100% ANCHO DE PANTALLA (SIN BANDEJA LATERAL NI CARD EVIDENCIA) */
        <div className="traditional-property-fullwidth">
          <section className="card traditional-property-card">
            {/* Cabecera del Predio Activo (US-158 a US-162) */}
            <div className="traditional-card-header">
              <div className="traditional-header-left">
                <div className="traditional-title-row">
                  <h2 className="traditional-property-title">
                    {selected.propertyCode} • {selected.canonicalName}
                  </h2>
                  <span className="badge version-badge">Versión {selected.batchVersion}</span>
                  <span className={`status ${selected.reviewState}`}>{selected.reviewState}</span>
                </div>
                <div className="traditional-property-sub">
                  <span><strong>Matrícula (FMI):</strong> {selected.folio}</span>
                  <span className="bullet-sep">•</span>
                  <span><strong>Cédula Catastral:</strong> {selected.attributes['cedula_catastral']?.activeValue || '05-615-01-00-00-0001-0001-0-00-00-0000'}</span>
                  <span className="bullet-sep">•</span>
                  <span><strong>Municipio:</strong> {selected.municipality}, {selected.department}</span>
                  <span className="bullet-sep">•</span>
                  <span className="quality-text">
                    <strong>Calidad Semántica:</strong> {Math.round(selected.semanticQualityScore * 100)}%
                  </span>
                </div>
              </div>

              <div className="traditional-header-right">
                {/* Stepper para cambiar de predio en Ficha Tradicional */}
                {filteredRecords.length > 1 && (
                  <div className="traditional-stepper">
                    <button
                      type="button"
                      className="button secondary small"
                      disabled={currentIndex <= 0}
                      onClick={() => setSelectedId(filteredRecords[currentIndex - 1].id)}
                      title="Predio anterior"
                    >
                      <ChevronLeft size={14} /> Anterior
                    </button>
                    <span className="stepper-indicator">
                      {currentIndex + 1} de {filteredRecords.length}
                    </span>
                    <button
                      type="button"
                      className="button secondary small"
                      disabled={currentIndex >= filteredRecords.length - 1}
                      onClick={() => setSelectedId(filteredRecords[currentIndex + 1].id)}
                      title="Predio siguiente"
                    >
                      Siguiente <ChevronRight size={14} />
                    </button>
                  </div>
                )}

                {/* Acciones de aprobación / devolución */}
                {canReview && (
                  <div className="traditional-actions-group">
                    <button
                      type="button"
                      className="button secondary small"
                      onClick={handleDevolveRecord}
                      title="Devolver para reproceso selectivo"
                    >
                      <RotateCcw size={14} /> Devolver
                    </button>
                    <button
                      type="button"
                      className="button primary small"
                      onClick={handleApproveRecord}
                      disabled={selected.isBlockedForExport}
                      title={selected.isBlockedForExport ? 'Resuelva conflictos antes de aprobar' : 'Certificar revisión jurídica'}
                    >
                      <CheckCircle2 size={14} /> Aprobar Predio
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Banner de conflictos críticos si existen (US-097, US-099) */}
            {selected.criticalConflictCount > 0 && (
              <div className="traditional-conflict-banner">
                <AlertCircle size={18} className="conflict-banner-icon" />
                <div className="conflict-banner-text">
                  <strong>Conflicto material entre fuentes documentales:</strong>{' '}
                  {selected.exportBlockReasons.join(' ')}
                </div>
              </div>
            )}

            {/* Barra de Filtros por Categoría y Búsqueda */}
            <div className="traditional-toolbar-row">
              <div className="traditional-category-tabs">
                {(['todos', 'identificacion', 'juridico', 'tecnico', 'manual'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`traditional-tab-btn ${activeTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                    <span className="tab-count-pill">{categoryCounts[tab]}</span>
                  </button>
                ))}
              </div>

              <div className="traditional-search-container">
                <Search size={14} className="search-icon-inside" />
                <input
                  type="text"
                  placeholder="Buscar en atributos de este predio..."
                  value={attrSearchQuery}
                  onChange={(e) => setAttrSearchQuery(e.target.value)}
                  className="traditional-search-input"
                />
                {attrSearchQuery && (
                  <button
                    type="button"
                    className="clear-search-btn"
                    onClick={() => setAttrSearchQuery('')}
                    title="Limpiar búsqueda"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Tabla Maestra de Atributos al 100% de Ancho */}
            <div className="traditional-table-container">
              <table className="traditional-attributes-table">
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>Atributo Maestro</th>
                    <th style={{ width: '28%' }}>Valor Activo Conciliado</th>
                    <th style={{ width: '12%' }}>Origen del Dato</th>
                    <th style={{ width: '26%' }}>Evidencia Documental y Soporte</th>
                    <th style={{ width: '12%', textAlign: 'right' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAttributes.length > 0 ? (
                    visibleAttributes.map((attr) => {
                      const isSelectedAttr = activeAttributeKey === attr.fieldKey
                      return (
                        <tr
                          key={attr.fieldKey}
                          onClick={() => setActiveAttributeKey(attr.fieldKey)}
                          className={`traditional-table-row ${isSelectedAttr ? 'row-active' : ''} ${attr.hasConflict ? 'row-conflict' : ''}`}
                        >
                          <td className="col-attr-name">
                            <div className="attr-name-cell">
                              <div className="attr-name-title">
                                {attr.hasConflict && (
                                  <span title="Conflicto detectado">
                                    <AlertTriangle size={15} className="text-danger" />
                                  </span>
                                )}
                                {attr.requiresLegalReview && (
                                  <span title="Revisión jurídica obligatoria">
                                    <ShieldAlert size={15} className="text-warning" />
                                  </span>
                                )}
                                <strong>{attr.label}</strong>
                              </div>
                              <span className="attr-key-sub">{attr.fieldKey}</span>
                            </div>
                          </td>

                          <td className="col-active-value">
                            <div className="attr-value-cell">
                              <span className="active-value-text">
                                {attr.activeValue || <em className="text-muted">Sin valor</em>}
                              </span>
                              {attr.previousValue && (
                                <div className="attr-diff-history">
                                  <History size={12} /> Anterior: <del>{attr.previousValue}</del>
                                </div>
                              )}
                              {attr.changeMotive && (
                                <div className="attr-motive-pill">
                                  <strong>Motivo:</strong> {attr.changeMotive} ({attr.lastModifiedBy})
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="col-source">
                            <span className={`source-badge badge-${attr.sourceState}`}>
                              {attr.sourceState === 'approved' ? 'APROBADO' : attr.sourceState === 'manual' ? 'MANUAL' : 'ORIGINAL IA'}
                            </span>
                          </td>

                          <td className="col-evidence">
                            {attr.evidence ? (
                              <div className="evidence-cell-box">
                                <div className="evidence-header-mini">
                                  <FileText size={13} className="text-muted" />
                                  <span className="evidence-doc-name">{attr.evidence.documentName}</span>
                                  <span className="evidence-page-tag">Pág. {attr.evidence.pageOrSection}</span>
                                </div>
                                {attr.evidence.quote && (
                                  <div className="evidence-quote-mini" title={attr.evidence.quote}>
                                    "{attr.evidence.quote}"
                                  </div>
                                )}
                                {attr.confidence !== undefined && (
                                  <div className="evidence-confidence-tag">
                                    <span className="conf-dot" />
                                    <span>{Math.round(attr.confidence * 100)}% confianza</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted text-xs">Regla de negocio / Catastral</span>
                            )}
                          </td>

                          <td className="col-actions" style={{ textAlign: 'right' }}>
                            {canReview && (
                              <button
                                type="button"
                                className="button secondary small"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenEditor(attr)
                                }}
                                title="Corregir valor con trazabilidad jurídica"
                              >
                                <Edit3 size={13} /> Corregir
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="empty-table-cell">
                        No se encontraron atributos con los criterios seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Inspección de Linderos Literales (US-070, US-071) si está seleccionado */}
            {activeAttributeKey === 'linderos_literales' && selected.attributes['linderos_literales'] && (
              <div className="traditional-linderos-box">
                <div className="linderos-header">
                  <Shield size={16} className="text-accent" />
                  <h4>Inspección Detallada de Linderos Literales (US-070, US-071)</h4>
                </div>
                <div className="linderos-body">
                  {selected.attributes['linderos_literales'].activeValue}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* MODAL DE CORRECCIÓN DE ATRIBUTO CON MOTIVO OBLIGATORIO (US-107, US-159, US-160) */}
      {editingAttr && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div className="card" style={{ width: '520px', maxWidth: '90vw', padding: '1.5rem', backgroundColor: '#fff', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Corregir Atributo: {editingAttr.label}</h3>
              <button className="text-button" onClick={() => setEditingAttr(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Comparativa de 3 Estados (US-101, US-160) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.78rem' }}>
              <div style={{ padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Valor Original IA:</span>
                <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>{editingAttr.aiValue}</div>
              </div>
              <div style={{ padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Valor Aprobado Actual:</span>
                <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>{editingAttr.approvedValue ?? 'Ninguno'}</div>
              </div>
            </div>

            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              <strong>Nuevo Valor Corregido:</strong>
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                style={{ width: '100%', minHeight: '80px', marginTop: '0.3rem', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}
              />
            </label>

            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '1rem' }}>
              <strong style={{ color: '#b91c1c' }}>* Motivo del Cambio (Obligatorio para trazabilidad):</strong>
              <input
                type="text"
                placeholder="Ej. Corrección según folio de matrícula anexo pág 3..."
                value={editMotive}
                onChange={(e) => setEditMotive(e.target.value)}
                style={{ width: '100%', marginTop: '0.3rem', height: '36px', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}
              />
            </label>

            {editError && (
              <div style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', color: '#991b1b', fontSize: '0.8rem' }}>
                {editError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="button secondary" onClick={() => setEditingAttr(null)}>
                Cancelar
              </button>
              <button className="button primary" onClick={handleSaveAttributeEdit}>
                <CheckCircle2 size={16} /> Guardar Corrección
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
