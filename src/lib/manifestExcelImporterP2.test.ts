import { describe, it, expect } from 'vitest'
import { processExcelManifestRows, type RawExcelManifestRow } from './manifestExcelImporterP2'

describe('manifestExcelImporterP2 (US-032)', () => {
  it('procesa filas de manifiesto Excel y empareja insumos contra archivos subidos', () => {
    const rawRows: RawExcelManifestRow[] = [
      {
        codigo_predial: 'PREDIO-001',
        tipo_documento: 'estudio_titulos',
        nombre_archivo_esperado: 'Estudio_PREDIO-001.pdf',
        propietario_presunto: 'Carlos Alberto Ramírez'
      },
      {
        codigo_predial: 'PREDIO-002',
        tipo_documento: 'plano',
        nombre_archivo_esperado: 'Plano_PREDIO-002.pdf',
        propietario_presunto: 'María Teresa Gómez'
      },
      {
        codigo_predial: 'PREDIO-003',
        tipo_documento: 'estudio_titulos',
        // Sin nombre esperado exacto -> debe buscar por código predial
        propietario_presunto: 'Herederos Pedro Gómez'
      }
    ]

    const uploadedFiles = [
      'Estudio_PREDIO-001.pdf',
      'escaneo_predio-003_completo.pdf',
      'otro_documento_no_esperado.pdf'
    ]

    const result = processExcelManifestRows(rawRows, uploadedFiles)

    expect(result.totalRows).toBe(3)
    expect(result.matchedRows).toBe(2) // PREDIO-001 exacto y PREDIO-003 por código
    expect(result.unmatchedRows).toBe(1) // PREDIO-002 no subido
    expect(result.rows[0].isMatched).toBe(true)
    expect(result.rows[0].matchedFile).toBe('Estudio_PREDIO-001.pdf')
    expect(result.rows[1].isMatched).toBe(false)
    expect(result.rows[2].isMatched).toBe(true)
    expect(result.rows[2].matchedFile).toBe('escaneo_predio-003_completo.pdf')
  })

  it('detecta filas con datos faltantes o códigos duplicados en el manifiesto', () => {
    const problematicRows: RawExcelManifestRow[] = [
      {
        codigo_predial: '', // Fila sin código
        tipo_documento: 'plano'
      },
      {
        codigo_predial: 'PREDIO-DUP',
        tipo_documento: 'estudio_titulos'
      },
      {
        codigo_predial: 'PREDIO-DUP', // Duplicado
        tipo_documento: 'estudio_titulos'
      }
    ]

    const result = processExcelManifestRows(problematicRows, [])

    expect(result.totalRows).toBe(2)
    expect(result.discrepancies.length).toBe(2)
    expect(result.discrepancies[0]).toContain('Faltante de código predial')
    expect(result.discrepancies[1]).toContain('duplicado para el predio')
  })
})
