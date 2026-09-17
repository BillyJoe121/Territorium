import { describe, it, expect } from 'vitest'
import {
  validateBatchUploadLimits,
  scanFileForThreats,
  createNewDocumentVersion
} from './storageSecurity'
import { ProjectConfiguration, SourceDocument } from '../types'

describe('storageSecurity (US-030, US-031, US-041, US-042)', () => {
  const mockConfig: ProjectConfiguration = {
    projectId: 'p1',
    sessionTimeoutMinutes: 60,
    mfaRequired: false,
    allowedWebOrigins: ['*'],
    maxFilesPerBatch: 5,
    maxBatchSizeMb: 10,
    allowedMimeTypes: ['application/pdf'],
    retentionDaysRaw: 365,
    retentionDaysDerivatives: 180,
    retentionDaysExports: 90,
    autoPurgeEnabled: false,
    budgetCapUsd: 500,
    budgetAlertThresholdPercent: 80
  }

  it('US-031: valida límites de lote (archivos máximos, tamaño total y extensiones)', () => {
    // 6 archivos cuando max es 5
    const files = [
      { name: '1.pdf', size: 1024 * 1024 },
      { name: '2.pdf', size: 1024 * 1024 },
      { name: '3.pdf', size: 1024 * 1024 },
      { name: '4.pdf', size: 1024 * 1024 },
      { name: '5.pdf', size: 1024 * 1024 },
      { name: '6.pdf', size: 1024 * 1024 }
    ]

    const resOverCount = validateBatchUploadLimits(files, mockConfig)
    expect(resOverCount.valid).toBe(false)
    expect(resOverCount.errors[0]).toContain('Límite de archivos excedido')

    // Archivo con extensión no permitida
    const invalidFormat = [{ name: 'malicious.exe', size: 500 }]
    const resBadFormat = validateBatchUploadLimits(invalidFormat, mockConfig)
    expect(resBadFormat.valid).toBe(false)
    expect(resBadFormat.errors[0]).toContain('formato no permitido')

    // Lote válido dentro de los límites
    const validBatch = [
      { name: 'estudio.pdf', size: 2 * 1024 * 1024 },
      { name: 'plano.pdf', size: 3 * 1024 * 1024 }
    ]
    const resValid = validateBatchUploadLimits(validBatch, mockConfig)
    expect(resValid.valid).toBe(true)
    expect(resValid.stats.fileCount).toBe(2)
    expect(resValid.stats.totalSizeMb).toBe(5)
  })

  it('US-041: detecta amenazas antivirus, cabeceras ejecutables y scripts embebidos', () => {
    // MZ header (ejecutable camuflado)
    const exeBuffer = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00])
    const exeScan = scanFileForThreats('falso_estudio.pdf', exeBuffer)
    expect(exeScan.scanStatus).toBe('infected')
    expect(exeScan.threatDetails).toContain('Cabecera ejecutable Win32/DOS')

    // Script malicioso
    const scriptBuffer = new TextEncoder().encode('<html><script>alert("xss")</script></html>')
    const scriptScan = scanFileForThreats('documento.docx', scriptBuffer)
    expect(scriptScan.scanStatus).toBe('quarantined')
    expect(scriptScan.threatDetails).toContain('script malicioso')

    // Archivo limpio
    const cleanBuffer = new TextEncoder().encode('%PDF-1.7 Estudio de titulos predio La Esperanza')
    const cleanScan = scanFileForThreats('estudio_limpio.pdf', cleanBuffer)
    expect(cleanScan.scanStatus).toBe('clean')
    expect(cleanScan.threatDetails).toBeNull()
  })

  it('US-030: versiona documentos preservando historial y marcando la versión vigente', () => {
    const doc: SourceDocument = {
      id: 'doc-100',
      projectId: 'p1',
      batchId: 'b1',
      name: 'Estudio_Titulos_V1.pdf',
      kind: 'estudio_titulos',
      size: 5000,
      uploadedAt: '2026-01-01'
    }

    // Version 1
    const { version: v1, updatedVersions: list1 } = createNewDocumentVersion(
      doc,
      'path/v1.pdf',
      'Estudio_Titulos_V1.pdf',
      5000,
      'sha-1',
      [],
      'Carga inicial'
    )
    expect(v1.versionNumber).toBe(1)
    expect(v1.isCurrent).toBe(true)

    // Version 2
    const { version: v2, updatedVersions: list2 } = createNewDocumentVersion(
      doc,
      'path/v2.pdf',
      'Estudio_Titulos_V2_Corregido.pdf',
      6200,
      'sha-2',
      list1,
      'Corrección de linderos aportada por cliente'
    )
    expect(v2.versionNumber).toBe(2)
    expect(v2.isCurrent).toBe(true)

    // La versión 1 ahora debe estar como no vigente
    const v1InList2 = list2.find(v => v.versionNumber === 1)
    expect(v1InList2?.isCurrent).toBe(false)
    expect(list2.length).toBe(2)
  })
})
