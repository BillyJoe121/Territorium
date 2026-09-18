# Graph Report - .  (2026-09-17)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 843 nodes · 1682 edges · 43 communities (38 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4492da5c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- e2eFlowP1.test.ts
- SupabaseGateway
- masterRecordReconciliation.ts
- types.ts
- IngestionView.tsx
- dependencies
- DashboardCharts.tsx
- platformRepository.ts
- App.tsx
- ConfigurationView.tsx
- scripts
- p1ComponentsAndFlow.test.ts
- Backlog de historias de usuario de Territorium
- compilerOptions
- negotiationExtraction.ts
- publicNotaryPortal.ts
- AuthContext.tsx
- Territorium — extracción predial asistida
- p0ComponentsAndFlow.test.ts
- compilerOptions
- 4. Backlog de 100 Nuevas Historias de Usuario (US-201 a US-300)
- P1AnalyticsCharts.tsx
- AuthContextValue
- TemplateEditorWithVariables.tsx
- Decisiones de implementación
- SessionGuard.tsx
- Estado de historias de usuario
- Títulos de historias de usuario no completas (38 pendientes / 62 completadas)
- Estado de cierre — 2026-09-17
- ExcelExportConfigModal.tsx
- NotaryLinksAdminModal.tsx
- manage-users/index.ts
- Arquitectura de producción
- ActionDropdown.tsx
- ColumnSelectorPopover.tsx
- imports
- create-batch-job/index.ts
- RadixSwitch.tsx
- tsconfig.json
- gap-pmo-territorium.md
- walkthrough.md

## God Nodes (most connected - your core abstractions)
1. `SupabaseGateway` - 33 edges
2. `requireSupabase()` - 26 edges
3. `SourceDocument` - 23 edges
4. `Backlog de historias de usuario de Territorium` - 22 edges
5. `Project` - 19 edges
6. `compilerOptions` - 16 edges
7. `OpenAIExtractionProvider` - 15 edges
8. `ExtractorKey` - 15 edges
9. `DocumentTask` - 14 edges
10. `Batch` - 14 edges

## Surprising Connections (you probably didn't know these)
- `createGeneratedDocumentsZip()` --references--> `jszip`  [EXTRACTED]
  src/lib/documentGeneration.ts → package.json
- `extractZipArchive()` --references--> `jszip`  [EXTRACTED]
  src/lib/batchValidation.ts → package.json
- `extractDocxWorkingText()` --references--> `jszip`  [EXTRACTED]
  src/lib/documentPreprocessor.ts → package.json
- `TitlePlanPairing` --references--> `SourceDocument`  [EXTRACTED]
  src/lib/legalTechnicalExtraction.ts → src/types.ts
- `RetentionEvaluationResult` --references--> `SourceDocument`  [EXTRACTED]
  src/lib/projectLifecycle.ts → src/types.ts

## Import Cycles
- None detected.

## Communities (43 total, 5 thin omitted)

### Community 0 - "e2eFlowP1.test.ts"
Cohesion: 0.05
Nodes (68): CommandItem, CommandPalette(), CommandPaletteProps, LegalDocumentGenerator(), FilterStatus, ProjectsManagementView(), ProjectsManagementViewProps, UsersManagementViewProps (+60 more)

### Community 1 - "SupabaseGateway"
Cohesion: 0.07
Nodes (39): BaseModel, DocumentTask, Event, Exception, FastAPI, get, PromptVersion, Response (+31 more)

### Community 2 - "masterRecordReconciliation.ts"
Cohesion: 0.06
Nodes (55): LegalDocumentGeneratorProps, ReviewStationProps, ReviewStationView(), SplitReviewStation(), BulkApprovalResult, bulkApproveUncontestedAttributes(), ColumnMappingDefinition, compareMasterRecordVersions() (+47 more)

### Community 3 - "types.ts"
Cohesion: 0.08
Nodes (39): RFC-3161, DynamicTemplateEditor(), DynamicTemplateEditorProps, SsoAndNotificationSettings(), evaluateServiceCapacity(), formatCorporateNotificationPayload(), createDynamicTemplate(), extractPlaceholdersFromTemplate() (+31 more)

### Community 4 - "IngestionView.tsx"
Cohesion: 0.10
Nodes (38): jszip, jszip, IngestionView(), IngestionViewProps, kindLabels, stateLabels, BatchUploadItemInput, ALLOWED_EXTENSIONS (+30 more)

### Community 5 - "dependencies"
Cohesion: 0.05
Nodes (39): lucide-react, dependencies, lucide-react, @radix-ui/react-accordion, @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-popover, @radix-ui/react-scroll-area (+31 more)

