import React, { ChangeEvent, DragEvent, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  FileWarning,
  FolderArchive,
  Hash,
  HelpCircle,
  Info,
  Layers,
  LoaderCircle,
  Package,
  RefreshCw,
  ShieldCheck,
  Tag,
  Trash2,
  UploadCloud,
  XCircle,
  Lock,
  ScanText,
} from 'lucide-react'
import { preProcessDocument } from '../lib/documentPreprocessor'
import type {
  Batch,
  BatchItem,
  DocumentKind,
  DocumentTask,
  DuplicateDecision,
  ExceptionCategory,
  JobState,
  ManifestSummary,
  Project,
  SourceDocument,
  UploadProgress,
} from '../types'

import {
  analyzeBatchDuplicates,
  computeManifestSummary,
  extractPropertyCode,
  extractZipArchive,
  validateFileEntry,
} from '../lib/batchValidation'
import { dataMode } from '../lib/supabase'

export interface IngestionViewProps {
  project: Project
  batches: Batch[]
  documents: SourceDocument[]
  tasks?: DocumentTask[]
  onUploadBatch: (
    items: BatchItem[],
    expectedProperties: string[],
    manifestSummary: ManifestSummary
  ) => Promise<void>
  onRunBatch: (batchId: string) => Promise<void>
  onCancelBatch: (batchId: string) => Promise<void>
  onReprocessTask?: (taskId: string) => Promise<void>
  busyAction: string | null
  uploadProgress: UploadProgress | null
}

const kindLabels: Record<DocumentKind, string> = {
  estudio_titulos: 'Estudio de títulos',
  plano: 'Plano',
  linderos: 'Linderos / Cabida',
  negociacion: 'Plantilla de negociación',
  soporte: 'Soporte',
  sin_clasificar: 'Sin clasificar',
}

const stateLabels: Record<JobState, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  requiere_revision: 'Requiere revisión',
  completado: 'Completado',
  fallido: 'Fallido',
  cancelado: 'Cancelado',
}

