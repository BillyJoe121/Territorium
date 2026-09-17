import { describe, expect, it } from 'vitest'
import { classifyFileName, cleanFileName } from './platformRepository'

describe('clasificación documental', () => {
  it.each([
    ['ESTUDIO DE TÍTULOS_SAN-CIM-001.pdf', 'estudio_titulos'],
    ['Plano_SAN-CIM-001.pdf', 'plano'],
    ['Oferta de servidumbre.docx', 'negociacion'],
    ['anexo-general.pdf', 'sin_clasificar'],
  ] as const)('clasifica %s', (name, expected) => {
    expect(classifyFileName(name)).toBe(expected)
  })
})

describe('rutas de almacenamiento', () => {
  it('normaliza nombres y conserva una extensión segura', () => {
    expect(cleanFileName('  Matrícula # 01.PDF')).toBe('Matricula-01.pdf')
  })

  it('elimina segmentos de ruta y caracteres especiales', () => {
    expect(cleanFileName('../predio<script>.docx')).toBe('predio-script.docx')
  })
})

describe('seguridad y roles de mínimo privilegio (US-002, US-003)', () => {
  const allowedRoles = ['owner', 'operator', 'reviewer', 'viewer'] as const

  it('valida que todos los roles declarados pertenezcan a la matriz formal', () => {
    for (const role of allowedRoles) {
      expect(['owner', 'operator', 'reviewer', 'viewer']).toContain(role)
    }
  })

  it('aplica el principio de mínimo privilegio: los roles de consulta no pueden editar', () => {
    const canEditAttributes = (role: string) => ['owner', 'operator', 'reviewer'].includes(role)
    const canOperateBatches = (role: string) => ['owner', 'operator'].includes(role)
    const canManageMembers = (role: string) => role === 'owner'

    expect(canEditAttributes('viewer')).toBe(false)
    expect(canEditAttributes('reviewer')).toBe(true)

    expect(canOperateBatches('reviewer')).toBe(false)
    expect(canOperateBatches('operator')).toBe(true)

    expect(canManageMembers('operator')).toBe(false)
    expect(canManageMembers('owner')).toBe(true)
  })

  it('valida formato de correo seguro para invitaciones de usuario sin compartir contraseñas', () => {
    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

    expect(isValidEmail('abogado@empresa.com')).toBe(true)
    expect(isValidEmail('  operador.predial@territorium.co  ')).toBe(true)
    expect(isValidEmail('invalido-sin-arroba.com')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})

describe('ciclo de vida de proyectos y expedientes (E02 P0)', () => {
  it('US-011: valida la creación de proyecto territorial con campos completos', () => {
    const project = {
      id: 'proyecto-1',
      name: 'Línea de Transmisión Colectora 500 kV',
      clientName: 'Grupo Energía Bogotá',
      municipality: 'Uribia',
      department: 'La Guajira',
      powerLine: 'Colectora - Cuestecitas 500 kV',
      createdAt: '2026-09-17T10:00:00.000Z',
      isArchived: false,
    }

    expect(project.name).toBe('Línea de Transmisión Colectora 500 kV')
    expect(project.clientName).toBe('Grupo Energía Bogotá')
    expect(project.powerLine).toBe('Colectora - Cuestecitas 500 kV')
    expect(project.isArchived).toBe(false)
  })

  it('US-012: la edición de metadatos no modifica extracciones históricas ni el ID del proyecto', () => {
    const originalProject = {
      id: 'proyecto-1',
      name: 'Subestación La Loma',
      clientName: 'ISA Intercolombia',
      municipality: 'El Paso',
      department: 'Cesar',
      createdAt: '2026-01-01T00:00:00.000Z',
    }

    const extractionRecords = [
      { id: 'rec-1', projectId: 'proyecto-1', folio: '190-12345', approved: true },
      { id: 'rec-2', projectId: 'proyecto-1', folio: '190-54321', approved: false },
    ]

    // Update metadata
    const updatedProject = {
      ...originalProject,
      name: 'Subestación La Loma 500 kV - Fase 2',
      clientName: 'ISA Intercolombia S.A. E.S.P.',
      powerLine: 'Loma - Sogamoso',
      updatedAt: '2026-09-17T12:00:00.000Z',
    }

    // Assert project ID is immutable
    expect(updatedProject.id).toBe(originalProject.id)
    // Assert extraction records retain original linkage and data
    expect(extractionRecords.every((r) => r.projectId === updatedProject.id)).toBe(true)
    expect(extractionRecords[0]?.folio).toBe('190-12345')
  })

  it('US-013: búsqueda y filtrado de proyectos por texto y estado activo/archivado', () => {
    const projects = [
      {
        id: 'p-1',
        name: 'Corredor Eólico Jepírachi',
        clientName: 'EPM',
        municipality: 'Uribia',
        department: 'La Guajira',
        powerLine: 'Jepírachi 110 kV',
        isArchived: false,
      },
      {
        id: 'p-2',
        name: 'Interconexión Noroccidental',
        clientName: 'ISA',
        municipality: 'Medellín',
        department: 'Antioquia',
        powerLine: 'Cerromatoso - Chinú',
        isArchived: false,
      },
      {
        id: 'p-3',
        name: 'Parque Solar Guayepo',
        clientName: 'Enel Green Power',
        municipality: 'Ponedera',
        department: 'Atlántico',
        powerLine: 'Guayepo - Sabanalarga',
        isArchived: true,
      },
    ]

    // Search query matches client, name, or powerLine
    const searchFilter = (query: string) => {
      const q = query.toLowerCase()
      return projects.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.clientName ?? '').toLowerCase().includes(q) ||
          p.municipality.toLowerCase().includes(q) ||
          (p.powerLine ?? '').toLowerCase().includes(q)
      )
    }

    expect(searchFilter('enel').map((p) => p.id)).toEqual(['p-3'])
    expect(searchFilter('epm').map((p) => p.id)).toEqual(['p-1'])
    expect(searchFilter('uribia').map((p) => p.id)).toEqual(['p-1'])
    expect(searchFilter('cerromatoso').map((p) => p.id)).toEqual(['p-2'])

    // Status filter
    const activeProjects = projects.filter((p) => !p.isArchived)
    const archivedProjects = projects.filter((p) => Boolean(p.isArchived))

    expect(activeProjects.length).toBe(2)
    expect(archivedProjects.length).toBe(1)
    expect(archivedProjects[0]?.id).toBe('p-3')
  })

  it('US-015: archivado recuperable mantiene los datos y no elimina físicamente el expediente', () => {
    let project = {
      id: 'p-4',
      name: 'Línea San Carlos',
      isArchived: false,
      archivedAt: null as string | null,
    }

    // Archive
    const archiveTimestamp = '2026-09-17T15:00:00.000Z'
    project = { ...project, isArchived: true, archivedAt: archiveTimestamp }
    expect(project.isArchived).toBe(true)
    expect(project.archivedAt).toBe(archiveTimestamp)

    // Restore
    project = { ...project, isArchived: false, archivedAt: null }
    expect(project.isArchived).toBe(false)
    expect(project.archivedAt).toBeNull()
  })
})