### Community 6 - "DashboardCharts.tsx"
Cohesion: 0.06
Nodes (15): ChartPanel(), KpiStripItem, ModernTooltip(), ProjectDraft, AppLayoutProps, ConfirmDialog(), ConfirmDialogProps, DashboardCharts() (+7 more)

### Community 7 - "platformRepository.ts"
Cohesion: 0.10
Nodes (36): roleDescriptions, UsersManagementView(), activateRemotePromptVersion(), addProjectMember(), allowedMime, cancelRemoteBatch(), classifyFileName(), cleanFileName() (+28 more)

### Community 8 - "App.tsx"
Cohesion: 0.07
Nodes (21): App(), date(), kindLabels, makeId(), menu, projectScopedScreens, Screen, screenRequiresProject() (+13 more)

### Community 9 - "ConfigurationView.tsx"
Cohesion: 0.12
Nodes (21): ConfigurationView(), ConfigurationViewProps, extractorLabels, sampleInputs, TabKey, AdminPanelView, GuideSidebar(), now (+13 more)

### Community 10 - "scripts"
Cohesion: 0.08
Nodes (25): devDependencies, @types/react, @types/react-dom, typescript, vite, @vitejs/plugin-react, vitest, name (+17 more)

### Community 11 - "p1ComponentsAndFlow.test.ts"
Cohesion: 0.11
Nodes (16): AccessibleAccordion(), AccessibleAccordionProps, AccordionSection, AccessibleTabs(), AccessibleTabsProps, TabItem, ButtonWithSpinner(), ButtonWithSpinnerProps (+8 more)

### Community 12 - "Backlog de historias de usuario de Territorium"
Cohesion: 0.09
Nodes (22): Alcance y convenciones, Backlog de historias de usuario de Territorium, Dependencias y decisiones abiertas, E01 Seguridad, usuarios y acceso, E02 Proyectos, participantes y ciclo de vida, E03 Lotes, carga y manifiesto de insumos, E04 Almacenamiento y preprocesamiento documental, E05 Trabajos, colas y recuperación ante fallos (+14 more)

### Community 13 - "compilerOptions"
Cohesion: 0.09
Nodes (21): DOM, DOM.Iterable, ES2022, src, compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop (+13 more)

### Community 14 - "negotiationExtraction.ts"
Cohesion: 0.16
Nodes (18): aggregateTechnicalPlansSummary(), APPROVED_NEGOTIATION_COLUMNS, BoundaryDiffResult, correctNegotiationOfferManually(), detectNegotiationAnomalies(), extractNegotiationOffers(), formatExcelCell(), GeometricValidationResult (+10 more)

### Community 15 - "publicNotaryPortal.ts"
Cohesion: 0.22
Nodes (15): PublicNotaryPortal(), PublicNotaryPortalProps, ShareNotaryLinkModal(), ShareNotaryLinkModalProps, createOtpChallenge(), generateNotaryShareToken(), NotaryConceptSubmission, NotaryPortalSession (+7 more)

### Community 16 - "AuthContext.tsx"
Cohesion: 0.15
Nodes (10): AuthContext, AuthProvider(), ErrorBoundary, config, hasRemoteConfiguration, parsed, schema, dataMode (+2 more)

### Community 17 - "Territorium — extracción predial asistida"
Cohesion: 0.12
Nodes (15): Checklist de lanzamiento, Incidentes, Privacidad y retención, Proveedor de IA indisponible, Recuperación, Revocar acceso, Runbook de producción, Servicios y señales (+7 more)

### Community 18 - "p0ComponentsAndFlow.test.ts"
Cohesion: 0.18
Nodes (11): EnhancedDropZone(), EnhancedDropZoneProps, UploadFileItem, SideDrawer(), SideDrawerProps, PropertyAttributeReview, PropertyListItem, SplitReviewStationProps (+3 more)

### Community 19 - "compilerOptions"
Cohesion: 0.13
Nodes (14): ES2023, vite.config.ts, compilerOptions, allowImportingTsExtensions, lib, module, moduleDetection, moduleResolution (+6 more)

### Community 20 - "4. Backlog de 100 Nuevas Historias de Usuario (US-201 a US-300)"
Cohesion: 0.14
Nodes (13): 1. Visión y Objetivo Estratégico, 2. Ecosistema de Componentes y Stack Tecnológico UI, 3. Mapa de Rutas de la Aplicación, 4. Backlog de 100 Nuevas Historias de Usuario (US-201 a US-300), 5. Plan de Ejecución por Fases, Backlog de Modernización UI/UX: Superar la Calidad de PMO en Territorium, Épica UX-01: Enrutamiento Declarativo, Layouts Anidados y Deep Linking (US-201 a US-215), Épica UX-02: Sistema de Diseño, Tokens Visuales y Primitivas Radix UI (US-216 a US-230) (+5 more)

