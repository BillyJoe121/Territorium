import { FileSpreadsheet, FileText, Map } from 'lucide-react'
import type { RemoteExpedienteGroup } from '../../data/expedienteProcessing'
import { downloadResultSheet, resultSheetPath, uploadResultSheet } from '../../data/resultSheetStorage'
import type { ExpedienteGroupKey } from '../../lib/expedienteWorkflow'
import type { Project } from '../../types'
import type { ResultSpreadsheetSource } from './ResultSpreadsheet'
import { statusLabel, type PrototypeConsolidationStatus } from './types'

/** Los tres subconjuntos documentales de un proyecto, en el orden en que se aprueban. */
export const groupInfo: Record<
  ExpedienteGroupKey,
  {
    title: string
    description: string
    accepted: string
    accept: string
    multiple: boolean
    icon: typeof FileText
  }
> = {
  titles: {
    title: 'Estudio de Títulos',
    description: 'Estudios de títulos de los predios. Se analiza y aprueba primero: su FMI es la llave de los planos.',
    accepted: 'PDF o DOCX',
    accept: '.pdf,.docx',
    multiple: true,
    icon: FileText,
  },
  plans: {
    title: 'Planos',
    description: 'Un plano por estudio de títulos. Se vincula por FMI y se coteja contra el estudio aprobado.',
    accepted: 'PDF, PNG o JPG',
    accept: '.pdf,.png,.jpg,.jpeg',
    multiple: true,
    icon: Map,
  },
  negotiation: {
    title: 'Plantilla de negociación',
    description: 'El Excel vigente de ofertas. Al aprobar se registra el valor negociado en números y letras.',
    accepted: 'XLSX',
    accept: '.xlsx',
    multiple: false,
    icon: FileSpreadsheet,
  },
}

export const orderedKeys: ExpedienteGroupKey[] = ['titles', 'plans', 'negotiation']

export function progressFor(group: RemoteExpedienteGroup): number {
  if (group.status === 'review_ready' || group.status === 'approved') return 100
  if (group.status === 'queued') return 15
  if (group.status === 'error') return 0
  if (!group.execution || group.execution.totalUnits === 0) return 0

  const stage = group.execution.stage
  if (stage === 'extracting') return 80
  if (stage === 'ready_for_extraction') return 60

  const validationRatio = group.execution.totalUnits > 0
    ? group.execution.completedUnits / group.execution.totalUnits
    : 0
  return Math.min(50, Math.round(validationRatio * 50))
}

export function statusText(group: RemoteExpedienteGroup): string {
  if (group.status === 'review_ready') return 'Listo para revisar'
  return statusLabel(group.status)
}

export function StatusText({ status, label }: { status: string; label: string }) {
  return (
    <span className={`expediente-status status-${status}`}>
      <span aria-hidden="true" />
      {label}
    </span>
  )
}

export const consolidationLabel = (status: PrototypeConsolidationStatus): string =>
  ({
    blocked: 'Bloqueado (requiere 3 aprobaciones)',
    available: 'Listo para consolidar',
    processing: 'Consolidando registro maestro',
    review_ready: 'Listo para revisión',
    approved: 'Consolidado aprobado',
    stale: 'Requiere actualización',
  })[status]

/** Hoja de cálculo (Univer) de los modales de resultados: un .xlsx por versión de resultado. */
export function resultSheetSource(
  project: Pick<Project, 'id' | 'name'>,
  groupKey: ExpedienteGroupKey | 'consolidated',
  resultVersionId: string,
  sheetName: string,
): ResultSpreadsheetSource | undefined {
  let path: string
  try {
    path = resultSheetPath(project.id, resultVersionId, groupKey)
  } catch {
    return undefined // Identificadores no remotos: se mantiene la tabla.
  }
  return {
    sheetName,
    fileName: `${sheetName} - ${project.name}.xlsx`,
    // Títulos se identifica por su documento fuente (archivos ya guardados); el resto, por ID oculto.
    keyColumn: groupKey === 'titles' ? 'sourceDocument' : undefined,
    load: () => downloadResultSheet(path),
    save: (file) => uploadResultSheet(path, file),
  }
}
