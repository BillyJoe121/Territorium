import { describe, expect, it, vi } from 'vitest'
import { DraftSyncController } from './useExpedienteDraftSync'
import { EditConflictError } from '../data/expedienteV2Repository'

describe('useExpedienteDraftSync / DraftSyncController (HU-V2-043)', () => {
  it('inicializa en estado idle con datos iniciales', () => {
    const onSave = vi.fn().mockResolvedValue({})
    const controller = new DraftSyncController({
      initialData: { folio: '050N-1' },
      versionId: 'v-1',
      versionNumber: 1,
      onSave,
    })

    expect(controller.getDraft()).toEqual({ folio: '050N-1' })
    expect(controller.getStatus()).toBe('idle')
    expect(controller.getIsConflict()).toBe(false)
  })

  it('guarda manualmente de inmediato con saveNow', async () => {
    const onSave = vi.fn().mockResolvedValue({ nextVersionNumber: 2 })
    const controller = new DraftSyncController({
      initialData: { folio: '050N-1' },
      versionId: 'v-1',
      versionNumber: 1,
      onSave,
    })

    controller.setDraft({ folio: '050N-MODIFICADO' })
    expect(controller.getStatus()).toBe('dirty')

    await controller.saveNow()

    expect(onSave).toHaveBeenCalledWith({ folio: '050N-MODIFICADO' }, 'v-1', 1)
    expect(controller.getStatus()).toBe('saved')
    expect(controller.getLastSavedAt()).toBeDefined()
  })

  it('detecta y marca conflicto de concurrencia cuando se lanza EditConflictError', async () => {
    const onSave = vi.fn().mockRejectedValue(new EditConflictError('Conflicto detectado en servidor', 2))
    const controller = new DraftSyncController({
      initialData: { folio: '050N-1' },
      versionId: 'v-1',
      versionNumber: 1,
      onSave,
    })

    controller.setDraft({ folio: '050N-MI-CAMBIO' })
    await controller.saveNow()

    expect(controller.getStatus()).toBe('conflict')
    expect(controller.getIsConflict()).toBe(true)
    expect(controller.getErrorMessage()).toContain('Conflicto de concurrencia')
  })

  it('permite recargar los datos del servidor para resolver el conflicto', () => {
    const onSave = vi.fn().mockResolvedValue({})
    const controller = new DraftSyncController({
      initialData: { folio: '050N-1' },
      versionId: 'v-1',
      versionNumber: 1,
      onSave,
    })

    controller.resolveConflictReloadServer({ folio: '050N-ACTUALIZADO-SERVIDOR' }, 2)

    expect(controller.getDraft()).toEqual({ folio: '050N-ACTUALIZADO-SERVIDOR' })
    expect(controller.getStatus()).toBe('idle')
    expect(controller.getIsConflict()).toBe(false)
  })
})
