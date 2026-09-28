import type { ConsolidatedMasterRecord } from './expedienteConsolidation'

export interface DownloadDocxOptions {
  templateId: string
  record: ConsolidatedMasterRecord | Record<string, unknown>
  fallbackFilename?: string
}

/**
 * Sends request to worker to export a populated DOCX matching the official template.
 */
export async function downloadPopulatedDocx({
  templateId,
  record,
  fallbackFilename,
}: DownloadDocxOptions): Promise<void> {
  const response = await fetch('/api/documents/export-docx', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      template_id: templateId,
      record,
    }),
  })

  if (!response.ok) {
    let errorDetail = `Error ${response.status}`
    try {
      const json = await response.json()
      if (json && json.detail) {
        errorDetail = json.detail
      }
    } catch {
      const text = await response.text()
      if (text) errorDetail = text
    }
    throw new Error(`No fue posible generar el archivo Word: ${errorDetail}`)
  }

  const blob = await response.blob()
  let filename = fallbackFilename
  const disposition = response.headers.get('Content-Disposition')
  if (disposition) {
    const match = /filename=["']?([^"']+)["']?/.exec(disposition)
    if (match?.[1]) {
      filename = match[1]
    }
  }
  if (!filename) {
    const defaultNames: Record<string, string> = {
      'tpl-escritura-publica': 'ESCRITURA_TOL_ANZ_045_CONSOLIDADA.docx',
      'tpl-descripcion-linderos': 'ID02_DESCRIPCION_LINDEROS_CONSOLIDADA.docx',
      'tpl-minuta-tipo': 'MINUTA_TIPO_TERRITORIUM_CONSOLIDADA.docx',
    }
    filename = defaultNames[templateId] || 'DOCUMENTO_CONSOLIDADO.docx'
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
