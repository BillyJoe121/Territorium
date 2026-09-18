import React, { useState } from 'react'
import {
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  FileCheck,
  FileText,
  History,
  Info,
  MapPin,
  Plus,
  Scale,
  ShieldCheck,
  UserCheck,
  Zap,
} from 'lucide-react'
import type { Project, PropertyRecord } from '../../types'
import { PageHeader } from '../common/PageHeader'
import { StatusBadge } from '../common/StatusBadge'

export interface NegotiationItem {
  id: string
  propertyCode: string
  ownerName: string
  cadastralAreaM2: number
  affectedAreaM2: number
  commercialAppraisalCop: number
  proposedValueCop: number
  reviewedValueCop: number
  finalValueCop: number | null
  negotiationStatus: 'ofertado' | 'en_estudio' | 'acordado' | 'no_conciliado'
  history: Array<{
    date: string
    author: string
    stage: string
    amountCop: number
    observations: string
  }>
}

export interface NegotiationViewProps {
  project?: Project
  projectName?: string
  records: PropertyRecord[]
  onSaveNegotiation?: (propertyCode: string, data: any) => Promise<void>
  onUpdateRecord?: (recordId: string, updatedFields: Record<string, string>) => Promise<void>
}

export function NegotiationView({
  project,
  projectName,
  records,
  onSaveNegotiation,
  onUpdateRecord,
}: NegotiationViewProps) {
  const resolvedProjectName = projectName || project?.name || 'Expediente Activo'
  // Datos demostrativos consistentes de negociación por predio
  const [items, setItems] = useState<NegotiationItem[]>([
    {
      id: 'neg-01',
      propertyCode: 'SAN-CIM-036',
      ownerName: 'MARÍA DEL CARMEN RESTREPO VÉLEZ',
      cadastralAreaM2: 124500,
      affectedAreaM2: 3450,
      commercialAppraisalCop: 45000000,
      proposedValueCop: 38500000,
      reviewedValueCop: 41200000,
      finalValueCop: 41200000,
      negotiationStatus: 'acordado',
      history: [
        {
          date: '2026-08-12',
          author: 'negociador@territorium.com',
          stage: 'Oferta Formal Inicial',
          amountCop: 38500000,
          observations: 'Notificación de oferta inicial de enajenación voluntaria.',
        },
        {
          date: '2026-09-02',
          author: 'perito.avaluos@territorium.com',
          stage: 'Ajuste de Avalúo por Cultivos',
          amountCop: 41200000,
          observations: 'Revisión técnica de indemnización por cultivos de pancoger afectados.',
        },
      ],
    },
    {
      id: 'neg-02',
      propertyCode: 'SAN-CIM-040',
      ownerName: 'JOSÉ IGNACIO MONTOYA',
      cadastralAreaM2: 85200,
      affectedAreaM2: 1800,
      commercialAppraisalCop: 28000000,
      proposedValueCop: 24000000,
      reviewedValueCop: 26500000,
      finalValueCop: null,
      negotiationStatus: 'en_estudio',
      history: [
        {
          date: '2026-08-20',
          author: 'negociador@territorium.com',
          stage: 'Oferta Formal Inicial',
          amountCop: 24000000,
          observations: 'Radicada notificación personal en predio.',
        },
      ],
    },
  ])

  const [selectedCode, setSelectedCode] = useState<string>(items[0]?.propertyCode ?? '')
  const currentItem = items.find((i) => i.propertyCode === selectedCode) || items[0]

  // Formulario de nueva oferta
  const [newStage, setNewStage] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newObs, setNewObs] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)

  const formatCop = (val: number | null | undefined) => {
    if (val === null || val === undefined) return 'No definido'
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestión Socioeconómica y Predial"
        title="Módulo de Negociación y Afectaciones"
        description={`Control de avalúos comerciales, indemnizaciones y actas de concertación para el expediente "${resolvedProjectName}".`}
        actions={
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsFormOpen(true)}
          >
            <Plus size={14} /> Registrar Gestión de Oferta
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna 1: Lista de Predios en Negociación */}
        <div className="card p-0 overflow-hidden space-y-0">
          <div className="p-4 border-b border-[#E4E7EC] bg-[#F7F8FA]">
            <h3 className="text-xs font-semibold text-[#667085] uppercase tracking-wider">
              Predios en Negociación ({items.length})
            </h3>
          </div>

          <div className="divide-y divide-[#E4E7EC]">
            {items.map((item) => {
              const isSelected = item.propertyCode === selectedCode
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`w-full p-4 text-left transition-colors flex items-start justify-between ${
                    isSelected ? 'bg-[#EDF3FF] border-l-2 border-l-[#2459D3]' : 'hover:bg-[#F7F8FA]'
                  }`}
                  onClick={() => setSelectedCode(item.propertyCode)}
                >
                  <div className="space-y-1">
                    <strong className="text-xs font-semibold text-[#182230] block">
                      {item.propertyCode}
                    </strong>
                    <p className="text-[11px] text-[#526071] truncate max-w-[180px]">
                      {item.ownerName}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <StatusBadge
                        status={
                          item.negotiationStatus === 'acordado'
                            ? 'aprobado'
                            : item.negotiationStatus === 'en_estudio'
                            ? 'pendiente'
                            : 'info'
                        }
                        label={
                          item.negotiationStatus === 'acordado'
                            ? 'Acuerdo Cerrado'
                            : item.negotiationStatus === 'en_estudio'
                            ? 'En Concertación'
                            : 'Ofertado'
                        }
                        size="sm"
                      />
                    </div>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-[#182230]">
                    {formatCop(item.finalValueCop || item.reviewedValueCop)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Columna 2 y 3: Detalle Económico, Avalúo y Línea de Tiempo */}
        <div className="lg:col-span-2 space-y-6">
          {currentItem && (
            <>
              {/* Resumen de Afectación Física y Financiera */}
              <div className="card p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-3">
                  <div>
                    <span className="text-[10px] font-semibold text-[#667085] uppercase tracking-wider block">
                      Titular y Registro
                    </span>
                    <h3 className="text-base font-semibold text-[#182230]">
                      {currentItem.propertyCode} · {currentItem.ownerName}
                    </h3>
                  </div>
                  <StatusBadge
                    status={
                      currentItem.negotiationStatus === 'acordado' ? 'aprobado' : 'pendiente'
                    }
                    label={
                      currentItem.negotiationStatus === 'acordado'
                        ? 'Acuerdo Cerrado'
                        : 'En Concertación'
                    }
                  />
                </div>

                {/* Métricas de Afectación */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-[#F7F8FA] border border-[#E4E7EC] rounded-lg">
                    <span className="text-[10px] font-semibold text-[#667085] uppercase tracking-wider block">
                      Área Predio
                    </span>
                    <strong className="text-sm font-semibold tabular-nums text-[#182230]">
                      {currentItem.cadastralAreaM2.toLocaleString('es-CO')} m²
                    </strong>
                  </div>

                  <div className="p-3 bg-[#F7F8FA] border border-[#E4E7EC] rounded-lg">
                    <span className="text-[10px] font-semibold text-[#667085] uppercase tracking-wider block">
                      Área Afectada
                    </span>
                    <strong className="text-sm font-semibold tabular-nums text-[#2459D3]">
                      {currentItem.affectedAreaM2.toLocaleString('es-CO')} m²
                    </strong>
                    <span className="text-[10px] text-[#667085] block">
                      ({((currentItem.affectedAreaM2 / currentItem.cadastralAreaM2) * 100).toFixed(2)}%)
                    </span>
                  </div>

                  <div className="p-3 bg-[#F7F8FA] border border-[#E4E7EC] rounded-lg">
                    <span className="text-[10px] font-semibold text-[#667085] uppercase tracking-wider block">
                      Avalúo Comercial
                    </span>
                    <strong className="text-sm font-semibold tabular-nums text-[#182230]">
                      {formatCop(currentItem.commercialAppraisalCop)}
                    </strong>
                  </div>

                  <div className="p-3 bg-[#EDFDF5] border border-[#A3E6C5] rounded-lg">
                    <span className="text-[10px] font-semibold text-[#18794E] uppercase tracking-wider block">
                      Valor Definitivo
                    </span>
                    <strong className="text-sm font-semibold tabular-nums text-[#18794E]">
                      {formatCop(currentItem.finalValueCop || currentItem.reviewedValueCop)}
                    </strong>
                  </div>
                </div>

                {/* Advertencia de Seguridad */}
                <div className="p-3 bg-[#F1F3F6] rounded-md text-xs text-[#526071] flex items-center gap-2">
                  <Info size={14} className="text-[#2459D3] flex-shrink-0" />
                  <span>
                    El valor definitivo requiere acta de entrega y validación jurídica previa a la emisión de minuta de servidumbre.
                  </span>
                </div>
              </div>

              {/* Historial de Negociaciones y Acuerdos */}
              <div className="card p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-3">
                  <h3 className="text-sm font-semibold text-[#182230] flex items-center gap-2">
                    <History size={16} className="text-[#2459D3]" />
                    Historial de Ofertas y Concertación
                  </h3>
                  <span className="text-xs text-[#667085]">
                    {currentItem.history.length} evento(s) registrado(s)
                  </span>
                </div>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E4E7EC]">
                  {currentItem.history.map((h, idx) => (
                    <div key={idx} className="relative space-y-1 text-xs">
                      <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#2459D3] border-2 border-white" />
                      <div className="flex items-center justify-between">
                        <strong className="text-[#182230] font-semibold">{h.stage}</strong>
                        <span className="text-[11px] text-[#667085] tabular-nums">{h.date}</span>
                      </div>
                      <p className="text-[#526071]">{h.observations}</p>
                      <div className="flex items-center gap-3 pt-1 text-[11px]">
                        <span className="font-semibold tabular-nums text-[#182230]">
                          Monto: {formatCop(h.amountCop)}
                        </span>
                        <span className="text-[#667085]">Registró: {h.author}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Formulario Modal o Desplegable */}
          {isFormOpen && (
            <div className="card p-6 bg-[#F7F8FA] border border-[#2459D3] space-y-4">
              <h3 className="text-sm font-semibold text-[#182230]">
                Registrar Nueva Gestión de Oferta para {selectedCode}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[#526071] mb-1 font-medium">Etapa / Tipo:</label>
                  <input
                    type="text"
                    className="w-full p-2 rounded-md border border-[#98A2B3] bg-white text-xs"
                    placeholder="Ej: Contrapropuesta de propietario, Acta de acuerdo"
                    value={newStage}
                    onChange={(e) => setNewStage(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[#526071] mb-1 font-medium">Monto COP:</label>
                  <input
                    type="number"
                    className="w-full p-2 rounded-md border border-[#98A2B3] bg-white text-xs"
                    placeholder="Ej: 42000000"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[#526071] mb-1 text-xs font-medium">
                  Observaciones / Términos:
                </label>
                <textarea
                  rows={2}
                  className="w-full p-2 rounded-md border border-[#98A2B3] bg-white text-xs"
                  placeholder="Detalles de la reunión o acta de concertación..."
                  value={newObs}
                  onChange={(e) => setNewObs(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsFormOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!newStage.trim() || !newAmount}
                  onClick={() => {
                    if (newStage && newAmount) {
                      const updated = items.map((i) => {
                        if (i.propertyCode === selectedCode) {
                          return {
                            ...i,
                            reviewedValueCop: Number(newAmount),
                            history: [
                              ...i.history,
                              {
                                date: new Date().toISOString().split('T')[0],
                                author: 'operador@territorium.com',
                                stage: newStage,
                                amountCop: Number(newAmount),
                                observations: newObs,
                              },
                            ],
                          }
                        }
                        return i
                      })
                      setItems(updated)
                      setIsFormOpen(false)
                      setNewStage('')
                      setNewAmount('')
                      setNewObs('')
                    }
                  }}
                >
                  Guardar Gestión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