export function IngestionView({
  project,
  batches,
  documents,
  tasks,
  onUploadBatch,
  onRunBatch,
  onCancelBatch,
  onReprocessTask,
  busyAction,
  uploadProgress,
}: IngestionViewProps) {
  const canOperate = dataMode === 'local' || ['owner', 'operator'].includes(project.role ?? '')

  const [selectedBatchTasksId, setSelectedBatchTasksId] = useState<string | null>(null)

  const projectExceptions = useMemo(() => {
    return (tasks ?? []).filter(
      (t) => t.status === 'failed' || t.status === 'blocked' || t.dependencyStatus === 'blocked'
    )
  }, [tasks])

  const exceptionCategoryLabels: Record<ExceptionCategory, string> = {
    password_encrypted: 'Protegido por contraseña',
    permanent_unreadable: 'Ilegible / Requiere OCR',
    ai_quota_exceeded: 'Cuota de IA agotada (429)',
    schema_validation_exhausted: 'Fallo de contrato JSON',
    missing_dependency: 'Dependencia no satisfecha',
    unsupported_format: 'Formato dañado o vacío',
    other: 'Excepción de ejecución',
  }

  // State for raw selected files
  const [items, setItems] = useState<BatchItem[]>([])
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

  // The expected-properties card was removed from the preparation UI. Keep the
  // empty collection so manifest/upload callbacks retain their existing shape.
  const expectedProperties: string[] = []

  // Bulk kind setter
  const [bulkKind, setBulkKind] = useState<DocumentKind>('sin_clasificar')

  // Acknowledgment checkpoint for non-critical warnings (US-029)
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false)

  // Process files and calculate hashes / validations
  async function processIncomingFiles(incomingFiles: File[]) {
    if (!incomingFiles.length) return
    setIsValidating(true)

    try {
      const flattenedFiles: File[] = []
      for (const file of incomingFiles) {
        if (file.name.toLowerCase().endsWith('.zip')) {
          const unzipped = await extractZipArchive(file)
          flattenedFiles.push(...unzipped)
        } else {
          flattenedFiles.push(file)
        }
      }

      const newItems: BatchItem[] = []
      for (const file of flattenedFiles) {
        const { errors, warnings, hash } = await validateFileEntry(file)
        const analysis = await preProcessDocument(file)

        if (analysis.isEncrypted) {
          errors.push('Documento protegido por contraseña (US-040). Requiere versión desbloqueada.')
        }
        if (analysis.exceptionReason && !errors.includes(analysis.exceptionReason)) {
          if (analysis.preprocessingStatus === 'corrupt') {
            errors.push(analysis.exceptionReason)
          } else {
            warnings.push(analysis.exceptionReason)
          }
        }

        const deducedCode = extractPropertyCode(file.name)

        newItems.push({
          id: `item-${crypto.randomUUID()}`,
          file,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          sha256: hash || analysis.sha256,
          kind: 'sin_clasificar',
          propertyCode: deducedCode,
          pageCount: analysis.pageCount,
          isScanned: analysis.isScanned,
          needsOcr: analysis.needsOcr,
          isEncrypted: analysis.isEncrypted,
          textOrigin: analysis.textOrigin,
          errors,
          warnings,
          isDuplicate: false,
        })
      }

      setItems((current) => {
        const combined = [...current, ...newItems]
        return analyzeBatchDuplicates(combined, documents)
      })
    } finally {
      setIsValidating(false)
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    void processIncomingFiles(files)
    event.target.value = ''
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (!canOperate) return
    setIsDraggingOver(true)
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDraggingOver(false)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDraggingOver(false)
    if (!canOperate) return
    const files = Array.from(event.dataTransfer.files ?? [])
    void processIncomingFiles(files)
  }

  function removeItem(id: string) {
    setItems((current) => {
      const remaining = current.filter((it) => it.id !== id)
      return analyzeBatchDuplicates(remaining, documents)
    })
  }

  function clearAll() {
    setItems([])
    setAcknowledgeWarnings(false)
  }

  function updateItemKind(id: string, kind: DocumentKind) {
    setItems((current) =>
      current.map((it) => (it.id === id ? { ...it, kind } : it))
    )
  }

  function applyBulkKind() {
    if (bulkKind === 'sin_clasificar') return
    setItems((current) =>
      current.map((it) => ({ ...it, kind: bulkKind }))
    )
  }

  function updateItemPropertyCode(id: string, propertyCode: string) {
    setItems((current) =>
      current.map((it) => (it.id === id ? { ...it, propertyCode: propertyCode.trim() } : it))
    )
  }

  function updateDuplicateDecision(id: string, decision: DuplicateDecision) {
    setItems((current) =>
      current.map((it) => (it.id === id ? { ...it, duplicateDecision: decision } : it))
    )
  }

  // Pre-Flight Manifest computation (US-028, US-029)
  const manifest = useMemo(
    () => computeManifestSummary(items, expectedProperties),
    [items, expectedProperties]
  )

  const hasWarnings =
    manifest.missingProperties.length > 0 || manifest.unassignedFiles > 0

  const isUploadAllowed =
    manifest.canProcess &&
    (!hasWarnings || acknowledgeWarnings) &&
    busyAction !== 'upload'

  async function handleSubmitBatch() {
    if (!isUploadAllowed) return
    await onUploadBatch(items, expectedProperties, manifest)
    setItems([])
    setAcknowledgeWarnings(false)
  }

  return (
    <div className="ingestion-container">
      {/* Header */}
      <div className="intro">
        <p className="eyebrow">{project.name.toUpperCase()}</p>
        <h2>Preparación y Manifiesto de Lote</h2>
        <p>
          Carga insumos por arrastre, selección múltiple o paquete ZIP. Valida
          integridad, duplicados por hash y cobertura frente a predios esperados antes de procesar.
        </p>
      </div>

      {!canOperate && (
        <div className="warning">
          <ShieldCheck size={18} />
          <div>
            <strong>Acceso de consulta</strong>
            <p>Tu rol en este expediente no permite cargar nuevos insumos ni ejecutar lotes.</p>
          </div>
        </div>
      )}

      {/* Zona de Carga Drag & Drop y Selección (US-019) */}
      <section
        className={`upload-card dropzone ${isDraggingOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="drop-icon">
          <UploadCloud size={32} />
        </div>
        <div className="drop-content">
          <h3>Arrastra archivos aquí o selecciónalos de tu equipo</h3>
          <p>
            Admite <strong>PDF, DOCX, imágenes (.png, .jpg)</strong> o <strong>paquetes comprimidos (.zip)</strong>.
            Límite de hasta 50 MB por archivo.
          </p>
          {isValidating && (
            <div className="validating-indicator">
              <LoaderCircle size={16} className="spin" />
              <span>Extrayendo archivos y verificando hash SHA-256…</span>
            </div>
          )}
        </div>
        <label className={!canOperate || busyAction === 'upload' ? 'file-choose disabled' : 'file-choose'}>
          <FilePlus2 size={18} />
          Seleccionar archivos o ZIP
          <input
            disabled={!canOperate || busyAction === 'upload'}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip"
            onChange={handleFileInput}
          />
        </label>
      </section>

      {/* Progreso de Carga en curso */}
      {uploadProgress && (
        <section className="card upload-progress" role="status">
          <div>
            <strong>Cargando {uploadProgress.fileName}</strong>
            <span>
              {uploadProgress.completedFiles} de {uploadProgress.totalFiles} completos · {uploadProgress.percent}%
            </span>
          </div>
          <div className="progress">
            <i style={{ width: `${uploadProgress.percent}%` }} />
          </div>
        </section>
      )}

      {/* Seccion 3: Insumos Seleccionados con Clasificación y Deduplicación (US-020, US-023, US-024, US-026) */}
      {items.length > 0 && (
        <section className="card chosen-files-card">
          <div className="section-title items-center justify-between">
            <div>
              <p className="eyebrow">DETALLE DE INSUMOS</p>
              <h3>
                {items.length} archivo(s) en preparación ({manifest.validFiles} válidos)
              </h3>
            </div>
            <div className="batch-actions-toolbar">
              <div className="bulk-classify">
                <select
                  value={bulkKind}
                  onChange={(e) => setBulkKind(e.target.value as DocumentKind)}
                  disabled={!canOperate}
                >
                  <option value="sin_clasificar">Clasificación masiva…</option>
                  {Object.entries(kindLabels)
                    .filter(([val]) => val !== 'sin_clasificar')
                    .map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="button secondary small"
                  onClick={applyBulkKind}
                  disabled={!canOperate || bulkKind === 'sin_clasificar'}
                >
                  Aplicar a todos
                </button>
              </div>
              <button
                type="button"
                className="button danger small"
                onClick={clearAll}
                disabled={!canOperate}
              >
                <Trash2 size={15} />
                Limpiar lista
              </button>
            </div>
          </div>

          <div className="batch-items-table-wrapper">
            <table className="batch-items-table">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Predio Asociado (US-026/027)</th>
                  <th>Tipo Documental (US-020)</th>
                  <th>Estado / Duplicados (US-023/024)</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={`batch-item-row ${item.errors.length > 0 ? 'row-error' : ''} ${
                      item.duplicateDecision === 'omit' ? 'row-omitted' : ''
                    }`}
                  >
                    {/* Archivo y tamaño */}
                    <td className="doc-col">
                      <div className="doc-info">
                        <FileText size={18} className="doc-icon" />
                        <div>
                          <strong title={item.name}>{item.name}</strong>
                          <small>
                            {(item.size / 1024 / 1024).toFixed(2)} MB
                            {item.pageCount ? ` · ${item.pageCount} pág(s).` : ''}
                            {item.sha256 && (
                              <span className="hash-preview" title={`SHA-256: ${item.sha256}`}>
                                · <Hash size={11} /> {item.sha256.slice(0, 8)}…
                              </span>
                            )}
                          </small>
                          <div className="doc-meta-tags">
                            {item.isEncrypted && (
                              <span className="tag-badge danger" title="Documento protegido por contraseña (US-040)">
                                <Lock size={11} /> Con contraseña
                              </span>
                            )}
                            {item.needsOcr && !item.isEncrypted && (
                              <span className="tag-badge warning" title="Documento escaneado; requiere OCR (US-037)">
                                <ScanText size={11} /> Escaneado (OCR)
                              </span>
                            )}
                            {!item.needsOcr && !item.isEncrypted && (
                              <span className="tag-badge success" title="Documento con texto digital nativo seleccionable (US-037)">
                                <FileCheck2 size={11} /> Texto digital
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Errores del archivo (US-022) */}
                      {item.errors.length > 0 && (
                        <div className="error-badge-list">
                          {item.errors.map((err, idx) => (
                            <span key={idx} className="error-text">
                              <AlertCircle size={13} /> {err}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Asociación a Predio (US-026, US-027) */}
                    <td className="property-col">
                      <div className="property-field-group">
                        <input
                          type="text"
                          className="property-code-input"
                          placeholder="Código predial (ej: SAN-036A)"
                          value={item.propertyCode}
                          onChange={(e) => updateItemPropertyCode(item.id, e.target.value)}
                          disabled={!canOperate || item.duplicateDecision === 'omit'}
                          list="expected-options"
                        />
                        <datalist id="expected-options">
                          {expectedProperties.map((code) => (
                            <option key={code} value={code} />
                          ))}
                        </datalist>
                      </div>
                    </td>

                    {/* Clasificación individual (US-020) */}
                    <td className="kind-col">
                      <select
                        className="kind-select"
                        value={item.kind}
                        onChange={(e) => updateItemKind(item.id, e.target.value as DocumentKind)}
                        disabled={!canOperate || item.duplicateDecision === 'omit'}
                      >
                        {Object.entries(kindLabels).map(([val, label]) => (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Duplicados y Decisión (US-023, US-024) */}
                    <td className="status-col">
                      {item.isDuplicate ? (
                        <div className="duplicate-box">
                          <span className="duplicate-alert" title={item.duplicateTargetName}>
                            <AlertTriangle size={13} />
                            {item.duplicateSource === 'batch' ? 'Duplicado en lote' : 'Existe en expediente'}
                          </span>
                          <div className="duplicate-decision-buttons">
                            <button
                              type="button"
                              className={`pill-btn ${item.duplicateDecision === 'omit' ? 'active danger' : ''}`}
                              onClick={() => updateDuplicateDecision(item.id, 'omit')}
                              title="No cargar este archivo"
                            >
                              Omitir
                            </button>
                            <button
                              type="button"
                              className={`pill-btn ${item.duplicateDecision === 'replace' ? 'active warning' : ''}`}
                              onClick={() => updateDuplicateDecision(item.id, 'replace')}
                              title="Reemplazar documento previo"
                            >
                              Reemplazar
                            </button>
                            <button
                              type="button"
                              className={`pill-btn ${item.duplicateDecision === 'keep_version' ? 'active info' : ''}`}
                              onClick={() => updateDuplicateDecision(item.id, 'keep_version')}
                              title="Conservar como nueva versión"
                            >
                              Versión
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="status-clean">
                          <CheckCircle2 size={13} />
                          Único
                        </span>
                      )}
                    </td>

                    {/* Botón eliminar */}
                    <td className="action-col">
                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={() => removeItem(item.id)}
                        disabled={!canOperate}
                        aria-label="Quitar archivo"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Seccion 4: Manifiesto Previo y Control de Inicio (US-028, US-029) */}
          <div className="manifest-summary-panel">
            <div className="manifest-header">
              <div className="manifest-title">
                <FileSpreadsheet size={20} />
                <div>
                  <strong>Manifiesto de Insumos Pre-Procesamiento (US-028)</strong>
                  <span>Revisión de balance, cobertura y consistencia</span>
                </div>
              </div>
              <div className="manifest-coverage">
                <span>Cobertura de Predios</span>
                <strong>{manifest.coveragePercent}%</strong>
                <small>
                  {manifest.receivedCount} de {manifest.expectedCount || manifest.receivedCount} predios
                </small>
              </div>
            </div>

            <div className="manifest-metrics-grid">
              <div className="metric-box">
                <span>Total archivos</span>
                <strong>{manifest.totalFiles}</strong>
                <small>{manifest.validFiles} listos para envío</small>
              </div>
              <div className="metric-box">
                <span>Predios faltantes</span>
                <strong className={manifest.missingProperties.length ? 'text-warning' : 'text-success'}>
                  {manifest.missingProperties.length}
                </strong>
                <small>Sin documentos en lista</small>
              </div>
              <div className="metric-box">
                <span>Archivos sin predio</span>
                <strong className={manifest.unassignedFiles ? 'text-warning' : 'text-muted'}>
                  {manifest.unassignedFiles}
                </strong>
                <small>Requieren asociación</small>
              </div>
              <div className="metric-box">
                <span>Duplicados detectados</span>
                <strong className={manifest.duplicatesCount ? 'text-warning' : 'text-muted'}>
                  {manifest.duplicatesCount}
                </strong>
                <small>
                  {manifest.unresolvedDuplicates > 0
                    ? `${manifest.unresolvedDuplicates} sin decisión`
                    : 'Todos resueltos'}
                </small>
              </div>
            </div>

            {/* Alerta de predios faltantes */}
            {manifest.missingProperties.length > 0 && (
              <div className="manifest-warning-banner">
                <AlertTriangle size={18} />
                <div>
                  <strong>Predios esperados sin insumos en este lote:</strong>
                  <div className="missing-chips-list">
                    {manifest.missingProperties.map((code) => (
                      <span key={code} className="missing-code-badge">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Alerta de errores críticos bloqueantes (US-029) */}
            {manifest.criticalErrors > 0 && (
              <div className="manifest-error-banner" role="alert">
                <XCircle size={18} />
                <div>
                  <strong>Carga bloqueada por inconsistencias críticas:</strong>
                  <p>
                    {manifest.unresolvedDuplicates > 0 &&
                      `Hay ${manifest.unresolvedDuplicates} archivo(s) duplicado(s) sin decisión explícita. `}
                    {items.some((it) => it.errors.length > 0) &&
                      'Existen archivos con errores (vacíos, corruptos o no compatibles).'}
                  </p>
                </div>
              </div>
            )}

            {/* Checkpoint para procesar con advertencias (US-029) */}
            {manifest.criticalErrors === 0 && hasWarnings && (
              <label className="warning-acknowledgment-box">
                <input
                  type="checkbox"
                  checked={acknowledgeWarnings}
                  onChange={(e) => setAcknowledgeWarnings(e.target.checked)}
                />
                <span>
                  <strong>Acepto procesar el lote con advertencias:</strong> Entiendo que hay predios
                  faltantes o archivos sin código predial asignado y confirmo el envío.
                </span>
              </label>
            )}

            {/* Botón final de envío */}
            <div className="manifest-footer-actions">
              <button
                type="button"
                className="button primary large"
                disabled={!isUploadAllowed}
                onClick={handleSubmitBatch}
              >
                {busyAction === 'upload' ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <ArrowRight size={18} />
                )}
                {busyAction === 'upload'
                  ? 'Cargando y verificando lote…'
                  : 'Cargar y procesar lote verificado'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Seccion 5: Lotes Previos del Expediente */}
      <section className="card batches-history-card">
        <div className="section-title">
          <div>
            <p className="eyebrow">HISTORIAL OPERATIVO</p>
            <h3>Lotes del expediente</h3>
          </div>
        </div>
        {batches.map((batch) => {
          const batchTasks = (tasks ?? []).filter((t) => t.batchId === batch.id)
          const completedCount = batchTasks.filter((t) => t.status === 'completed').length
          const failedCount = batchTasks.filter((t) => t.status === 'failed' || t.status === 'blocked').length

          return (
            <div className="batch-row" key={batch.id}>
              <div>
                <strong>{batch.name}</strong>
                <small>
                  {batch.documentCount ?? documents.filter((doc) => doc.batchId === batch.id).length} documentos
                  · {new Date(batch.createdAt).toLocaleString('es-CO')}
                  {batch.attempts ? ` · intento ${batch.attempts}` : ''}
                </small>
                {batch.error && <span className="batch-error">{batch.error}</span>}
                {batchTasks.length > 0 && (
                  <button
                    type="button"
                    className="tasks-breakdown-btn"
                    onClick={() => setSelectedBatchTasksId(batch.id)}
                  >
                    <Layers size={13} />
                    {batchTasks.length} tareas ({completedCount} completadas, {failedCount} excepciones)
                  </button>
                )}
                {batch.jobState === 'en_proceso' && (
                  <div className="progress">
                    <i style={{ width: `${batch.progress}%` }} />
                  </div>
                )}
              </div>
              <span className={`status ${batch.jobState}`}>
                {batch.jobState === 'en_proceso' && <LoaderCircle size={13} className="spin" />}
                {stateLabels[batch.jobState]}
              </span>
              {canOperate && ['pendiente', 'fallido', 'cancelado'].includes(batch.jobState) && (
                <button
                  className="button primary small"
                  disabled={busyAction === `run:${batch.id}`}
                  onClick={() => void onRunBatch(batch.id)}
                >
                  {busyAction === `run:${batch.id}` ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Bot size={16} />
                  )}
                  {batch.jobState === 'pendiente' ? 'Ejecutar' : 'Reintentar'}
                </button>
              )}
              {canOperate && batch.jobState === 'en_proceso' && (
                <button
                  className="button danger small"
                  disabled={busyAction === `cancel:${batch.id}`}
                  onClick={() => void onCancelBatch(batch.id)}
                >
                  <XCircle size={16} />
                  Cancelar
                </button>
              )}
            </div>
          )
        })}
        {!batches.length && (
          <div className="empty-state">
            <FolderArchive size={36} />
            <p>Aún no hay lotes cargados en este expediente. Prepara el primer lote arriba.</p>
          </div>
        )}
      </section>

      {/* US-051: Bandeja de Excepciones Accionable */}
      {projectExceptions.length > 0 && (
        <section className="card exception-tray-card">
          <div className="exception-tray-header">
            <h3>
              <AlertTriangle size={18} />
              Bandeja de Excepciones del Expediente ({projectExceptions.length})
            </h3>
            <span className="tag-badge warning">Acción requerida</span>
          </div>
          <div className="exception-list">
            {projectExceptions.map((task) => {
              const doc = documents.find((d) => d.id === task.sourceDocumentId)
              return (
                <div key={task.id} className="exception-item">
                  <div className="exception-item-header">
                    <div className="exception-doc-info">
                      <FileWarning size={16} color="#d97706" />
                      <span>{doc?.name ?? 'Documento sin nombre'}</span>
                      {task.propertyCode && <span className="exception-code">{task.propertyCode}</span>}
                    </div>
                    <span className="tag-badge danger">
                      {exceptionCategoryLabels[task.exceptionCategory ?? 'other']}
                    </span>
                  </div>
                  {task.errorMessage && (
                    <p style={{ margin: 0, fontSize: '12px', color: '#991b1b' }}>
                      {task.errorMessage}
                    </p>
                  )}
                  {task.suggestedAction && (
                    <div className="exception-suggested-action">
                      <Info size={14} />
                      <span>
                        <strong>Acción sugerida:</strong> {task.suggestedAction}
                      </span>
                    </div>
                  )}
                  {onReprocessTask && canOperate && (
                    <div className="exception-actions">
                      <button
                        className="button small"
                        disabled={busyAction === `reprocess:${task.id}`}
                        onClick={() => void onReprocessTask(task.id)}
                        type="button"
                      >
                        {busyAction === `reprocess:${task.id}` ? (
                          <LoaderCircle size={14} className="spin" />
                        ) : (
                          <RefreshCw size={14} />
                        )}
                        Reprocesar tarea
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Modal de Tareas Granulares del Lote (US-044) */}
      {selectedBatchTasksId && (
        <div className="modal-backdrop" onClick={() => setSelectedBatchTasksId(null)}>
          <div className="modal-card" style={{ width: 'min(820px, 95vw)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} />
                Tareas Granulares de Extracción
              </h3>
              <button className="icon-button" onClick={() => setSelectedBatchTasksId(null)} type="button">
                <XCircle size={18} />
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="task-table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Predio</th>
                    <th>Extractor</th>
                    <th>Dependencia</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(tasks ?? [])
                    .filter((t) => t.batchId === selectedBatchTasksId)
                    .map((t) => {
                      const doc = documents.find((d) => d.id === t.sourceDocumentId)
                      return (
                        <tr key={t.id}>
                          <td><strong>{doc?.name ?? t.sourceDocumentId}</strong></td>
                          <td><code>{t.propertyCode ?? 'N/A'}</code></td>
                          <td>{kindLabels[t.extractorKey as DocumentKind] ?? t.extractorKey}</td>
                          <td>
                            <span className={`tag-badge ${t.dependencyStatus === 'ready' ? 'success' : t.dependencyStatus === 'waiting' ? 'warning' : 'danger'}`}>
                              {t.dependencyStatus === 'ready' ? 'Listo' : t.dependencyStatus === 'waiting' ? 'En espera' : 'Bloqueado'}
                            </span>
                          </td>
                          <td>
                            <span className={`status-pill ${t.status}`}>
                              {t.status}
                            </span>
                          </td>
                          <td>
                            {onReprocessTask && canOperate && ['failed', 'blocked', 'completed'].includes(t.status) && (
                              <button
                                className="button small"
                                disabled={busyAction === `reprocess:${t.id}`}
                                onClick={() => void onReprocessTask(t.id)}
                                type="button"
                              >
                                <RefreshCw size={12} />
                                Reprocesar
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
