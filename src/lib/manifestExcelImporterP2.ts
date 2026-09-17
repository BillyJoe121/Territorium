import type { ManifestImportRow, ManifestImportResult } from '../types'

export interface RawExcelManifestRow {
  codigo_predial?: string | number
  tipo_documento?: string
  nombre_archivo_esperado?: string
  propietario_presunto?: string
  observaciones?: string
  [key: string]: unknown
}

/**
 * US-032: Normaliza y procesa filas tabulares de un manifiesto de insumos desde Excel.
 */
export function processExcelManifestRows(
  rows: RawExcelManifestRow[],
  uploadedFileNames: string[] = []
): ManifestImportResult {
  const processedRows: ManifestImportRow[] = []
  const discrepancies: string[] = []
  const seenCodes = new Set<string>()

  const normalizedUploaded = uploadedFileNames.map(f => ({
    raw: f,
    clean: f.toLowerCase().trim()
  }))

  for (let index = 0; index < rows.length; index++) {
    const raw = rows[index]
    const code = raw.codigo_predial ? String(raw.codigo_predial).trim() : ''

    if (!code) {
      discrepancies.push(`Fila ${index + 1}: Faltante de código predial obligatorio.`)
      continue
    }

    const key = `${code}-${raw.tipo_documento || 'insumo'}`
    if (seenCodes.has(key)) {
      discrepancies.push(`Fila ${index + 1}: Registro duplicado para el predio '${code}' y tipo '${raw.tipo_documento}'.`)
    }
    seenCodes.add(key)

    const expectedName = raw.nombre_archivo_esperado ? String(raw.nombre_archivo_esperado).trim() : undefined
    let isMatched = false
    let matchedFile: string | undefined

    if (expectedName) {
      const match = normalizedUploaded.find(u => u.clean === expectedName.toLowerCase())
      if (match) {
        isMatched = true
        matchedFile = match.raw
      }
    } else {
      // Buscar coincidencia por código predial en el nombre del archivo
      const matchByCode = normalizedUploaded.find(u => u.clean.includes(code.toLowerCase()))
      if (matchByCode) {
        isMatched = true
        matchedFile = matchByCode.raw
      }
    }

    processedRows.push({
      propertyCode: code,
      expectedDocumentType: raw.tipo_documento || 'estudio_titulos',
      expectedFileName: expectedName,
      presumedOwner: raw.propietario_presunto ? String(raw.propietario_presunto).trim() : undefined,
      notes: raw.observaciones ? String(raw.observaciones).trim() : undefined,
      isMatched,
      matchedFile
    })
  }

  const matchedCount = processedRows.filter(r => r.isMatched).length
  const unmatchedCount = processedRows.length - matchedCount

  return {
    totalRows: processedRows.length,
    matchedRows: matchedCount,
    unmatchedRows: unmatchedCount,
    rows: processedRows,
    discrepancies
  }
}
