import React, { useState } from 'react'
import { FileText, Save, Eye, Sparkles } from 'lucide-react'
import { VariablePillsSelector } from './ui/VariablePillsSelector'
import { AutoSaveIndicator, type SaveStatus } from './ui/AutoSaveIndicator'

interface TemplateEditorWithVariablesProps {
  initialContent?: string
  templateName?: string
  onSave?: (content: string) => void
  onNotice?: (msg: string) => void
}

/**
 * US-210 & US-268: Sub-ruta y editor interactivo de minutas jurídicas con inserción
 * de variables dinámicas mediante píldoras flotantes y previsualización en vivo.
 */
export const TemplateEditorWithVariables: React.FC<TemplateEditorWithVariablesProps> = ({
  initialContent = `MINUTA DE CONSTITUCIÓN DE SERVIDUMBRE DE PASO Y CONDUCCIÓN DE ENERGÍA

En el municipio de {{municipio}}, departamento de {{departamento}}, compareció {{propietario_principal}}, identificado con cédula de ciudadanía número {{cedula_propietario}}, quien en su condición de propietario del predio con matrícula inmobiliaria {{folio_matricula}} y cédula catastral {{cedula_catastral}}, manifiesta:

PRIMERA: Que transfiere a título de servidumbre legal una faja de terreno de {{area_afectada_m2}} contenida dentro de una cabida total de {{area_total_m2}}.
SEGUNDA: Que el lindero específico de la zona afectada corresponde a: {{linderos_perimetro}}.
TERCERA: Que el valor acordado por concepto de indemnización corresponde a la suma de {{valor_indemnizacion}}.`,
  templateName = 'Minuta Oficial de Servidumbre v1.2',
  onSave,
  onNotice,
}) => {
  const [content, setContent] = useState(initialContent)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor')
  const [lastSaved, setLastSaved] = useState<Date | null>(new Date())

  const handleInsertVariable = (tag: string) => {
    setContent((prev) => `${prev} ${tag}`)
    setSaveStatus('saving')
    setTimeout(() => {
      setSaveStatus('saved')
      setLastSaved(new Date())
      onNotice?.(`Variable ${tag} insertada en la minuta.`)
    }, 400)
  }

  const handleManualSave = () => {
    setSaveStatus('saving')
    setTimeout(() => {
      setSaveStatus('saved')
      setLastSaved(new Date())
      onSave?.(content)
      onNotice?.('Plantilla jurídica guardada con éxito.')
    }, 300)
  }

  // Sustitución de variables simulada para previsualización
  const simulatedPreview = content
    .replace(/\{\{municipio\}\}/g, 'Facatativá')
    .replace(/\{\{departamento\}\}/g, 'Cundinamarca')
    .replace(/\{\{propietario_principal\}\}/g, 'Juan Carlos Pérez Silva')
    .replace(/\{\{cedula_propietario\}\}/g, '19.452.880 de Bogotá')
    .replace(/\{\{folio_matricula\}\}/g, '300-88492')
    .replace(/\{\{cedula_catastral\}\}/g, '25269000100020034000')
    .replace(/\{\{area_afectada_m2\}\}/g, '850.25 m²')
    .replace(/\{\{area_total_m2\}\}/g, '12.450 m²')
    .replace(/\{\{linderos_perimetro\}\}/g, 'Norte: 120m con vía veredal; Sur: 115m con quebrada')
    .replace(/\{\{valor_indemnizacion\}\}/g, '$45.000.000 COP')

  return (
    <div className="template-editor-container space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-slate-100">{templateName}</span>
          <AutoSaveIndicator status={saveStatus} lastSavedAt={lastSaved} />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-750 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                activeTab === 'editor' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              Editor
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
                activeTab === 'preview' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Eye className="w-3 h-3" />
              Previsualización
            </button>
          </div>

          <button
            type="button"
            onClick={handleManualSave}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar Borrador</span>
          </button>
        </div>
      </div>

      {/* Selector de variables dinámicas flotante (US-268) */}
      <VariablePillsSelector onSelectVariable={handleInsertVariable} />

      {/* Editor o Previsualización */}
      {activeTab === 'editor' ? (
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-400">Texto de la Cláusula Jurídica</label>
          <textarea
            rows={14}
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              setSaveStatus('saving')
              setTimeout(() => setSaveStatus('saved'), 600)
            }}
            className="w-full p-4 font-mono text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 leading-relaxed focus:outline-none focus:border-emerald-500"
          />
        </div>
      ) : (
        <div className="p-6 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 leading-relaxed text-xs font-serif whitespace-pre-wrap">
          {simulatedPreview}
        </div>
      )}
    </div>
  )
}
