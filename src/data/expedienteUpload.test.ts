import { describe, expect, it } from 'vitest'
import { expedienteTusEndpoint, resolveExpedienteMime, validateExpedienteFile } from './expedienteUpload'

const file = (name: string, type: string, bytes: number[]) => new File([new Uint8Array(bytes)], name, { type })

describe('expediente upload validation', () => {
  it('usa el host directo de Storage para proyectos alojados', () => {
    expect(expedienteTusEndpoint('https://abc123.supabase.co')).toBe('https://abc123.storage.supabase.co/storage/v1/upload/resumable')
    expect(expedienteTusEndpoint('http://127.0.0.1:54321')).toBe('http://127.0.0.1:54321/storage/v1/upload/resumable')
  })

  it('no confía en un MIME que contradice la extensión', () => {
    expect(() => resolveExpedienteMime(file('plano.pdf', 'image/png', [0x25, 0x50, 0x44, 0x46, 0x2d]))).toThrow('tipo declarado')
  })

  it('acepta un PDF de títulos con cabecera válida', async () => {
    await expect(validateExpedienteFile(file('titulo.pdf', 'application/pdf', [0x25, 0x50, 0x44, 0x46, 0x2d]), 'titles')).resolves.toBe('application/pdf')
  })

  it('rechaza un XLSX con contenido que no es ZIP', async () => {
    await expect(validateExpedienteFile(file('negociacion.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', [0x25, 0x50, 0x44, 0x46]), 'negotiation')).rejects.toThrow('contenido no corresponde')
  })

  it('rechaza una imagen cargada en el grupo jurídico', async () => {
    await expect(validateExpedienteFile(file('foto.png', 'image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'titles')).rejects.toThrow('no pertenece')
  })
})
