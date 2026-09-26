import { describe, expect, it } from 'vitest'
import { describeComparisonError, validateComparisonFile } from './documentComparison'

describe('validateComparisonFile', () => {
  it('accepts PDF and DOCX by matching extension and MIME', () => {
    expect(validateComparisonFile(new File(['pdf'], 'original.pdf', { type: 'application/pdf' }))).toBe('application/pdf')
    expect(validateComparisonFile(new File(['docx'], 'original.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))).toContain('wordprocessingml')
  })

  it('rejects unsupported formats and mismatched MIME', () => {
    expect(() => validateComparisonFile(new File(['a'], 'original.txt', { type: 'text/plain' }))).toThrow()
    expect(() => validateComparisonFile(new File(['a'], 'original.pdf', { type: 'text/plain' }))).toThrow()
  })

  it('rejects empty files', () => {
    expect(() => validateComparisonFile(new File([], 'original.pdf', { type: 'application/pdf' }))).toThrow()
  })
})

describe('describeComparisonError', () => {
  it('explains a missing comparison schema even when Supabase rejects with a plain object', () => {
    expect(describeComparisonError({ code: 'PGRST205', message: 'Could not find the table' }, 'fallback')).toContain('migración')
  })

  it('translates specific business and queue exceptions from Postgres', () => {
    expect(describeComparisonError({ message: 'comparison_documents_not_available' }, 'fallback')).toContain('permisos de operador o revisor')
    expect(describeComparisonError({ message: 'comparison_queue_full' }, 'fallback')).toContain('máximo 2')
    expect(describeComparisonError({ message: 'comparison_already_running' }, 'fallback')).toContain('Ya existe una comparación')
    expect(describeComparisonError({ message: 'comparison_requires_two_documents' }, 'fallback')).toContain('dos documentos distintos')
    expect(describeComparisonError({ message: 'comparison_document_limit_reached' }, 'fallback')).toContain('10 documentos activos')
  })

  it('preserves useful errors and falls back for non-error values', () => {
    expect(describeComparisonError({ message: 'Sin permiso' }, 'fallback')).toBe('Sin permiso')
    expect(describeComparisonError(null, 'fallback')).toBe('fallback')
  })
})
