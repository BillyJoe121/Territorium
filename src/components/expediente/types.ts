import type { LucideIcon } from 'lucide-react'
import { FileSpreadsheet, FileText, Map } from 'lucide-react'
import type {
  ExpedienteConsolidationStatus,
  ExpedienteFinalDocumentStatus,
  ExpedienteGroupKey,
  ExpedienteGroupStatus,
} from '../../lib/expedienteWorkflow'

export type DocumentGroupKey = ExpedienteGroupKey
export type PrototypeGroupStatus = ExpedienteGroupStatus
export type PrototypeDocumentStatus = ExpedienteFinalDocumentStatus
export type PrototypeConsolidationStatus = ExpedienteConsolidationStatus
export type DetailView = 'summary' | 'extraction' | 'document'

export interface PrototypeFile {
  id: string
  name: string
  size: number
  extension: string
}

export interface EditableResultRow {
  id: string
  [key: string]: string
}

export interface ResultColumn {
  key: string
  label: string
  editable?: boolean
  inputMode?: 'text' | 'numeric'
  width?: number
}

export interface DocumentGroup {
  key: DocumentGroupKey
  label: string
  singularLabel: string
  description: string
  helper: string
  acceptedTypes: string
  icon: LucideIcon
  files: PrototypeFile[]
  status: PrototypeGroupStatus
  progress: number
  resultVersion: number
  updatedAt?: string
  error?: string
  columns: ResultColumn[]
  rows: EditableResultRow[]
}

const file = (id: string, name: string, size: number): PrototypeFile => ({
  id,
  name,
  size,
  extension: name.split('.').pop()?.toUpperCase() ?? 'ARCHIVO',
})

