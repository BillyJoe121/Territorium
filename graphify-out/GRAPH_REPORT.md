# Graph Report - .  (2026-09-17)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 811 nodes · 1671 edges · 44 communities (38 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- types.ts
- SupabaseGateway
- masterRecordReconciliation.ts
- platformRepository.ts
- dependencies
- IngestionView.tsx
- App.tsx
- operationsObservability.ts
- p1ComponentsAndFlow.test.ts
- scripts
- loadBenchmarkP2.test.ts
- Backlog de historias de usuario de Territorium
- compilerOptions
- extractorConfig.ts
- negotiationExtraction.ts
- SessionGuard.tsx
- p0ComponentsAndFlow.test.ts
- publicNotaryPortal.ts
- AuthContext.tsx
- Territorium — extracción predial asistida
- compilerOptions
- 4. Backlog de 100 Nuevas Historias de Usuario (US-201 a US-300)
- P1AnalyticsCharts.tsx
- TemplateEditorWithVariables.tsx
- SplitReviewStation.tsx
- Decisiones de implementación
- Títulos de historias de usuario no completas (38 pendientes / 62 completadas)
- Estado de historias de usuario
- Estado de cierre — 2026-09-17
- Territorium — MVP listo para producción
- ExcelExportConfigModal.tsx
- NotaryLinksAdminModal.tsx
- manage-users/index.ts
- Arquitectura de producción
- ActionDropdown.tsx
- imports
- create-batch-job/index.ts
- ConfirmDialog.tsx
- RadixSwitch.tsx
- tsconfig.json
- gap-pmo-territorium.md
- walkthrough.md

## God Nodes (most connected - your core abstractions)
1. `App()` - 33 edges
2. `SupabaseGateway` - 33 edges
3. `requireSupabase()` - 26 edges
4. `SourceDocument` - 22 edges
5. `Backlog de historias de usuario de Territorium` - 22 edges
6. `Project` - 18 edges
7. `compilerOptions` - 16 edges
8. `OpenAIExtractionProvider` - 15 edges
9. `ExtractorKey` - 15 edges
10. `DocumentTask` - 14 edges

## Surprising Connections (you probably didn't know these)
- `createGeneratedDocumentsZip()` --references--> `jszip`  [EXTRACTED]
  src/lib/documentGeneration.ts → package.json
- `extractZipArchive()` --references--> `jszip`  [EXTRACTED]
  src/lib/batchValidation.ts → package.json
- `extractDocxWorkingText()` --references--> `jszip`  [EXTRACTED]
  src/lib/documentPreprocessor.ts → package.json
- `LegalDocumentGeneratorProps` --references--> `PropertyMasterRecord`  [EXTRACTED]
  src/components/LegalDocumentGenerator.tsx → src/lib/masterRecordReconciliation.ts
- `UsersManagementViewProps` --references--> `Project`  [EXTRACTED]
  src/components/UsersManagementView.tsx → src/types.ts

## Import Cycles
- None detected.

## Communities (44 total, 6 thin omitted)

### Community 0 - "types.ts"
Cohesion: 0.05
Nodes (74): RFC-3161, CommandItem, CommandPaletteProps, FilterStatus, ProjectsManagementView(), ProjectsManagementViewProps, SsoAndNotificationSettings(), assignTaskToUser() (+66 more)

### Community 1 - "SupabaseGateway"
Cohesion: 0.07
Nodes (39): BaseModel, DocumentTask, Event, Exception, FastAPI, get, PromptVersion, Response (+31 more)

### Community 2 - "masterRecordReconciliation.ts"
Cohesion: 0.06
Nodes (53): ReviewStationProps, ReviewStationView(), BulkApprovalResult, bulkApproveUncontestedAttributes(), ColumnMappingDefinition, compareMasterRecordVersions(), createManualPropertyMasterRecord(), createWordAnnotation() (+45 more)

### Community 3 - "platformRepository.ts"
Cohesion: 0.10
Nodes (40): App(), date(), makeId(), roleDescriptions, UsersManagementView(), UsersManagementViewProps, activateRemotePromptVersion(), addProjectMember() (+32 more)

### Community 4 - "dependencies"
Cohesion: 0.05
Nodes (39): lucide-react, dependencies, lucide-react, @radix-ui/react-accordion, @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-popover, @radix-ui/react-scroll-area (+31 more)

### Community 5 - "IngestionView.tsx"
Cohesion: 0.13
Nodes (29): jszip, jszip, IngestionView(), IngestionViewProps, kindLabels, stateLabels, BatchUploadItemInput, ALLOWED_EXTENSIONS (+21 more)

### Community 6 - "App.tsx"
Cohesion: 0.09
Nodes (15): kindLabels, menu, Screen, stateLabels, CommandPalette(), ConfigurationView(), BreadcrumbItem, ProjectBreadcrumbs() (+7 more)

