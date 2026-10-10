/**
 * Documentos generados desde el consolidado en Supabase Storage (bucket privado source-documents):
 *   <project_id>/documentos/<escritura|linderos|minuta>/<archivo>.docx
 * Lectura: miembros del proyecto. Crear, sobreescribir y eliminar: revisor jurídico
 * (migración 20261009120000_generated_documents_storage.sql).
 */
import type { GeneratedDocumentKind } from '../lib/generatedDocuments'
import { requireSupabase } from '../lib/supabase'

const BUCKET = 'source-documents'
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Storage rechazó la escritura por sus políticas (RLS): generar más filas fallaría igual. */
export class GeneratedDocumentsPermissionError extends Error {
  constructor() {
    super(
      'Supabase no permitió guardar el documento. Se necesita el rol revisor jurídico, aprobador o administrador en el proyecto, '
      + 'y tener aplicadas las migraciones 20261009120000_generated_documents_storage.sql y, para la plantilla personalizada, 20261010120000_generated_documents_custom_template.sql.',
    )
    this.name = 'GeneratedDocumentsPermissionError'
  }
}

const isRlsError = (message: string | undefined) => /row-level security|violates.*policy|unauthorized|permission/i.test(message ?? '')

export interface GeneratedDocumentFile {
  kind: GeneratedDocumentKind
  name: string
  path: string
  size: number | null
  updatedAt: string | null
}

export function generatedDocumentsFolder(projectId: string, kind: GeneratedDocumentKind): string {
  if (!UUID.test(projectId)) throw new Error('Identificador de proyecto no válido para los documentos generados.')
  return `${projectId}/documentos/${kind}`
}

export async function listGeneratedDocuments(projectId: string, kind: GeneratedDocumentKind): Promise<GeneratedDocumentFile[]> {
  const folder = generatedDocumentsFolder(projectId, kind)
  const { data, error } = await requireSupabase().storage.from(BUCKET).list(folder, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
  if (error) throw new Error(`No se pudieron listar los documentos generados: ${error.message}`)
  return (data ?? [])
    // Las carpetas vienen sin id; solo interesan los .docx.
    .filter((item) => item.id && item.name.toLowerCase().endsWith('.docx'))
    .map((item) => ({
      kind,
      name: item.name,
      path: `${folder}/${item.name}`,
      size: typeof item.metadata?.size === 'number' ? item.metadata.size : null,
      updatedAt: item.updated_at ?? item.created_at ?? null,
    }))
}

/** Crea o reemplaza el documento. cacheControl 0: al visualizarlo nunca se sirve una copia vieja. */
export async function uploadGeneratedDocument(path: string, file: Blob, metadata: Record<string, string>): Promise<void> {
  // Con un Blob, Storage toma el tipo del propio Blob (no de contentType) y el bucket lo valida.
  const body = file.type === DOCX_MIME ? file : new Blob([file], { type: DOCX_MIME })
  const { error } = await requireSupabase().storage.from(BUCKET).upload(path, body, {
    contentType: DOCX_MIME,
    upsert: true,
    cacheControl: '0',
    metadata,
  })
  if (error) {
    if (isRlsError(error.message)) throw new GeneratedDocumentsPermissionError()
    throw new Error(`No se pudo guardar el documento en Storage: ${error.message}`)
  }
}

export async function downloadGeneratedDocument(path: string): Promise<Blob> {
  const { data, error } = await requireSupabase().storage.from(BUCKET).download(path)
  if (error || !data) throw new Error(`No se pudo descargar el documento: ${error?.message ?? 'sin datos'}`)
  return data
}

export async function removeGeneratedDocument(path: string): Promise<void> {
  const { data, error } = await requireSupabase().storage.from(BUCKET).remove([path])
  if (error) throw new Error(`No se pudo eliminar el documento: ${error.message}`)
  // Storage no informa error si la política impide borrar: simplemente no devuelve el objeto.
  if (!data?.length) throw new Error('No se pudo eliminar el documento: no tienes permiso o ya no existe.')
}

/** Acceso a los documentos generados de un proyecto (Storage en la app; en memoria en pruebas). */
export interface GeneratedDocumentsStore {
  list: (kind: GeneratedDocumentKind) => Promise<GeneratedDocumentFile[]>
  save: (kind: GeneratedDocumentKind, name: string, file: Blob, metadata: Record<string, string>) => Promise<void>
  load: (path: string) => Promise<Blob>
  remove: (path: string) => Promise<void>
}

export function supabaseGeneratedDocumentsStore(projectId: string): GeneratedDocumentsStore {
  return {
    list: (kind) => listGeneratedDocuments(projectId, kind),
    save: (kind, name, file, metadata) => uploadGeneratedDocument(`${generatedDocumentsFolder(projectId, kind)}/${name}`, file, metadata),
    load: downloadGeneratedDocument,
    remove: removeGeneratedDocument,
  }
}
