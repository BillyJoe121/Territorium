import { seedState } from '../data/seed'
import type { PlatformState } from '../types'

const STORAGE_KEY = 'territorium-platform-state-v1'

export function loadState(): PlatformState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return seedState
    const parsed = JSON.parse(saved) as PlatformState
    return {
      ...seedState,
      ...parsed,
      tasks: parsed.tasks ?? [],
      extractorConfigs: parsed.extractorConfigs?.length ? parsed.extractorConfigs : seedState.extractorConfigs,
      promptVersions: parsed.promptVersions?.length ? parsed.promptVersions : seedState.promptVersions,
      aiLogs: parsed.aiLogs ?? seedState.aiLogs,
    }
  } catch {
    return seedState
  }
}

export function saveState(state: PlatformState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY)
}
