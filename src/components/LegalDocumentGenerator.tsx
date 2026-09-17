import React, { useState, useMemo } from 'react'
import {
  FileCheck,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Layers,
  Eye,
  FileSpreadsheet
} from 'lucide-react'
import { PropertyMasterRecord } from '../lib/masterRecordReconciliation'
import {
  DEFAULT_LEGAL_TEMPLATES,
  validateTemplateRequirements,
  renderDocumentTemplate,
  generateLegalDocument,
  createGeneratedDocumentsZip
} from '../lib/documentGeneration'
import { exportOperationalMetricsToCsv } from '../lib/operationsObservability'
import { TemplateKey } from '../types'

export interface LegalDocumentGeneratorProps {
  records: PropertyMasterRecord[]
  projectName: string
  userEmail: string
  aiLogs?: import('../types').AiExecutionLog[]
  onNotice: (msg: string) => void
  onError: (msg: string) => void
}

export const LegalDocumentGenerator: React.FC<LegalDocumentGeneratorProps> = ({
  records,
  projectName,
  userEmail,
  aiLogs = [],
  onNotice,
  onError
}) => {
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<TemplateKey>('oferta_economica')
  const [selectedPropertyCode, setSelectedPropertyCode] = useState<string>(
    records[0]?.propertyCode ?? ''
  )
  const [isGeneratingZip, setIsGeneratingZip] = useState(false)

  const template = DEFAULT_LEGAL_TEMPLATES[selectedTemplateKey]

  const selectedRecord = useMemo(() => {
    return records.find(r => r.propertyCode === selectedPropertyCode) ?? records[0]
  }, [records, selectedPropertyCode])

  // Extraer valores normalizados del registro seleccionado para el generador
  const propertyData = useMemo(() => {
    if (!selectedRecord) return {}
    const data: Record<string, unknown> = {
      codigo_predial: selectedRecord.propertyCode,
      municipio: selectedRecord.attributes['municipio']?.approvedValue || selectedRecord.attributes['municipio']?.manualValue || selectedRecord.attributes['municipio']?.aiValue || 'Yumbo',
      matricula_inmobiliaria: selectedRecord.attributes['folio']?.approvedValue || selectedRecord.attributes['folio']?.manualValue || selectedRecord.attributes['folio']?.aiValue || '',
      propietario_actual: selectedRecord.attributes['propietario']?.approvedValue || selectedRecord.attributes['propietario']?.manualValue || selectedRecord.attributes['propietario']?.aiValue || '',
      cedula_propietario: selectedRecord.attributes['cedula']?.approvedValue || selectedRecord.attributes['cedula']?.manualValue || selectedRecord.attributes['cedula']?.aiValue || 'Por verificar',
      apoderado_nombre: 'Dra. Asesora Legal ISA',
      apoderado_cedula: '31.999.888',
      linderos: selectedRecord.attributes['linderos']?.approvedValue || selectedRecord.attributes['linderos']?.manualValue || selectedRecord.attributes['linderos']?.aiValue || '',
      area_afectada_m2: selectedRecord.attributes['area']?.approvedValue || selectedRecord.attributes['area']?.manualValue || selectedRecord.attributes['area']?.aiValue || '1200.00',
      oferta_definitiva_num: '145000000',
      oferta_definitiva_letras: 'ciento cuarenta y cinco millones de pesos',
      fecha_generacion: new Date().toLocaleDateString('es-CO'),
      estado_juridico: selectedRecord.reviewState,
      gravamenes: 'Sin gravámenes vigentes'
    }
    return data
  }, [selectedRecord])

  // Validación de requisitos de plantilla (US-123 & US-127)
  const validation = useMemo(() => {
    if (!template || !selectedRecord) {
      return { canGenerate: false, missingFields: ['Sin datos'], conflicts: [] }
    }
    const conflictsList = selectedRecord.criticalConflictCount > 0 ? ['Conflictos jurídicos críticos pendientes'] : []
    return validateTemplateRequirements(
      template,
      propertyData,
      conflictsList
    )
  }, [template, propertyData, selectedRecord])

  // Renderizado en tiempo real (US-124, US-168)
  const renderedContent = useMemo(() => {
    if (!template) return ''
    return renderDocumentTemplate(template, propertyData)
  }, [template, propertyData])

  const handleDownloadSingle = () => {
    if (!validation.canGenerate) {
      onError(`No se puede generar: faltan campos obligatorios (${validation.missingFields.join(', ')})`)
      return
    }

    try {
      const blob = new Blob([renderedContent], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedRecord.propertyCode}_${selectedTemplateKey}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      onNotice(`Documento ${template.name} generado con éxito.`)
    } catch {
      onError('Error al generar la descarga del documento.')
    }
  }

  const handleDownloadZip = async () => {
    if (records.length === 0) {
      onError('No hay predios para generar en lote.')
      return
    }

    setIsGeneratingZip(true)
    try {
      const documentsToPack = records.map(rec => {
        const pData: Record<string, unknown> = {
          codigo_predial: rec.propertyCode,
          municipio: rec.attributes['municipio']?.approvedValue || 'Yumbo',
          matricula_inmobiliaria: rec.attributes['folio']?.approvedValue || '370-12345',
          propietario_actual: rec.attributes['propietario']?.approvedValue || 'Propietario Registrado',
          cedula_propietario: '16.123.456',
          apoderado_nombre: 'Dra. Asesora Legal ISA',
          apoderado_cedula: '31.999.888',
          linderos: rec.attributes['linderos']?.approvedValue || 'Linderos certificados',
          area_afectada_m2: '1500.00',
          oferta_definitiva_num: '120000000',
          oferta_definitiva_letras: 'ciento veinte millones de pesos',
          fecha_generacion: new Date().toLocaleDateString('es-CO'),
          estado_juridico: rec.reviewState,
          gravamenes: 'Sin gravámenes vigentes'
        }

        const conflictReasons = rec.criticalConflictCount > 0 ? ['Conflictos críticos'] : []
        const genDoc = generateLegalDocument(
          template,
          'project-active',
          rec.propertyCode,
          pData,
          conflictReasons,
          userEmail
        )

        return {
          document: genDoc,
          content: renderDocumentTemplate(template, pData)
        }
      })

      const zipBytes = await createGeneratedDocumentsZip(documentsToPack)
      const blob = new Blob([zipBytes as unknown as BlobPart], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Paquete_${selectedTemplateKey}_${records.length}_predios.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      onNotice(`Paquete ZIP generado exitosamente con ${records.length} documentos.`)
    } catch {
      onError('Error al empaquetar documentos en ZIP.')
    } finally {
      setIsGeneratingZip(false)
    }
  }

  const handleExportMetricsCsv = () => {
    try {
      const csv = exportOperationalMetricsToCsv(aiLogs)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Metricas_Operativas_${projectName.replace(/\s+/g, '_')}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      onNotice('Métricas operativas exportadas en CSV (US-135).')
    } catch {
      onError('No fue posible exportar las métricas en CSV.')
    }
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Cabecera */}
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Generador de Formatos y Minutas Jurídicas (US-119 a US-127)
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-1">
              Documentos Formales desde Datos Aprobados
            </h3>
            <p className="text-sm text-slate-500">
              Genera minutas con validación de obligatoriedad, previsualización Word/Text y paquetes ZIP.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportMetricsCsv}
            className="flex items-center space-x-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs cursor-pointer"
            title="Exportar archivo CSV con métricas de duración, tokens y costo (US-135)"
          >
            <FileSpreadsheet size={16} className="text-emerald-600" />
            <span>Exportar Métricas CSV</span>
          </button>
        </div>
      </div>

      {/* Selectores de Formato y Predio */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Tipo de Formato o Minuta
          </label>
          <select
            value={selectedTemplateKey}
            onChange={e => setSelectedTemplateKey(e.target.value as TemplateKey)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="oferta_economica">Oferta Formal de Indemnización (US-119)</option>
            <option value="acta_acuerdo">Acta de Concertación y Acuerdo Voluntario (US-120)</option>
            <option value="bitacora">Bitácora Predial Consolidada (US-121)</option>
            <option value="poder">Poder Especial Amplio y Suficiente (US-122)</option>
            <option value="promesa">Promesa de Constitución de Servidumbre (US-122)</option>
            <option value="escritura">Minuta de Escritura Pública (US-122)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Predio de Referencia
          </label>
          <select
            value={selectedPropertyCode}
            onChange={e => setSelectedPropertyCode(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            {records.map(r => (
              <option key={r.propertyCode} value={r.propertyCode}>
                {r.propertyCode} - {r.attributes['propietario']?.approvedValue || 'Titular'} ({r.reviewState})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Estado de Validación de Requisitos */}
      {validation.canGenerate ? (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>
              Todos los campos obligatorios ({template.requiredFields.join(', ')}) están validados y sin conflictos.
            </span>
          </div>
          <span className="font-semibold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
            Apto para generación
          </span>
        </div>
      ) : (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-2.5 text-xs text-amber-900">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Generación bloqueada para este predio (US-127):</strong>
            {validation.missingFields.length > 0 && (
              <p className="mt-0.5">
                Faltan campos obligatorios requeridos por la minuta:{' '}
                <span className="font-semibold">{validation.missingFields.join(', ')}</span>.
              </p>
            )}
            {validation.conflicts.length > 0 && (
              <p className="mt-0.5 text-red-700">
                Existen conflictos jurídicos no resueltos en:{' '}
                <span className="font-semibold">{validation.conflicts.join(', ')}</span>.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Previsualización del Documento Generado (US-124, US-168) */}
      <div className="border border-slate-300 rounded-xl overflow-hidden shadow-xs bg-white">
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between text-xs font-semibold text-slate-700">
          <div className="flex items-center space-x-2">
            <Eye size={15} className="text-slate-500" />
            <span>Previsualización: {template.name} (Versión {template.version})</span>
          </div>
          <span className="text-slate-500 font-mono text-[11px]">
            {selectedRecord?.propertyCode}
          </span>
        </div>
        <div className="p-5 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto bg-slate-50/50">
          {renderedContent}
        </div>
      </div>

      {/* Acciones de Descarga */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            disabled={!validation.canGenerate}
            onClick={handleDownloadSingle}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-xs ${
              validation.canGenerate
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Download size={16} />
            <span>Descargar Documento Individual</span>
          </button>

          <button
            type="button"
            disabled={isGeneratingZip || records.length === 0}
            onClick={handleDownloadZip}
            className="flex items-center space-x-2 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg text-sm font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <Layers size={16} className="text-blue-600" />
            <span>
              {isGeneratingZip ? 'Empaquetando ZIP...' : `Descargar Paquete ZIP (${records.length} predios)`}
            </span>
          </button>
        </div>

        <div className="text-right text-xs text-slate-500">
          Plantilla vinculada a directiva corporativa ISA · Auditoría inmutable de minutas
        </div>
      </div>
    </div>
  )
}
