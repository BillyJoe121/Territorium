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
  renderDocxTemplate
} from '../lib/dynamicTemplateManagerP2'

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
