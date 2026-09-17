import { describe, it, expect } from 'vitest'
import {
  validateSsoConfiguration,
  resolveUserRoleFromSsoClaims,
  createElectronicSignatureEnvelope,
  verifyAndApplyElectronicSignature
} from './enterpriseIdentityP2'
import type { SsoConfiguration } from '../types'

describe('enterpriseIdentityP2 (US-010, US-115)', () => {
  const mockSsoConfig: SsoConfiguration = {
    id: 'sso-1',
    providerName: 'azure_ad',
    entityId: 'https://sts.windows.net/isa-corp-tenant/',
    clientId: 'client-app-isa-territorium',
    issuer: 'https://login.microsoftonline.com/isa-corp-tenant/v2.0',
    defaultRole: 'CONSULTOR',
    roleClaimMapping: {
      'ISA-Territorium-Admins': 'ADMIN',
      'ISA-Territorium-Reviewers': 'REVISOR',
      'ISA-Territorium-Operators': 'OPERADOR'
    },
    isActive: true
  }

  describe('US-010: Integración con Identidad Corporativa (SSO SAML / Azure AD)', () => {
    it('valida correctamente configuraciones válidas e inválidas de proveedor de identidad', () => {
      const validCheck = validateSsoConfiguration(mockSsoConfig)
      expect(validCheck.isValid).toBe(true)
      expect(validCheck.errors.length).toBe(0)

      const invalidCheck = validateSsoConfiguration({
        providerName: 'azure_ad',
        clientId: ''
        // Falta issuer y defaultRole
      })
      expect(invalidCheck.isValid).toBe(false)
      expect(invalidCheck.errors.length).toBeGreaterThan(1)
    })

    it('resuelve roles corporativos a partir de claims de grupos con mínimo privilegio y fallback seguro', () => {
      // Usuario con grupo de revisores jurídicos
      const reviewerRole = resolveUserRoleFromSsoClaims(
        { roles: ['ISA-Territorium-Reviewers', 'ISA-General-Staff'] },
        mockSsoConfig
      )
      expect(reviewerRole).toBe('REVISOR')

      // Usuario con grupo de administradores
      const adminRole = resolveUserRoleFromSsoClaims(
        { groups: ['ISA-Territorium-Admins'] },
        mockSsoConfig
      )
      expect(adminRole).toBe('ADMIN')

      // Usuario sin grupo mapeado -> asigna defaultRole (CONSULTOR)
      const defaultRole = resolveUserRoleFromSsoClaims(
        { groups: ['Other-Unmapped-Group'] },
        mockSsoConfig
      )
      expect(defaultRole).toBe('CONSULTOR')
    })
  })

  describe('US-115: Solicitud y Sellado de Firma Electrónica Certificada', () => {
    it('genera envelope de firma electrónica con hash SHA-256 de documento inmutable', () => {
      const envelope = createElectronicSignatureEnvelope({
        documentId: 'doc-oferta-001',
        projectId: 'proj-isa-cauca',
        propertyCode: 'PREDIO-01',
        documentSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        signerEmail: 'carlos.ramirez@propietarios.co',
        signerName: 'Carlos Alberto Ramírez',
        signerRole: 'PROPIETARIO_TITULAR',
        provider: 'certicamara'
      })

      expect(envelope.id.startsWith('sig-')).toBe(true)
      expect(envelope.status).toBe('pending')
      expect(envelope.provider).toBe('certicamara')
      expect(envelope.signerEmail).toBe('carlos.ramirez@propietarios.co')
    })

    it('aplica firma electrónica exitosamente con estampa cronológica cuando el hash coincide', () => {
      const envelope = createElectronicSignatureEnvelope({
        documentId: 'doc-oferta-001',
        projectId: 'proj-isa-cauca',
        propertyCode: 'PREDIO-01',
        documentSha256: 'valid-doc-hash-12345',
        signerEmail: 'carlos.ramirez@propietarios.co',
        signerName: 'Carlos Alberto Ramírez',
        signerRole: 'PROPIETARIO_TITULAR'
      })

      const verification = verifyAndApplyElectronicSignature(
        envelope,
        'valid-doc-hash-12345',
        'OTP-987654'
      )

      expect(verification.success).toBe(true)
      expect(verification.updatedRecord.status).toBe('signed')
      expect(verification.updatedRecord.timestampToken).toContain('RFC3161')
      expect(verification.updatedRecord.signedAt).toBeDefined()
    })

    it('rechaza la firma si el documento fue alterado después de emitida la solicitud (hash no coincide)', () => {
      const envelope = createElectronicSignatureEnvelope({
        documentId: 'doc-oferta-001',
        projectId: 'proj-isa-cauca',
        propertyCode: 'PREDIO-01',
        documentSha256: 'original-hash-11111',
        signerEmail: 'abogado@empresa.com',
        signerName: 'Dra. Claudia Asesora',
        signerRole: 'APODERADO_EMPRESA'
      })

      // Intento de firmar documento modificado
      const verification = verifyAndApplyElectronicSignature(
        envelope,
        'tampered-hash-99999',
        'OTP-123456'
      )

      expect(verification.success).toBe(false)
      expect(verification.updatedRecord.status).toBe('declined')
      expect(verification.rejectionReason).toContain('Discrepancia de integridad')
    })
  })
})
