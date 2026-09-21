# Graph Report - Territorium  (2026-09-19)

## Corpus Check
- 241 files · ~181,643 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1604 nodes · 3342 edges · 115 communities (91 shown, 24 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 60 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e29a0d32`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- supabase_gateway.py
- batchOrchestrationP1.ts
- masterRecordReconciliation.ts
- Project
- reopenedStoriesAcceptance.test.ts
- dependencies
- loadBenchmarkP2.test.ts
- IngestionView.tsx
- RemoteExpedienteWorkspace.tsx
- App.tsx
- expedienteV2Repository.ts
- platformRepository.ts
- p1ComponentsAndFlow.test.ts
- Fase 1 — Prototipo frontend navegable
- scripts
- expedienteDocumentCompiler.ts
- Backlog de historias de usuario de Territorium
- p0ComponentsAndFlow.test.ts
- compilerOptions
- Runbook de producción — Territorium 2.0
- supabase.ts
- compilerOptions
- 4. Backlog de 100 Nuevas Historias de Usuario (US-201 a US-300)
- seed.ts
- expedienteConsolidation.ts
- TemplateEditorWithVariables.tsx
- extractorConfig.ts
- SessionGuard.tsx
- Decisiones de implementación
- Estado de historias de usuario
- Títulos de historias de usuario no completas y reabiertas por auditoría
- negotiationExtraction.ts
- DemoExpedienteV2Repository
- Estado de cierre — 2026-09-17
- ConsolidatedMasterRecord
- phase7EndToEndAndA11y.test.ts
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
- HUs_version2.0.md
- Fase 6 — Plantillas y documento final
- Fase 7 — Migración, retiro del flujo anterior y endurecimiento
- Fase 2 — modelo v2 del expediente
- pipeline_v2.py
- Q: Usando los grafos de graphify, analiza y compara PMO vs Terrotorium, y dime que grado de madurez tiene territorium, que cosas le faltan para lanzarlo a produccion, recuerda usar los grafos para ahorrar en tokens. Dame un informe de territorium, ahí sí ignora a PMO y solo dime todas las caracteristicas positivas y de mejora de Territorium, dime lo robusto que es en cada aspecto, como funciona, cual es su pipeline, que sí puede hacer, que falta que sea capaz de hacer. La idea es presentarle ese informa a mi jefe y mostrarle lo que he desarrollado desde cero, el estado actual, las capacidades/caracteristicas del sistema, su estado en pruebas, su estado en supabase, su logica. Todo, todo todo.
- ExpedienteV2WorkerTests
- Índice de Documentación Técnica y Operativa Oficial en PDF
- expedienteResultAdapters.ts
- requireSupabase
- negotiation_extractor.py
- process_document_ai_revision
- src/types.ts
- validator.py
- ExpedientePrototype.tsx
- expedienteUpload.ts
- Phase4PipelineOrchestrator
- HierarchicalReducer
- compare_number_and_letters
- DashboardCharts.tsx
- devDependencies
- operationsObservability.ts
- e2eFlowP1.test.ts
- resolve_extractor
- UsersManagementView.tsx
- DocumentComponents.tsx
- main.py
- DraftSyncController
- expedienteObservability.ts
- resilienceAndFaults.test.ts
- sanitize_telemetry_payload
- documentPreprocessor.ts
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
- ExcelExportConfigModal.tsx
- AccessibleTabs.tsx
- expedienteMigration.ts
- consolidatedExcelGenerator.ts
- ColumnSelectorPopover.tsx
- Settings
- Fase 3 — Carga privada y procesamiento asíncrono
- verify_migrations.cjs
- ProjectBreadcrumbs.tsx
- FacetedFilters.tsx

## God Nodes (most connected - your core abstractions)
1. `SupabaseGateway` - 56 edges
2. `requireSupabase()` - 46 edges
3. `Project` - 36 edges
4. `App()` - 34 edges
5. `SourceDocument` - 27 edges
6. `Fase 1 — Prototipo frontend navegable` - 22 edges
7. `Backlog de historias de usuario de Territorium` - 22 edges
8. `Batch` - 20 edges
9. `PropertyRecord` - 20 edges
10. `ExpedienteV2Repository` - 19 edges

## Surprising Connections (you probably didn't know these)
- `createGeneratedDocumentsZip()` --references--> `jszip`  [EXTRACTED]
  src/lib/documentGeneration.ts → package.json
- `extractDocxWorkingText()` --references--> `jszip`  [EXTRACTED]
  src/lib/documentPreprocessor.ts → package.json
- `extractZipArchive()` --references--> `jszip`  [EXTRACTED]
  src/lib/batchValidation.ts → package.json
- `renderDocxTemplate()` --references--> `jszip`  [EXTRACTED]
  src/lib/dynamicTemplateManagerP2.ts → package.json
- `UsersManagementViewProps` --references--> `Project`  [EXTRACTED]
  src/components/UsersManagementView.tsx → src/types.ts

## Import Cycles
- None detected.

## Communities (115 total, 24 thin omitted)

### Community 0 - "supabase_gateway.py"
Cohesion: 0.18
Nodes (21): DocumentTask, Exception, OpenAIExtractionProvider, Any, ExtractorConfig, AiExecutionResult, DocumentTask, Evidence (+13 more)

### Community 1 - "batchOrchestrationP1.ts"
Cohesion: 0.18
Nodes (17): ConfigurationViewProps, ProcessingMonitorViewProps, assignTaskToUser(), BatchPauseResult, BudgetCheckResult, comparePromptVersions(), evaluateBudgetCap(), ExceptionManualAction (+9 more)

### Community 2 - "masterRecordReconciliation.ts"
Cohesion: 0.06
Nodes (56): LegalDocumentGeneratorProps, ReviewStationProps, ReviewStationView(), DeliverablesViewProps, BulkApprovalResult, bulkApproveUncontestedAttributes(), ColumnMappingDefinition, compareMasterRecordVersions() (+48 more)

### Community 3 - "Project"
Cohesion: 0.13
Nodes (24): CommandItem, CommandPaletteProps, PageHeader(), PageHeaderProps, BadgeStatus, StatusBadge(), StatusBadgeProps, FilterStatus (+16 more)

### Community 4 - "reopenedStoriesAcceptance.test.ts"
Cohesion: 0.05
Nodes (51): SsoAndNotificationSettings(), dispatchCorporateNotification(), evaluateServiceCapacity(), formatCorporateNotificationPayload(), NotificationDeliveryResult, computeCryptoSha256(), createVerifiableElectronicSignature(), generateRfc3161TimeStampToken() (+43 more)

### Community 5 - "dependencies"
Cohesion: 0.12
Nodes (17): lucide-react, dependencies, lucide-react, @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, react, sonner, @tanstack/react-table (+9 more)

### Community 6 - "loadBenchmarkP2.test.ts"
Cohesion: 0.17
Nodes (16): DynamicTemplateEditor(), DynamicTemplateEditorProps, createDynamicTemplate(), extractPlaceholdersFromTemplate(), renderDynamicTemplate(), processExcelManifestRows(), RawExcelManifestRow, calculateOfferLadder() (+8 more)

### Community 7 - "IngestionView.tsx"
Cohesion: 0.16
Nodes (22): jszip, jszip, IngestionView(), IngestionViewProps, kindLabels, stateLabels, ALLOWED_EXTENSIONS, analyzeBatchDuplicates() (+14 more)

### Community 8 - "RemoteExpedienteWorkspace.tsx"
Cohesion: 0.11
Nodes (25): AiRevisionDialog(), AiRevisionDialogProps, AiRevisionProposalModal(), AiRevisionProposalModalProps, DocumentPrototypeEditor(), DocumentPrototypeEditorProps, consolidationLabel(), documentLabel() (+17 more)

### Community 9 - "App.tsx"
Cohesion: 0.06
Nodes (19): kindLabels, NavGroup, navGroups, NavItem, projectScopedScreens, Screen, screenLabels, stateLabels (+11 more)

### Community 10 - "expedienteV2Repository.ts"
Cohesion: 0.13
Nodes (15): asGroupKey(), assertCompleteGroups(), createExpedienteV2Repository(), CreateExpedienteV2RepositoryOptions, EditConflictError, ExpedienteDocumentAiRevisionSnapshot, ExpedienteDocumentVersionSnapshot, ExpedientePropertyIdentity (+7 more)

### Community 11 - "platformRepository.ts"
Cohesion: 0.10
Nodes (31): App(), date(), makeId(), screenRequiresProject(), activateRemotePromptVersion(), allowedMime, cancelRemoteBatch(), classifyFileName() (+23 more)

### Community 12 - "p1ComponentsAndFlow.test.ts"
Cohesion: 0.09
Nodes (23): AccessibleAccordion(), AccessibleAccordionProps, AccordionSection, ButtonWithSpinner(), ButtonWithSpinnerProps, LEGAL_TERMS_DICTIONARY, LegalTooltip(), LegalTooltipProps (+15 more)

### Community 13 - "Fase 1 — Prototipo frontend navegable"
Cohesion: 0.09
Nodes (23): Checkpoint de Fase 1, Fase 1 — Prototipo frontend navegable, HU-V2-001 — Navegación interna de la ficha de expediente, HU-V2-002 — Contrato de estados y repositorio simulado, HU-V2-003 — Resumen de expediente para un único predio, HU-V2-004 — Espacio de extracción en tres columnas, HU-V2-005 — Tarjeta de carga de Títulos, HU-V2-006 — Tarjeta de carga de Planos (+15 more)

### Community 14 - "scripts"
Cohesion: 0.15
Nodes (12): name, private, scripts, build, check, dev, preview, test (+4 more)

### Community 15 - "expedienteDocumentCompiler.ts"
Cohesion: 0.16
Nodes (25): AiRevisionRequest, createAiRevisionProposal(), GuardCheckResult, PROTECTED_DOCUMENT_LABELS, ProtectedFieldViolation, validateAiProposalIntegrity(), compileConsolidatedToTiptap(), computeDeterministicVerificationCode() (+17 more)

### Community 16 - "Backlog de historias de usuario de Territorium"
Cohesion: 0.09
Nodes (22): Alcance y convenciones, Backlog de historias de usuario de Territorium, Dependencias y decisiones abiertas, E01 Seguridad, usuarios y acceso, E02 Proyectos, participantes y ciclo de vida, E03 Lotes, carga y manifiesto de insumos, E04 Almacenamiento y preprocesamiento documental, E05 Trabajos, colas y recuperación ante fallos (+14 more)

### Community 17 - "p0ComponentsAndFlow.test.ts"
Cohesion: 0.12
Nodes (18): BentoGridKpis(), BentoGridKpisProps, DEFAULT_METRICS, KpiMetric, DiscrepancyBarChart(), PropertyStatusDonut(), EnhancedDropZone(), EnhancedDropZoneProps (+10 more)

### Community 18 - "compilerOptions"
Cohesion: 0.09
Nodes (21): DOM, DOM.Iterable, ES2022, src, compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop (+13 more)

### Community 19 - "Runbook de producción — Territorium 2.0"
Cohesion: 0.11
Nodes (17): 1. Servicios, Salud y Telemetría, 2.1 Trabajo de Extracción Atascado (>10 Minutos), 2.2 Fallo Transitorio o Indisponibilidad del Proveedor de IA, 2.3 Alerta de Consumo Anómalo de Tokens o Costo, 2. Protocolos de Respuesta ante Incidentes, 3. Privacidad de Datos y Sanitización de Logs (HU-V2-056), 4. Migración de Expedientes y Reversibilidad (HU-V2-052), 5. Checklist de Lanzamiento a Producción (+9 more)

### Community 20 - "supabase.ts"
Cohesion: 0.09
Nodes (15): AuthContext, AuthContextValue, AuthProvider(), useAuth(), AuthScreen(), Mode, SessionGuard(), ErrorBoundary (+7 more)

### Community 21 - "compilerOptions"
Cohesion: 0.13
Nodes (14): ES2023, vite.config.ts, compilerOptions, allowImportingTsExtensions, lib, module, moduleDetection, moduleResolution (+6 more)

### Community 22 - "4. Backlog de 100 Nuevas Historias de Usuario (US-201 a US-300)"
Cohesion: 0.14
Nodes (13): 1. Visión y Objetivo Estratégico, 2. Ecosistema de Componentes y Stack Tecnológico UI, 3. Mapa de Rutas de la Aplicación, 4. Backlog de 100 Nuevas Historias de Usuario (US-201 a US-300), 5. Plan de Ejecución por Fases, Backlog de Modernización UI/UX: Superar la Calidad de PMO en Territorium, Épica UX-01: Enrutamiento Declarativo, Layouts Anidados y Deep Linking (US-201 a US-215), Épica UX-02: Sistema de Diseño, Tokens Visuales y Primitivas Radix UI (US-216 a US-230) (+5 more)

### Community 23 - "seed.ts"
Cohesion: 0.32
Nodes (6): now, seedState, loadState(), resetState(), saveState(), PlatformState

### Community 24 - "expedienteConsolidation.ts"
Cohesion: 0.20
Nodes (14): consolidateApprovedGroups(), ConsolidatedMasterRecord, ConsolidationInputs, getActiveDocumentTemplate(), getTemplateById(), getTemplateByVersion(), OFFICIAL_PREDIAL_TEMPLATE_V1, publishNewTemplateVersion() (+6 more)

### Community 25 - "TemplateEditorWithVariables.tsx"
Cohesion: 0.21
Nodes (9): TemplateEditorWithVariables(), TemplateEditorWithVariablesProps, AutoSaveIndicator(), AutoSaveIndicatorProps, SaveStatus, LEGAL_VARIABLES, LegalVariableOption, VariablePillsSelector() (+1 more)

### Community 26 - "extractorConfig.ts"
Cohesion: 0.15
Nodes (19): ConfigurationView(), extractorLabels, TabKey, activatePromptVersion(), AVAILABLE_AI_MODELS, calculateEstimatedCost(), calculateExtractorCost, createAiExecutionLog() (+11 more)

### Community 27 - "SessionGuard.tsx"
Cohesion: 0.32
Nodes (5): SessionGuardProps, InviteUserModal(), InviteUserModalProps, ROLES_INFO, ProjectRole

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

### Community 33 - "Estado de cierre — 2026-09-17"
Cohesion: 0.40
Nodes (4): Estado de cierre — 2026-09-17, Estado operativo, No ejecutado para evitar cambios remotos no confirmados, Terminado y verificado

### Community 34 - "ConsolidatedMasterRecord"
Cohesion: 0.12
Nodes (17): generate_consolidated_excel_bytes(), ConsolidatedMasterRecord, Generates a production Excel workbook for the approved consolidated record…, _clean_text(), compute_pdf_verification_hash(), generate_consolidated_pdf_bytes(), ConsolidatedMasterRecord, Computes deterministic verification hash identical to client-side and Excel… (+9 more)

### Community 35 - "phase7EndToEndAndA11y.test.ts"
Cohesion: 0.32
Nodes (9): allGroupsApproved(), allowedTransitions, canTransitionGroupStatus(), deriveConsolidationStatus(), expedienteGroupKeys, GroupWorkflowState, invalidateForInputChange(), transitionGroupStatus() (+1 more)

### Community 36 - "manage-users/index.ts"
Cohesion: 0.33
Nodes (6): allowedActions, allowedOrigins, allowedRoles, cors(), json(), ManageUserPayload

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
Cohesion: 0.10
Nodes (9): PromptVersion, Response, RuntimeError, Any, ExtractorConfig, SourceDocument, Retrieves current active files for a document group in Territorium 2.0., Saves immutable execution output to expediente_execution_outputs and creates or… (+1 more)

### Community 51 - "Historias de usuario — Territorium 2.0"
Cohesion: 0.25
Nodes (8): 1. Propósito, 2. Alcance funcional objetivo, 3.1 Prioridad, 3.2 Dificultad, 3.3 Estados principales, 3. Convenciones, 4. Decisiones y supuestos de planificación, Historias de usuario — Territorium 2.0

### Community 52 - "Fase 2 — Dominio, persistencia y seguridad"
Cohesion: 0.25
Nodes (8): Checkpoint de Fase 2, Fase 2 — Dominio, persistencia y seguridad, HU-V2-021 — Modelo un expediente–un predio, HU-V2-022 — Grupos documentales y versiones de archivos, HU-V2-023 — Ejecuciones y tareas versionadas, HU-V2-024 — Resultados, correcciones y aprobaciones inmutables, HU-V2-025 — Reglas transaccionales de invalidación, HU-V2-026 — RLS, permisos y auditoría del nuevo dominio

### Community 53 - "TitleStudyPayload"
Cohesion: 0.17
Nodes (12): PlanExtractor, Any, PlanExtractionPayload, BaseModel, Any, Extracts title study fields using OpenAI Structured Outputs if available, or…, Deterministic regex and structural parser for Colombian title study documents.…, TitleStudyExtractor (+4 more)

### Community 54 - "5. Mapa de pantallas y transiciones del prototipo"
Cohesion: 0.29
Nodes (7): 5.1 Ficha de expediente — Resumen, 5.2 Ficha de expediente — Extracción y consolidación, 5.3 Modal de resultados de subconjunto, 5.4 Modal de consolidado, 5.5 Ficha de expediente — Documento final, 5.6 Transiciones, 5. Mapa de pantallas y transiciones del prototipo

### Community 55 - "HUs_version2.0.md"
Cohesion: 0.15
Nodes (12): 10. Definición de terminado por historia, 7. Orden recomendado de ejecución y paralelización, 8. Riesgos y mitigaciones, 9. Decisiones pendientes antes de la fase correspondiente, Checkpoint de Fase 5, Dependencias resumidas, Fase 5 — Revisión persistente, consolidación y Excel, HU-V2-042 — TanStack Table conectado a resultados reales (+4 more)

### Community 56 - "Fase 6 — Plantillas y documento final"
Cohesion: 0.29
Nodes (7): Checkpoint de Fase 6, Fase 6 — Plantillas y documento final, HU-V2-047 — Plantilla documental versionada, HU-V2-048 — Combinación determinista de campos, HU-V2-049 — Documento real editable con Tiptap, HU-V2-050 — Revisión del documento por IA con comentarios, HU-V2-051 — PDF final y artefactos vinculados

### Community 57 - "Fase 7 — Migración, retiro del flujo anterior y endurecimiento"
Cohesion: 0.29
Nodes (7): Checkpoint de Fase 7, Fase 7 — Migración, retiro del flujo anterior y endurecimiento, HU-V2-052 — Migración controlada de expedientes existentes, HU-V2-053 — Retiro de navegación y pantallas obsoletas, HU-V2-054 — Autorizaciones finales por acción, HU-V2-055 — Pruebas integrales y accesibilidad, HU-V2-056 — Observabilidad, costos y preparación productiva

### Community 58 - "Fase 2 — modelo v2 del expediente"
Cohesion: 0.29
Nodes (6): Activación gradual del frontend, Alcance y compatibilidad, Fase 2 — modelo v2 del expediente, Garantías del servidor, Recuperación, Verificación antes de activar Supabase

### Community 59 - "pipeline_v2.py"
Cohesion: 0.15
Nodes (19): CanonicalDocument, DocumentFragment, FragmentLocator, PageScanInfo, Any, BaseModel, StrEnum, ScanClassification (+11 more)

### Community 60 - "Q: Usando los grafos de graphify, analiza y compara PMO vs Terrotorium, y dime que grado de madurez tiene territorium, que cosas le faltan para lanzarlo a produccion, recuerda usar los grafos para ahorrar en tokens. Dame un informe de territorium, ahí sí ignora a PMO y solo dime todas las caracteristicas positivas y de mejora de Territorium, dime lo robusto que es en cada aspecto, como funciona, cual es su pipeline, que sí puede hacer, que falta que sea capaz de hacer. La idea es presentarle ese informa a mi jefe y mostrarle lo que he desarrollado desde cero, el estado actual, las capacidades/caracteristicas del sistema, su estado en pruebas, su estado en supabase, su logica. Todo, todo todo."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Usando los grafos de graphify, analiza y compara PMO vs Terrotorium, y dime que grado de madurez tiene territorium, que cosas le faltan para lanzarlo a produccion, recuerda usar los grafos para ahorrar en tokens. Dame un informe de territorium, ahí sí ignora a PMO y solo dime todas las caracteristicas positivas y de mejora de Territorium, dime lo robusto que es en cada aspecto, como funciona, cual es su pipeline, que sí puede hacer, que falta que sea capaz de hacer. La idea es presentarle ese informa a mi jefe y mostrarle lo que he desarrollado desde cero, el estado actual, las capacidades/caracteristicas del sistema, su estado en pruebas, su estado en supabase, su logica. Todo, todo todo., Source Nodes

### Community 61 - "ExpedienteV2WorkerTests"
Cohesion: 0.18
Nodes (18): cache_key(), detect_mime(), payload_sha256(), PermanentValidationError, process_expediente_v2_task(), Any, Durable, content-safe preparation worker for Territorium expediente v2. This is…, Checks if all inputs for the execution are validated. If so, triggers Phase 4… (+10 more)

### Community 62 - "Índice de Documentación Técnica y Operativa Oficial en PDF"
Cohesion: 0.50
Nodes (3): 1. Documentos Disponibles en Carpeta `docs/pdf/`, 2. Instrucciones para Abrir y Visualizar, Índice de Documentación Técnica y Operativa Oficial en PDF

### Community 63 - "expedienteResultAdapters.ts"
Cohesion: 0.20
Nodes (17): ResultDataTable(), ResultDataTableProps, cloneRows(), ReviewDialog(), ReviewDialogProps, DocumentGroup, DocumentGroupKey, EditableResultRow (+9 more)

### Community 64 - "requireSupabase"
Cohesion: 0.22
Nodes (4): mapDocumentAiRevision(), mapDocumentVersion(), SupabaseExpedienteV2Repository, requireSupabase()

### Community 65 - "negotiation_extractor.py"
Cohesion: 0.17
Nodes (16): _format_currency_cop(), NegotiationExtractor, Deterministically extracts and validates negotiation values from an XLSX…, NegotiationExtractionPayload, BaseModel, _clean_numeric_value(), NegotiationBookResult, NegotiationCell (+8 more)

### Community 66 - "process_document_ai_revision"
Cohesion: 0.31
Nodes (10): DocumentAiRevisionTask, extract_narrative(), inject_narrative(), _node_text(), process_document_ai_revision(), Any, Server-side narrative-only revisions for persisted Tiptap documents., Replace only the narrative body; tables and structured fields are copied intact. (+2 more)

### Community 67 - "src/types.ts"
Cohesion: 0.13
Nodes (22): computeProjectOverallStatus(), createProjectBackupSnapshot(), createSensitiveAuditEntry(), duplicateProjectConfiguration(), DuplicateProjectOptions, evaluateDocumentRetention(), HealthCheckReport, performSystemHealthCheck() (+14 more)

### Community 68 - "validator.py"
Cohesion: 0.35
Nodes (11): AuditRepair, BaseModel, validate_and_normalize_cadastral_id(), validate_and_normalize_doc_number(), validate_and_normalize_folio(), validate_boundaries_text(), ValidationIssue, BaseModel (+3 more)

### Community 69 - "ExpedientePrototype.tsx"
Cohesion: 0.16
Nodes (21): cloneRows(), consolidationLabel(), ConsolidationState, DetailView, documentLabel(), ExpedientePrototype(), FinalDocumentState, GroupCard() (+13 more)

### Community 70 - "expedienteUpload.ts"
Cohesion: 0.20
Nodes (13): allowedByGroup, DuplicateDecision, expedienteTusEndpoint(), extensionMime, extensionOf(), requestExpedienteAnalysis(), resolveExpedienteMime(), sha256File() (+5 more)

### Community 71 - "Phase4PipelineOrchestrator"
Cohesion: 0.15
Nodes (6): Phase4PipelineOrchestrator, Any, Executes end-to-end Phase 4 processing for an entire document group of an…, Formats the output payload according to the public.expediente_execution_outputs…, Production orchestrator for Phase 4 (HU-V2-034 to HU-V2-041): Canonical Parsing…, Phase4EndToEndTests

### Community 72 - "HierarchicalReducer"
Cohesion: 0.15
Nodes (14): FieldDiscrepancy, HierarchicalReducer, ProvenanceReference, Any, BaseModel, Reduces multi-plan extractions into a consolidated technical view. Retains…, Executes tasks with bounded concurrency (asyncio.Semaphore) and reduces partial…, Executes a list of coroutine factories with bounded concurrency. (+6 more)

### Community 73 - "compare_number_and_letters"
Cohesion: 0.21
Nodes (9): compare_number_and_letters(), _convert_group(), _normalize_spanish_text(), number_to_spanish_words(), Compares a numeric offer against its written expression in words. Returns…, Removes accents, uppercase, standardizes spaces and currency suffixes., Converts a 3-digit number (0-999) to Spanish words., Converts a numeric amount (e.g. Colombian Pesos) into uppercase Spanish words.… (+1 more)

### Community 74 - "DashboardCharts.tsx"
Cohesion: 0.10
Nodes (13): ChartPanel(), KpiStripItem, ModernTooltip(), ConfirmDialog(), ConfirmDialogProps, BatchStatusData, DashboardCharts(), DashboardChartsProps (+5 more)

### Community 75 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @types/react, @types/react-dom, typescript, vite, @vitejs/plugin-react, vitest, @types/react (+5 more)

### Community 76 - "operationsObservability.ts"
Cohesion: 0.19
Nodes (10): analyzeQueueObservability(), calculateCompletenessMetrics(), CompletenessMetrics, computeExecutionMetricsSummary(), evaluateServicesHealth(), ExecutionMetricsSummary, ModelMetricsBreakdown, PropertyTraceabilityReport (+2 more)

### Community 77 - "e2eFlowP1.test.ts"
Cohesion: 0.44
Nodes (9): LegalDocumentGenerator(), createGeneratedDocumentsZip(), DEFAULT_LEGAL_TEMPLATES, generateLegalDocument(), renderDocumentTemplate(), validateTemplateRequirements(), ValidationRequirementsResult, exportOperationalMetricsToCsv() (+1 more)

### Community 78 - "resolve_extractor"
Cohesion: 0.31
Nodes (4): SourceDocument, resolve_extractor(), PipelineTests, SourceDocument

### Community 79 - "UsersManagementView.tsx"
Cohesion: 0.22
Nodes (10): canonicalRoles, roleDescriptions, UsersManagementView(), UsersManagementViewProps, addProjectMember(), inviteOrRecoverUser(), listProjectMembers(), removeProjectMember() (+2 more)

### Community 80 - "DocumentComponents.tsx"
Cohesion: 0.08
Nodes (3): AdminPanelView, ProjectDraft, AppLayoutProps

### Community 81 - "main.py"
Cohesion: 0.33
Nodes (9): Event, FastAPI, get, expediente_v2_worker_loop(), health(), lifespan(), Processes leased v2 tasks and triggers Phase 4 extraction upon input validation., ready() (+1 more)

### Community 82 - "DraftSyncController"
Cohesion: 0.13
Nodes (4): DraftSyncController, DraftSyncOptions, SaveStatus, UseExpedienteDraftSyncReturn

### Community 83 - "expedienteObservability.ts"
Cohesion: 0.36
Nodes (7): calculateLlmCost(), evaluateObservabilityAlerts(), ExpedienteStage, ObservabilityAlert, sanitizeTelemetryPayload(), SENSITIVE_KEY_PATTERNS, StageExecutionMetric

### Community 84 - "resilienceAndFaults.test.ts"
Cohesion: 0.23
Nodes (11): compareBoundariesVisualDiff(), BatchLimitsCheckResult, createNewDocumentVersion(), RetentionPurgeRecord, RetentionPurgeResult, scanFileForThreats(), scanUploadedFileSecurity(), validateBatchUploadLimits() (+3 more)

### Community 85 - "sanitize_telemetry_payload"
Cohesion: 0.22
Nodes (8): calculate_llm_cost(), evaluate_worker_alerts(), Any, Calculates deterministic LLM cost based on standard token pricing (HU-V2-056)., Sanitizes log and telemetry payloads in worker, masking PII and confidential…, Evaluates operational alert thresholds in worker (HU-V2-056)., sanitize_telemetry_payload(), TestPhase7Hardening

### Community 86 - "documentPreprocessor.ts"
Cohesion: 0.32
Nodes (10): BatchUploadItemInput, calculateSha256(), analyzePdfBuffer(), DocumentAnalysisResult, executeOcrPipeline(), extractDocxWorkingText(), OcrExecutionResult, preProcessDocument() (+2 more)

### Community 87 - "expediente-analysis-request/index.ts"
Cohesion: 0.50
Nodes (4): allowedOrigins, AnalysisRequest, cors(), json()

### Community 88 - ".ocr_page_image_base64"
Cohesion: 0.40
Nodes (3): OCRService, Any, Transcribes a scanned page image via Vision API.

### Community 89 - "imports"
Cohesion: 0.50
Nodes (3): imports, @supabase/functions-js, @supabase/server

### Community 105 - "ExcelExportConfigModal.tsx"
Cohesion: 0.50
Nodes (4): DEFAULT_EXCEL_SHEETS, ExcelExportConfigModal(), ExcelExportConfigModalProps, ExcelSheetConfig

### Community 106 - "AccessibleTabs.tsx"
Cohesion: 0.50
Nodes (3): AccessibleTabs(), AccessibleTabsProps, TabItem

### Community 107 - "expedienteMigration.ts"
Cohesion: 0.26
Nodes (10): buildMigrationPlan(), classifyDocumentToGroup(), diagnoseLegacyProject(), DocumentMigrationMapping, executeMigrationPlan(), MigrationExecutionPlan, ProjectDiagnosticReport, ProjectMigrationClassification (+2 more)

### Community 108 - "consolidatedExcelGenerator.ts"
Cohesion: 0.36
Nodes (8): CONSOLIDATED_EXCEL_HEADERS, ConsolidatedExcelOptions, downloadConsolidatedExcel(), generateConsolidatedExcelData(), headerCell(), metaHeaderCell(), safeCell(), textCell()

### Community 109 - "ColumnSelectorPopover.tsx"
Cohesion: 0.50
Nodes (3): ColumnOption, ColumnSelectorPopover(), ColumnSelectorPopoverProps

### Community 111 - "Fase 3 — Carga privada y procesamiento asíncrono"
Cohesion: 0.33
Nodes (5): Componentes y límites, Evidencia mínima antes de habilitar usuarios, Fase 3 — Carga privada y procesamiento asíncrono, Operación y recuperación, Orden de despliegue

### Community 112 - "verify_migrations.cjs"
Cohesion: 0.33
Nodes (5): files, fs, migrationsDir, path, timestamps

### Community 114 - "FacetedFilters.tsx"
Cohesion: 0.50
Nodes (3): FacetedFilterGroup, FacetedFilters(), FacetedFiltersProps

## Knowledge Gaps
- **416 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+411 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `jszip` connect `IngestionView.tsx` to `e2eFlowP1.test.ts`, `dependencies`, `documentPreprocessor.ts`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `react-dom`, `react-router-dom`, `recharts`, `@supabase/supabase-js`, `@tiptap/extension-table`, `@tiptap/react`, `@tiptap/starter-kit`, `IngestionView.tsx`, `@types/jszip`, `write-excel-file`, `scripts`, `@radix-ui/react-accordion`, `@radix-ui/react-popover`, `@radix-ui/react-scroll-area`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `requireSupabase()` connect `requireSupabase` to `expedienteUpload.ts`, `RemoteExpedienteWorkspace.tsx`, `expedienteV2Repository.ts`, `platformRepository.ts`, `UsersManagementView.tsx`, `supabase.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Are the 13 inferred relationships involving `SupabaseGateway` (e.g. with `AiExecutionResult` and `DocumentTask`) actually correct?**
  _`SupabaseGateway` has 13 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _416 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `masterRecordReconciliation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05970149253731343 - nodes in this community are weakly interconnected._
- **Should `Project` be split into smaller, more focused modules?**
  _Cohesion score 0.12941176470588237 - nodes in this community are weakly interconnected._