export const expedienteGroupKeys = ['titles', 'plans', 'negotiation'] as const

export type ExpedienteGroupKey = (typeof expedienteGroupKeys)[number]
export type ExpedienteGroupStatus = 'empty' | 'ready' | 'queued' | 'processing' | 'review_ready' | 'approved' | 'stale' | 'error'
export type ExpedienteConsolidationStatus = 'blocked' | 'available' | 'processing' | 'review_ready' | 'approved' | 'stale'
export type ExpedienteFinalDocumentStatus = 'blocked' | 'generating' | 'editable' | 'reprocessing' | 'final' | 'stale'