export const createDemoGroups = (): Record<DocumentGroupKey, DocumentGroup> => ({
  titles: {
    key: 'titles',
    label: 'Títulos',
    singularLabel: 'títulos',
    description: 'Estudios, certificados y antecedentes jurídicos del predio.',
    helper: 'Todos los documentos deben referirse a este mismo predio.',
    acceptedTypes: 'PDF o DOCX',
    icon: FileText,
    status: 'ready',
    progress: 0,
    resultVersion: 1,
    files: [
      file('title-1', 'Estudio de títulos — La Esperanza.docx', 1_860_000),
      file('title-2', 'Certificado de tradición 050N-204581.pdf', 842_000),
    ],
    columns: [
      { key: 'folio', label: 'Folio de matrícula', width: 170 },
      { key: 'cadastralId', label: 'Cédula catastral', width: 190 },
      { key: 'owners', label: 'Propietarios del predio', width: 220 },
      { key: 'documentNumber', label: 'No. documento', width: 145 },
      { key: 'documentType', label: 'Tipo documento', width: 165 },
      { key: 'antecedentsConsultationDate', label: 'Fecha consulta antecedentes propietario Tusdatos.co', width: 255 },
      { key: 'propertyName', label: 'Nombre del predio', width: 180 },
      { key: 'municipality', label: 'Municipio del predio', width: 165 },
      { key: 'department', label: 'Departamento del predio', width: 175 },
      { key: 'village', label: 'Vereda del predio', width: 160 },
      { key: 'areaNumbers', label: 'Área del predio (números)', inputMode: 'numeric', width: 190 },
      { key: 'areaLetters', label: 'Área del predio (letras)', width: 250 },
      { key: 'registryOffice', label: 'Oficina de registro del predio', width: 220 },
      { key: 'acquisitionMode', label: 'Modo de adquisición del predio', width: 220 },
      { key: 'boundaries', label: 'Linderos del predio', width: 290 },
      { key: 'boundariesDocument', label: 'Documento que contiene los linderos', width: 280 },
      { key: 'legalConditions', label: 'Condiciones jurídicas vigentes', width: 245 },
      { key: 'justiceMinistryCase', label: 'Radicado consulta Ministerio de Justicia', width: 255 },
      { key: 'urtCase', label: 'Radicado consulta URT', width: 190 },
      { key: 'urtTerritorialDirection', label: 'Dirección territorial de la URT', width: 230 },
    ],
    rows: [
      {
        id: 'title-property-1',
        folio: '050N-204581',
        cadastralId: '05001010400230012000',
        owners: 'María Elena Rojas',
        documentNumber: '43.123.456',
        documentType: 'Cédula de ciudadanía',
        antecedentsConsultationDate: '18/09/2026',
        propertyName: 'La Esperanza',
        municipality: 'Rionegro',
        department: 'Antioquia',
        village: 'La Esperanza',
        areaNumbers: '124580 m²',
        areaLetters: 'Doce hectáreas y cuatro mil quinientos ochenta metros cuadrados',
        registryOffice: 'ORIP Rionegro',
        acquisitionMode: 'Compraventa',
        boundaries: 'Norte: predio El Roble; sur: vía veredal; oriente: quebrada La Esperanza; occidente: predio La Loma.',
        boundariesDocument: 'Escritura pública 1.240 del 12/06/2012',
        legalConditions: 'Sin anotaciones restrictivas vigentes en la muestra.',
        justiceMinistryCase: 'MJ-2026-050N-204581',
        urtCase: 'URT-ANT-2026-01842',
        urtTerritorialDirection: 'Antioquia',
      },
    ],
  },
  plans: {
    key: 'plans',
    label: 'Planos',
    singularLabel: 'planos',
    description: 'Planos, levantamientos y soportes técnicos del predio.',
    helper: 'Puede incluir varios planos asociados a la misma gestión.',
    acceptedTypes: 'PDF o imagen',
    icon: Map,
    status: 'ready',
    progress: 0,
    resultVersion: 1,
    files: [
      file('plan-1', 'Plano de servidumbre — tramo 12.pdf', 4_280_000),
      file('plan-2', 'Levantamiento topográfico La Esperanza.pdf', 3_170_000),
    ],
    columns: [
      { key: 'planName', label: 'Nombre del plano', width: 220 },
      { key: 'easementAreaNumbers', label: 'Área servidumbre (m²) números', inputMode: 'numeric', width: 210 },
      { key: 'easementAreaLetters', label: 'Área servidumbre (m²) letras', width: 240 },
      { key: 'easementLengthNumbers', label: 'Longitud servidumbre (m) números', inputMode: 'numeric', width: 235 },
      { key: 'easementLengthLetters', label: 'Longitud servidumbre (m) letras', width: 245 },
      { key: 'easementWidthNumbers', label: 'Ancho servidumbre (m) números', inputMode: 'numeric', width: 220 },
      { key: 'easementWidthLetters', label: 'Ancho servidumbre (m) letras', width: 230 },
      { key: 'infrastructureCountNumbers', label: 'Cantidad postes o infraestructuras números', inputMode: 'numeric', width: 275 },
      { key: 'infrastructureCountLetters', label: 'Cantidad postes o infraestructuras letras', width: 265 },
      { key: 'planScale', label: 'Escala del plano', width: 140 },
    ],
    rows: [
      {
        id: 'plan-a',
        planName: 'Servidumbre — tramo 12',
        easementAreaNumbers: '4580',
        easementAreaLetters: 'Cuatro mil quinientos ochenta metros cuadrados',
        easementLengthNumbers: '458',
        easementLengthLetters: 'Cuatrocientos cincuenta y ocho metros',
        easementWidthNumbers: '10',
        easementWidthLetters: 'Diez metros',
        infrastructureCountNumbers: '8',
        infrastructureCountLetters: 'Ocho apoyos',
        planScale: '1:2.000',
      },
      {
        id: 'plan-b',
        planName: 'Levantamiento topográfico La Esperanza',
        easementAreaNumbers: '124580',
        easementAreaLetters: 'Ciento veinticuatro mil quinientos ochenta metros cuadrados',
        easementLengthNumbers: '—',
        easementLengthLetters: 'No aplica',
        easementWidthNumbers: '—',
        easementWidthLetters: 'No aplica',
        infrastructureCountNumbers: '—',
        infrastructureCountLetters: 'No aplica',
        planScale: '1:1.000',
      },
    ],
  },
  negotiation: {
    key: 'negotiation',
    label: 'Negociación',
    singularLabel: 'negociación',
    description: 'Tabla vigente de ofertas y validaciones económicas.',
    helper: 'Se utiliza la versión vigente de la tabla para la consolidación.',
    acceptedTypes: 'XLSX',
    icon: FileSpreadsheet,
    status: 'ready',
    progress: 0,
    resultVersion: 1,
    files: [file('negotiation-1', 'Tabla de negociación — La Esperanza.xlsx', 226_000)],
    columns: [
      { key: 'firstOfferNumbers', label: 'Primera oferta (números)', inputMode: 'numeric', width: 210 },
      { key: 'firstOfferLetters', label: 'Primera oferta (letras)', width: 290 },
      { key: 'secondOfferNumbers', label: 'Segunda oferta (números)', inputMode: 'numeric', width: 215 },
      { key: 'secondOfferLetters', label: 'Segunda oferta (letras)', width: 290 },
      { key: 'valuesMatch', label: '¿Coinciden números y letras?', editable: false, width: 220 },
    ],
    rows: [
      {
        id: 'negotiation-offers-1',
        firstOfferNumbers: '$ 218.450.000',
        firstOfferLetters: 'Doscientos dieciocho millones cuatrocientos cincuenta mil pesos',
        secondOfferNumbers: '$ 232.800.000',
        secondOfferLetters: 'Doscientos treinta y dos millones ochocientos mil pesos',
        valuesMatch: 'Sí, coinciden',
      },
    ],
  },
})

export const createDemoConsolidatedRows = (): EditableResultRow[] => [
  { id: 'consolidated-folio', field: 'Matrícula inmobiliaria', value: '050N-204581', source: 'Títulos' },
  { id: 'consolidated-cadastral', field: 'Cédula catastral', value: '05001010400230012000', source: 'Títulos' },
  { id: 'consolidated-owner', field: 'Propietario(s) actual(es)', value: 'María Elena Rojas y Carlos Rojas', source: 'Títulos' },
  { id: 'consolidated-area', field: 'Área de servidumbre', value: '4.580 m²', source: 'Planos' },
  { id: 'consolidated-length', field: 'Longitud de servidumbre', value: '458 m', source: 'Planos' },
  { id: 'consolidated-offer', field: 'Oferta vigente', value: '$ 232.800.000', source: 'Negociación' },
]

export const consolidatedColumns: ResultColumn[] = [
  { key: 'field', label: 'Campo', editable: false, width: 190 },
  { key: 'value', label: 'Valor consolidado', width: 350 },
  { key: 'source', label: 'Origen', editable: false, width: 100 },
]

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1_000))} KB`
  return `${(bytes / 1_000_000).toFixed(bytes >= 10_000_000 ? 0 : 1)} MB`
}

export const statusLabel = (status: PrototypeGroupStatus): string => ({
  empty: 'Sin archivos',
  ready: 'Listo para analizar',
  queued: 'En cola',
  processing: 'Procesando',
  review_ready: 'Listo para revisar',
  approved: 'Aprobado',
  stale: 'Requiere actualización',
  error: 'Requiere atención',
})[status]
