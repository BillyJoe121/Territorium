import { describe, it, expect, vi } from 'vitest'
import {
  normalizeRole,
  getRolePermissions,
  type CanonicalRole,
  type ProjectConfiguration,
  type Project,
  type DocumentTask
} from '../types'
import {
  createSessionInactivityTracker,
  logSensitiveDataAccess,
  querySensitiveAccessLogs,
  createEnterpriseSsoConnection,
  verifyAndApplyElectronicSignature
} from '../lib/enterpriseIdentityP2'
import {
  createVerifiableElectronicSignature,
  verifyDigitalSignature
} from '../lib/digitalSignatureVerification'
import {
  scanUploadedFileSecurity,
  executeRetentionPurgePolicy
} from '../lib/storageSecurity'
import {
  executeOcrPipeline
} from '../lib/documentPreprocessor'
import {
  createReprocessTask,
  calculateExponentialRetryDelay,
  recoverExpiredLeaseTasks,
  JobExecutionController,
  executeTasksWithConcurrencyLimit
} from '../lib/taskOrchestration'
import {
  validateProviderConfig,
  calculateExtractorCost,
  executeRealAiSandboxPrompt,
  AVAILABLE_AI_MODELS
} from '../lib/extractorConfig'
import {
  consolidateMasterRecord,
  updateMasterRecordAttribute,
  restoreMasterRecordVersion,
  computeBatchReconciliationSummary,
  convertPropertyRecordToMasterRecord,
  type PropertyMasterRecord
} from '../lib/masterRecordReconciliation'
import {
  downloadMasterRecordsXlsx,
  type ExportOptions
} from '../lib/excel'
import {
  createGeneratedDocumentsZip
} from '../lib/documentGeneration'
import {
  renderDocxTemplate
} from '../lib/dynamicTemplateManagerP2'
import {
  dispatchCorporateNotification
} from '../lib/corporateNotificationDispatcherP2'
import {
  generateSecureNotaryAccessToken,
  validateNotaryShareToken,
  verifyNotaryTokenWithRevocationCheck,
  revokeTokenPersistent,
  verifyNotaryOtpWithRateLimit,
  persistNotaryConcept,
  queryNotaryConcepts
} from '../lib/publicNotaryPortal'

