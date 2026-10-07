import * as Dialog from '@radix-ui/react-dialog'
import { Check, Compass, FileCheck, FileSignature, FileText, LoaderCircle, Scale, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  OFFICIAL_FINAL_DOCUMENT_TEMPLATES,
  type ExpedienteDocumentTemplate,
} from '../../lib/expedienteDocumentTemplates'

export interface ChooseDocumentTemplateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectTemplate: (template: ExpedienteDocumentTemplate, predioId?: string) => void | Promise<void>
  initialTemplateId?: string
  isGenerating?: boolean
  /** Predios del consolidado (una fila de CORRESPONDENCIA cada uno): el documento es por predio. */
  predios?: { id: string; label: string }[]
  initialPredioId?: string | null
}

export function ChooseDocumentTemplateModal({
  open,
  onOpenChange,
  onSelectTemplate,
  initialTemplateId = 'tpl-escritura-publica',
  isGenerating = false,
  predios,
  initialPredioId,
}: ChooseDocumentTemplateModalProps) {
  const [selectedId, setSelectedId] = useState<string>(initialTemplateId)
  const [predioId, setPredioId] = useState<string>(initialPredioId ?? predios?.[0]?.id ?? '')

  useEffect(() => {
    if (open) setPredioId(initialPredioId ?? predios?.[0]?.id ?? '')
  }, [open, initialPredioId, predios])

  const handleConfirm = async () => {
    const tpl = OFFICIAL_FINAL_DOCUMENT_TEMPLATES.find((t) => t.id === selectedId)
    if (tpl) {
      await onSelectTemplate(tpl, predios ? predioId : undefined)
    }
  }

  const getTemplateIcon = (id: string) => {
    switch (id) {
      case 'tpl-escritura-publica':
        return <FileSignature size={22} className="template-card-icon notarial" />
      case 'tpl-descripcion-linderos':
        return <Compass size={22} className="template-card-icon technical" />
      case 'tpl-minuta-tipo':
        return <Scale size={22} className="template-card-icon corporate" />
      default:
        return <FileText size={22} className="template-card-icon" />
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="expediente-modal-overlay" />
        <Dialog.Content className="expediente-template-modal" aria-labelledby="choose-template-title">
          <header className="expediente-modal-header compact">
            <div>
              <p className="expediente-modal-kicker">Módulo de Documentos Oficiales</p>
              <Dialog.Title id="choose-template-title">Escoger documento a generar</Dialog.Title>
              <Dialog.Description>
                Selecciona la plantilla oficial que deseas compilar con los datos consolidados y aprobados del predio.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="expediente-modal-close" aria-label="Cerrar modal">
                <X size={18} />
              </button>
            </Dialog.Close>
          </header>

          <div className="template-picker-body">
            {predios && (
              <label className="template-predio-select">
                <span>Predio</span>
                <select value={predioId} onChange={(event) => setPredioId(event.target.value)} disabled={!predios.length}>
                  {predios.length === 0 && <option value="">No hay predios consolidados</option>}
                  {predios.map((predio) => <option key={predio.id} value={predio.id}>{predio.label}</option>)}
                </select>
              </label>
            )}
            <div
              className="template-picker-grid"
              role="radiogroup"
              aria-label="Plantillas de documentos finales disponibles"
            >
              {OFFICIAL_FINAL_DOCUMENT_TEMPLATES.map((template) => {
                const isSelected = template.id === selectedId
                return (
                  <div
                    key={template.id}
                    className={`template-picker-card${isSelected ? ' selected' : ''}`}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={() => setSelectedId(template.id)}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault()
                        setSelectedId(template.id)
                      }
                    }}
                  >
                    <div className="template-card-header">
                      <div className="template-card-title-wrap">
                        {getTemplateIcon(template.id)}
                        <div>
                          <div className="template-card-badge-row">
                            <span className="template-badge">{template.metadata?.badge || 'Oficial'}</span>
                            <span className="template-filename-tag">{template.metadata?.filename}</span>
                          </div>
                          <h3 className="template-card-name">{template.name}</h3>
                        </div>
                      </div>
                      <div className={`template-radio-indicator${isSelected ? ' checked' : ''}`} aria-hidden="true">
                        {isSelected && <Check size={14} />}
                      </div>
                    </div>

                    <p className="template-card-desc">{template.metadata?.description}</p>

                    <div className="template-card-sections">
                      <span className="template-sections-label">Estructura y cláusulas incluidas:</span>
                      <ul className="template-sections-list">
                        {template.sections.map((sec) => (
                          <li key={sec.id}>
                            <span className="bullet-dot" />
                            <span>{sec.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <footer className="expediente-modal-footer">
            <div className="template-picker-footer-info">
              <span className="template-footer-note">
                El documento se genera con fidelidad exacta a la plantilla original, integrando folio, cédula, propietarios, linderos y ofertas.
              </span>
            </div>
            <div className="expediente-modal-footer-actions">
              <button
                type="button"
                className="expediente-secondary-action"
                disabled={isGenerating}
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="expediente-primary-action"
                disabled={isGenerating || !selectedId || (predios !== undefined && !predioId)}
                onClick={() => void handleConfirm()}
              >
                {isGenerating ? <LoaderCircle size={16} className="spin" /> : <FileCheck size={16} />}
                <span>{isGenerating ? 'Generando documento…' : 'Generar documento'}</span>
              </button>
            </div>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