### Community 7 - "operationsObservability.ts"
Cohesion: 0.13
Nodes (22): LegalDocumentGenerator(), LegalDocumentGeneratorProps, createGeneratedDocumentsZip(), DEFAULT_LEGAL_TEMPLATES, generateLegalDocument(), renderDocumentTemplate(), validateTemplateRequirements(), ValidationRequirementsResult (+14 more)

### Community 8 - "p1ComponentsAndFlow.test.ts"
Cohesion: 0.09
Nodes (19): AccessibleAccordion(), AccessibleAccordionProps, AccordionSection, AccessibleTabs(), AccessibleTabsProps, TabItem, ButtonWithSpinner(), ButtonWithSpinnerProps (+11 more)

### Community 9 - "scripts"
Cohesion: 0.08
Nodes (25): devDependencies, @types/react, @types/react-dom, typescript, vite, @vitejs/plugin-react, vitest, name (+17 more)

### Community 10 - "loadBenchmarkP2.test.ts"
Cohesion: 0.17
Nodes (16): DynamicTemplateEditor(), DynamicTemplateEditorProps, createDynamicTemplate(), extractPlaceholdersFromTemplate(), renderDynamicTemplate(), processExcelManifestRows(), RawExcelManifestRow, calculateOfferLadder() (+8 more)

### Community 11 - "Backlog de historias de usuario de Territorium"
Cohesion: 0.09
Nodes (22): Alcance y convenciones, Backlog de historias de usuario de Territorium, Dependencias y decisiones abiertas, E01 Seguridad, usuarios y acceso, E02 Proyectos, participantes y ciclo de vida, E03 Lotes, carga y manifiesto de insumos, E04 Almacenamiento y preprocesamiento documental, E05 Trabajos, colas y recuperación ante fallos (+14 more)

### Community 12 - "compilerOptions"
Cohesion: 0.09
Nodes (21): DOM, DOM.Iterable, ES2022, src, compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop (+13 more)

### Community 13 - "extractorConfig.ts"
Cohesion: 0.21
Nodes (19): ConfigurationViewProps, extractorLabels, sampleInputs, TabKey, activatePromptVersion(), calculateEstimatedCost(), createAiExecutionLog(), createNextPromptVersion() (+11 more)

### Community 14 - "negotiationExtraction.ts"
Cohesion: 0.16
Nodes (19): aggregateTechnicalPlansSummary(), APPROVED_NEGOTIATION_COLUMNS, BoundaryDiffResult, compareBoundariesVisualDiff(), correctNegotiationOfferManually(), detectNegotiationAnomalies(), extractNegotiationOffers(), formatExcelCell() (+11 more)

### Community 15 - "SessionGuard.tsx"
Cohesion: 0.13
Nodes (11): AuthContextValue, useAuth(), AuthScreen(), Mode, SessionGuard(), SessionGuardProps, InviteUserModal(), InviteUserModalProps (+3 more)

### Community 16 - "p0ComponentsAndFlow.test.ts"
Cohesion: 0.13
Nodes (15): BentoGridKpis(), BentoGridKpisProps, DEFAULT_METRICS, KpiMetric, DashboardCharts(), DashboardChartsProps, DEFAULT_DISCREPANCIES, DEFAULT_STATUS_DATA (+7 more)

### Community 17 - "publicNotaryPortal.ts"
Cohesion: 0.22
Nodes (15): PublicNotaryPortal(), PublicNotaryPortalProps, ShareNotaryLinkModal(), ShareNotaryLinkModalProps, createOtpChallenge(), generateNotaryShareToken(), NotaryConceptSubmission, NotaryPortalSession (+7 more)

### Community 18 - "AuthContext.tsx"
Cohesion: 0.15
Nodes (10): AuthContext, AuthProvider(), ErrorBoundary, config, hasRemoteConfiguration, parsed, schema, dataMode (+2 more)

### Community 19 - "Territorium — extracción predial asistida"
Cohesion: 0.12
Nodes (15): Checklist de lanzamiento, Incidentes, Privacidad y retención, Proveedor de IA indisponible, Recuperación, Revocar acceso, Runbook de producción, Servicios y señales (+7 more)

### Community 20 - "compilerOptions"
Cohesion: 0.13
Nodes (14): ES2023, vite.config.ts, compilerOptions, allowImportingTsExtensions, lib, module, moduleDetection, moduleResolution (+6 more)

### Community 21 - "4. Backlog de 100 Nuevas Historias de Usuario (US-201 a US-300)"
Cohesion: 0.14
Nodes (13): 1. Visión y Objetivo Estratégico, 2. Ecosistema de Componentes y Stack Tecnológico UI, 3. Mapa de Rutas de la Aplicación, 4. Backlog de 100 Nuevas Historias de Usuario (US-201 a US-300), 5. Plan de Ejecución por Fases, Backlog de Modernización UI/UX: Superar la Calidad de PMO en Territorium, Épica UX-01: Enrutamiento Declarativo, Layouts Anidados y Deep Linking (US-201 a US-215), Épica UX-02: Sistema de Diseño, Tokens Visuales y Primitivas Radix UI (US-216 a US-230) (+5 more)

