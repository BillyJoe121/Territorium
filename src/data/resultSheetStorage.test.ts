import { describe, expect, it } from 'vitest'
import { isMissingObjectError, resultSheetPath } from './resultSheetStorage'

const project = '3f1c2b9e-1d4a-4c7e-9a2b-6b5f8e0d1c23'
const version = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

describe('resultSheetPath', () => {
  it('builds one deterministic path per result version', () => {
    expect(resultSheetPath(project, version, 'titles')).toBe(`${project}/hojas/${version}/estudio-titulos.xlsx`)
  })

  it('rejects identifiers that could change the path', () => {
    expect(() => resultSheetPath('../otro', version, 'titles')).toThrow(/no válido/)
    expect(() => resultSheetPath(project, `${version}/x`, 'titles')).toThrow(/no válido/)
  })
})

describe('isMissingObjectError', () => {
  it('recognizes Storage "not found" responses', () => {
    expect(isMissingObjectError({ name: 'StorageUnknownError', message: 'Bad Request', originalError: { status: 400 } })).toBe(true)
    expect(isMissingObjectError({ name: 'StorageApiError', status: 404, statusCode: '404', message: 'Object not found' })).toBe(true)
    expect(isMissingObjectError({ message: 'Object not found' })).toBe(true)
  })

  it('does not hide other failures', () => {
    expect(isMissingObjectError({ status: 500, message: 'Internal error' })).toBe(false)
    expect(isMissingObjectError({ originalError: { status: 403 }, message: 'Forbidden' })).toBe(false)
    expect(isMissingObjectError(null)).toBe(false)
  })
})
