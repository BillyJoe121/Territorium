import React from 'react'
import { Tag, Sparkles, Plus } from 'lucide-react'

export interface LegalVariableOption {
  key: string
  label: string
  exampleValue: string
  category: 'identificacion' | 'tecnico' | 'economico' | 'juridico'
}

export const LEGAL_VARIABLES: LegalVariableOption[] = [
  { key: 'propietario_principal', label: 'Propietario Principal', exampleValue: 'Juan Pérez Silva', category: 'identificacion' },
  { key: 'cedula_propietario', label: 'Cédula de Ciudadanía', exampleValue: 'CC 19.452.880', category: 'identificacion' },
  { key: 'folio_matricula', label: 'Folio Matrícula', exampleValue: '300-88492', category: 'identificacion' },
  { key: 'cedula_catastral', label: 'Cédula Catastral', exampleValue: '25269000100020034000', category: 'identificacion' },
  { key: 'municipio', label: 'Municipio', exampleValue: 'Facatativá', category: 'identificacion' },
  { key: 'departamento', label: 'Departamento', exampleValue: 'Cundinamarca', category: 'identificacion' },
  { key: 'area_total_m2', label: 'Área Total (m²)', exampleValue: '12.450 m²', category: 'tecnico' },
  { key: 'area_afectada_m2', label: 'Área Servidumbre (m²)', exampleValue: '850 m²', category: 'tecnico' },
  { key: 'linderos_perimetro', label: 'Linderos Completos', exampleValue: 'Por el Norte con lote...', category: 'juridico' },
  { key: 'valor_indemnizacion', label: 'Valor Indemnización ($)', exampleValue: '$45.000.000 COP', category: 'economico' },
]

interface VariablePillsSelectorProps {
  onSelectVariable: (tag: string) => void
  className?: string
}

/**
 * US-268: Selector dinámico de variables jurídicas mediante píldoras en el editor de minutas.
 * Al pulsar una píldora se inserta la variable exacta (ej. {{propietario_principal}}) en la posición del cursor.
 */
export const VariablePillsSelector: React.FC<VariablePillsSelectorProps> = ({
  onSelectVariable,
  className = '',
}) => {
  return (
    <div className={`variable-pills-container p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          Variables Jurídicas Dinámicas
        </span>
        <span className="text-[10px] text-slate-500">
          Haga clic en una píldora para insertar en la minuta
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1">
        {LEGAL_VARIABLES.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => onSelectVariable(`{{${v.key}}}`)}
            title={`Inserta {{${v.key}}} (Ejemplo: ${v.exampleValue})`}
            className="group inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-emerald-300 hover:border-emerald-500/50 hover:bg-emerald-950/20 transition-all duration-150 cursor-pointer select-none"
          >
            <Tag className="w-3 h-3 text-emerald-400/70 group-hover:text-emerald-400" />
            <span className="font-mono text-[11px] text-emerald-400/90 group-hover:text-emerald-300">
              {`{{${v.key}}}`}
            </span>
            <span className="text-[10px] text-slate-500 group-hover:text-slate-400">
              ({v.label})
            </span>
            <Plus className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 text-emerald-400" />
          </button>
        ))}
      </div>
    </div>
  )
}