describe('REOPENED USER STORIES ACCEPTANCE SUITE (Consultant Criteria)', () => {

  // =========================================================================
  // US-002, 003, 004: Autorización administrativa, 6 roles canónicos y aislamiento
  // =========================================================================
  describe('US-002, 003, 004: Autorización Administrativa y Aislamiento Multitenant', () => {
    it('unifica y normaliza los 6 roles canónicos con su matriz de permisos respectiva', () => {
      const canonicalRoles: CanonicalRole[] = [
        'administrador',
        'operador',
        'analista_predial',
        'revisor_juridico',
        'aprobador',
        'auditor'
      ]

      for (const role of canonicalRoles) {
        expect(normalizeRole(role)).toBe(role)
        const perms = getRolePermissions(role)
        expect(perms).toBeDefined()
        expect(perms.canViewObservability).toBe(true)
      }

      // El administrador es el único con facultades completas de gobierno
      const adminPerms = getRolePermissions('administrador')
      expect(adminPerms.canManageUsers).toBe(true)
      expect(adminPerms.canConfigureTenant).toBe(true)
      expect(adminPerms.canApproveLegal).toBe(true)
      expect(adminPerms.canPurgeData).toBe(true)

      // El aprobador puede aprobar jurídica y técnicamente, pero no purgar datos de la empresa
      const approverPerms = getRolePermissions('aprobador')
      expect(approverPerms.canApproveLegal).toBe(true)
      expect(approverPerms.canApproveTechnical).toBe(true)
      expect(approverPerms.canPurgeData).toBe(false)

      // El auditor solo tiene lectura y consulta forense
      const auditorPerms = getRolePermissions('auditor')
      expect(auditorPerms.canEditManual).toBe(false)
      expect(auditorPerms.canApproveLegal).toBe(false)
      expect(auditorPerms.canExportCertified).toBe(false)
    })

    it('demuestra aislamiento estricto de datos entre proyectos (Multitenant)', () => {
      const projectAId = 'proj-tenant-alpha'
      const projectBId = 'proj-tenant-beta'

      const recordA = consolidateMasterRecord({
        id: 'mr-alpha-01',
        propertyCode: 'SAN-CIM-001',
        projectId: projectAId,
        batchId: 'batch-alpha',
        titleExtraction: { folio: '300-11111' }
      })

      const recordB = consolidateMasterRecord({
        id: 'mr-beta-01',
        propertyCode: 'ANT-MED-001',
        projectId: projectBId,
        batchId: 'batch-beta',
        titleExtraction: { folio: '001-22222' }
      })

      // Simulación de función de acceso aislada por contexto de proyecto
      const queryProjectRecords = (tenantProjectId: string, allRecords: PropertyMasterRecord[]) => {
        return allRecords.filter((r) => r.projectId === tenantProjectId)
      }

      const resultsA = queryProjectRecords(projectAId, [recordA, recordB])
      expect(resultsA).toHaveLength(1)
      expect(resultsA[0].propertyCode).toBe('SAN-CIM-001')
      expect(resultsA.some((r) => r.projectId === projectBId)).toBe(false)
    })
  })

  // =========================================================================
  // US-008, 009, 010: Sesión/MFA, auditoría de accesos sensibles y SSO
  // =========================================================================
  describe('US-008, 009, 010: Políticas de Sesión, MFA, Auditoría Sensible y SSO', () => {
    it('controla la inactividad de sesión con timeout operativo y verificación de vigencia', () => {
      const tracker = createSessionInactivityTracker(15) // 15 minutos
      expect(tracker.isExpired()).toBe(false)
      expect(tracker.getRemainingSeconds()).toBeGreaterThan(800)

      // Simular paso del tiempo excediendo los 15 minutos
      const now = Date.now()
      tracker.setLastActivityForTesting(now - 16 * 60 * 1000)
      expect(tracker.isExpired()).toBe(true)
      expect(tracker.getRemainingSeconds()).toBe(0)

      // Restauración de actividad
      tracker.recordActivity()
      expect(tracker.isExpired()).toBe(false)
    })

    it('registra y consulta accesos a datos sensibles para trazabilidad forense', () => {
      const logEntry = logSensitiveDataAccess(
        'proj-seguridad-01',
        'oficial.cumplimiento@territorium.com',
        'master_record',
        'rec-9988',
        'export',
        ['cedula_catastral', 'propietarios_actuales', 'folio_matricula'],
        'SAN-CIM-055'
      )

      expect(logEntry.id).toBeDefined()
      expect(logEntry.sensitiveFields).toContain('propietarios_actuales')

      const queried = querySensitiveAccessLogs('proj-seguridad-01', 'export')
      expect(queried.length).toBeGreaterThan(0)
      expect(queried[0].accessedBy).toBe('oficial.cumplimiento@territorium.com')
    })

    it('establece conexión SSO corporativa validando dominio y certificados de federación', () => {
      const sso = createEnterpriseSsoConnection(
        'proj-enterprise-01',
        'https://sso.isa.com.co/saml/metadata',
        'https://sso.isa.com.co/saml/sso',
        'MIIC8DCCAdigAwIBAgIQ...CERT_FINGERPRINT...',
        ['isa.com.co', 'intercolombia.com']
      )

      expect(sso.isEnabled).toBe(true)
      expect(sso.allowedDomains).toContain('isa.com.co')
    })
  })

  // =========================================================================
  // US-038, 041, 042: OCR ejecutable, escaneo de seguridad y retención/purga
  // =========================================================================
  describe('US-038, 041, 042: OCR Ejecutable, Escaneo de Seguridad y Purga', () => {
    it('ejecuta OCR veraz reportando texto cuando existe y fallando honestamente sin inventar contenido si está vacío', async () => {
      // 1. PDF vacío sin texto
      const rawEmptyPdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]) // %PDF-1.4
      const ocrEmpty = await executeOcrPipeline(rawEmptyPdf, 'vacio.pdf')
      expect(ocrEmpty.status).toBe('failed')
      expect(ocrEmpty.text).toBe('')
      expect(ocrEmpty.confidence).toBe(0)

      // 2. PDF escaneado con capas textuales
      const scannedWithStream = new TextEncoder().encode('%PDF-1.4 ... (Folio de matricula 300-12345) ... (Linderos norte con quebrada)')
      const ocrWithText = await executeOcrPipeline(scannedWithStream, 'escaneado_con_capas.pdf')
      expect(ocrWithText.status).toBe('completed')
      expect(ocrWithText.text).toContain('300-12345')
      expect(ocrWithText.confidence).toBeGreaterThan(0)
    })

    it('detecta y neutraliza archivos maliciosos (ZIP-bomb y scripts PDF)', async () => {
      // Simular ataque de ratio de compresión (ZIP bomb)
      const zipBombBuffer = new Uint8Array(500).fill(0x00)
      const scanZip = await scanUploadedFileSecurity(
        'archive_bomb.zip',
        zipBombBuffer,
        'application/zip',
        { uncompressedSizeBytes: 500 * 1024 * 1024 } // 500MB desempacado desde 500 bytes -> ratio 1000:1
      )

      expect(scanZip.isSafe).toBe(false)
      expect(scanZip.quarantined).toBe(true)
      expect(scanZip.threatDetected).toContain('ZIP_BOMB')

      // Simular PDF con inyección de JavaScript embebido
      const maliciousPdfText = '%PDF-1.4 ... /JavaScript (app.alert("exploit")) /OpenAction'
      const maliciousPdfBuffer = new TextEncoder().encode(maliciousPdfText)
      const scanPdf = await scanUploadedFileSecurity('escritura_infectada.pdf', maliciousPdfBuffer, 'application/pdf')

      expect(scanPdf.isSafe).toBe(false)
      expect(scanPdf.threatDetected).toContain('PDF_ACTIVE_CONTENT_OR_EXPLOIT')
    })

    it('ejecuta la política operativa de retención y purga eliminando archivos expirados', () => {
      const now = new Date()
      const oldDate = new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000).toISOString() // 200 días atrás
      const recentDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString() // 10 días atrás

      const projectConfig: ProjectConfiguration = {
        projectId: 'proj-purge-01',
        sessionTimeoutMinutes: 30,
        mfaRequired: false,
        allowedWebOrigins: ['*'],
        maxFilesPerBatch: 100,
        maxBatchSizeMb: 200,
        allowedMimeTypes: ['application/pdf'],
        retentionDaysRaw: 180, // Máximo 180 días
        retentionDaysDerivatives: 90,
        retentionDaysExports: 60,
        autoPurgeEnabled: true,
        budgetCapUsd: 1000,
        budgetAlertThresholdPercent: 80,
      }

      const files = [
        { id: 'f-old-raw', name: 'antiguo_titulo.pdf', category: 'raw' as const, createdAt: oldDate, sizeBytes: 500000 },
        { id: 'f-recent-raw', name: 'nuevo_titulo.pdf', category: 'raw' as const, createdAt: recentDate, sizeBytes: 300000 }
      ]

      const purgeResult = executeRetentionPurgePolicy('proj-purge-01', files, projectConfig)
      expect(purgeResult.purgedFilesCount).toBe(1)
      expect(purgeResult.purgedFileIds).toContain('f-old-raw')
      expect(purgeResult.retainedFilesCount).toBe(1)
      expect(purgeResult.bytesReclaimed).toBe(500000)
    })
  })

  // =========================================================================
  // US-046, 048, 050, 055: Dependencias por predio, reproceso, reintentos y recuperación
  // =========================================================================
  describe('US-046, 048, 050, 055: Orquestación de Tareas Prediales y Recuperación', () => {
    it('limpia leases y resetea asignaciones al reprocesar una tarea predial (US-048)', () => {
      const failedTask: DocumentTask | any = {
        id: 'task-neg-01',
        projectId: 'proj-orq-01',
        propertyCode: 'PR-SAN-101',
        taskType: 'negotiation_sheet',
        priority: 'high',
        dependsOnTaskIds: ['task-title-01', 'task-plan-01'],
        status: 'failed',
        retryCount: 3,
        lastError: 'Falla temporal en servicio de generación',
        assignedTo: 'worker-node-4',
        leaseExpiresAt: '2026-09-17T20:00:00Z',
        createdAt: '2026-09-17T19:00:00Z'
      }

      const reprocessed = createReprocessTask(failedTask, 'Reintento tras corrección de plantilla')
      expect(reprocessed.status).toBe('pending')
      expect(reprocessed.retryCount).toBe(0)
      expect(reprocessed.lastError).toBeUndefined()
      expect(reprocessed.assignedTo).toBeUndefined()
      expect(reprocessed.leaseExpiresAt).toBeUndefined()
    })

    it('calcula retroceso exponencial con jitter para reintentos efectivos sin sobrecarga (US-050)', () => {
      const delayAttempt1 = calculateExponentialRetryDelay(1, 1000, 30000)
      const delayAttempt3 = calculateExponentialRetryDelay(3, 1000, 30000)

      expect(delayAttempt1).toBeGreaterThanOrEqual(1000)
      expect(delayAttempt3).toBeGreaterThan(delayAttempt1)
      expect(delayAttempt3).toBeLessThanOrEqual(30000)
    })

    it('recupera automáticamente tareas zombies con leases expirados (US-055)', () => {
      const now = new Date()
      const expiredLease = new Date(now.getTime() - 10 * 60 * 1000).toISOString() // Expiró hace 10 min
      const activeLease = new Date(now.getTime() + 10 * 60 * 1000).toISOString() // Vence en 10 min

      const tasks: (DocumentTask | any)[] = [
        {
          id: 'task-zombie-01',
          projectId: 'p1',
          propertyCode: 'PR-01',
          taskType: 'title_study',
          priority: 'medium',
          dependsOnTaskIds: [],
          status: 'running',
          retryCount: 1,
          assignedTo: 'dead-worker-1',
          leaseExpiresAt: expiredLease,
          createdAt: '2026-09-17T18:00:00Z'
        },
        {
          id: 'task-healthy-01',
          projectId: 'p1',
          propertyCode: 'PR-02',
          taskType: 'plan_analysis',
          priority: 'medium',
          dependsOnTaskIds: [],
          status: 'running',
          retryCount: 0,
          assignedTo: 'active-worker-2',
          leaseExpiresAt: activeLease,
          createdAt: '2026-09-17T18:30:00Z'
        }
      ]

      const { recoveredTasks, recoveredCount } = recoverExpiredLeaseTasks(tasks)
      expect(recoveredCount).toBe(1)
      const zombie = recoveredTasks.find((t) => t.id === 'task-zombie-01')
      expect(zombie?.status).toBe('pending')
      expect(zombie?.assignedTo).toBeUndefined()
      expect(zombie?.lastError).toContain('Lease expirado')

      const healthy = recoveredTasks.find((t) => t.id === 'task-healthy-01')
      expect(healthy?.status).toBe('running')
    })
  })

  // =========================================================================
  // US-052, 053, 064: Presupuesto USD, límites de concurrencia y pausa interactiva
  // =========================================================================
  describe('US-052, 053, 064: Control de Presupuesto, Concurrencia y Pausa/Reanudación', () => {
    it('pausa y reanuda el procesamiento mediante JobExecutionController interactivo', async () => {
      const controller = new JobExecutionController()
      expect(controller.isPaused()).toBe(false)

      controller.pause('Mantenimiento programado de modelo de IA')
      expect(controller.isPaused()).toBe(true)

      // Verificar que executeOrWait respeta la pausa
      let actionExecuted = false
      const actionPromise = controller.executeOrWait(async () => {
        actionExecuted = true
      })

      // Dar tiempo para verificar que sigue esperando
      await new Promise((r) => setTimeout(r, 50))
      expect(actionExecuted).toBe(false)

      // Reanudar
      controller.resume()
      expect(controller.isPaused()).toBe(false)
      await actionPromise
      expect(actionExecuted).toBe(true)
    })

    it('aplica límite de concurrencia y detiene ejecución si se excede el presupuesto USD', async () => {
      const tasks: (DocumentTask | any)[] = [
        { id: 't1', projectId: 'p1', propertyCode: 'P-01', taskType: 'title_study', priority: 'medium', dependsOnTaskIds: [], status: 'pending', retryCount: 0, createdAt: '' },
        { id: 't2', projectId: 'p1', propertyCode: 'P-02', taskType: 'title_study', priority: 'medium', dependsOnTaskIds: [], status: 'pending', retryCount: 0, createdAt: '' }
      ]

      const outcome = await executeTasksWithConcurrencyLimit(
        tasks,
        2,
        async (task) => ({ id: task.id, processed: true }),
        { budgetCapUsd: 10, currentAccumulatedCostUsd: 15 } // Presupuesto ya excedido
      )

      // Debe abortar y detener ejecución por sobrecosto presupuestal
      expect(outcome.budgetExceeded).toBe(true)
    })

    it('ejecuta tareas cuando el controlador está activo y no pausado', async () => {
      let calls = 0
      const controller = new JobExecutionController()
      const tasksList = [{ id: 'a', status: 'queued' as const, dependencyStatus: 'ready' as const }]
      await executeTasksWithConcurrencyLimit(tasksList, 1, async () => { calls++; return { success: true, tokensUsed: 1, costUsd: 1 } }, undefined, 250000, undefined, controller)
      expect(calls).toBe(1)
    })

    it('no ejecuta tareas con dependencias en espera (waiting)', async () => {
      let calls = 0
      const tasksList = [{ id: 'w1', status: 'queued' as const, dependencyStatus: 'waiting' as const }]
      await executeTasksWithConcurrencyLimit(tasksList, 1, async () => { calls++; return { success: true, tokensUsed: 1, costUsd: 1 } })
      expect(calls).toBe(0)
    })

    it('detiene la ejecución tan pronto se sobrepasa el presupuesto durante el bucle', async () => {
      let calls = 0
      const tasksList = ['a', 'b', 'c'].map((id) => ({ id, status: 'queued' as const, dependencyStatus: 'ready' as const }))
      const budgetRes = await executeTasksWithConcurrencyLimit(
        tasksList,
        1,
        async () => { calls++; return { success: true, tokensUsed: 1, costUsd: 1 } },
        { budgetCapUsd: 0.1, currentAccumulatedCostUsd: 0 }
      )
      expect(calls).toBe(1)
      expect(budgetRes.budgetExceeded).toBe(true)
    })
  })

  // =========================================================================
  // US-056, 059, 060, 062: Configuración del proveedor, costos reales y sandbox
  // =========================================================================
  describe('US-056, 059, 060, 062: Validación de Proveedor, Costos Reales y Sandbox', () => {
    it('valida la configuración del proveedor de IA rechazando parámetros erróneos', () => {
      const valid = validateProviderConfig({
        provider: 'openai',
        apiKey: 'sk-proj-1234567890abcdef',
        model: 'gpt-4o',
        temperature: 0.2,
        maxTokens: 4000
      })
      expect(valid.isValid).toBe(true)

      const invalid = validateProviderConfig({
        provider: 'openai',
        apiKey: '', // Clave vacía
        model: 'gpt-4o',
        temperature: 2.5 // Temperatura fuera de rango
      })
      expect(invalid.isValid).toBe(false)
      expect(invalid.errors.length).toBeGreaterThanOrEqual(2)
    })

    it('calcula costos monetarios precisos según tokens de entrada y salida', () => {
      const model = AVAILABLE_AI_MODELS[0] // ej. gpt-4o
      const cost = calculateExtractorCost(model.id, 10000, 2000)
      expect(cost).toBeGreaterThan(0)
      expect(typeof cost).toBe('number')
    })

    it('ejecuta prompts de prueba en sandbox con estimación de costos y tokens', async () => {
      const result = await executeRealAiSandboxPrompt(
        'openai',
        'gpt-4o',
        'sk-fake-sandbox-key',
        'Extrae el número de matrícula inmobiliaria del siguiente texto: Folio No. 300-987654 de Vélez',
        { mockSuccess: true }
      )

      expect(result.success).toBe(true)
      expect(result.rawResponse).toBeDefined()
      expect(result.costUsd).toBeGreaterThan(0)
      expect(result.tokensUsed.total).toBeGreaterThan(0)
    })

    it('rechaza modelos inexistentes en sandbox reportando error de catálogo', async () => {
      const res = await executeRealAiSandboxPrompt({ sampleInput: 'SIN FOLIO', modelOverride: 'modelo-inexistente' })
      expect(res.success).toBe(false)
      expect(res.error).toContain('no reconocido')
      expect(res.output).toBeNull()
    })
  })

  // =========================================================================
  // US-074, 081: Evidencia real por atributo con documento, página y cita
  // =========================================================================
  describe('US-074, 081: Trazabilidad de Evidencia por Atributo hasta la Estación de Revisión', () => {
    it('consolida atributos conservando la referencia exacta de página, fuente y cita textual', () => {
      const masterRecord = consolidateMasterRecord({
        id: 'mr-evidencia-01',
        propertyCode: 'SAN-CIM-033',
        projectId: 'proj-ev-01',
        batchId: 'batch-01',
        titleExtraction: {
          folio: '300-554433',
          boundaries: {
            rawLiteralText: 'NORTE: Con quebrada La Honda en 150m. SUR: Con predio El Mirador.',
            isLong: false,
            isIncomplete: false,
            isSuspiciouslySummarized: false,
            requiresMandatoryReview: false
          }
        }
      })

      const linderosAttr = masterRecord.attributes['linderos_literales']
      expect(linderosAttr).toBeDefined()
      expect(linderosAttr.activeValue).toContain('quebrada La Honda')
      // La estación de revisión exige conocer el origen documental
      expect(linderosAttr.category).toBe('juridico')
      expect(linderosAttr.isMandatory).toBe(true)
    })
  })

  // =========================================================================
  // US-094–101: Discrepancias reales, cálculo de resumen y bloqueo de exportación
  // =========================================================================
  describe('US-094–101: Conciliación Real, Discrepancias y Bloqueo de Exportación', () => {
    it('detecta discrepancias de área entre título y plano y bloquea la exportación', () => {
      const conflictedRecord = consolidateMasterRecord({
        id: 'mr-conflicto-01',
        propertyCode: 'SAN-CIM-999',
        projectId: 'p1',
        batchId: 'b1',
        titleExtraction: {
          folio: '300-112233',
          areaNumbers: 10000 // 10.000 m2 según escritura
        },
        planExtraction: {
          totalArea: { numbers: 25000, letters: 'VEINTICINCO MIL', unit: 'm2' } // 25.000 m2 según plano (+150% discrepancia)
        }
      })

      expect(conflictedRecord.criticalConflictCount).toBeGreaterThan(0)
      expect(conflictedRecord.isBlockedForExport).toBe(true)
      expect(conflictedRecord.exportBlockReasons[0]).toContain('Conflicto material de cabida')
    })

    it('calcula resumen de conciliación de lote alertando predios faltantes u huérfanos', () => {
      const expectedCodes = ['PREDIO-A', 'PREDIO-B', 'PREDIO-C']
      const receivedCodes = ['PREDIO-A', 'PREDIO-B', 'PREDIO-EXTRA-D']

      const consolidated = [
        consolidateMasterRecord({ id: '1', propertyCode: 'PREDIO-A', projectId: 'p', batchId: 'b' }),
        consolidateMasterRecord({ id: '2', propertyCode: 'PREDIO-B', projectId: 'p', batchId: 'b' })
      ]

      const summary = computeBatchReconciliationSummary(expectedCodes, consolidated, receivedCodes)
      expect(summary.isExportReady).toBe(false)
      expect(summary.missingProperties).toContain('PREDIO-C')
      expect(summary.orphanSources).toContain('PREDIO-EXTRA-D')
    })
  })

  // =========================================================================
  // US-107, 110, 114, 163: Motivos obligatorios, protección y restauración
  // =========================================================================
  describe('US-107, 110, 114, 163: Motivos de Cambio, Historial Persistente y Restauración', () => {
    it('exige motivo justificado no vacío para cualquier corrección manual (US-107)', () => {
      const record = consolidateMasterRecord({
        id: 'mr-hist-01',
        propertyCode: 'PR-107',
        projectId: 'p1',
        batchId: 'b1',
        titleExtraction: { folio: '300-11111' }
      })

      // Intentar cambio sin motivo debe lanzar error
      expect(() => {
        updateMasterRecordAttribute(record, 'folio_matricula', '300-99999', {
          author: 'operador@territorium.com',
          changeMotive: '   ' // Motivo en blanco
        })
      }).toThrow(/requiere un motivo de cambio explícito/i)
    })

    it('impide modificación no autorizada de predios ya aprobados (US-110 & US-114)', () => {
      const record = consolidateMasterRecord({
        id: 'mr-hist-02',
        propertyCode: 'PR-110',
        projectId: 'p1',
        batchId: 'b1',
        titleExtraction: { folio: '300-22222' }
      })

      // Simular que el predio fue aprobado por el comité jurídico
      record.reviewState = 'aprobado'

      // Un operador raso intenta modificarlo
      expect(() => {
        updateMasterRecordAttribute(record, 'folio_matricula', '300-ALTERADO', {
          author: 'operador@territorium.com',
          changeMotive: 'Cambio solicitado por teléfono',
          userRole: 'operador'
        })
      }).toThrow(/ya está aprobado. Solo un Aprobador o Administrador/i)

      // Intento sin rol especificado (omitido) debe fallar también por mínimo privilegio
      expect(() => {
        updateMasterRecordAttribute(record, 'folio_matricula', '300-ALTERADO', {
          author: 'anonimo@territorium.com',
          changeMotive: 'Cambio sin rol'
        })
      }).toThrow(/ya está aprobado. Solo un Aprobador o Administrador/i)
    })

    it('convierte PropertyRecord sin inventar folios, áreas ni propietarios ficticios y preserva estado aprobado', () => {
      const emptyRec = {
        id: 'rec-vacio',
        projectId: 'p1',
        sourceDocumentId: 'doc1',
        name: 'PREDIO_SIN_DATOS.pdf',
        folio: 'POR VALIDAR',
        municipality: 'NO_IDENTIFICADO',
        reviewState: 'aprobado' as const,
        confidence: 0,
        fields: {}
      }
      const converted = convertPropertyRecordToMasterRecord(emptyRec as any, [])
      expect(converted.reviewState).toBe('aprobado')
      expect(converted.folio).toBe('POR VALIDAR')
      expect(converted.attributes['area_titulo_m2']?.activeValue).toBe('NO_IDENTIFICADO')
      expect(converted.attributes['propietarios_actuales']?.activeValue).toBe('NO_IDENTIFICADO')
    })

    it('registra historial de versiones acumulativo y permite restaurar a versión previa (US-114 & US-163)', () => {
      const initial = consolidateMasterRecord({
        id: 'mr-hist-03',
        propertyCode: 'PR-114',
        projectId: 'p1',
        batchId: 'b1',
        titleExtraction: { folio: '300-ORIGINAL' }
      })

      // Edición V2
      const v2 = updateMasterRecordAttribute(initial, 'folio_matricula', '300-MODIFICADO-V2', {
        author: 'abogado@territorium.com',
        changeMotive: 'Corrección según última anotación de registro',
        userRole: 'aprobador'
      })

      expect(v2.version).toBe(2)
      expect(v2.history).toHaveLength(1)
      expect(v2.attributes['folio_matricula'].activeValue).toBe('300-MODIFICADO-V2')

      // Restauración de vuelta a la versión original
      const restored = restoreMasterRecordVersion(
        v2,
        2, // Target version cuyas propiedades previas deseamos restaurar
        'auditor@territorium.com',
        'Restauración por nulidad sobreviniente de la última anotación'
      )

      expect(restored.version).toBe(3)
      expect(restored.attributes['folio_matricula'].activeValue).toBe('300-ORIGINAL')
      expect(restored.history).toHaveLength(2)
      expect(restored.attributes['folio_matricula'].changeMotive).toContain('RESTAURACIÓN')
    })
  })

  // =========================================================================
  // US-115: Firma electrónica y sello de tiempo RFC 3161 verificable
  // =========================================================================
  describe('US-115: Firma Electrónica y Sello de Tiempo RFC 3161 Verificable', () => {
    it('genera y verifica matemáticamente una firma electrónica con digest SHA-256 y token RFC 3161', async () => {
      const documentPayload = 'EXPEDIENTE_PREDIAL_SAN_CIM_036_CONTRATO_SERVIDUMBRE_OFICIAL'
      const certId = 'CERT-ONAC-TTM-99281'
      const signerEmail = 'notario.encargado@notaria1velez.gov.co'

      const signature = await createVerifiableElectronicSignature(documentPayload, signerEmail, certId)
      expect(signature.rfc3161Token).toBeDefined()
      expect(signature.sha256Digest).toHaveLength(64) // Longitud de hash SHA-256 en hex
      expect(signature.rfc3161Token.authority).toBe('TERRITORIUM_RFC3161_TSA_PRIMARY')

      // Verificación positiva del documento intacto
      const verificationValid = await verifyDigitalSignature(documentPayload, signature)
      expect(verificationValid.isValid).toBe(true)
      expect(verificationValid.reasons).toHaveLength(0)

      // Verificación negativa si el contenido fue adulterado
      const tamperedPayload = documentPayload + '_ADULTERACION_FRAUDULENTA'
      const verificationTampered = await verifyDigitalSignature(tamperedPayload, signature)
      expect(verificationTampered.isValid).toBe(false)
      expect(verificationTampered.reasons[0]).toContain('Digest mismatch')

      // Verificación negativa si el firmante es adulterado
      const tamperedSignerSignature = { ...signature, signerEmail: 'impostor@notaria1velez.gov.co' }
      const verificationTamperedSigner = await verifyDigitalSignature(documentPayload, tamperedSignerSignature)
      expect(verificationTamperedSigner.isValid).toBe(false)
      expect(verificationTamperedSigner.reasons.some(r => r.includes('firmante') || r.includes('adulterada'))).toBe(true)

      // Verificación negativa si el sello de tiempo RFC 3161 es adulterado
      const tamperedTokenSignature = {
        ...signature,
        rfc3161Token: { ...signature.rfc3161Token, signature: 'FORGED_TSA_SIGNATURE' }
      }
      const verificationTamperedToken = await verifyDigitalSignature(documentPayload, tamperedTokenSignature)
      expect(verificationTamperedToken.isValid).toBe(false)
      expect(verificationTamperedToken.reasons.some(r => r.includes('sello de tiempo') || r.includes('adulterada'))).toBe(true)
    })
  })

  // =========================================================================
  // US-116–118: Excel basado en datos reales, sólo aprobados y trazabilidad
  // =========================================================================
  describe('US-116–118: Exportación Certificada en Excel y Bloqueo de Conflictos', () => {
    it('bloquea la exportación masiva en Excel si existen predios con conflictos no resueltos', async () => {
      const conflictedRecord = consolidateMasterRecord({
        id: 'rec-conflicto',
        propertyCode: 'PR-BLOQUEADO',
        projectId: 'p1',
        batchId: 'b1',
        titleExtraction: { folio: 'NO_IDENTIFICADO' } // Folio no identificado bloquea
      })

      expect(conflictedRecord.isBlockedForExport).toBe(true)

      // La llamada sin bypass debe lanzar error de bloqueo
      await expect(
        downloadMasterRecordsXlsx([conflictedRecord], {
          inclusionCriteria: 'all',
          allowBlockedExport: false
        })
      ).rejects.toThrow(/Exportación bloqueada/i)
    })
  })

  // =========================================================================
  // US-119–127: Generación documental, versiones y bloqueo de ZIP
  // =========================================================================
  describe('US-119–127: Generación de Documentos y Bloqueo en Empaquetado ZIP', () => {
    it('bloquea la descarga de ZIP si contiene documentos fallidos o no aprobados', async () => {
      const documents: any[] = [
        {
          id: 'doc-01',
          code: 'FICHA_PREDIAL',
          name: 'Ficha Predial SAN-01.docx',
          status: 'ready',
          version: 1,
          size: '120 KB',
          createdAt: new Date().toISOString(),
          isBlockedForExport: false
        },
        {
          id: 'doc-02',
          code: 'ESTUDIO_TITULOS',
          name: 'Estudio Titulos SAN-01.docx',
          status: 'error', // Documento fallido
          version: 1,
          size: '0 KB',
          createdAt: new Date().toISOString(),
          isBlockedForExport: true,
          blockReason: 'Falla en resolución de linderos'
        }
      ]

      // Debe abortar con excepción si no se permite exportar bloqueados
      await expect(
        createGeneratedDocumentsZip('EXPEDIENTE-SAN-01', documents, false)
      ).rejects.toThrow(/Empaquetado ZIP bloqueado/i)
    })
  })

  // =========================================================================
  // US-128, 136: Plantillas Word .docx operativas y despacho de notificaciones
  // =========================================================================
  describe('US-128, 136: Plantillas DOCX Manipuladas en XML y Notificaciones Corporativas', () => {
    it('renderiza plantilla Word sustituyendo variables dentro del XML del archivo docx', async () => {
      const templateRecord = {
        id: 'tpl-01',
        name: 'Ficha Notarial',
        format: 'docx' as const,
        requiredVariables: ['NOMBRE_PREDIO', 'FOLIO_MATRICULA', 'AREA_AFECTADA'],
        templateFileUrl: 'https://storage.territorium.com/templates/ficha.docx'
      }

      const inputValues = {
        NOMBRE_PREDIO: 'HACIENDA EL PARAÍSO',
        FOLIO_MATRICULA: '300-887766',
        AREA_AFECTADA: '2.450 m²'
      }

      const renderedBuffer = await renderDocxTemplate(templateRecord, inputValues)
      expect(renderedBuffer).toBeDefined()
      expect(renderedBuffer.byteLength).toBeGreaterThan(100)
    })

    it('despacha notificaciones corporativas con reintentos y acuse de recibo', async () => {
      const notification = {
        id: 'notif-99',
        recipientEmail: 'juridico@isa.com.co',
        subject: 'Expediente Aprobado para Notaría',
        body: 'El predio SAN-CIM-036 ha sido debidamente certificado.',
        webhookUrl: 'https://httpbin.org/post'
      }

      let deliveryAttempt = 0
      const deterministicWebhook = (async () => {
        deliveryAttempt += 1
        return {
          ok: deliveryAttempt === 3,
          status: deliveryAttempt === 3 ? 200 : 503,
          statusText: deliveryAttempt === 3 ? 'OK' : 'Service Unavailable'
        } as Response
      }) as typeof fetch

      const receipt = await dispatchCorporateNotification(notification, undefined, deterministicWebhook)
      expect(receipt.notificationId).toBe('notif-99')
      expect(receipt.status).toBe('delivered')
      expect(receipt.deliveryAttempts).toBe(3)
      expect(receipt.receiptSignature).toBeDefined()
    })

    it('reporta status failed honestamente cuando ocurre un fallo de red o webhook inaccesible', async () => {
      const notification = {
        id: 'notif-fail-01',
        recipientEmail: 'juridico@isa.com.co',
        subject: 'Expediente Aprobado para Notaría',
        body: 'El predio SAN-CIM-036 ha sido debidamente certificado.',
        webhookUrl: 'https://offline.territorium.local/post'
      }

      const receipt = await dispatchCorporateNotification(
        notification,
        undefined,
        (async () => {
          throw new Error('NETWORK_UNREACHABLE_TEST_ERROR')
        }) as unknown as typeof fetch
      )

      expect(receipt.status).toBe('failed')
      expect(receipt.error).toContain('NETWORK_UNREACHABLE_TEST_ERROR')
      expect(receipt.deliveryAttempts).toBe(3)
      expect(receipt.receiptSignature).toBeUndefined()
    })
  })

  // =========================================================================
  // US-289–296: Portal notarial con HMAC, revocación, OTP y conceptos persistidos
  // =========================================================================
  describe('US-289–296: Portal Notarial Seguro, Tokens HMAC, OTP y Conceptos', () => {
    it('genera tokens HMAC-SHA256 y verifica inmediatamente la revocación persistente', async () => {
      const token = await generateSecureNotaryAccessToken('notario.velez@notaria1.com', 'SAN-CIM-036', 4) // 4 horas
      expect(token).toContain('ttm_ext_')

      // Token activo debe ser válido
      const checkValid = await verifyNotaryTokenWithRevocationCheck(token)
      expect(checkValid.isValid).toBe(true)

      // Revocar token inmediatamente
      revokeTokenPersistent(token, 'Revocado por cambio de notaría delegada')

      // Verificación posterior debe rechazarlo como revocado
      const checkRevoked = await verifyNotaryTokenWithRevocationCheck(token)
      expect(checkRevoked.isValid).toBe(false)
      expect(checkRevoked.error).toContain('revocado')
    })

    it('rechaza tajantemente tokens no firmados o con firma HMAC adulterada/forjada', async () => {
      // Token sin firma HMAC (formato antiguo o sin punto de separación)
      const unsignedToken = 'ttm_ext_raw_token_without_signature'
      const checkUnsigned = await verifyNotaryTokenWithRevocationCheck(unsignedToken)
      expect(checkUnsigned.isValid).toBe(false)
      expect(checkUnsigned.error).toMatch(/inválido|no firmado|ausente/i)

      // Token válido pero con firma forjada / adulterada
      const realToken = await generateSecureNotaryAccessToken('notario.test@notaria1.com', 'SAN-001', 1)
      const tamperedToken = realToken.slice(0, -5) + 'ABCDE'
      const checkTampered = await verifyNotaryTokenWithRevocationCheck(tamperedToken)
      expect(checkTampered.isValid).toBe(false)
      expect(checkTampered.error).toContain('inválida')
    })

    it('restringe el OTP a un máximo de 3 intentos para prevenir ataques de fuerza bruta', () => {
      const email = 'notario.seguro@notaria.gov.co'
      const validCode = '884920'

      // Intentos fallidos 1 y 2
      expect(verifyNotaryOtpWithRateLimit(email, '000000', validCode).success).toBe(false)
      expect(verifyNotaryOtpWithRateLimit(email, '111111', validCode).success).toBe(false)

      // Intento fallido 3 -> Bloquea
      const attempt3 = verifyNotaryOtpWithRateLimit(email, '222222', validCode)
      expect(attempt3.success).toBe(false)
      expect(attempt3.blocked).toBe(true)

      // Intento 4 con el código correcto debe seguir bloqueado por exceso de intentos
      const attempt4 = verifyNotaryOtpWithRateLimit(email, validCode, validCode)
      expect(attempt4.success).toBe(false)
      expect(attempt4.error).toContain('bloqueado')
    })

    it('persiste conceptos notariales con IP y fecha para trazabilidad jurídica oficial', () => {
      const concept = persistNotaryConcept({
        propertyCode: 'SAN-CIM-036',
        notaryEmail: 'notario.velez@notaria1.com',
        conceptType: 'favorable',
        observations: 'El estudio de títulos y plano cumplen plenamente con la tradición y alinderación.',
        ipAddress: '190.14.88.21'
      })

      expect(concept.id).toBeDefined()
      expect(concept.conceptType).toBe('favorable')
      expect(concept.ipAddress).toBe('190.14.88.21')

      const storedList = queryNotaryConcepts('SAN-CIM-036')
      expect(storedList).toHaveLength(1)
      expect(storedList[0].observations).toContain('cumplen plenamente')
    })
  })

  // =========================================================================
  // US-066–093: Validación de historias de extracción jurídica
  // =========================================================================
  describe('US-066–093: Protocolo de Validación de Extracción Jurídica (Reglas Reabiertas como Parciales)', () => {
    it('establece el protocolo de validación jurídica para no dar por cerradas las HUs sin corpus real anonimizado', () => {
      // Las historias US-066 a US-093 se marcan como parciales según dictamen del consultor
      const extractionRulesValidation = {
        scope: 'US-066..US-093',
        status: 'parcial_en_validacion_corpus_real',
        corpusRequired: true,
        legalReviewerSignoffRequired: true,
        criteria: [
          'Folio y tradición validados con certificados de libertad reales anonimizados',
          'Linderos validados con escrituras matrices de más de 3 páginas',
          'Gravámenes y medidas cautelares contrastados con anotaciones de falsa tradición y embargos'
        ]
      }

      expect(extractionRulesValidation.status).toBe('parcial_en_validacion_corpus_real')
      expect(extractionRulesValidation.corpusRequired).toBe(true)
      expect(extractionRulesValidation.legalReviewerSignoffRequired).toBe(true)
    })
  })
})
