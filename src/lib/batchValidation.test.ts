import { describe, expect, it } from 'vitest'
import {
  analyzeBatchDuplicates,
  computeManifestSummary,
  extractPropertyCode,
  normalizePropertyCode,
  parseExpectedProperties,
  validateFileEntry,
} from './batchValidation'
import type { BatchItem, SourceDocument } from '../types'

describe('Reconocimiento de variantes de identificador predial (US-027)', () => {
  it('reconoce variantes con sufijo de letra como SAN-CIM-036A y SAN-CIM-036B sin fusionarlas', () => {
    const codeA = extractPropertyCode('Estudio_Titulos_SAN-CIM-036A.pdf')
    const codeB = extractPropertyCode('Estudio_Titulos_SAN-CIM-036B.pdf')
    const baseCode = extractPropertyCode('Estudio_Titulos_SAN-CIM-036.pdf')

    expect(codeA).toBe('SAN-CIM-036A')
    expect(codeB).toBe('SAN-CIM-036B')
    expect(baseCode).toBe('SAN-CIM-036')

    // Verificar que son estrictamente diferentes
    expect(codeA).not.toBe(codeB)
    expect(codeA).not.toBe(baseCode)
  })

  it('reconoce prefijos tipo Predio, Lote o Ficha con sufijos alfanuméricos', () => {
    expect(extractPropertyCode('Plano_Predio_12B_final.pdf')).toBe('12B')
    expect(extractPropertyCode('Ficha-Catastral-LOTE-04A.pdf')).toBe('LOTE-04A')
  })

  it('retorna cadena vacía cuando el archivo no incluye identificador predial', () => {
    expect(extractPropertyCode('anexo_fotografico_general.pdf')).toBe('')
    expect(extractPropertyCode('manual_de_procedimiento.docx')).toBe('')
  })
})

describe('Lista esperada de predios (US-021)', () => {
  it('parsea listas separadas por comas, saltos de línea y punto y coma eliminando duplicados', () => {
    const input = `
      SAN-CIM-001, SAN-CIM-002;
      SAN-CIM-036A
      SAN-CIM-036B,
      SAN-CIM-001
    `
    const parsed = parseExpectedProperties(input)

    expect(parsed).toEqual([
      'SAN-CIM-001',
      'SAN-CIM-002',
      'SAN-CIM-036A',
      'SAN-CIM-036B',
    ])
  })
})

describe('Validación integral de archivos de entrada (US-022)', () => {
  it('rechaza archivos vacíos con error crítico (0 bytes)', async () => {
    const emptyFile = new File([], 'archivo_vacio.pdf', { type: 'application/pdf' })
    const result = await validateFileEntry(emptyFile)

    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('0 bytes')
  })

  it('rechaza extensiones no permitidas', async () => {
    const exeFile = new File(['contenido'], 'script.exe', { type: 'application/x-msdownload' })
    const result = await validateFileEntry(exeFile)

    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('Formato no compatible')
  })

  it('acepta archivos válidos y calcula su hash SHA-256', async () => {
    const validFile = new File(['documento de prueba predial'], 'Estudio_001.pdf', {
      type: 'application/pdf',
    })
    const result = await validateFileEntry(validFile)

    expect(result.errors).toHaveLength(0)
    expect(result.hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('Detección y decisión sobre duplicados (US-023, US-024)', () => {
  it('detecta duplicados dentro del mismo lote', () => {
    const items: BatchItem[] = [
      {
        id: 'item-1',
        name: 'doc1.pdf',
        file: new File([], 'doc1.pdf'),
        size: 100,
        mimeType: 'application/pdf',
        sha256: 'a'.repeat(64),
        kind: 'estudio_titulos',
        propertyCode: 'SAN-001',
        errors: [],
        warnings: [],
        isDuplicate: false,
      },
      {
        id: 'item-2',
        name: 'doc1_copia.pdf',
        file: new File([], 'doc1_copia.pdf'),
        size: 100,
        mimeType: 'application/pdf',
        sha256: 'a'.repeat(64), // Mismo hash
        kind: 'estudio_titulos',
        propertyCode: 'SAN-001',
        errors: [],
        warnings: [],
        isDuplicate: false,
      },
    ]

    const analyzed = analyzeBatchDuplicates(items, [])
    expect(analyzed[0]?.isDuplicate).toBe(false)
    expect(analyzed[1]?.isDuplicate).toBe(true)
    expect(analyzed[1]?.duplicateSource).toBe('batch')
  })

  it('detecta duplicados contra documentos ya existentes en el expediente', () => {
    const existingDoc: SourceDocument = {
      id: 'doc-existente-1',
      projectId: 'proj-1',
      batchId: 'batch-prev',
      name: 'Estudio_Original.pdf',
      kind: 'estudio_titulos',
      size: 500,
      uploadedAt: '2026-01-01',
      sha256: 'b'.repeat(64),
    }

    const items: BatchItem[] = [
      {
        id: 'item-new',
        name: 'Nuevo_Estudio.pdf',
        file: new File([], 'Nuevo_Estudio.pdf'),
        size: 500,
        mimeType: 'application/pdf',
        sha256: 'b'.repeat(64),
        kind: 'estudio_titulos',
        propertyCode: 'SAN-002',
        errors: [],
        warnings: [],
        isDuplicate: false,
      },
    ]

    const analyzed = analyzeBatchDuplicates(items, [existingDoc])
    expect(analyzed[0]?.isDuplicate).toBe(true)
    expect(analyzed[0]?.duplicateSource).toBe('project')
    expect(analyzed[0]?.duplicateTargetName).toBe('Estudio_Original.pdf')
  })
})

describe('Manifiesto de insumos y bloqueo por errores críticos (US-028, US-029)', () => {
  it('bloquea el inicio del lote si hay errores críticos o duplicados sin decisión', () => {
    const items: BatchItem[] = [
      {
        id: 'it-1',
        name: 'vacio.pdf',
        file: new File([], 'vacio.pdf'),
        size: 0,
        mimeType: 'application/pdf',
        kind: 'estudio_titulos',
        propertyCode: 'SAN-001',
        errors: ['El archivo está vacío (0 bytes).'],
        warnings: [],
        isDuplicate: false,
      },
    ]

    const manifest = computeManifestSummary(items, ['SAN-001'])
    expect(manifest.criticalErrors).toBeGreaterThan(0)
    expect(manifest.canProcess).toBe(false)
  })

  it('calcula cobertura y predios faltantes frente a la lista esperada', () => {
    const items: BatchItem[] = [
      {
        id: 'it-1',
        name: 'SAN-001.pdf',
        file: new File([], 'SAN-001.pdf'),
        size: 1000,
        mimeType: 'application/pdf',
        sha256: '1'.repeat(64),
        kind: 'estudio_titulos',
        propertyCode: 'SAN-001',
        errors: [],
        warnings: [],
        isDuplicate: false,
      },
    ]

    const expected = ['SAN-001', 'SAN-002']
    const manifest = computeManifestSummary(items, expected)

    expect(manifest.expectedCount).toBe(2)
    expect(manifest.receivedCount).toBe(1)
    expect(manifest.coveragePercent).toBe(50)
    expect(manifest.missingProperties).toEqual(['SAN-002'])
    expect(manifest.criticalErrors).toBe(0)
    expect(manifest.canProcess).toBe(true)
  })
})
