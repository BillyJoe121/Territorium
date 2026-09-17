import React, { useState, useMemo } from 'react'
import {
  FileText,
  Plus,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Eye,
  Settings
} from 'lucide-react'
import {
  createDynamicTemplate,
  renderDynamicTemplate,
  extractPlaceholdersFromTemplate
} from '../lib/dynamicTemplateManagerP2'
import type { CustomDynamicTemplate } from '../types'

interface DynamicTemplateEditorProps {
  projectId: string
  availableAttributes?: string[]
}

export const DynamicTemplateEditor: React.FC<DynamicTemplateEditorProps> = ({
  projectId,
  availableAttributes = [
    'codigo_predial',
    'propietario_actual',
    'cedula_propietario',
    'matricula_inmobiliaria',
    'municipio',
    'departamento',
    'area_afectada_m2',
    'oferta_inicial_num',
    'oferta_definitiva_num',
    'linderos'
  ]
}) => {
  const [templateName, setTemplateName] = useState('Minuta de Notificación Notarial')
  const [templateKey, setTemplateKey] = useState('notificacion_notarial')
  const [format, setFormat] = useState<'txt' | 'docx' | 'xlsx'>('txt')
  const [rawContent, setRawContent] = useState(
`REPÚBLICA DE COLOMBIA
MINUTA DE NOTIFICACIÓN DE AFECTACIÓN PREDIAL

Por medio de la presente, se notifica a {{propietario_actual}}, identificado con C.C. {{cedula_propietario}}, que el inmueble con folio de matrícula {{matricula_inmobiliaria}} ubicado en el municipio de {{municipio}}, departamento de {{departamento}}, presenta una afectación de servidumbre de {{area_afectada_m2}} m2.

Se formula la presente oferta indemnizatoria por valor de $[oferta_definitiva_num].

Atentamente,
EQUIPO PREDIAL TERRITORIUM
`
  )

  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor')

  // Marcadores detectados automáticamente
  const detectedPlaceholders = useMemo(() => {
    return extractPlaceholdersFromTemplate(rawContent)
  }, [rawContent])

  // Plantilla construida
  const dynamicTemplate = useMemo(() => {
    return createDynamicTemplate({
      projectId,
      templateKey,
      name: templateName,
      format,
      rawContent,
      initialMappings: mappings
    })
  }, [projectId, templateKey, templateName, format, rawContent, mappings])

  // Datos simulados para previsualización
  const sampleData = {
    codigo_predial: 'PREDIO-CALI-001',
    propietario_actual: 'Carlos Alberto Ramírez Gómez',
    cedula_propietario: '19.876.543',
    matricula_inmobiliaria: '370-123456',
    municipio: 'Cali',
    departamento: 'Valle del Cauca',
    area_afectada_m2: '1,250.50',
    oferta_inicial_num: '$75.000.000',
    oferta_definitiva_num: '$85.000.000',
    linderos: 'Norte: Predio Las Acacias; Sur: Río Cauca'
  }

  const renderResult = useMemo(() => {
    return renderDynamicTemplate(dynamicTemplate, sampleData)
  }, [dynamicTemplate])

  const handleMappingChange = (placeholder: string, targetAttr: string) => {
    setMappings(prev => ({
      ...prev,
      [placeholder]: targetAttr
    }))
  }

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden my-6">
      {/* Encabezado */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
            <FileText size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Gestor No-Code de Plantillas Dinámicas (US-128)
            </h3>
            <p className="text-xs text-slate-500">
              Diseñe y mapee plantillas de minutas con marcadores {'{{campo}}'} sin desplegar código
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center space-x-1 ${
              activeTab === 'editor'
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Settings size={14} />
            <span>Editor & Mapeo</span>
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center space-x-1 ${
              activeTab === 'preview'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Eye size={14} />
            <span>Previsualizar</span>
          </button>
        </div>
      </div>

      {activeTab === 'editor' ? (
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nombre de Plantilla</label>
              <input
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Clave Única (Slug)</label>
              <input
                type="text"
                value={templateKey}
                onChange={e => setTemplateKey(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Formato</label>
              <select
                value={format}
                onChange={e => setFormat(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500"
              >
                <option value="txt">Texto Enriquecido (.txt)</option>
                <option value="docx">Microsoft Word (.docx)</option>
                <option value="xlsx">Hoja de Cálculo (.xlsx)</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-700">
                Contenido con Marcadores (Use {'{{nombre_variable}}'} o [VARIABLE])
              </label>
              <span className="text-xs text-slate-500">
                {detectedPlaceholders.length} marcadores detectados
              </span>
            </div>
            <textarea
              rows={8}
              value={rawContent}
              onChange={e => setRawContent(e.target.value)}
              className="w-full p-3 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-slate-900 text-emerald-400"
            />
          </div>

          {/* Mapeador de Variables */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <h4 className="text-xs font-semibold text-slate-800 mb-2.5 flex items-center space-x-1.5">
              <Sparkles size={14} className="text-amber-500" />
              <span>Mapeo Automático de Variables a Atributos Prediales</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {detectedPlaceholders.map(ph => (
                <div key={ph} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200 text-xs">
                  <span className="font-mono text-emerald-700 font-medium">{'{{' + ph + '}}'}</span>
                  <select
                    value={mappings[ph] || ph}
                    onChange={e => handleMappingChange(ph, e.target.value)}
                    className="ml-2 px-2 py-1 text-xs border border-slate-300 rounded bg-slate-50 focus:ring-1 focus:ring-emerald-500"
                  >
                    {availableAttributes.map(attr => (
                      <option key={attr} value={attr}>{attr}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              {renderResult.success ? (
                <CheckCircle size={16} className="text-emerald-600" />
              ) : (
                <AlertCircle size={16} className="text-amber-600" />
              )}
              <span className="text-xs font-medium text-slate-800">
                {renderResult.success
                  ? 'Plantilla válida: todos los marcadores sustituidos correctamente.'
                  : `Advertencia: ${renderResult.unresolvedPlaceholders.length} marcadores sin datos.`}
              </span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg whitespace-pre-wrap font-mono text-xs text-slate-800 leading-relaxed max-h-96 overflow-y-auto">
            {renderResult.renderedContent}
          </div>
        </div>
      )}
    </div>
  )
}
