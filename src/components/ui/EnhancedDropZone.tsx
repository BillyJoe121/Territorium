import React, { useState, useRef } from 'react'
import { UploadCloud, FileText, CheckCircle2, AlertCircle, FolderUp, X, RefreshCw } from 'lucide-react'

export interface UploadFileItem {
  id: string
  name: string
  size: number
  progress: number
  status: 'esperando' | 'subiendo' | 'completado' | 'error'
  error?: string
  detectedKind?: string
}

interface EnhancedDropZoneProps {
  onFilesSelected: (files: File[]) => void
  files: UploadFileItem[]
  onRemoveFile?: (id: string) => void
  onRetryFile?: (id: string) => void
  disabled?: boolean
}

export function EnhancedDropZone({
  onFilesSelected,
  files,
  onRemoveFile,
  onRetryFile,
  disabled = false,
}: EnhancedDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled) return

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files))
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="enhanced-upload-area">
      {/* Zona Drag & Drop (US-261) */}
      <div
        className={`dropzone-box ${isDragOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Zona de arrastre de archivos documentales"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.tif,.tiff,.jpg,.png,.zip"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onFilesSelected(Array.from(e.target.files))
            }
          }}
        />
        {/* Input invisible para carpeta completa */}
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory es soportado en navegadores modernos
          webkitdirectory=""
          directory=""
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onFilesSelected(Array.from(e.target.files))
            }
          }}
        />

        <div className="dropzone-content">
          <div className="dropzone-icon">
            <UploadCloud size={36} />
          </div>
          <h3>Arrastra tus documentos o carpetas aquí</h3>
          <p>Soporta Estudios de Títulos (PDF), Planos Topográficos (PDF/TIF), Actas y Minutas</p>
          <div className="dropzone-buttons" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
            >
              <FileText size={14} /> Seleccionar archivos
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => folderInputRef.current?.click()}
              disabled={disabled}
            >
              <FolderUp size={14} /> Cargar carpeta completa
            </button>
          </div>
        </div>
      </div>

      {/* Lista de píldoras con progreso individual (US-262) */}
      {files.length > 0 && (
        <div className="upload-pills-list">
          <div className="upload-pills-header">
            <h4>Archivos seleccionados ({files.length})</h4>
            <span className="upload-pills-summary">
              {files.filter((f) => f.status === 'completado').length} de {files.length} listos
            </span>
          </div>
          <div className="upload-pills-grid">
            {files.map((file) => (
              <div key={file.id} className={`upload-file-pill status-${file.status}`}>
                <div className="pill-icon">
                  {file.status === 'completado' ? (
                    <CheckCircle2 size={16} className="text-success" />
                  ) : file.status === 'error' ? (
                    <AlertCircle size={16} className="text-danger" />
                  ) : (
                    <FileText size={16} />
                  )}
                </div>
                <div className="pill-info">
                  <div className="pill-title-row">
                    <span className="pill-name" title={file.name}>
                      {file.name}
                    </span>
                    <span className="pill-size">{formatFileSize(file.size)}</span>
                  </div>
                  {file.detectedKind && <span className="pill-kind">{file.detectedKind}</span>}
                  {file.status === 'subiendo' && (
                    <div className="pill-progress-bar">
                      <div className="pill-progress-fill" style={{ width: `${file.progress}%` }} />
                    </div>
                  )}
                  {file.status === 'error' && <span className="pill-error">{file.error || 'Error al subir'}</span>}
                </div>
                <div className="pill-actions">
                  {file.status === 'error' && onRetryFile && (
                    <button
                      type="button"
                      className="pill-btn-action"
                      onClick={() => onRetryFile(file.id)}
                      title="Reintentar"
                    >
                      <RefreshCw size={14} />
                    </button>
                  )}
                  {onRemoveFile && (
                    <button
                      type="button"
                      className="pill-btn-action danger"
                      onClick={() => onRemoveFile(file.id)}
                      title="Quitar"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
