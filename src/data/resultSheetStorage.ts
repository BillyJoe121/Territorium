/**
 * Hojas de cálculo de los resultados en Supabase Storage (bucket privado source-documents).
 *
 * Ruta determinística por versión de resultado, para sobreescribir siempre el mismo archivo:
 *   <project_id>/hojas/<result_version_id>/<grupo>.xlsx
 * Lectura: miembros del proyecto. Escritura: revisor jurídico, solo mientras la versión es
 * borrador (migración 20261008120000_result_sheets_storage.sql).
 */
import type { ExpedienteGroupKey } from '../lib/expedienteWorkflow'
import { requireSupabase } from '../lib/supabase'

export const RESULT_SHEET_BUCKET = 'source-documents'
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const SHEET_FILE_NAMES: Record<ExpedienteGroupKey | 'consolidated', string> = {
  titles: 'estudio-titulos',
  plans: 'planos',
  negotiation: 'plantilla-negociacion',
  consolidated: 'consolidado',
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function resultSheetPath(projectId: string, resultVersionId: string, groupKey: ExpedienteGroupKey | 'consolidated'): string {
  if (!UUID.test(projectId) || !UUID.test(resultVersionId)) throw new Error('Identificador de proyecto o de resultado no válido para la hoja de cálculo.')
  return `${projectId}/hojas/${resultVersionId}/${SHEET_FILE_NAMES[groupKey]}.xlsx`
}

/**
 * La descarga de Storage no interpreta el cuerpo del error: "no existe" (o sin permiso de
 * lectura, que Storage también reporta así) llega como respuesta 400/404.
 */
export function isMissingObjectError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { status?: number; statusCode?: string | number; message?: string; originalError?: { status?: number } }
  const status = e.status ?? e.originalError?.status
  if (status === 404 || status === 400) return true
  if (String(e.statusCode ?? '') === '404') return true
  return /not[_ ]?found|no existe/i.test(e.message ?? '')
}

/** Archivo guardado, o null si aún no existe. */
export async function downloadResultSheet(path: string): Promise<Blob | null> {
  const { data, error } = await requireSupabase().storage.from(RESULT_SHEET_BUCKET).download(path)
  if (error) {
    if (isMissingObjectError(error)) return null
    throw new Error(`No se pudo descargar la hoja de cálculo: ${error.message}`)
  }
  return data
}

/** Sobreescribe el archivo. cacheControl 0: al reabrir el modal nunca se sirve una copia vieja. */
export async function uploadResultSheet(path: string, file: Blob): Promise<void> {
  const { error } = await requireSupabase().storage.from(RESULT_SHEET_BUCKET).upload(path, file, {
    contentType: XLSX_MIME,
    upsert: true,
    cacheControl: '0',
  })
  if (error) throw new Error(`No se pudo guardar la hoja de cálculo en Storage: ${error.message}`)
}
