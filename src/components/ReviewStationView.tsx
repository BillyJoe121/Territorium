import React, { useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CornerDownLeft,
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

  // Atributos visibles según pestaña
  const visibleAttributes = selected
    ? Object.values(selected.attributes).filter((attr) => {
        if (activeTab === 'todos') return true
        return attr.category === activeTab
      })
    : []

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

  if (!selected) {
    return (
      <div className="card empty-state" style={{ padding: '3rem', textAlign: 'center' }}>
        <FileSpreadsheet size={48} style={{ color: 'var(--color-primary)', margin: '0 auto 1rem' }} />
        <h3>No hay registros disponibles para la mesa de revisión</h3>
        <p>Procesa un lote o carga insumos en el expediente para habilitar la conciliación de títulos y planos.</p>
      </div>
    )
  }

  if (viewMode === 'split' && selected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>VISTA DE REVISIÓN:</span>
            <button
              type="button"
              className="btn btn-primary btn-xs"
              onClick={() => setViewMode('split')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <Columns size={13} /> Visor Split-View (US-246)
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => setViewMode('standard')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <LayoutGrid size={13} /> Ficha Tradicional
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Predio activo: <strong>{selected.propertyCode}</strong> ({selected.folio})
            </span>
          </div>
        </div>

        <SplitReviewStation
          propertyFolio={selected.folio}
          propertyName={selected.canonicalName}
          documentName={relatedDoc?.name || 'Estudio_Titulos_Consolidado.pdf'}
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
            const currentIndex = filteredRecords.findIndex((r) => r.id === selected.id)
            if (currentIndex >= 0 && currentIndex < filteredRecords.length - 1) {
              setSelectedId(filteredRecords[currentIndex + 1].id)
            }
          }}
          onPrevProperty={() => {
            const currentIndex = filteredRecords.findIndex((r) => r.id === selected.id)
            if (currentIndex > 0) {
              setSelectedId(filteredRecords[currentIndex - 1].id)
            }
          }}
        />
      </div>
    )
  }

  return (
    <div className="review-station-container" style={{ display: 'grid', gridTemplateColumns: '320px 1fr 380px', gap: '1rem', height: 'calc(100vh - 130px)' }}>
      {/* PANEL 1: BANDEJA PRIORIZADA DE PREDIOS (US-105, US-174) */}
      <section className="card panel-tray" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileCheck size={18} color="var(--color-primary)" />
              Bandeja de Predios
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => setViewMode('split')}
                title="Cambiar a Split-View (US-246)"
              >
                <Columns size={12} />
              </button>
              <span className="badge" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '0.75rem' }}>
                {filteredRecords.length} / {records.length}
              </span>
            </div>
          </div>

          <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
            <Search size={15} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar predio, folio, municipio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: '2rem', height: '32px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            <button
              className={`pill-button ${filterState === 'all' ? 'active' : ''}`}
              onClick={() => setFilterState('all')}
              style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '12px' }}
            >
              Todos
            </button>
            <button
              className={`pill-button ${filterState === 'pendientes' ? 'active' : ''}`}
              onClick={() => setFilterState('pendientes')}
              style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '12px' }}
            >
              Pendientes
            </button>
            <button
              className={`pill-button ${filterState === 'conflictos' ? 'active' : ''}`}
              onClick={() => setFilterState('conflictos')}
              style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '12px', color: '#b91c1c' }}
            >
              Conflictos
            </button>
            <button
              className={`pill-button ${filterState === 'aprobados' ? 'active' : ''}`}
              onClick={() => setFilterState('aprobados')}
              style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '12px', color: '#15803d' }}
            >
              Aprobados
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {filteredRecords.map((rec) => {
            const isSelected = rec.id === selected.id
            const hasConflict = rec.criticalConflictCount > 0
            return (
              <div
                key={rec.id}
                onClick={() => setSelectedId(rec.id)}
                style={{
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                  backgroundColor: isSelected ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <strong style={{ fontSize: '0.85rem' }}>{rec.propertyCode}</strong>
                  <span className={`status ${rec.reviewState}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
                    {rec.reviewState}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                  {rec.canonicalName} · {rec.municipality}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem' }}>
                  <span>FMI: {rec.folio}</span>
                  {hasConflict ? (
                    <span style={{ color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 600 }}>
                      <AlertTriangle size={12} /> {rec.criticalConflictCount} conflicto(s)
                    </span>
                  ) : (
                    <span style={{ color: 'var(--color-text-muted)' }}>Calidad {Math.round(rec.semanticQualityScore * 100)}%</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* PANEL 2: MATRIZ DE ATRIBUTOS MAESTRA (US-158 a US-162, US-174) */}
      <section className="card panel-master" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
        {/* Cabecera del predio activo */}
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{selected.propertyCode}</h2>
                <span className="badge" style={{ backgroundColor: 'var(--color-surface)', fontSize: '0.75rem' }}>
                  Versión {selected.batchVersion}
                </span>
                <span className={`status ${selected.reviewState}`}>{selected.reviewState}</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                {selected.canonicalName} · Matrícula: {selected.folio} · {selected.municipality}, {selected.department}
              </p>
            </div>

            {/* Acciones de aprobación / devolución del predio (US-108) */}
            {canReview && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="button secondary small" onClick={handleDevolveRecord} title="Devolver para reproceso selectivo">
                  <RotateCcw size={14} /> Devolver
                </button>
                <button
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

          {/* Banner de conflictos críticos si existen (US-097, US-099) */}
          {selected.criticalConflictCount > 0 && (
            <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.8rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} />
              <div>
                <strong>Conflicto material entre fuentes:</strong> {selected.exportBlockReasons.join(' ')}
              </div>
            </div>
          )}

          {/* Pestañas de categorías del esquema maestro CORRESPONDENCIA.xlsx (US-158) */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderBottom: '1px solid var(--color-border)' }}>
            {(['todos', 'identificacion', 'juridico', 'tecnico', 'manual'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.8rem',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
                  background: 'transparent',
                  fontWeight: activeTab === tab ? 600 : 400,
                  color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla de atributos con 3 estados y trazabilidad (US-101, US-158, US-160) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                <th style={{ padding: '0.5rem' }}>Atributo Maestro</th>
                <th style={{ padding: '0.5rem' }}>Valor Activo</th>
                <th style={{ padding: '0.5rem' }}>Origen</th>
                <th style={{ padding: '0.5rem' }}>Evidencia / Confianza</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {visibleAttributes.map((attr) => {
                const isSelectedAttr = activeAttributeKey === attr.fieldKey
                return (
                  <tr
                    key={attr.fieldKey}
                    onClick={() => setActiveAttributeKey(attr.fieldKey)}
                    style={{
                      borderBottom: '1px solid var(--color-border-subtle)',
                      backgroundColor: isSelectedAttr ? 'var(--color-primary-subtle)' : attr.hasConflict ? '#fff1f2' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        {attr.hasConflict && <AlertTriangle size={14} color="#b91c1c" />}
                        {attr.requiresLegalReview && (
                          <span title="Revisión jurídica obligatoria">
                            <ShieldAlert size={14} color="#d97706" />
                          </span>
                        )}
                        {attr.label}
                      </div>
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {attr.activeValue}
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem' }}>
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.7rem',
                          backgroundColor:
                            attr.sourceState === 'approved' ? '#dcfce7' : attr.sourceState === 'manual' ? '#e0e7ff' : '#f3f4f6',
                          color:
                            attr.sourceState === 'approved' ? '#15803d' : attr.sourceState === 'manual' ? '#4338ca' : '#374151',
                        }}
                      >
                        {attr.sourceState.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', color: 'var(--color-text-muted)' }}>
                      {attr.evidence ? `${attr.evidence.documentName} (pág. ${attr.evidence.pageOrSection})` : 'Regla de negocio'}
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                      {canReview && (
                        <button
                          className="button secondary small"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenEditor(attr)
                          }}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          Corregir
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* PANEL 3: EVIDENCIA DOCUMENTAL Y VISOR DE TRABAJO (US-165, US-166, US-174) */}
      <section className="card panel-evidence" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileSearch size={18} color="var(--color-primary)" />
              Evidencia Fuente
            </h3>
            {relatedDoc && (
              <button
                className="text-button"
                onClick={() => onOpenSignedUrl(relatedDoc.id)}
                style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              >
                <Maximize2 size={13} /> Original
              </button>
            )}
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Documento: <strong>{relatedDoc?.name ?? 'Sin documento cargado'}</strong>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {activeAttributeKey ? (
            <div>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
                Evidencia de: {selected.attributes[activeAttributeKey]?.label}
              </h4>

              {selected.attributes[activeAttributeKey]?.evidence ? (
                <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem' }}>
                    Ubicación: Página/Sección {selected.attributes[activeAttributeKey].evidence?.pageOrSection}
                  </div>
                  <blockquote style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic', borderLeft: '3px solid var(--color-primary)', paddingLeft: '0.5rem' }}>
                    "{selected.attributes[activeAttributeKey].evidence?.quote}"
                  </blockquote>
                </div>
              ) : (
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  Este atributo proviene de consolidación tabular directa o del encabezado de la ficha predial.
                </p>
              )}

              {/* Detalle especial para Linderos Literales (US-070, US-071) */}
              {activeAttributeKey === 'linderos_literales' && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--color-surface-subtle)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                  <h5 style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Shield size={14} /> Inspección Literal de Linderos
                  </h5>
                  <div style={{ fontSize: '0.78rem', whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto', backgroundColor: '#fff', padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
                    {selected.attributes['linderos_literales'].activeValue}
                  </div>
                </div>
              )}

              {/* Historial de cambios del atributo (US-107, US-160) */}
              {selected.attributes[activeAttributeKey]?.changeMotive && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '0.78rem' }}>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#166534', marginBottom: '0.25rem' }}>
                    <History size={13} /> Historial de Modificación
                  </strong>
                  <div><strong>Modificado por:</strong> {selected.attributes[activeAttributeKey].lastModifiedBy}</div>
                  <div><strong>Motivo:</strong> {selected.attributes[activeAttributeKey].changeMotive}</div>
                  <div><strong>Valor anterior:</strong> {selected.attributes[activeAttributeKey].previousValue}</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', paddingTop: '2rem' }}>
              <FileText size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
              <p style={{ fontSize: '0.85rem' }}>Selecciona un atributo en la matriz central para inspeccionar su evidencia, página y cita textual de soporte.</p>
            </div>
          )}
        </div>
      </section>

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