### Community 21 - "P1AnalyticsCharts.tsx"
Cohesion: 0.14
Nodes (13): AiConfidenceDonutChart(), AiConfidenceDonutChartProps, BatchesTreemap(), BatchesTreemapProps, BatchTreemapNode, DocumentMaturityPoint, MaturityRadarChart(), MaturityRadarChartProps (+5 more)

### Community 22 - "AuthContextValue"
Cohesion: 0.20
Nodes (6): AuthContextValue, useAuth(), AuthScreen(), Mode, SessionGuard(), SessionStatus

### Community 23 - "TemplateEditorWithVariables.tsx"
Cohesion: 0.21
Nodes (9): TemplateEditorWithVariables(), TemplateEditorWithVariablesProps, AutoSaveIndicator(), AutoSaveIndicatorProps, SaveStatus, LEGAL_VARIABLES, LegalVariableOption, VariablePillsSelector() (+1 more)

### Community 24 - "Decisiones de implementación"
Cohesion: 0.25
Nodes (7): 2026-09-17 — Base paralela, no renombrar PMO, 2026-09-17 — IA con validación semántica y recuperación acotada, 2026-09-17 — Mesas de trabajo, no editores de archivos fuente, 2026-09-17 — Procesamiento fuera de Edge Functions, 2026-09-17 — Resultados sujetos a revisión, 2026-09-17 — Sistema visual operacional propio, Decisiones de implementación

### Community 25 - "SessionGuard.tsx"
Cohesion: 0.32
Nodes (5): SessionGuardProps, InviteUserModal(), InviteUserModalProps, ROLES_INFO, ProjectRole

### Community 26 - "Estado de historias de usuario"
Cohesion: 0.29
Nodes (6): Avances parciales que no deben confundirse con cierre, Completas en el repositorio (173 - 100% del Backlog), Criterio de corte, Dependencias de cierre, Estado de historias de usuario, No completas (0)

### Community 27 - "Títulos de historias de usuario no completas (38 pendientes / 62 completadas)"
Cohesion: 0.29
Nodes (6): Historias de Usuario Pendientes de Implementación (38 restantes), Historias P0 Completadas y Verificadas (27/27), Historias P1 Completadas y Verificadas (35/35), Prioridad P2: Excelencia Sensorial, Analítica Avanzada y Flujos de Cierre (38 historias), Resumen de Estado del Backlog UI/UX Activo, Títulos de historias de usuario no completas (38 pendientes / 62 completadas)

### Community 28 - "Estado de cierre — 2026-09-17"
Cohesion: 0.40
Nodes (4): Estado de cierre — 2026-09-17, Estado operativo, No ejecutado para evitar cambios remotos no confirmados, Terminado y verificado

### Community 29 - "ExcelExportConfigModal.tsx"
Cohesion: 0.50
Nodes (4): DEFAULT_EXCEL_SHEETS, ExcelExportConfigModal(), ExcelExportConfigModalProps, ExcelSheetConfig

### Community 30 - "NotaryLinksAdminModal.tsx"
Cohesion: 0.50
Nodes (4): NotaryLinkRecord, NotaryLinksAdminModal(), NotaryLinksAdminModalProps, NotaryShareTokenPayload

### Community 31 - "manage-users/index.ts"
Cohesion: 0.50
Nodes (4): allowedOrigins, cors(), json(), ManageUserPayload

### Community 32 - "Arquitectura de producción"
Cohesion: 0.50
Nodes (3): Arquitectura de producción, Flujo, Límites de confianza

### Community 34 - "ColumnSelectorPopover.tsx"
Cohesion: 0.50
Nodes (3): ColumnOption, ColumnSelectorPopover(), ColumnSelectorPopoverProps

### Community 35 - "imports"
Cohesion: 0.50
Nodes (3): imports, @supabase/functions-js, @supabase/server

### Community 36 - "create-batch-job/index.ts"
Cohesion: 0.67
Nodes (3): allowedOrigins, cors(), json()

## Knowledge Gaps
- **253 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+248 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `scripts`, `IngestionView.tsx`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `jszip` connect `IngestionView.tsx` to `e2eFlowP1.test.ts`, `dependencies`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Why does `createGeneratedDocumentsZip()` connect `e2eFlowP1.test.ts` to `IngestionView.tsx`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `SupabaseGateway` (e.g. with `AiExecutionResult` and `DocumentTask`) actually correct?**
  _`SupabaseGateway` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _253 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `e2eFlowP1.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05350140056022409 - nodes in this community are weakly interconnected._
- **Should `SupabaseGateway` be split into smaller, more focused modules?**
  _Cohesion score 0.07315315315315316 - nodes in this community are weakly interconnected._