### Community 22 - "P1AnalyticsCharts.tsx"
Cohesion: 0.14
Nodes (13): AiConfidenceDonutChart(), AiConfidenceDonutChartProps, BatchesTreemap(), BatchesTreemapProps, BatchTreemapNode, DocumentMaturityPoint, MaturityRadarChart(), MaturityRadarChartProps (+5 more)

### Community 23 - "TemplateEditorWithVariables.tsx"
Cohesion: 0.21
Nodes (9): TemplateEditorWithVariables(), TemplateEditorWithVariablesProps, AutoSaveIndicator(), AutoSaveIndicatorProps, SaveStatus, LEGAL_VARIABLES, LegalVariableOption, VariablePillsSelector() (+1 more)

### Community 24 - "SplitReviewStation.tsx"
Cohesion: 0.20
Nodes (9): SideDrawer(), SideDrawerProps, PropertyAttributeReview, PropertyListItem, SplitReviewStation(), SplitReviewStationProps, StatusPill(), StatusPillKind (+1 more)

### Community 25 - "Decisiones de implementación"
Cohesion: 0.25
Nodes (7): 2026-09-17 — Base paralela, no renombrar PMO, 2026-09-17 — IA con validación semántica y recuperación acotada, 2026-09-17 — Mesas de trabajo, no editores de archivos fuente, 2026-09-17 — Procesamiento fuera de Edge Functions, 2026-09-17 — Resultados sujetos a revisión, 2026-09-17 — Sistema visual operacional propio, Decisiones de implementación

### Community 26 - "Títulos de historias de usuario no completas (38 pendientes / 62 completadas)"
Cohesion: 0.25
Nodes (7): Historias de Usuario Pendientes de Implementación (38 restantes), Historias P0 Completadas y Verificadas (27/27), Historias P1 Completadas y Verificadas (35/35), Prioridad P2: Excelencia Sensorial, Analítica Avanzada y Flujos de Cierre (38 historias), Prioridad P2: Excelencia Sensorial, Analítica Avanzada y Flujos de Cierre (38 historias), Resumen de Estado del Backlog UI/UX Activo, Títulos de historias de usuario no completas (38 pendientes / 62 completadas)

### Community 27 - "Estado de historias de usuario"
Cohesion: 0.29
Nodes (6): Avances parciales que no deben confundirse con cierre, Completas en el repositorio (173 - 100% del Backlog), Criterio de corte, Dependencias de cierre, Estado de historias de usuario, No completas (0)

### Community 28 - "Estado de cierre — 2026-09-17"
Cohesion: 0.40
Nodes (4): Estado de cierre — 2026-09-17, Estado operativo, No ejecutado para evitar cambios remotos no confirmados, Terminado y verificado

### Community 29 - "Territorium — MVP listo para producción"
Cohesion: 0.40
Nodes (4): Alcance objetivo, Criterios verificables, Resultado solicitado, Territorium — MVP listo para producción

### Community 30 - "ExcelExportConfigModal.tsx"
Cohesion: 0.50
Nodes (4): DEFAULT_EXCEL_SHEETS, ExcelExportConfigModal(), ExcelExportConfigModalProps, ExcelSheetConfig

### Community 31 - "NotaryLinksAdminModal.tsx"
Cohesion: 0.50
Nodes (4): NotaryLinkRecord, NotaryLinksAdminModal(), NotaryLinksAdminModalProps, NotaryShareTokenPayload

### Community 32 - "manage-users/index.ts"
Cohesion: 0.50
Nodes (4): allowedOrigins, cors(), json(), ManageUserPayload

### Community 33 - "Arquitectura de producción"
Cohesion: 0.50
Nodes (3): Arquitectura de producción, Flujo, Límites de confianza

### Community 35 - "imports"
Cohesion: 0.50
Nodes (3): imports, @supabase/functions-js, @supabase/server

### Community 36 - "create-batch-job/index.ts"
Cohesion: 0.67
Nodes (3): allowedOrigins, cors(), json()

## Knowledge Gaps
- **251 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+246 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `scripts`, `IngestionView.tsx`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Why does `jszip` connect `IngestionView.tsx` to `dependencies`, `operationsObservability.ts`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Why does `createGeneratedDocumentsZip()` connect `operationsObservability.ts` to `types.ts`, `IngestionView.tsx`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `SupabaseGateway` (e.g. with `AiExecutionResult` and `DocumentTask`) actually correct?**
  _`SupabaseGateway` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _251 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05282842449742871 - nodes in this community are weakly interconnected._
- **Should `SupabaseGateway` be split into smaller, more focused modules?**
  _Cohesion score 0.07315315315315316 - nodes in this community are weakly interconnected._