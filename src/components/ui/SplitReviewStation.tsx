import React, { useState, useEffect } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  FileText,
  Search,
  Check,
  Edit2,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize,
  History,
  Columns3,
  Layers,
  ListFilter,
  X,
} from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { StatusPill } from './StatusPill'
import { SideDrawer } from './SideDrawer'

export interface PropertyAttributeReview {
  id: string
  key: string
  label: string
  value: string | number
  sourceDocumentKind: 'estudio_titulos' | 'plano' | 'negociacion' | 'manual'
  confidence: number // 0 - 100
  evidenceText?: string
  evidencePage?: number
  hasDiscrepancy?: boolean
  isEdited?: boolean
  previousValue?: string
  lastModifiedBy?: string
  lastModifiedAt?: string
  changeMotive?: string
  // Comparativa tripartita (US-252)
  titleValue?: string
  planValue?: string
  negotiationValue?: string
}

export interface PropertyListItem {
  id: string
  folio: string
  code: string
  name: string
  status: 'aprobado' | 'en_revision' | 'discrepancia'
}

export interface SplitReviewStationProps {
  propertyFolio: string
  propertyName: string
  attributes: PropertyAttributeReview[]
  documentUrl?: string
  documentName?: string
  propertiesList?: PropertyListItem[]
  onSelectPropertyFromList?: (propertyId: string) => void
  onSaveAttribute: (attrId: string, newValue: string) => void
  onApproveProperty: () => void
  onFlagDiscrepancy: (reason?: string) => void
  onNextProperty?: () => void
  onPrevProperty?: () => void
}

