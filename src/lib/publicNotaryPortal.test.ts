import { describe, expect, it } from 'vitest'
import {
  generateNotaryShareToken,
  validateNotaryShareToken,
  recordNotaryConcept,
} from './publicNotaryPortal'

describe('publicNotaryPortal (US-289 a US-292)', () => {
  it('genera un token válido con metadatos y expiración calculada', () => {
    const { token, payload } = generateNotaryShareToken({
      projectId: 'PRJ-TEST-01',
      recipientName: 'Dr. Carlos Mendoza',
      recipientOrganization: 'Notaría 12 de Cali',
      durationHours: 24,
    })

    expect(token).toMatch(/^ttm_ext_/)
    expect(payload.projectId).toBe('PRJ-TEST-01')
    expect(payload.recipientOrganization).toBe('Notaría 12 de Cali')
    expect(payload.permissions).toContain('submit_concept')
    expect(new Date(payload.expiresAt).getTime()).toBeGreaterThan(Date.now())
  })

  it('valida exitosamente un token no expirado y no revocado', () => {
    const { token } = generateNotaryShareToken({
      projectId: 'PRJ-TEST-01',
      recipientName: 'Dra. Lucia Gómez',
      recipientOrganization: 'Notaría 45 de Bogotá',
      durationHours: 48,
    })

    const session = validateNotaryShareToken(token)
    expect(session.isValid).toBe(true)
    expect(session.payload?.recipientName).toBe('Dra. Lucia Gómez')
    expect(session.error).toBeUndefined()
  })

  it('rechaza tokens malformados, alterados o con prefijo incorrecto', () => {
    const malformed = validateNotaryShareToken('invalid_token_1234')
    expect(malformed.isValid).toBe(false)
    expect(malformed.error).toBe('token_invalido')
  })

  it('rechaza tokens expirados', () => {
    const { token } = generateNotaryShareToken({
      projectId: 'PRJ-TEST-01',
      recipientName: 'Dr. Pedro',
      recipientOrganization: 'Notaría 1',
      durationHours: -1, // ya expirado
    })

    const session = validateNotaryShareToken(token)
    expect(session.isValid).toBe(false)
    expect(session.error).toBe('token_expirado')
  })

  it('rechaza tokens marcados en la lista de revocación', () => {
    const { token, payload } = generateNotaryShareToken({
      projectId: 'PRJ-TEST-01',
      recipientName: 'Dr. Andrés',
      recipientOrganization: 'Notaría 2',
      durationHours: 12,
    })

    const session = validateNotaryShareToken(token, [payload.tokenId])
    expect(session.isValid).toBe(false)
    expect(session.error).toBe('token_revocado')
  })

  it('registra conformidad notarial con sellos de auditoría válidos', () => {
    const { token } = generateNotaryShareToken({
      projectId: 'PRJ-TEST-01',
      recipientName: 'Dra. María Ramos',
      recipientOrganization: 'Notaría 3 de Medellín',
      durationHours: 24,
    })

    const session = validateNotaryShareToken(token)
    const result = recordNotaryConcept(session, {
      decision: 'conforme',
      notaryOfficialName: 'Dra. María Ramos',
      notaryNumber: 'Notaría 3 de Medellín',
      documentHashSha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
    })

    expect(result.success).toBe(true)
    expect(result.record?.decision).toBe('conforme')
    expect(result.record?.submittedAt).toBeDefined()
    expect(result.record?.tokenId).toBe(session.payload?.tokenId)
  })

  it('exige observaciones cuando se solicitan ajustes a la minuta', () => {
    const { token } = generateNotaryShareToken({
      projectId: 'PRJ-TEST-01',
      recipientName: 'Dr. Test',
      recipientOrganization: 'Notaría 1',
      durationHours: 24,
    })

    const session = validateNotaryShareToken(token)
    const resultSinObs = recordNotaryConcept(session, {
      decision: 'ajustes_requeridos',
      notaryOfficialName: 'Dr. Test',
      notaryNumber: 'Notaría 1',
      documentHashSha256: 'hash123',
    })

    expect(resultSinObs.success).toBe(false)
    expect(resultSinObs.error).toContain('ajustes requeridos')

    const resultConObs = recordNotaryConcept(session, {
      decision: 'ajustes_requeridos',
      notaryOfficialName: 'Dr. Test',
      notaryNumber: 'Notaría 1',
      observations: 'Corregir el lindero norte que colinda con quebrada',
      documentHashSha256: 'hash123',
    })

    expect(resultConObs.success).toBe(true)
  })
})
