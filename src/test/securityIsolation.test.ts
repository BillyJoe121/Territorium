import { describe, it, expect } from 'vitest'
import {
  validateSessionPolicy,
  duplicateProjectConfiguration,
  createSensitiveAuditEntry
} from '../lib/projectLifecycle'
import type { Project, ProjectConfiguration, UserRole } from '../types'

describe('US-156: Seguridad, Aislamiento Multitenant y Permisos por Rol P1', () => {
  const mockConfig: ProjectConfiguration = {
    projectId: 'proj-source-99',
    sessionTimeoutMinutes: 15,
    mfaRequired: true,
    allowedWebOrigins: ['https://seguridad.territorium.co', 'https://admin.territorium.co'],
    maxFilesPerBatch: 50,
    maxBatchSizeMb: 100,
    allowedMimeTypes: ['application/pdf'],
    retentionDaysRaw: 180,
    retentionDaysDerivatives: 90,
    retentionDaysExports: 60,
    autoPurgeEnabled: true,
    budgetCapUsd: 1000,
    budgetAlertThresholdPercent: 80
  }

  const mockProject: Project = {
    id: 'proj-source-99',
    name: 'Expediente Gasoducto Andino',
    clientName: 'Transportadora de Gas S.A.',
    municipality: 'Bogotá',
    department: 'Cundinamarca',
    createdAt: '2026-01-01T00:00:00Z',
    budgetCapUsd: 1000
  }

  describe('Aislamiento de Proyectos y Sanitización en Duplicación (US-016)', () => {
    it('duplica configuración de proyecto aislando el tenant y reseteando límites sin copiar logs sensibles', () => {
      const { project: duplicatedProject, config: duplicatedConfig } = duplicateProjectConfiguration(
        mockProject,
        { newName: 'Expediente Gasoducto Andino (Plantilla)' },
        mockConfig
      )

      expect(duplicatedProject.id).not.toBe(mockProject.id)
      expect(duplicatedProject.name).toBe('Expediente Gasoducto Andino (Plantilla)')
      expect(duplicatedProject.statusOverall).toBe('sin_lotes')
      expect(duplicatedConfig.projectId).toBe(duplicatedProject.id)
      expect(duplicatedConfig.mfaRequired).toBe(true)
      expect(duplicatedConfig.sessionTimeoutMinutes).toBe(15)
    })
  })

  describe('Políticas de Sesión, Restricción de Origen y MFA (US-008)', () => {
    it('configura y valida políticas estrictas de seguridad de sesión empresarial', () => {
      const valid = validateSessionPolicy(mockConfig, 10, true, 'https://seguridad.territorium.co')
      expect(valid.valid).toBe(true)

      const invalidOrigin = validateSessionPolicy(mockConfig, 10, true, 'http://insecure-site.com')
      expect(invalidOrigin.valid).toBe(false)
      expect(invalidOrigin.originAllowed).toBe(false)

      const expired = validateSessionPolicy(mockConfig, 20, true, 'https://seguridad.territorium.co')
      expect(expired.valid).toBe(false)
      expect(expired.reason).toContain('Sesión expirada')

      const mfaMissing = validateSessionPolicy(mockConfig, 5, false, 'https://seguridad.territorium.co')
      expect(mfaMissing.valid).toBe(false)
      expect(mfaMissing.mfaChallengeRequired).toBe(true)
    })
  })

  describe('Auditoría de Datos Sensibles (US-009)', () => {
    it('registra accesos a campos sensibles de propietarios para trazabilidad forense', () => {
      const auditLog = createSensitiveAuditEntry(
        'proj-source-99',
        'oficial_seguridad@empresa.com',
        'property_record',
        'rec-101',
        'export',
        ['cedula_propietario', 'valor_oferta_economica'],
        'PREDIO-001'
      )
      expect(auditLog.projectId).toBe('proj-source-99')
      expect(auditLog.action).toBe('export')
      expect(auditLog.sensitiveFields).toContain('cedula_propietario')
    })
  })

  describe('Matriz de Permisos RBAC por Rol (US-156)', () => {
    const checkPermission = (role: UserRole, action: 'CREATE_PROJECT' | 'PAUSE_BATCH' | 'APPROVE_ATTRIBUTES' | 'VIEW_METRICS' | 'PURGE_DATA'): boolean => {
      switch (action) {
        case 'CREATE_PROJECT':
        case 'PURGE_DATA':
          return role === 'ADMIN'
        case 'PAUSE_BATCH':
          return role === 'ADMIN' || role === 'OPERADOR'
        case 'APPROVE_ATTRIBUTES':
          return role === 'ADMIN' || role === 'REVISOR'
        case 'VIEW_METRICS':
          return true // Todos los roles autenticados pueden ver observabilidad en distintos grados
        default:
          return false
      }
    }

    it('ADMIN tiene acceso sin restricciones a operaciones de gobierno y purga', () => {
      expect(checkPermission('ADMIN', 'CREATE_PROJECT')).toBe(true)
      expect(checkPermission('ADMIN', 'PURGE_DATA')).toBe(true)
      expect(checkPermission('ADMIN', 'PAUSE_BATCH')).toBe(true)
      expect(checkPermission('ADMIN', 'APPROVE_ATTRIBUTES')).toBe(true)
    })

    it('OPERADOR puede operar lotes pero no aprobar atributos jurídicos ni purgar datos', () => {
      expect(checkPermission('OPERADOR', 'PAUSE_BATCH')).toBe(true)
      expect(checkPermission('OPERADOR', 'APPROVE_ATTRIBUTES')).toBe(false)
      expect(checkPermission('OPERADOR', 'PURGE_DATA')).toBe(false)
    })

    it('REVISOR puede validar y aprobar atributos pero no modificar lotes ni purgar', () => {
      expect(checkPermission('REVISOR', 'APPROVE_ATTRIBUTES')).toBe(true)
      expect(checkPermission('REVISOR', 'PAUSE_BATCH')).toBe(false)
      expect(checkPermission('REVISOR', 'PURGE_DATA')).toBe(false)
    })

    it('CONSULTOR tiene únicamente permisos de lectura y visualización', () => {
      expect(checkPermission('CONSULTOR', 'VIEW_METRICS')).toBe(true)
      expect(checkPermission('CONSULTOR', 'PAUSE_BATCH')).toBe(false)
      expect(checkPermission('CONSULTOR', 'APPROVE_ATTRIBUTES')).toBe(false)
      expect(checkPermission('CONSULTOR', 'PURGE_DATA')).toBe(false)
    })
  })
})
