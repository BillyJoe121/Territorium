export type DocumentKind = 'estudio_titulos' | 'plano' | 'linderos' | 'negociacion' | 'soporte' | 'sin_clasificar'
export type JobState = 'pendiente' | 'en_proceso' | 'requiere_revision' | 'completado' | 'fallido' | 'cancelado'
export type ReviewState = 'pendiente' | 'aprobado' | 'devuelto'

export type ProjectRole = 'owner' | 'operator' | 'reviewer' | 'viewer'
export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'session_expired'

export type DuplicateDecision = 'omit' | 'replace' | 'keep_version'

export type TextOrigin = 'native' | 'ocr' | 'hybrid' | 'exception'
export type PreprocessingStatus = 'ready' | 'needs_ocr' | 'ocr_in_progress' | 'ocr_completed' | 'exception' | 'corrupt'

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'blocked'
export type UserRole = 'ADMIN' | 'OPERADOR' | 'REVISOR' | 'CONSULTOR'
export type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'requires_review' | 'blocked'
export type DependencyStatus = 'ready' | 'waiting' | 'blocked'
export type ExceptionCategory =
  | 'permanent_unreadable'
  | 'password_encrypted'
  | 'unsupported_format'
  | 'ai_quota_exceeded'
  | 'schema_validation_exhausted'
  | 'missing_dependency'
  | 'other'

