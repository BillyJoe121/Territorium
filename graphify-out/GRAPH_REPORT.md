# Graph Report - Territorium  (2026-09-18)

## Corpus Check
- 206 files · ~158,413 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1388 nodes · 2825 edges · 105 communities (80 shown, 25 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 50 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0ac04a36`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- pipeline.py
- e2eFlowP1.test.ts
- masterRecordReconciliation.ts
- Project
- reopenedStoriesAcceptance.test.ts
- dependencies
- loadBenchmarkP2.test.ts
- IngestionView.tsx
- ExpedientePrototype.tsx
- App.tsx
- publicNotaryPortal.ts
- platformRepository.ts
- p1ComponentsAndFlow.test.ts
- Fase 1 — Prototipo frontend navegable
- scripts
- AdminComponents.tsx
- Backlog de historias de usuario de Territorium
- p0ComponentsAndFlow.test.ts
- compilerOptions
- Territorium — extracción predial asistida
- AuthContext.tsx
- compilerOptions
- 4. Backlog de 100 Nuevas Historias de Usuario (US-201 a US-300)
- seed.ts
- P1AnalyticsCharts.tsx
- TemplateEditorWithVariables.tsx
- extractorConfig.ts
- SessionGuard.tsx
- Decisiones de implementación
- Estado de historias de usuario
- Títulos de historias de usuario no completas y reabiertas por auditoría
- negotiationExtraction.ts
- expedienteV2Repository.ts
- Estado de cierre — 2026-09-17
- ExcelExportConfigModal.tsx
- expedienteWorkflow.ts
- manage-users/index.ts
- Arquitectura de producción
- ActionDropdown.tsx
- imports
- create-batch-job/index.ts
- DetailDrawer.tsx
- RadixSwitch.tsx
- tsconfig.json
- gap-pmo-territorium.md
- walkthrough.md
- Fase 4 — Preprocesamiento y extractores
- Fase 3 — Carga y procesamiento asíncrono
- SupabaseGateway
- Historias de usuario — Territorium 2.0
- Fase 2 — Dominio, persistencia y seguridad
- TitleStudyPayload
- 5. Mapa de pantallas y transiciones del prototipo
- Fase 5 — Revisión persistente, consolidación y Excel
- Fase 6 — Plantillas y documento final
- HUs_version2.0.md
- Fase 2 — modelo v2 del expediente
- pipeline_v2.py
- Q: Usando los grafos de graphify, analiza y compara PMO vs Terrotorium, y dime que grado de madurez tiene territorium, que cosas le faltan para lanzarlo a produccion, recuerda usar los grafos para ahorrar en tokens. Dame un informe de territorium, ahí sí ignora a PMO y solo dime todas las caracteristicas positivas y de mejora de Territorium, dime lo robusto que es en cada aspecto, como funciona, cual es su pipeline, que sí puede hacer, que falta que sea capaz de hacer. La idea es presentarle ese informa a mi jefe y mostrarle lo que he desarrollado desde cero, el estado actual, las capacidades/caracteristicas del sistema, su estado en pruebas, su estado en supabase, su logica. Todo, todo todo.
- expediente_v2.py
- Índice de Documentación Técnica y Operativa Oficial en PDF
- DocumentPrototypeEditor.tsx
- NotaryLinksAdminModal.tsx
- negotiation_extractor.py
- src/types.ts
- projectLifecycle.ts
- validator.py
- RemoteExpedienteWorkspace.tsx
- expedienteUpload.ts
- Phase4PipelineOrchestrator
- hierarchical_reducer.py
- compare_number_and_letters
- DashboardCharts.tsx
- devDependencies
- operationsObservability.ts
- LegalDocumentGenerator.tsx
- process_job
- Batch
- DataComponents.tsx
- main.py
- ProjectComponents.tsx
- ShellComponents.tsx
- Phase4ExecutionResult
- DocumentKind
- expediente-analysis-request/index.ts
- .ocr_page_image_base64
- imports
- @radix-ui/react-accordion
- @radix-ui/react-popover
- @radix-ui/react-scroll-area
- @radix-ui/react-switch
- @radix-ui/react-tabs
- @radix-ui/react-tooltip
- react-dom
- react-router-dom
- recharts
- @supabase/supabase-js
- @tiptap/extension-table
- @tiptap/react
- @tiptap/starter-kit
- @types/jszip
- write-excel-file

## God Nodes (most connected - your core abstractions)
1. `SupabaseGateway` - 49 edges
2. `requireSupabase()` - 38 edges
3. `Project` - 36 edges
4. `App()` - 32 edges
5. `SourceDocument` - 25 edges
6. `Fase 1 — Prototipo frontend navegable` - 22 edges
7. `Backlog de historias de usuario de Territorium` - 22 edges
8. `Batch` - 20 edges
9. `PropertyRecord` - 20 edges
10. `PropertyMasterRecord` - 17 edges

## Surprising Connections (you probably didn't know these)
- `createGeneratedDocumentsZip()` --references--> `jszip`  [EXTRACTED]
  src/lib/documentGeneration.ts → package.json
- `extractZipArchive()` --references--> `jszip`  [EXTRACTED]
  src/lib/batchValidation.ts → package.json
- `extractDocxWorkingText()` --references--> `jszip`  [EXTRACTED]
  src/lib/documentPreprocessor.ts → package.json
- `renderDocxTemplate()` --references--> `jszip`  [EXTRACTED]
  src/lib/dynamicTemplateManagerP2.ts → package.json
- `uploadExpedienteFiles()` --indirect_call--> `file()`  [INFERRED]
  src/data/expedienteUpload.ts → src/components/expediente/types.ts

## Import Cycles
- None detected.

## Communities (105 total, 25 thin omitted)

### Community 0 - "pipeline.py"
Cohesion: 0.15
Nodes (18): Exception, OpenAIExtractionProvider, Any, ExtractorConfig, AiExecutionResult, DocumentTask, Evidence, ExtractedAttribute (+10 more)

### Community 1 - "e2eFlowP1.test.ts"
Cohesion: 0.14
Nodes (25): assignTaskToUser(), BatchPauseResult, BudgetCheckResult, comparePromptVersions(), evaluateBudgetCap(), ExceptionManualAction, pauseBatch(), PromptComparisonResult (+17 more)

### Community 2 - "masterRecordReconciliation.ts"
Cohesion: 0.06
Nodes (56): LegalDocumentGeneratorProps, ReviewStationProps, ReviewStationView(), DeliverablesView(), DeliverablesViewProps, BulkApprovalResult, bulkApproveUncontestedAttributes(), ColumnMappingDefinition (+48 more)

### Community 3 - "Project"
Cohesion: 0.11
Nodes (21): PageHeader(), PageHeaderProps, BadgeStatus, StatusBadge(), StatusBadgeProps, FilterStatus, ProjectsManagementView(), ProjectsManagementViewProps (+13 more)

### Community 4 - "reopenedStoriesAcceptance.test.ts"
Cohesion: 0.07
Nodes (36): computeCryptoSha256(), createVerifiableElectronicSignature(), generateRfc3161TimeStampToken(), RFC3161TimeStampToken, SignatureVerificationResult, RFC-3161, VerifiableSignatureRecord, verifyDigitalSignature() (+28 more)

### Community 5 - "dependencies"
Cohesion: 0.12
Nodes (17): lucide-react, dependencies, lucide-react, @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, react, sonner, @tanstack/react-table (+9 more)

### Community 6 - "loadBenchmarkP2.test.ts"
Cohesion: 0.17
Nodes (16): DynamicTemplateEditor(), DynamicTemplateEditorProps, createDynamicTemplate(), extractPlaceholdersFromTemplate(), renderDynamicTemplate(), processExcelManifestRows(), RawExcelManifestRow, calculateOfferLadder() (+8 more)

### Community 7 - "IngestionView.tsx"
Cohesion: 0.14
Nodes (27): jszip, jszip, IngestionView(), IngestionViewProps, kindLabels, stateLabels, ALLOWED_EXTENSIONS, analyzeBatchDuplicates() (+19 more)

### Community 8 - "ExpedientePrototype.tsx"
Cohesion: 0.12
Nodes (27): cloneRows(), consolidationLabel(), ConsolidationState, DetailView, documentLabel(), ExpedientePrototype(), FinalDocumentState, GroupCard() (+19 more)

### Community 9 - "App.tsx"
Cohesion: 0.08
Nodes (14): kindLabels, NavGroup, navGroups, NavItem, projectScopedScreens, Screen, screenLabels, stateLabels (+6 more)

### Community 10 - "publicNotaryPortal.ts"
Cohesion: 0.13
Nodes (25): PublicNotaryPortal(), PublicNotaryPortalProps, ShareNotaryLinkModal(), ShareNotaryLinkModalProps, computeTokenHmac(), createOtpChallenge(), generateNotaryShareToken(), generateSecureNotaryAccessToken() (+17 more)

### Community 11 - "platformRepository.ts"
Cohesion: 0.09
Nodes (43): App(), date(), makeId(), screenRequiresProject(), canonicalRoles, roleDescriptions, UsersManagementView(), activateRemotePromptVersion() (+35 more)

### Community 12 - "p1ComponentsAndFlow.test.ts"
Cohesion: 0.09
Nodes (19): AccessibleAccordion(), AccessibleAccordionProps, AccordionSection, AccessibleTabs(), AccessibleTabsProps, TabItem, ButtonWithSpinner(), ButtonWithSpinnerProps (+11 more)

### Community 13 - "Fase 1 — Prototipo frontend navegable"
Cohesion: 0.09
Nodes (23): Checkpoint de Fase 1, Fase 1 — Prototipo frontend navegable, HU-V2-001 — Navegación interna de la ficha de expediente, HU-V2-002 — Contrato de estados y repositorio simulado, HU-V2-003 — Resumen de expediente para un único predio, HU-V2-004 — Espacio de extracción en tres columnas, HU-V2-005 — Tarjeta de carga de Títulos, HU-V2-006 — Tarjeta de carga de Planos (+15 more)

### Community 14 - "scripts"
Cohesion: 0.15
Nodes (12): name, private, scripts, build, check, dev, preview, test (+4 more)

### Community 16 - "Backlog de historias de usuario de Territorium"
Cohesion: 0.09
Nodes (22): Alcance y convenciones, Backlog de historias de usuario de Territorium, Dependencias y decisiones abiertas, E01 Seguridad, usuarios y acceso, E02 Proyectos, participantes y ciclo de vida, E03 Lotes, carga y manifiesto de insumos, E04 Almacenamiento y preprocesamiento documental, E05 Trabajos, colas y recuperación ante fallos (+14 more)

### Community 17 - "p0ComponentsAndFlow.test.ts"
Cohesion: 0.12
Nodes (17): BentoGridKpis(), BentoGridKpisProps, DEFAULT_METRICS, KpiMetric, PropertyStatusDonut(), EnhancedDropZone(), EnhancedDropZoneProps, UploadFileItem (+9 more)

### Community 18 - "compilerOptions"
Cohesion: 0.09
Nodes (21): DOM, DOM.Iterable, ES2022, src, compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop (+13 more)

### Community 19 - "Territorium — extracción predial asistida"
Cohesion: 0.12
Nodes (15): Checklist de lanzamiento, Incidentes, Privacidad y retención, Proveedor de IA indisponible, Recuperación, Revocar acceso, Runbook de producción, Servicios y señales (+7 more)

### Community 20 - "AuthContext.tsx"
Cohesion: 0.15
Nodes (10): AuthContext, AuthProvider(), ErrorBoundary, config, hasRemoteConfiguration, parsed, schema, dataMode (+2 more)

### Community 21 - "compilerOptions"
Cohesion: 0.13
Nodes (14): ES2023, vite.config.ts, compilerOptions, allowImportingTsExtensions, lib, module, moduleDetection, moduleResolution (+6 more)

### Community 22 - "4. Backlog de 100 Nuevas Historias de Usuario (US-201 a US-300)"
Cohesion: 0.14
Nodes (13): 1. Visión y Objetivo Estratégico, 2. Ecosistema de Componentes y Stack Tecnológico UI, 3. Mapa de Rutas de la Aplicación, 4. Backlog de 100 Nuevas Historias de Usuario (US-201 a US-300), 5. Plan de Ejecución por Fases, Backlog de Modernización UI/UX: Superar la Calidad de PMO en Territorium, Épica UX-01: Enrutamiento Declarativo, Layouts Anidados y Deep Linking (US-201 a US-215), Épica UX-02: Sistema de Diseño, Tokens Visuales y Primitivas Radix UI (US-216 a US-230) (+5 more)

### Community 23 - "seed.ts"
Cohesion: 0.32
Nodes (5): now, seedState, loadState(), saveState(), PlatformState

### Community 24 - "P1AnalyticsCharts.tsx"
Cohesion: 0.14
Nodes (13): AiConfidenceDonutChart(), AiConfidenceDonutChartProps, BatchesTreemap(), BatchesTreemapProps, BatchTreemapNode, DocumentMaturityPoint, MaturityRadarChart(), MaturityRadarChartProps (+5 more)

### Community 25 - "TemplateEditorWithVariables.tsx"
Cohesion: 0.21
Nodes (9): TemplateEditorWithVariables(), TemplateEditorWithVariablesProps, AutoSaveIndicator(), AutoSaveIndicatorProps, SaveStatus, LEGAL_VARIABLES, LegalVariableOption, VariablePillsSelector() (+1 more)

### Community 26 - "extractorConfig.ts"
Cohesion: 0.15
Nodes (22): ConfigurationViewProps, extractorLabels, TabKey, activatePromptVersion(), AVAILABLE_AI_MODELS, calculateEstimatedCost(), calculateExtractorCost, createAiExecutionLog() (+14 more)

### Community 27 - "SessionGuard.tsx"
Cohesion: 0.13
Nodes (11): AuthContextValue, useAuth(), AuthScreen(), Mode, SessionGuard(), SessionGuardProps, InviteUserModal(), InviteUserModalProps (+3 more)

### Community 28 - "Decisiones de implementación"
Cohesion: 0.25
Nodes (7): 2026-09-17 — Base paralela, no renombrar PMO, 2026-09-17 — IA con validación semántica y recuperación acotada, 2026-09-17 — Mesas de trabajo, no editores de archivos fuente, 2026-09-17 — Procesamiento fuera de Edge Functions, 2026-09-17 — Resultados sujetos a revisión, 2026-09-17 — Sistema visual operacional propio, Decisiones de implementación

### Community 29 - "Estado de historias de usuario"
Cohesion: 0.22
Nodes (8): Avances parciales que no deben confundirse con cierre, Criterio de corte y Auditoría de Calidad, Dependencias de cierre, Estado de historias de usuario, Historias de Núcleo y Plataforma Base Verificadas en Repositorio, Historias Parciales en Validación con Corpus Real (US-066 a US-093), Historias Reabiertas en Endurecimiento y Cierre Técnico Activo, No completas (0)

### Community 30 - "Títulos de historias de usuario no completas y reabiertas por auditoría"
Cohesion: 0.25
Nodes (7): Historias de Usuario Pendientes de Implementación (38 restantes), Historias P0 Completadas y Verificadas (27/27), Historias P1 Completadas y Verificadas (35/35), Prioridad P2: Excelencia Sensorial, Analítica Avanzada y Flujos de Cierre (38 historias), Prioridad P2: Excelencia Sensorial, Analítica Avanzada y Flujos de Cierre (38 historias), Resumen de Estado del Backlog UI/UX Activo, Títulos de historias de usuario no completas y reabiertas por auditoría

### Community 31 - "negotiationExtraction.ts"
Cohesion: 0.16
Nodes (18): aggregateTechnicalPlansSummary(), APPROVED_NEGOTIATION_COLUMNS, BoundaryDiffResult, correctNegotiationOfferManually(), detectNegotiationAnomalies(), extractNegotiationOffers(), formatExcelCell(), GeometricValidationResult (+10 more)

### Community 32 - "expedienteV2Repository.ts"
Cohesion: 0.09
Nodes (14): asGroupKey(), assertCompleteGroups(), createExpedienteV2Repository(), CreateExpedienteV2RepositoryOptions, DemoExpedienteV2Repository, ExpedientePropertyIdentity, ExpedienteV2Repository, ExpedienteV2RepositoryMode (+6 more)

### Community 33 - "Estado de cierre — 2026-09-17"
Cohesion: 0.40
Nodes (4): Estado de cierre — 2026-09-17, Estado operativo, No ejecutado para evitar cambios remotos no confirmados, Terminado y verificado

### Community 34 - "ExcelExportConfigModal.tsx"
Cohesion: 0.50
Nodes (4): DEFAULT_EXCEL_SHEETS, ExcelExportConfigModal(), ExcelExportConfigModalProps, ExcelSheetConfig

### Community 35 - "expedienteWorkflow.ts"
Cohesion: 0.27
Nodes (9): allGroupsApproved(), allowedTransitions, canTransitionGroupStatus(), deriveConsolidationStatus(), expedienteGroupKeys, GroupWorkflowState, invalidateForInputChange(), transitionGroupStatus() (+1 more)

### Community 36 - "manage-users/index.ts"
Cohesion: 0.50
Nodes (4): allowedOrigins, cors(), json(), ManageUserPayload

### Community 37 - "Arquitectura de producción"
Cohesion: 0.50
Nodes (3): Arquitectura de producción, Flujo, Límites de confianza

### Community 39 - "imports"
Cohesion: 0.50
Nodes (3): imports, @supabase/functions-js, @supabase/server

### Community 40 - "create-batch-job/index.ts"
Cohesion: 0.67
Nodes (3): allowedOrigins, cors(), json()

### Community 48 - "Fase 4 — Preprocesamiento y extractores"
Cohesion: 0.20
Nodes (10): Checkpoint de Fase 4, Fase 4 — Preprocesamiento y extractores, HU-V2-034 — Representación documental canónica, HU-V2-035 — Detección de escaneo y OCR selectivo, HU-V2-036 — Lectura determinista de negociación XLSX, HU-V2-037 — Segmentación exhaustiva y reducción jerárquica, HU-V2-038 — Extractor de Títulos, HU-V2-039 — Extractor de Planos (+2 more)

### Community 49 - "Fase 3 — Carga y procesamiento asíncrono"
Cohesion: 0.22
Nodes (9): Checkpoint de Fase 3, Fase 3 — Carga y procesamiento asíncrono, HU-V2-027 — Carga privada, reanudable y validada, HU-V2-028 — Hash, duplicados y reutilización documental, HU-V2-029 — API de creación idempotente de análisis, HU-V2-030 — Cola durable y worker externo, HU-V2-031 — Progreso real mediante Realtime, HU-V2-032 — Caché versionada de extracción (+1 more)

### Community 50 - "SupabaseGateway"
Cohesion: 0.11
Nodes (12): DocumentTask, PromptVersion, Response, RuntimeError, Job, fail_job(), Any, ExtractorConfig (+4 more)

### Community 51 - "Historias de usuario — Territorium 2.0"
Cohesion: 0.25
Nodes (8): 1. Propósito, 2. Alcance funcional objetivo, 3.1 Prioridad, 3.2 Dificultad, 3.3 Estados principales, 3. Convenciones, 4. Decisiones y supuestos de planificación, Historias de usuario — Territorium 2.0

### Community 52 - "Fase 2 — Dominio, persistencia y seguridad"
Cohesion: 0.25
Nodes (8): Checkpoint de Fase 2, Fase 2 — Dominio, persistencia y seguridad, HU-V2-021 — Modelo un expediente–un predio, HU-V2-022 — Grupos documentales y versiones de archivos, HU-V2-023 — Ejecuciones y tareas versionadas, HU-V2-024 — Resultados, correcciones y aprobaciones inmutables, HU-V2-025 — Reglas transaccionales de invalidación, HU-V2-026 — RLS, permisos y auditoría del nuevo dominio

### Community 53 - "TitleStudyPayload"
Cohesion: 0.14
Nodes (14): PlanExtractor, Any, PlanExtractionPayload, BaseModel, Any, Extracts title study fields using OpenAI Structured Outputs if available, or…, Deterministic regex and structural parser for Colombian title study documents.…, TitleStudyExtractor (+6 more)

### Community 54 - "5. Mapa de pantallas y transiciones del prototipo"
Cohesion: 0.29
Nodes (7): 5.1 Ficha de expediente — Resumen, 5.2 Ficha de expediente — Extracción y consolidación, 5.3 Modal de resultados de subconjunto, 5.4 Modal de consolidado, 5.5 Ficha de expediente — Documento final, 5.6 Transiciones, 5. Mapa de pantallas y transiciones del prototipo

### Community 55 - "Fase 5 — Revisión persistente, consolidación y Excel"
Cohesion: 0.29
Nodes (7): Checkpoint de Fase 5, Fase 5 — Revisión persistente, consolidación y Excel, HU-V2-042 — TanStack Table conectado a resultados reales, HU-V2-043 — Autoguardado y concurrencia de edición, HU-V2-044 — Aprobación y reproceso de versiones reales, HU-V2-045 — Consolidación versionada del predio, HU-V2-046 — Generación y descarga del Excel consolidado

### Community 56 - "Fase 6 — Plantillas y documento final"
Cohesion: 0.29
Nodes (7): Checkpoint de Fase 6, Fase 6 — Plantillas y documento final, HU-V2-047 — Plantilla documental versionada, HU-V2-048 — Combinación determinista de campos, HU-V2-049 — Documento real editable con Tiptap, HU-V2-050 — Revisión del documento por IA con comentarios, HU-V2-051 — PDF final y artefactos vinculados

### Community 57 - "HUs_version2.0.md"
Cohesion: 0.15
Nodes (12): 10. Definición de terminado por historia, 7. Orden recomendado de ejecución y paralelización, 8. Riesgos y mitigaciones, 9. Decisiones pendientes antes de la fase correspondiente, Checkpoint de Fase 7, Dependencias resumidas, Fase 7 — Migración, retiro del flujo anterior y endurecimiento, HU-V2-052 — Migración controlada de expedientes existentes (+4 more)

### Community 58 - "Fase 2 — modelo v2 del expediente"
Cohesion: 0.29
Nodes (6): Activación gradual del frontend, Alcance y compatibilidad, Fase 2 — modelo v2 del expediente, Garantías del servidor, Recuperación, Verificación antes de activar Supabase

### Community 59 - "pipeline_v2.py"
Cohesion: 0.18
Nodes (17): CanonicalDocument, DocumentFragment, FragmentLocator, PageScanInfo, Any, BaseModel, StrEnum, ScanClassification (+9 more)

### Community 60 - "Q: Usando los grafos de graphify, analiza y compara PMO vs Terrotorium, y dime que grado de madurez tiene territorium, que cosas le faltan para lanzarlo a produccion, recuerda usar los grafos para ahorrar en tokens. Dame un informe de territorium, ahí sí ignora a PMO y solo dime todas las caracteristicas positivas y de mejora de Territorium, dime lo robusto que es en cada aspecto, como funciona, cual es su pipeline, que sí puede hacer, que falta que sea capaz de hacer. La idea es presentarle ese informa a mi jefe y mostrarle lo que he desarrollado desde cero, el estado actual, las capacidades/caracteristicas del sistema, su estado en pruebas, su estado en supabase, su logica. Todo, todo todo."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Usando los grafos de graphify, analiza y compara PMO vs Terrotorium, y dime que grado de madurez tiene territorium, que cosas le faltan para lanzarlo a produccion, recuerda usar los grafos para ahorrar en tokens. Dame un informe de territorium, ahí sí ignora a PMO y solo dime todas las caracteristicas positivas y de mejora de Territorium, dime lo robusto que es en cada aspecto, como funciona, cual es su pipeline, que sí puede hacer, que falta que sea capaz de hacer. La idea es presentarle ese informa a mi jefe y mostrarle lo que he desarrollado desde cero, el estado actual, las capacidades/caracteristicas del sistema, su estado en pruebas, su estado en supabase, su logica. Todo, todo todo., Source Nodes

### Community 61 - "expediente_v2.py"
Cohesion: 0.22
Nodes (15): cache_key(), detect_mime(), payload_sha256(), PermanentValidationError, process_expediente_v2_task(), Any, Durable, content-safe preparation worker for Territorium expediente v2. This is…, Complete one lease without logging source names or legal content. (+7 more)

### Community 62 - "Índice de Documentación Técnica y Operativa Oficial en PDF"
Cohesion: 0.50
Nodes (3): 1. Documentos Disponibles en Carpeta `docs/pdf/`, 2. Instrucciones para Abrir y Visualizar, Índice de Documentación Técnica y Operativa Oficial en PDF

### Community 64 - "NotaryLinksAdminModal.tsx"
Cohesion: 0.50
Nodes (4): NotaryLinkRecord, NotaryLinksAdminModal(), NotaryLinksAdminModalProps, NotaryShareTokenPayload

### Community 65 - "negotiation_extractor.py"
Cohesion: 0.17
Nodes (16): _format_currency_cop(), NegotiationExtractor, Deterministically extracts and validates negotiation values from an XLSX…, NegotiationExtractionPayload, BaseModel, _clean_numeric_value(), NegotiationBookResult, NegotiationCell (+8 more)

### Community 66 - "src/types.ts"
Cohesion: 0.17
Nodes (17): SsoAndNotificationSettings(), dispatchCorporateNotification(), evaluateServiceCapacity(), formatCorporateNotificationPayload(), NotificationDeliveryResult, CapacityAlertLevel, CapacityQuotaStatus, CorporateNotificationChannel (+9 more)

### Community 67 - "projectLifecycle.ts"
Cohesion: 0.16
Nodes (16): computeProjectOverallStatus(), createProjectBackupSnapshot(), createSensitiveAuditEntry(), duplicateProjectConfiguration(), DuplicateProjectOptions, evaluateDocumentRetention(), HealthCheckReport, performSystemHealthCheck() (+8 more)

### Community 68 - "validator.py"
Cohesion: 0.35
Nodes (11): AuditRepair, BaseModel, validate_and_normalize_cadastral_id(), validate_and_normalize_doc_number(), validate_and_normalize_folio(), validate_boundaries_text(), ValidationIssue, BaseModel (+3 more)

### Community 69 - "RemoteExpedienteWorkspace.tsx"
Cohesion: 0.21
Nodes (15): groupInfo, orderedKeys, progressFor(), RemoteExpedienteWorkspace(), statusText(), groupKey(), loadRemoteExpedienteProcessing(), RemoteExpedienteExecution (+7 more)

### Community 70 - "expedienteUpload.ts"
Cohesion: 0.20
Nodes (13): allowedByGroup, DuplicateDecision, expedienteTusEndpoint(), extensionMime, extensionOf(), requestExpedienteAnalysis(), resolveExpedienteMime(), sha256File() (+5 more)

### Community 71 - "Phase4PipelineOrchestrator"
Cohesion: 0.14
Nodes (8): Phase4PipelineOrchestrator, Executes end-to-end Phase 4 processing for an entire document group of an…, Production orchestrator for Phase 4 (HU-V2-034 to HU-V2-041): Canonical Parsing…, detect_scan_and_ocr_needs(), Any, Evaluates scan condition per page according to HU-V2-035. Identifies pages that…, ScanAnalysisResult, Phase4EndToEndTests

### Community 72 - "hierarchical_reducer.py"
Cohesion: 0.19
Nodes (10): FieldDiscrepancy, ProvenanceReference, Any, BaseModel, Reduces multi-plan extractions into a consolidated technical view. Retains…, Executes a list of coroutine factories with bounded concurrency., Reduces title extraction fragments into a single canonical title study record.…, ReducedExtractionResult (+2 more)

### Community 73 - "compare_number_and_letters"
Cohesion: 0.21
Nodes (9): compare_number_and_letters(), _convert_group(), _normalize_spanish_text(), number_to_spanish_words(), Compares a numeric offer against its written expression in words. Returns…, Removes accents, uppercase, standardizes spaces and currency suffixes., Converts a 3-digit number (0-999) to Spanish words., Converts a numeric amount (e.g. Colombian Pesos) into uppercase Spanish words.… (+1 more)

### Community 74 - "DashboardCharts.tsx"
Cohesion: 0.20
Nodes (10): BatchStatusData, DashboardCharts(), DashboardChartsProps, DEFAULT_DISCREPANCIES, DEFAULT_STATUS_DATA, DiscrepancyBarChart(), DiscrepancyCategoryData, ProjectWorkloadData (+2 more)

### Community 75 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @types/react, @types/react-dom, typescript, vite, @vitejs/plugin-react, vitest, @types/react (+5 more)

### Community 76 - "operationsObservability.ts"
Cohesion: 0.19
Nodes (10): analyzeQueueObservability(), calculateCompletenessMetrics(), CompletenessMetrics, computeExecutionMetricsSummary(), evaluateServicesHealth(), ExecutionMetricsSummary, ModelMetricsBreakdown, PropertyTraceabilityReport (+2 more)

### Community 77 - "LegalDocumentGenerator.tsx"
Cohesion: 0.42
Nodes (9): LegalDocumentGenerator(), createGeneratedDocumentsZip(), DEFAULT_LEGAL_TEMPLATES, generateLegalDocument(), renderDocumentTemplate(), validateTemplateRequirements(), ValidationRequirementsResult, exportOperationalMetricsToCsv() (+1 more)

### Community 78 - "process_job"
Cohesion: 0.26
Nodes (6): process_job(), SourceDocument, resolve_extractor(), retry_delay(), PipelineTests, SourceDocument

### Community 79 - "Batch"
Cohesion: 0.33
Nodes (9): CommandItem, CommandPalette(), CommandPaletteProps, OperationalHomeViewProps, ProjectDetailView(), ProjectDetailViewProps, Batch, PropertyRecord (+1 more)

### Community 80 - "DataComponents.tsx"
Cohesion: 0.20
Nodes (5): ChartPanel(), KpiStripItem, ModernTooltip(), ConfirmDialog(), ConfirmDialogProps

### Community 81 - "main.py"
Cohesion: 0.33
Nodes (9): Event, FastAPI, get, expediente_v2_worker_loop(), health(), lifespan(), Processes only leased v2 ingestion tasks; no AI call occurs in Phase 3., ready() (+1 more)

### Community 85 - "Phase4ExecutionResult"
Cohesion: 0.40
Nodes (3): Phase4ExecutionResult, Any, Formats the output payload according to the public.expediente_execution_outputs…

### Community 86 - "DocumentKind"
Cohesion: 0.50
Nodes (5): BatchUploadItemInput, DocumentAnalysisResult, DocumentKind, PreprocessingStatus, TextOrigin

### Community 87 - "expediente-analysis-request/index.ts"
Cohesion: 0.50
Nodes (4): allowedOrigins, AnalysisRequest, cors(), json()

### Community 88 - ".ocr_page_image_base64"
Cohesion: 0.40
Nodes (3): OCRService, Any, Transcribes a scanned page image via Vision API.

### Community 89 - "imports"
Cohesion: 0.50
Nodes (3): imports, @supabase/functions-js, @supabase/server

## Knowledge Gaps
- **389 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+384 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `jszip` connect `IngestionView.tsx` to `LegalDocumentGenerator.tsx`, `dependencies`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `react-dom`, `react-router-dom`, `recharts`, `@supabase/supabase-js`, `@tiptap/extension-table`, `@tiptap/react`, `@tiptap/starter-kit`, `IngestionView.tsx`, `@types/jszip`, `write-excel-file`, `scripts`, `@radix-ui/react-accordion`, `@radix-ui/react-popover`, `@radix-ui/react-scroll-area`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `createGeneratedDocumentsZip()` connect `LegalDocumentGenerator.tsx` to `e2eFlowP1.test.ts`, `reopenedStoriesAcceptance.test.ts`, `IngestionView.tsx`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `SupabaseGateway` (e.g. with `AiExecutionResult` and `DocumentTask`) actually correct?**
  _`SupabaseGateway` has 12 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _389 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `e2eFlowP1.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13978494623655913 - nodes in this community are weakly interconnected._
- **Should `masterRecordReconciliation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.058384547848990345 - nodes in this community are weakly interconnected._