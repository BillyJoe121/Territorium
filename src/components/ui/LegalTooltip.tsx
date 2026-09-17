import React from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { HelpCircle, Info } from 'lucide-react'

interface LegalTooltipProps {
  term: string
  explanation: string
  children?: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}

/**
 * Catálogo canónico de definiciones jurídicas territoriales de Territorium
 */
export const LEGAL_TERMS_DICTIONARY: Record<string, string> = {
  cabida: 'Área o superficie total de terreno de un inmueble expresada en metros cuadrados o hectáreas.',
  gravamen: 'Limitación o carga jurídica que pesa sobre un bien inmueble (ej. hipoteca, servidumbre, embargo).',
  tradicion: 'Modo de adquirir el dominio de las cosas, reflejado cronológicamente en el historial de matrículas.',
  falsa_tradicion: 'Inscripción registral que no transfiere el pleno dominio sino derechos de posesión o mejoras.',
  linderos: 'Demarcación precisa de los límites perimetrales de un predio con indicación de colindantes y medidas.',
  afectacion: 'Área superficial del predio requerida o interceptada por la faja de servidumbre del proyecto.',
  folio_matricula: 'Número único asignado por la SNR que identifica jurídicamente a una unidad inmobiliaria.',
  cedula_catastral: 'Identificador oficial asignado por la autoridad catastral (IGAC/Gestor) para fines fiscales y físicos.',
}

/**
 * US-221: Tooltips explicativos contextuales con @radix-ui/react-tooltip.
 * Provee certeza inmediata sobre términos técnicos y jurídicos sin salir del flujo de trabajo.
 */
export const LegalTooltip: React.FC<LegalTooltipProps> = ({
  term,
  explanation,
  children,
  side = 'top',
  className = '',
}) => {
  return (
    <Tooltip.Provider delayDuration={250}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span
            className={`inline-flex items-center gap-1 cursor-help border-b border-dotted border-slate-500 hover:border-emerald-400 transition-colors ${className}`}
          >
            {children || (
              <>
                <span>{term}</span>
                <HelpCircle className="w-3 h-3 text-slate-400 hover:text-emerald-400" />
              </>
            )}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
            sideOffset={5}
            className="z-50 max-w-xs px-3 py-2 text-xs font-normal text-slate-100 bg-slate-900 border border-slate-700/80 rounded-lg shadow-xl shadow-black/70 backdrop-blur-sm animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          >
            <div className="flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-300 capitalize text-[11px] mb-0.5">{term}</p>
                <p className="text-slate-300 leading-relaxed text-[11px]">{explanation}</p>
              </div>
            </div>
            <Tooltip.Arrow className="fill-slate-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
