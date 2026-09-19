import { useCallback, useEffect, useRef, useState } from 'react'

export interface DraftSyncOptions<T> {
  initialData: T
  versionId: string
  versionNumber: number
  onSave: (data: T, versionId: string, currentVersionNumber: number) => Promise<{ nextVersionNumber?: number }>
  onConflictDetected?: (serverData: T) => void
  autoSaveDelay?: number
}

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'error'

export class DraftSyncController<T extends Record<string, unknown>> {
  private draft: T
  private status: SaveStatus = 'idle'
  private lastSavedAt: string | null = null
  private errorMessage: string | null = null
  private isConflict = false
  private currentVersion: number
  private isDirty = false
  private timer: any = null

  constructor(private options: DraftSyncOptions<T>, private onStateChange?: () => void) {
    this.draft = options.initialData
    this.currentVersion = options.versionNumber
  }

  getSnapshot() {
    return {
      draft: this.draft,
      status: this.status,
      lastSavedAt: this.lastSavedAt,
      errorMessage: this.errorMessage,
      isConflict: this.isConflict,
    }
  }

  getStatus(): SaveStatus {
    return this.status
  }

  getDraft(): T {
    return this.draft
  }

  getIsConflict(): boolean {
    return this.isConflict
  }

  getErrorMessage(): string | null {
    return this.errorMessage
  }

  getLastSavedAt(): string | null {
    return this.lastSavedAt
  }

  setDraft(next: T | ((prev: T) => T)) {
    this.draft = typeof next === 'function' ? (next as any)(this.draft) : next
    this.isDirty = true
    this.status = 'dirty'
    this.onStateChange?.()

    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      void this.saveNow()
    }, this.options.autoSaveDelay ?? 1500)
  }

  async saveNow(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (!this.isDirty) return

    this.status = 'saving'
    this.errorMessage = null
    this.onStateChange?.()

    try {
      const res = await this.options.onSave(this.draft, this.options.versionId, this.currentVersion)
      if (res.nextVersionNumber) {
        this.currentVersion = res.nextVersionNumber
      }
      this.isDirty = false
      this.status = 'saved'
      this.lastSavedAt = new Date().toISOString()
      this.onStateChange?.()
    } catch (err: any) {
      if (err?.name === 'EditConflictError' || err?.message?.includes('Conflicto')) {
        this.isConflict = true
        this.status = 'conflict'
        this.errorMessage = 'Conflicto de concurrencia: otro usuario o proceso guardó una nueva versión.'
      } else {
        this.status = 'error'
        this.errorMessage = err instanceof Error ? err.message : 'Error al guardar el borrador.'
      }
      this.onStateChange?.()
    }
  }

  resolveConflictReloadServer(serverData: T, newVersion: number) {
    if (this.timer) clearTimeout(this.timer)
    this.currentVersion = newVersion
    this.draft = serverData
    this.isDirty = false
    this.isConflict = false
    this.status = 'idle'
    this.errorMessage = null
    this.onStateChange?.()
  }
}

export interface UseExpedienteDraftSyncReturn<T> {
  draft: T
  setDraft: (updater: T | ((prev: T) => T)) => void
  status: SaveStatus
  lastSavedAt: string | null
  errorMessage: string | null
  isConflict: boolean
  saveNow: () => Promise<void>
  resolveConflictKeepMine: () => Promise<void>
  resolveConflictReloadServer: (serverData: T, newVersionNumber: number) => void
  resetDraft: (data: T, versionNumber: number) => void
}

export function useExpedienteDraftSync<T extends Record<string, unknown>>({
  initialData,
  versionId,
  versionNumber,
  onSave,
  autoSaveDelay = 1500,
}: DraftSyncOptions<T>): UseExpedienteDraftSyncReturn<T> {
  const [draft, setDraftState] = useState<T>(initialData)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isConflict, setIsConflict] = useState(false)

  const currentVersionRef = useRef(versionNumber)
  const isDirtyRef = useRef(false)
  const draftRef = useRef<T>(initialData)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    currentVersionRef.current = versionNumber
    draftRef.current = initialData
    setDraftState(initialData)
    setStatus('idle')
    setIsConflict(false)
    setErrorMessage(null)
  }, [versionId, versionNumber, initialData])

  const executeSave = useCallback(async () => {
    if (!isDirtyRef.current) return
    setStatus('saving')
    setErrorMessage(null)

    try {
      const res = await onSave(draftRef.current, versionId, currentVersionRef.current)
      if (res.nextVersionNumber) {
        currentVersionRef.current = res.nextVersionNumber
      }
      isDirtyRef.current = false
      setStatus('saved')
      setLastSavedAt(new Intl.DateTimeFormat('es-CO', { timeStyle: 'medium' }).format(new Date()))
    } catch (err: any) {
      if (err?.message?.includes('conflict') || err?.name === 'EditConflictError') {
        setIsConflict(true)
        setStatus('conflict')
        setErrorMessage('Conflicto de concurrencia: otro usuario o proceso guardó una nueva versión.')
      } else {
        setStatus('error')
        setErrorMessage(err instanceof Error ? err.message : 'Error al guardar el borrador.')
      }
    }
  }, [onSave, versionId])

  const setDraft = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setDraftState((prev) => {
        const next = typeof updater === 'function' ? (updater as (prev: T) => T)(prev) : updater
        draftRef.current = next
        isDirtyRef.current = true
        setStatus('dirty')

        if (timerRef.current) {
          window.clearTimeout(timerRef.current)
        }
        timerRef.current = window.setTimeout(() => {
          void executeSave()
        }, autoSaveDelay)

        return next
      })
    },
    [autoSaveDelay, executeSave],
  )

  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    await executeSave()
  }, [executeSave])

  const resolveConflictKeepMine = useCallback(async () => {
    setIsConflict(false)
    isDirtyRef.current = true
    await executeSave()
  }, [executeSave])

  const resolveConflictReloadServer = useCallback((serverData: T, newVersionNumber: number) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    currentVersionRef.current = newVersionNumber
    draftRef.current = serverData
    setDraftState(serverData)
    isDirtyRef.current = false
    setIsConflict(false)
    setStatus('idle')
    setErrorMessage(null)
  }, [])

  const resetDraft = useCallback((data: T, newVersionNumber: number) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    currentVersionRef.current = newVersionNumber
    draftRef.current = data
    setDraftState(data)
    isDirtyRef.current = false
    setIsConflict(false)
    setStatus('idle')
    setErrorMessage(null)
  }, [])

  return {
    draft,
    setDraft,
    status,
    lastSavedAt,
    errorMessage,
    isConflict,
    saveNow,
    resolveConflictKeepMine,
    resolveConflictReloadServer,
    resetDraft,
  }
}