export interface DocumentTask {
  id: string
  jobId?: string | null
  batchId: string
  projectId: string
  sourceDocumentId: string
  propertyCode?: string | null
  extractorKey: 'title_study' | 'plan' | 'negotiation'
  status: TaskStatus
  dependencyStatus: DependencyStatus
  dependsOnExtractors: string[]
  attemptCount: number
  maxAttempts: number
  errorCode?: string | null
  errorMessage?: string | null
  exceptionCategory?: ExceptionCategory | null
  suggestedAction?: string | null
  tokensUsed: number
  assignedTo?: string | null
  leaseExpiresAt?: string | null
  startedAt?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface BatchItem {
  id: string
  file: File
  name: string
  size: number
  mimeType: string
  sha256?: string
  kind: DocumentKind
  propertyCode: string
  errors: string[]
  warnings: string[]
  isDuplicate: boolean
  duplicateSource?: 'batch' | 'project'
  duplicateTargetName?: string
  duplicateDecision?: DuplicateDecision
  pageCount?: number
  isScanned?: boolean
  needsOcr?: boolean
  ocrApplied?: boolean
  isEncrypted?: boolean
  textOrigin?: TextOrigin
  workingText?: string
  preprocessingStatus?: PreprocessingStatus
  exceptionReason?: string
}

export interface ManifestSummary {
  totalFiles: number
  validFiles: number
  criticalErrors: number
  expectedCount: number
  receivedCount: number
  coveragePercent: number
  missingProperties: string[]
  unassignedFiles: number
  duplicatesCount: number
  unresolvedDuplicates: number
  canProcess: boolean
}

export interface ProjectMember {
  userId: string
  projectId: string
  email?: string
  role: ProjectRole
  createdAt: string
  isActive?: boolean
}

export interface Project {
  id: string
  name: string
  clientName?: string
  municipality: string
  department: string
  powerLine?: string
  createdAt: string
  updatedAt?: string
  isArchived?: boolean
  archivedAt?: string | null
  role?: ProjectRole
  budgetCapUsd?: number
  totalSpentUsd?: number
  statusOverall?: ProjectStatusOverall
}

export interface SourceDocument {
  id: string
  projectId: string
  batchId: string
  name: string
  kind: DocumentKind
  size: number
  uploadedAt: string
  storagePath?: string
  mimeType?: string
  sha256?: string | null
  propertyCode?: string | null
  duplicateDecision?: DuplicateDecision | null
  duplicateOfDocumentId?: string | null
  pageCount?: number | null
  isScanned?: boolean | null
  needsOcr?: boolean | null
  ocrApplied?: boolean | null
  textOrigin?: TextOrigin | null
  isEncrypted?: boolean | null
  workingText?: string | null
  preprocessingStatus?: PreprocessingStatus | null
  exceptionReason?: string | null
}

export interface Batch {
  id: string
  projectId: string
  name: string
  createdAt: string
  jobState: JobState
  progress: number
  runId: string | null
  error: string | null
  documentCount?: number
  attempts?: number
  expectedProperties?: string[]
  manifestSummary?: ManifestSummary | null
  tasks?: DocumentTask[]
  isPaused?: boolean
}

export interface PropertyRecord {
  id: string
  projectId: string
  sourceDocumentId: string
  name: string
  folio: string
  municipality: string
  reviewState: ReviewState
  confidence: number
  fields: Record<string, string>
  updatedAt: string
  sourceName?: string
}

export interface ReviewTask {
  id: string
  recordId: string
  title: string
  reason: string
  severity: 'alta' | 'media' | 'baja'
  state: ReviewState
  createdAt?: string
  resolvedAt?: string | null
}

export interface AuditEvent {
  id: string
  projectId: string
  at: string
  action: string
  detail: string
  actorId?: string | null
}

export interface ExtractorConfig {
  extractorKey: 'title_study' | 'plan' | 'negotiation'
  provider: 'openai' | 'anthropic' | 'deepseek' | 'azure_openai'
  primaryModel: string
  fallbackModel?: string | null
  fallbackProvider?: 'openai' | 'anthropic' | 'deepseek' | 'azure_openai' | null
  temperature: number
  maxTokens: number
  timeoutSeconds: number
  isEnabled: boolean
  updatedAt?: string
}

export interface PromptVersion {
  id: string
  extractorKey: 'title_study' | 'plan' | 'negotiation'
  version: number
  name: string
  prompt: string
  schema: Record<string, unknown>
  active: boolean
  createdAt: string
}

export interface AiExecutionLog {
  id: string
  projectId?: string | null
  batchId?: string | null
  taskId?: string | null
  documentId?: string | null
  extractorKey: 'title_study' | 'plan' | 'negotiation'
  promptVersionId?: string | null
  promptVersionNumber?: number | null
  requestedModel: string
  usedModel: string
  fallbackTriggered: boolean
  fallbackReason?: string | null
  status: 'success' | 'failed' | 'fallback_success'
  latencyMs: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCostUsd: number
  errorMessage?: string | null
  isTestRun: boolean
  createdAt: string
}

export interface PromptTestRequest {
  extractorKey: 'title_study' | 'plan' | 'negotiation'
  promptText: string
  schema: Record<string, unknown>
  sampleInput: string
  modelOverride?: string
}

export interface PromptTestResult {
  success: boolean
  output: Record<string, unknown> | null
  validationErrors: string[]
  tokens: { prompt: number; completion: number; total: number }
  latencyMs: number
  modelUsed: string
  isTestRun: true
}

export type ProjectStatusOverall = 'sin_lotes' | 'en_carga' | 'en_revision' | 'aprobado' | 'exportado' | 'archivado'
export type VisualDensity = 'comfortable' | 'compact'

export type TemplateKey = 'oferta_economica' | 'acta_acuerdo' | 'bitacora' | 'poder' | 'promesa' | 'escritura'

export interface ProjectConfiguration {
  id?: string
  projectId: string
  sessionTimeoutMinutes: number
  mfaRequired: boolean
  allowedWebOrigins: string[]
  maxFilesPerBatch: number
  maxBatchSizeMb: number
  allowedMimeTypes: string[]
  retentionDaysRaw: number
  retentionDaysDerivatives: number
  retentionDaysExports: number
  autoPurgeEnabled: boolean
  budgetCapUsd: number
  budgetAlertThresholdPercent: number
  createdAt?: string
  updatedAt?: string
}

export interface SensitiveDataAuditLog {
  id: string
  projectId: string
  actorId?: string | null
  actorEmail: string
  resourceType: 'property_record' | 'document' | 'attribute' | 'export' | 'negotiation'
  resourceId: string
  propertyCode?: string | null
  action: 'view' | 'download' | 'export' | 'modify' | 'delete' | 'approve'
  sensitiveFields: string[]
  ipAddress?: string | null
  userAgent?: string | null
  createdAt: string
}

export interface DocumentVersion {
  id: string
  documentId: string
  projectId: string
  versionNumber: number
  fileName: string
  storagePath: string
  sizeBytes: number
  sha256: string
  isCurrent: boolean
  changeSummary?: string | null
  createdBy?: string | null
  createdAt: string
}

export interface FileScanLog {
  id: string
  documentId?: string | null
  fileName: string
  scanStatus: 'clean' | 'infected' | 'quarantined' | 'bypassed'
  threatDetails?: string | null
  engineName: string
  engineVersion: string
  scannedAt: string
}

export interface NegotiationRecord {
  id: string
  projectId: string
  batchId: string
  propertyCode: string
  initialOfferNum?: number | null
  initialOfferText?: string | null
  negotiatedOfferNum?: number | null
  negotiatedOfferText?: string | null
  finalOfferNum?: number | null
  finalOfferText?: string | null
  offersMatchStatus: 'coinciden' | 'discrepancia' | 'incompleto'
  cellReferences: Record<string, string>
  isApproved: boolean
  correctedManually: boolean
  reviewerNotes?: string | null
  createdAt: string
  updatedAt: string
}

export interface DocumentTemplate {
  id: string
  projectId?: string | null
  templateKey: TemplateKey
  name: string
  version: number
  requiredFields: string[]
  templateBody: string
  isActive: boolean
  createdAt: string
}

export interface GeneratedDocument {
  id: string
  projectId: string
  propertyCode: string
  templateKey: TemplateKey
  templateVersion: number
  documentTitle: string
  status: 'preview' | 'generated' | 'blocked' | 'downloaded'
  blockingReasons: string[]
  storagePath?: string | null
  sourceDataSnapshot: Record<string, unknown>
  createdBy?: string | null
  createdAt: string
}

export interface AttributeChangeHistoryItem {
  id: string
  projectId: string
  propertyCode: string
  attributeKey: string
  previousValue?: string | null
  newValue?: string | null
  authorId?: string | null
  authorName: string
  reason: string
  changeType: 'ai_extraction' | 'manual_edit' | 'bulk_approved' | 'restored' | 'rule_normalization'
  createdAt: string
}

export interface ProjectSnapshot {
  id: string
  projectId: string
  snapshotType: 'backup' | 'configuration_clone' | 'pre_migration'
  label: string
  payload: Record<string, unknown>
  createdBy?: string | null
  createdAt: string
}

export interface PlatformState {
  projects: Project[]
  batches: Batch[]
  documents: SourceDocument[]
  records: PropertyRecord[]
  reviews: ReviewTask[]
  audit: AuditEvent[]
  tasks: DocumentTask[]
  extractorConfigs: ExtractorConfig[]
  promptVersions: PromptVersion[]
  aiLogs: AiExecutionLog[]
  projectConfigurations?: Record<string, ProjectConfiguration>
  sensitiveLogs?: SensitiveDataAuditLog[]
  documentVersions?: DocumentVersion[]
  fileScanLogs?: FileScanLog[]
  negotiations?: NegotiationRecord[]
  templates?: DocumentTemplate[]
  generatedDocs?: GeneratedDocument[]
  changeHistory?: AttributeChangeHistoryItem[]
  snapshots?: ProjectSnapshot[]
}

export interface UploadProgress {
  fileName: string
  percent: number
  completedFiles: number
  totalFiles: number
}

// ==========================================
// TIPOS P2: CAPACIDADES AVANZADAS EMPRESARIALES
// ==========================================

export type SsoProvider = 'azure_ad' | 'okta' | 'google_workspace' | 'saml2'

export interface SsoConfiguration {
  id: string
  projectId?: string
  providerName: SsoProvider
  entityId: string
  metadataUrl?: string
  clientId: string
  clientSecret?: string
  issuer: string
  defaultRole: UserRole
  roleClaimMapping: Record<string, UserRole>
  isActive: boolean
}

export interface ElectronicSignatureRecord {
  id: string
  documentId: string
  projectId: string
  propertyCode: string
  provider: 'docusign' | 'certicamara' | 'internal_otp'
  envelopeId: string
  signerEmail: string
  signerName: string
  signerRole: string
  documentSha256: string
  timestampToken?: string
  status: 'pending' | 'signed' | 'declined' | 'expired'
  certificateDetails?: Record<string, unknown>
  signedAt?: string
  createdAt: string
}

export interface ManifestImportRow {
  propertyCode: string
  expectedDocumentType: string
  expectedFileName?: string
  presumedOwner?: string
  notes?: string
  isMatched?: boolean
  matchedFile?: string
}

export interface ManifestImportResult {
  totalRows: number
  matchedRows: number
  unmatchedRows: number
  rows: ManifestImportRow[]
  discrepancies: string[]
}

export type ServitudeType = 'transito' | 'vuelo_linea' | 'acceso' | 'subestacion'

export interface PropertyValuationInput {
  propertyCode: string
  commercialCadastralValue: number
  areaAffectedM2: number
  totalAreaM2: number
  servitudeType: ServitudeType
  hasImprovements: boolean
  improvementsValue?: number
}

export interface NegotiationFormulaRule {
  id: string
  name: string
  servitudeCoefficients: Record<ServitudeType, number> // Factor según tipo (ej. vuelo 0.35, transito 0.60)
  voluntaryAgreementBonusPercent: number // Bonificación por firma voluntaria (ej. 10%)
  negotiationMarginPercent: number // Margen entre oferta inicial y techo (ej. 15%)
  minOfferCapUsd?: number
  maxOfferCapUsd?: number
}

export interface OfferLadderResult {
  propertyCode: string
  baseDamageValue: number
  initialOffer: number
  negotiatedOffer: number
  finalOffer: number
  voluntaryBonus: number
  ruleApplied: string
  calculationDetails: string[]
}

export interface CustomDynamicTemplate {
  id: string
  projectId: string
  templateKey: string
  name: string
  description?: string
  format: 'txt' | 'docx' | 'xlsx'
  rawContent: string
  detectedPlaceholders: string[]
  fieldMappings: Record<string, string> // placeholder -> attributeKey
  isActive: boolean
  version: number
  createdBy?: string | null
  createdAt: string
  updatedAt: string
}

export type CorporateNotificationChannel = 'teams' | 'slack' | 'email_smtp' | 'whatsapp'

export interface CorporateNotificationPayload {
  projectId: string
  eventType: 'batch_blocked' | 'budget_alert' | 'system_degraded' | 'all_approved' | 'security_anomaly'
  title: string
  message: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
  metadata?: Record<string, unknown>
  timestamp: string
}

export interface NotificationChannelConfig {
  id: string
  projectId?: string
  channelType: CorporateNotificationChannel
  webhookUrl?: string
  targetRecipients: string[]
  eventsSubscribed: string[]
  isEnabled: boolean
}

export type CapacityAlertLevel = 'normal' | 'warning_70' | 'critical_85' | 'exhausted_95'

export interface CapacityQuotaStatus {
  serviceName: 'openai' | 'gemini' | 'supabase_storage' | 'worker_pool'
  currentUsage: number
  capacityLimit: number
  unit: 'tokens' | 'megabytes' | 'active_jobs' | 'usd'
  percentConsumed: number
  alertLevel: CapacityAlertLevel
  recommendation: string
}