export function SplitReviewStation({
  propertyFolio,
  propertyName,
  attributes,
  documentUrl,
  documentName = 'Estudio_Titulos_Consolidado.pdf',
  propertiesList = [],
  onSelectPropertyFromList,
  onSaveAttribute,
  onApproveProperty,
  onFlagDiscrepancy,
  onNextProperty,
  onPrevProperty,
}: SplitReviewStationProps) {
  // Divisor vertical arrastrable (US-246)
  const [splitRatio, setSplitRatio] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const [activeAttrId, setActiveAttrId] = useState<string | null>(attributes[0]?.id || null)
  const [editingAttrId, setEditingAttrId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  // US-251: Controles de zoom y rotación en visor PDF
  const [zoomLevel, setZoomLevel] = useState(100) // 50% - 300%
  const [rotation, setRotation] = useState(0) // 0, 90, 180, 270

  // US-254: Selector de documento fuente (<200ms)
  const [activeDocTab, setActiveDocTab] = useState<'estudio' | 'plano' | 'negociacion'>('estudio')

  // US-252: Vista comparativa tripartita
  const [showTripartiteView, setShowTripartiteView] = useState(false)

  // US-253: Drawer lateral de predios del lote
  const [showPropertyDrawer, setShowPropertyDrawer] = useState(false)
  const [propertySearchQuery, setPropertySearchQuery] = useState('')

  // US-281: Micro-animación de destello verde al aprobar
  const [approvedFlash, setApprovedFlash] = useState(false)

  // US-283: Sacudida horizontal por error
  const [shakeAttrId, setShakeAttrId] = useState<string | null>(null)

  const activeAttribute = attributes.find((a) => a.id === activeAttrId)

  // Arrastre del split-pane
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const newRatio = (e.clientX / window.innerWidth) * 100
      if (newRatio >= 20 && newRatio <= 80) {
        setSplitRatio(newRatio)
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // Atajos de teclado (US-250)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        handleApproveWithFlash()
      } else if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        onFlagDiscrepancy('Marcado por atajo de teclado')
      } else if (e.altKey && e.key === 'ArrowRight' && onNextProperty) {
        e.preventDefault()
        onNextProperty()
      } else if (e.altKey && e.key === 'ArrowLeft' && onPrevProperty) {
        e.preventDefault()
        onPrevProperty()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onFlagDiscrepancy, onNextProperty, onPrevProperty])

  const handleApproveWithFlash = () => {
    setApprovedFlash(true)
    setTimeout(() => {
      setApprovedFlash(false)
      onApproveProperty()
    }, 300)
  }

  const startEditing = (attr: PropertyAttributeReview) => {
    setEditingAttrId(attr.id)
    setEditValue(String(attr.value))
  }

  const saveEdit = (attrId: string) => {
    if (!editValue.trim()) {
      setShakeAttrId(attrId)
      setTimeout(() => setShakeAttrId(null), 500)
      return
    }
    onSaveAttribute(attrId, editValue)
    setEditingAttrId(null)
  }

  // Filtrado de predios para el Drawer lateral (US-253)
  const filteredProperties = propertiesList.filter(
    (p) =>
      p.code.toLowerCase().includes(propertySearchQuery.toLowerCase()) ||
      p.folio.toLowerCase().includes(propertySearchQuery.toLowerCase()) ||
      p.name.toLowerCase().includes(propertySearchQuery.toLowerCase())
  )

  const getDocNameByTab = () => {
    switch (activeDocTab) {
      case 'plano':
        return 'Plano_Topografico_Predial.pdf'
      case 'negociacion':
        return 'Acta_Negociacion_Servidumbre.pdf'
      default:
        return documentName
    }
  }

  return (
    <div className={`split-review-container ${approvedFlash ? 'ring-4 ring-emerald-500/80 bg-emerald-950/20' : ''} transition-all duration-300`}>
      {/* Cabecera de la estación */}
      <div className="split-review-header">
        <div className="split-header-info">
          <button
            type="button"
            onClick={() => setShowPropertyDrawer(true)}
            className="drawer-open-btn"
            title="Abrir listado rápido de predios (US-253)"
          >
            <ListFilter size={14} className="text-accent" />
            <span>Predios ({propertiesList.length || 'Lote'})</span>
          </button>
          <div className="split-title-group">
            <h3>
              Predio: {propertyFolio} — {propertyName}
            </h3>
            <span className="split-badge-sub">Estación Split-View • Superior a PMO</span>
          </div>
        </div>

        <div className="split-header-nav">
          {/* Alternar comparativa tripartita (US-252) */}
          <button
            type="button"
            onClick={() => setShowTripartiteView(!showTripartiteView)}
            className={`tripartite-toggle-btn ${showTripartiteView ? 'active' : ''}`}
          >
            <Columns3 size={14} />
            <span>{showTripartiteView ? 'Ocultar Comparativa' : 'Comparativa 3 Fuentes (US-252)'}</span>
          </button>

          {onPrevProperty && (
            <button type="button" className="button secondary small" onClick={onPrevProperty} title="Alt + ←">
              <ArrowLeft size={14} /> Anterior
            </button>
          )}
          {onNextProperty && (
            <button type="button" className="button secondary small" onClick={onNextProperty} title="Alt + →">
              Siguiente <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Drawer lateral de selección de predios (US-253) */}
      <SideDrawer
        open={showPropertyDrawer}
        onOpenChange={setShowPropertyDrawer}
        title="Directorio de Predios del Lote"
        description="Selección instantánea sin salir de la estación de revisión"
        side="left"
      >
        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por código, matrícula o nombre..."
              value={propertySearchQuery}
              onChange={(e) => setPropertySearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          </div>

          <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
            {filteredProperties.length > 0 ? (
              filteredProperties.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelectPropertyFromList?.(p.id)
                    setShowPropertyDrawer(false)
                  }}
                  className={`p-2.5 rounded-xl border transition-colors cursor-pointer select-none ${
                    p.folio === propertyFolio
                      ? 'bg-emerald-950/40 border-emerald-500/60 text-slate-100'
                      : 'bg-slate-800/60 border-slate-750 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-200">{p.code}</span>
                    <StatusPill status={p.status} />
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{p.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">FMI: {p.folio}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">No se encontraron predios</p>
            )}
          </div>
        </div>
      </SideDrawer>

      {/* Cuerpo Split-Pane (US-246) */}
      <div className="split-review-body">
        {/* Panel Izquierdo: Visor de PDF con controles de zoom, rotación y selector de documentos (US-247, US-251, US-254) */}
        <div className="split-pane-left" style={{ width: `${splitRatio}%` }}>
          {/* Pestañas de documentos fuente (US-254) */}
          <div className="split-doc-toolbar">
            <div className="doc-source-tabs">
              <button
                type="button"
                onClick={() => setActiveDocTab('estudio')}
                className={`doc-source-tab ${activeDocTab === 'estudio' ? 'active' : ''}`}
              >
                Estudio de Títulos
              </button>
              <button
                type="button"
                onClick={() => setActiveDocTab('plano')}
                className={`doc-source-tab ${activeDocTab === 'plano' ? 'active' : ''}`}
              >
                Plano Topográfico
              </button>
              <button
                type="button"
                onClick={() => setActiveDocTab('negociacion')}
                className={`doc-source-tab ${activeDocTab === 'negociacion' ? 'active' : ''}`}
              >
                Acta Negociación
              </button>
            </div>

            {/* Controles de Zoom y Rotación (US-251) */}
            <div className="doc-zoom-controls">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(50, z - 25))}
                title="Alejar (Zoom -)"
                className="zoom-btn"
              >
                <ZoomOut size={13} />
              </button>
              <span className="zoom-value">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(300, z + 25))}
                title="Acercar (Zoom +)"
                className="zoom-btn"
              >
                <ZoomIn size={13} />
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                title="Girar 90° (Rotación)"
                className="zoom-btn"
              >
                <RotateCw size={13} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoomLevel(100)
                  setRotation(0)
                }}
                title="Restablecer vista"
                className="zoom-btn"
              >
                <Maximize size={13} />
              </button>
            </div>
          </div>

          <div className="pane-header flex items-center justify-between">
            <div className="pane-title flex items-center gap-1.5">
              <FileText size={15} className="text-emerald-400" />
              <span className="truncate text-xs font-mono">{getDocNameByTab()}</span>
            </div>
            {activeAttribute?.evidencePage && (
              <span className="badge badge-info">Página {activeAttribute.evidencePage}</span>
            )}
          </div>

          <div className="pdf-viewer-mockup overflow-auto relative">
            {activeAttribute?.evidenceText ? (
              <div className="pdf-evidence-highlight-card">
                <div className="highlight-tag">
                  <div className="highlight-tag-header">
                    <Sparkles size={15} className="highlight-tag-icon" />
                    <span className="highlight-tag-title">Evidencia Extraída por IA</span>
                    <span className="highlight-attr-pill">{activeAttribute.label}</span>
                  </div>
                  <span className="confidence-pill">{activeAttribute.confidence}% confianza</span>
                </div>

                <blockquote className="highlight-quote">
                  "{activeAttribute.evidenceText}"
                </blockquote>

                <div className="highlight-meta">
                  <div className="meta-source-info">
                    <FileText size={13} className="text-muted" />
                    <span>Coincidencia textual en documento</span>
                  </div>
                  <span className="meta-doc-tag">
                    Página {activeAttribute.evidencePage || 1} • {getDocNameByTab()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="pdf-empty-state">
                <FileText size={48} className="text-muted" />
                <p>Selecciona un atributo a la derecha para ver la evidencia resaltada en el documento</p>
              </div>
            )}

            {/* Simulación de página PDF con escala y rotación aplicadas */}
            <div
              className="pdf-sheet-simulated transition-transform duration-200"
              style={{
                transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                transformOrigin: 'top center',
              }}
            >
              <div className="pdf-sheet-header">
                <div className="pdf-sheet-sub">REPÚBLICA DE COLOMBIA</div>
                <div className="pdf-sheet-title">SUPERINTENDENCIA DE NOTARIADO Y REGISTRO</div>
                <div className="pdf-sheet-cert">OFICINA DE REGISTRO DE INSTRUMENTOS PÚBLICOS</div>
                <div className="pdf-sheet-meta-row">
                  <span>MATRÍCULA: <strong>{propertyFolio}</strong></span>
                  <span>ESTADO: <strong>ACTIVO REGISTRAL</strong></span>
                </div>
                <hr className="pdf-sheet-divider" />
              </div>

              <div className="pdf-sheet-body">
                <p className="pdf-sheet-paragraph">
                  En cumplimiento de las disposiciones registrales y notariales vigentes, se certifica que la información extraída y cotejada corresponde fielmente a los expedientes y títulos archivados:
                </p>

                {activeAttribute?.evidenceText && (
                  <div className="pdf-highlight-box">
                    <div className="pdf-highlight-badge">
                      <Sparkles size={11} /> Cita de Soporte Registral Identificada por IA
                    </div>
                    <div className="pdf-highlight-text">
                      "{activeAttribute.evidenceText}"
                    </div>
                  </div>
                )}

                <p className="pdf-sheet-paragraph">
                  Las inscripciones de dominio, cabida superficiaria, linderos y gravámenes constan en los respectivos folios y planos anexos que integran la tradición jurídica de este predio rural/urbano.
                </p>
                <p className="pdf-sheet-paragraph">
                  Se expide la presente certificación documental con fines de conciliación predial y estructuración del expediente técnico-jurídico.
                </p>
              </div>

              <div className="pdf-sheet-footer">
                <div className="pdf-footer-stamp">OFICINA REGISTRAL • FIRMA DIGITAL VALIDADA</div>
                <div className="pdf-footer-page">Página {activeAttribute?.evidencePage || 1} de 4</div>
              </div>
            </div>
          </div>
        </div>

        {/* Separador arrastrable */}
        <div
          className={`split-divider ${isDragging ? 'dragging' : ''}`}
          onMouseDown={() => setIsDragging(true)}
          role="separator"
          aria-valuenow={splitRatio}
        />

        {/* Panel Derecho: Formulario de atributos con edición inline y comparativa */}
        <div className="split-pane-right" style={{ width: `${100 - splitRatio}%` }}>
          <div className="pane-header flex items-center justify-between">
            <h4>Atributos Jurídicos y Catastrales</h4>
            <span className="badge badge-neutral">{attributes.length} campos</span>
          </div>

          {/* US-252: Vista comparativa tripartita desplegable */}
          {showTripartiteView && activeAttribute && (
            <div className="p-3 mb-3 bg-indigo-950/40 border border-indigo-500/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                  <Columns3 className="w-3.5 h-3.5 text-indigo-400" />
                  Comparativa de Fuentes para: {activeAttribute.label}
                </span>
                <button
                  type="button"
                  onClick={() => setShowTripartiteView(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                {/* Fuente 1: Estudio de Títulos */}
                <div className="p-2 bg-slate-900 border border-slate-750 rounded-lg">
                  <span className="text-[10px] text-emerald-400 font-semibold block">1. Estudio de Títulos</span>
                  <p className="font-mono text-slate-200 mt-1 text-xs">
                    {activeAttribute.titleValue || String(activeAttribute.value)}
                  </p>
                  <button
                    type="button"
                    onClick={() => onSaveAttribute(activeAttribute.id, activeAttribute.titleValue || String(activeAttribute.value))}
                    className="mt-2 text-[10px] w-full py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40"
                  >
                    Elegir como oficial
                  </button>
                </div>

                {/* Fuente 2: Plano Topográfico */}
                <div className="p-2 bg-slate-900 border border-slate-750 rounded-lg">
                  <span className="text-[10px] text-indigo-400 font-semibold block">2. Plano Topográfico</span>
                  <p className="font-mono text-slate-200 mt-1 text-xs">
                    {activeAttribute.planValue || '11.850 m²'}
                  </p>
                  <button
                    type="button"
                    onClick={() => onSaveAttribute(activeAttribute.id, activeAttribute.planValue || '11.850 m²')}
                    className="mt-2 text-[10px] w-full py-0.5 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/40"
                  >
                    Elegir como oficial
                  </button>
                </div>

                {/* Fuente 3: Negociación */}
                <div className="p-2 bg-slate-900 border border-slate-750 rounded-lg">
                  <span className="text-[10px] text-amber-400 font-semibold block">3. Acta Negociación</span>
                  <p className="font-mono text-slate-200 mt-1 text-xs">
                    {activeAttribute.negotiationValue || String(activeAttribute.value)}
                  </p>
                  <button
                    type="button"
                    onClick={() => onSaveAttribute(activeAttribute.id, activeAttribute.negotiationValue || String(activeAttribute.value))}
                    className="mt-2 text-[10px] w-full py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40"
                  >
                    Elegir como oficial
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="attributes-review-list space-y-2">
            {attributes.map((attr) => {
              const isActive = attr.id === activeAttrId
              const isEditing = attr.id === editingAttrId
              const isShaking = attr.id === shakeAttrId

              return (
                <div
                  key={attr.id}
                  className={`attr-review-card ${isActive ? 'active' : ''} ${
                    attr.hasDiscrepancy ? 'has-discrepancy' : ''
                  } ${isShaking ? 'animate-shake border-rose-500 ring-2 ring-rose-500/50' : ''}`}
                  onClick={() => setActiveAttrId(attr.id)}
                >
                  <div className="attr-header-row flex items-center justify-between">
                    <span className="attr-label">{attr.label}</span>
                    <div className="attr-badges flex items-center gap-1.5">
                      {/* Píldora de confianza */}
                      <span className={`confidence-badge ${attr.confidence >= 80 ? 'high' : 'medium'}`}>
                        {attr.sourceDocumentKind === 'estudio_titulos' ? 'Títulos' : attr.sourceDocumentKind === 'plano' ? 'Plano' : 'Negociación'} • {attr.confidence}%
                      </span>
                      {attr.isEdited && <span className="edited-badge">Editado</span>}

                      {/* US-255: Popover con historial de versiones */}
                      <Popover.Root>
                        <Popover.Trigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            title="Ver historial de auditoría de este atributo (US-255)"
                            className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                          >
                            <History className="w-3 h-3" />
                          </button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content
                            side="left"
                            align="center"
                            className="z-50 w-72 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl text-xs space-y-2 focus:outline-none"
                          >
                            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                                <History className="w-3.5 h-3.5 text-emerald-400" />
                                Historial: {attr.label}
                              </span>
                            </div>
                            <div className="space-y-1.5 text-[11px] text-slate-300">
                              <div>
                                <span className="text-slate-500 block">Valor Actual:</span>
                                <span className="font-mono text-emerald-400">{String(attr.value)}</span>
                              </div>
                              {attr.previousValue && (
                                <div>
                                  <span className="text-slate-500 block">Valor Anterior:</span>
                                  <span className="font-mono text-slate-400 line-through">{attr.previousValue}</span>
                                </div>
                              )}
                              <div>
                                <span className="text-slate-500 block">Última Modificación:</span>
                                <span>{attr.lastModifiedBy || 'Extracción Automática IA'}</span>
                              </div>
                              {attr.changeMotive && (
                                <div>
                                  <span className="text-slate-500 block">Motivo:</span>
                                  <span className="text-slate-300 italic">{attr.changeMotive}</span>
                                </div>
                              )}
                            </div>
                            <Popover.Arrow className="fill-slate-900" />
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    </div>
                  </div>

                  <div className="attr-value-row">
                    {isEditing ? (
                      <div className="attr-inline-edit" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          className="input-inline"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(attr.id)
                            if (e.key === 'Escape') setEditingAttrId(null)
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-xs"
                          onClick={() => saveEdit(attr.id)}
                          title="Guardar (Enter)"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs"
                          onClick={() => setEditingAttrId(null)}
                          title="Cancelar (Esc)"
                        >
                          <RotateCcw size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="attr-value-display">
                        <span className="attr-value-text">{String(attr.value) || '(Sin información)'}</span>
                        <button
                          type="button"
                          className="btn-icon-edit"
                          onClick={(e) => {
                            e.stopPropagation()
                            startEditing(attr)
                          }}
                          title="Editar manualmente (US-249)"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {attr.hasDiscrepancy && (
                    <div className="attr-discrepancy-warning">
                      <AlertTriangle size={13} />
                      <span>Discrepancia detectada contra plano topográfico</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Barra de acción fija inferior con atajos (US-250) */}
      <div className="split-review-footer">
        <div className="footer-shortcuts">
          <span className="shortcut-hint">
            <kbd>Alt</kbd> + <kbd>A</kbd> Aprobar
          </span>
          <span className="shortcut-hint">
            <kbd>Alt</kbd> + <kbd>D</kbd> Marcar Discrepancia
          </span>
          <span className="shortcut-hint">
            <kbd>Alt</kbd> + <kbd>→</kbd> Siguiente
          </span>
        </div>
        <div className="footer-actions">
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => onFlagDiscrepancy('Discrepancia reportada por el revisor')}
          >
            <AlertTriangle size={16} /> Marcar con Discrepancia
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleApproveWithFlash}
          >
            <CheckCircle2 size={16} /> Aprobar Predio
          </button>
        </div>
      </div>
    </div>
  )
}
