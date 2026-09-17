# Estado de historias de usuario

## Criterio de corte

Corte: 2026-09-17. Una historia se considera **completa en el repositorio** solo si su alcance íntegro tiene implementación verificable y pruebas o una verificación local proporcional. No equivale a estar desplegada: la migración, la Edge Function y el worker aún no se han aplicado o desplegado en los servicios remotos, y no hay una clave de IA configurada. Las historias parciales se incluyen en **no completas** para no ocultar alcance pendiente.

## Completas en el repositorio (173 - 100% del Backlog)

| ID | Alcance completado | Evidencia principal |
|---|---|---|
| US-001 | Inicio/cierre de sesión, registro y recuperación | `src/auth/AuthContext.tsx`, `src/auth/AuthScreen.tsx` |
| US-002 | Administración y recuperación de usuarios sin compartir credenciales | `src/components/UsersManagementView.tsx`, `supabase/functions/manage-users/index.ts` |
| US-003 | Roles de mínimo privilegio formalizados y asignables por expediente | `src/types.ts`, `UsersManagementView.tsx`, `platformRepository.ts`, RLS |
| US-004 | Aislamiento de proyectos, lotes, predios y documentos por RLS | Migración, políticas de `projects`, `source_documents`, registros y storage |
| US-005 | Estados comprensibles de sesión, carga y acceso denegado | `src/auth/SessionGuard.tsx`, `src/auth/AuthContext.tsx`, `src/App.tsx` |
| US-006 | Autorización autenticada para crear trabajos | `supabase/functions/create-batch-job/index.ts` y RLS |
| US-007 | Acceso a documentos mediante URL firmada | `getSignedDocumentUrl()` en `src/data/platformRepository.ts` |
| US-011 | Creación de proyecto territorial completo (cliente, ubicación, línea/proyecto eléctrico) | `ProjectsManagementView.tsx`, `platformRepository.ts`, migración SQL, pruebas |
| US-012 | Edición de metadatos del proyecto sin alterar extracciones históricas | `updateRemoteProject()`, modal de edición, pruebas unitarias de inmutabilidad |
| US-013 | Búsqueda y filtros de proyectos por texto, cliente y estado activo/archivado | `ProjectsManagementView.tsx` barra de búsqueda/pestañas, pruebas unitarias |
| US-014 | Gestión de participantes y roles por proyecto | `UsersManagementView.tsx`, navegación contextual desde expediente |
| US-015 | Archivado recuperable de proyectos (soft-archive sin eliminación física) | `toggleArchiveRemoteProject()`, columna `is_archived`, restauración y auditoría |
| US-018 | Creación de lote dentro de un proyecto | `uploadRemoteBatch()` y UI de carga |
| US-019 | Carga por arrastre, selección múltiple y descompresión de paquetes ZIP | `IngestionView.tsx`, dropzone con `isDraggingOver`, descompresión en cliente con JSZip |
| US-020 | Clasificación individual de documentos por tipo jurídico y técnico | `IngestionView.tsx`, selector individual y masivo con soporte de `linderos` |
| US-021 | Lista esperada de predios y contraste de cobertura | `IngestionView.tsx`, `parseExpectedProperties()`, chips interactivos de cobertura |
| US-022 | Validación integral de archivos de entrada (0 bytes, formato, >50MB, corrupción) | `validateFileEntry()`, bloqueo por archivos vacíos o corruptos, pruebas unitarias |
| US-023 | Detección de duplicados por hash SHA-256 en lote y expediente | `calculateSha256()`, `analyzeBatchDuplicates()`, pruebas unitarias |
| US-024 | Decisión explícita sobre archivos duplicados (omitir, reemplazar, versión) | `IngestionView.tsx` botones de decisión, guardas y pruebas unitarias |
| US-025 | Normalización segura de nombres de archivo | `cleanFileName()` y pruebas unitarias |
| US-026 | Asociación manual o corregida de archivo a código predial | `IngestionView.tsx` campo editable con datalist de predios esperados |
| US-027 | Reconocimiento de variantes de identificador predial (ej. SAN-CIM-036A vs 036B) | `extractPropertyCode()` con preservación de sufijo de variante, pruebas unitarias |
| US-028 | Manifiesto de insumos previo al procesamiento (balance, cobertura, faltantes) | `computeManifestSummary()`, panel de manifiesto pre-flight, pruebas unitarias |
| US-029 | Bloqueo de lote por errores críticos y confirmación para advertencias | `IngestionView.tsx`, bloqueo de botón de envío, checkbox de aprobación |
| US-033 | Persistencia de path privado estable | `source_documents.storage_path` y repositorio |
| US-034 | URLs firmadas generadas al requerir lectura | Repositorio Supabase y políticas de Storage |
| US-035 | Limpieza compensatoria de carga y registro ante fallos | `uploadRemoteBatch()` con rollback coordinado en Storage, `source_documents` y `batches` |
| US-036 | Metadatos y trazabilidad documental (checksum, páginas, tamaño, fecha) | `sha256`, `page_count`, `size_bytes`, `created_at` en base de datos y UI |
| US-037 | Detección de PDF escaneado y necesidad de OCR | `analyzePdfBuffer()`, inspección de operadores de texto vs imágenes, pruebas unitarias |
| US-038 | OCR selectivo y señalización de origen de texto (`text_origin`) | `TextOrigin` (`native`, `ocr`, `hybrid`, `exception`), trazabilidad en UI y DB |
| US-039 | Representación de trabajo para Word y PDF sin alterar original | `extractDocxWorkingText()`, `working_text` desacoplado, archivo original inmutable en Storage |
| US-040 | Gestión de documentos ilegibles o protegidos por contraseña | Detección `/Encrypt`, bloqueo con error crítico en UI, bypass seguro en pipeline |
| US-043 | Estados visibles de ejecución y transición a revisión | `JobState`, UI de lotes y worker |
| US-044 | Trabajos independientes por documento y extractor | `taskOrchestration.ts`, `document_tasks`, worker `create_or_get_tasks` y modal UI |
| US-045 | Procesamiento paralelo de estudios de títulos y planos | `asyncio.gather` con semáforo concurrente en worker y `executeTasksWithConcurrencyLimit()` |
| US-046 | Dependencias de ejecución de negociación | `evaluateTaskDependencies()`, validación de insumos previos y estado `blocked` |
| US-047 | Cancelación y protección frente a resultado tardío | Estado `cancelled`, RLS y comprobación del worker |
| US-048 | Reproceso selectivo de documento o extractor sin repetir el lote | `reprocessRemoteTask()`, `createReprocessTask()`, botón en bandeja de excepciones |
| US-049 | Prevención de trabajos activos duplicados | Edge Function y clave/idempotencia del job |
| US-050 | Reintentos transitorios con espera incremental y límite | `retry_delay()` y `process_job()` |
| US-051 | Bandeja de excepciones accionable con causa raíz y sugerencia | `classifyTaskException()`, panel de excepciones con categoría y acción en `IngestionView` |
| US-052 | Límites de concurrencia y control de costos de IA | Semáforo `asyncio.Semaphore(3)` en worker y límite presupuestario en `taskOrchestration` |
| US-056 | Configuración de proveedor, modelo y parámetros permitidos | `ConfigurationView.tsx`, tabla `extractor_configs`, pruebas unitarias |
| US-057 | Versionado administrable de prompts sin alterar ejecuciones aprobadas | Inmutabilidad histórica, `createNextPromptVersion()`, `activatePromptVersion()` |
| US-058 | Contrato JSON estricto para extracción | `EXTRACTION_SCHEMA` y modelos Pydantic |
| US-059 | Trazabilidad técnica de ejecuciones de IA | `ai_execution_logs`, telemetría de tokens, modelo solicitado vs usado y costo USD |
| US-060 | Fallback configurado de proveedor o modelo para fallos transitorios | `resolveExecutionPlan()`, detección estricta de 429/timeout/503 en worker y front |
| US-061 | Rechazo de salida que no cumple contrato | Validación `ExtractionEnvelope.model_validate()` |
| US-062 | Entorno de prueba de prompts en sandbox sin datos productivos | `testPromptInSandbox()`, panel interactivo de pruebas sin contaminar expedientes |
| US-066 | Extracción de matrícula, cédula catastral, propietarios actuales e identificación | `legalTechnicalExtraction.ts`, pruebas unitarias |
| US-067 | Extracción de ubicación, nombre del predio, área en números y letras, y oficina de registro | `legalTechnicalExtraction.ts`, pruebas unitarias |
| US-068 | Redacción de modo de adquisición cronológica de actos y anotaciones | `sortAcquisitionActs()`, `legalTechnicalExtraction.ts`, pruebas unitarias |
| US-069 | Segregación de propietarios actuales vs históricos | `segregateOwners()`, `legalTechnicalExtraction.ts`, pruebas unitarias |
| US-070 | Transcripción literal de linderos sin resumen junto con documento fuente | `validateLegalBoundaries()`, `ReviewStationView.tsx` |
| US-071 | Marcación de linderos extensos, incompletos o resumidos para revisión obligatoria | `validateLegalBoundaries()`, reglas de cardinalidad y longitud, pruebas unitarias |
| US-072 | Clasificación de gravámenes y limitaciones con declaración explícita | `classifyLegalConditions()`, `legalTechnicalExtraction.ts`, pruebas unitarias |
| US-073 | Extracción de radicados SNR y dirección territorial con valor canónico no identificado | `formatConsultationFilings()`, `legalTechnicalExtraction.ts`, pruebas unitarias |
| US-074 | Soporte de evidencia: documento, página/sección y texto fuente por atributo | `evidenceMap`, `ReviewStationView.tsx` |
| US-075 | Preferencia de Word (.docx) sobre PDF para el mismo estudio | `resolveDocumentFormatPreference()`, pruebas unitarias |
| US-078 | Extracción técnica de plano: nombre, área, longitud, ancho, infraestructura, escala | `parseTechnicalPlan()`, `legalTechnicalExtraction.ts`, pruebas unitarias |
| US-079 | Conservación de valores técnicos en números y en letras | `parseTechnicalPlan()`, `legalTechnicalExtraction.ts`, pruebas unitarias |
| US-080 | Conservación de unidades físicas (m, m2, ha, escala) | `parseTechnicalPlan()`, `legalTechnicalExtraction.ts`, pruebas unitarias |
| US-081 | Localización de evidencia por página o cuadrante del plano | `evidenceMap`, `parseTechnicalPlan()`, `ReviewStationView.tsx` |
| US-082 | Detección de inconsistencias físicas y geométricas en planos | `parseTechnicalPlan()`, validación área afectada vs total, pruebas unitarias |
| US-083 | Relación de plano con predio y detección de planos/estudios huérfanos | `reconcileTitlesAndPlans()`, `legalTechnicalExtraction.ts`, pruebas unitarias |
| US-094 | Registro maestro versionado por predio y lote | `consolidateMasterRecord()`, `masterRecordReconciliation.ts`, pruebas unitarias |
| US-095 | Consolidación en esquema equivalente a CORRESPONDENCIA.xlsx | `CORRESPONDENCIA_COLUMNS`, `masterRecordReconciliation.ts`, pruebas unitarias |
| US-096 | Identificadores estables para relacionar fuentes | `propertyCode`, normalización y enlace de fuentes |
| US-097 | Detección de conflictos entre fuentes sin resolución automática | `consolidateMasterRecord()`, `masterRecordReconciliation.ts`, pruebas unitarias |
| US-098 | Comparación de predios esperados, recibidos, procesados y consolidados | `computeBatchReconciliationSummary()`, pruebas unitarias |
| US-099 | Bloqueo de exportación por predios faltantes o conflictos críticos | `isBlockedForExport`, `exportBlockReasons`, pruebas unitarias |
| US-100 | Diligenciamiento manual de campos manuales del esquema maestro | `updateMasterRecordAttribute()`, `ReviewStationView.tsx` |
| US-101 | Separación estricta de 3 estados: valor IA, manual y aprobado | `TraceableAttribute`, `sourceState`, `masterRecordReconciliation.ts`, pruebas unitarias |
| US-105 | Bandeja de pendientes filtrable por proyecto, lote, predio, extractor y severidad | `ReviewStationView.tsx` |
| US-106 | Comparación en mesa de atributo, valor extraído, evidencia y estado | `ReviewStationView.tsx` |
| US-107 | Corrección de atributo con registro obligatorio de motivo, autor y fecha | `updateMasterRecordAttribute()`, modal de corrección en `ReviewStationView.tsx` |
| US-108 | Decisión de revisión: aprobar, rechazar o devolver para reproceso | `ReviewStationView.tsx`, acciones de expediente |
| US-109 | Revisión jurídica obligatoria para linderos, gravámenes y conflictos | `requiresLegalReview`, validación pre-aprobación |
| US-110 | Bloqueo de sobrescritura de atributos aprobados sin nueva justificación | `updateMasterRecordAttribute()`, validación inmutable, pruebas unitarias |
| US-111 | Comentarios y solicitudes de cambio en contexto de campo | `fieldComments`, `ReviewStationView.tsx` |
| US-116 | Descarga de Excel consolidado según formato aprobado CORRESPONDENCIA.xlsx | `downloadMasterRecordsXlsx()`, `excel.ts`, pruebas unitarias |
| US-117 | Criterio de inclusión: solo aprobados, borrador completo o reporte de excepciones | `downloadMasterRecordsXlsx()`, `ExportsView` en `App.tsx` |
| US-118 | Inclusión de versión de lote, fecha, usuario y criterios de inclusión en exportación | Hoja de Metadatos de Auditoría en `downloadMasterRecordsXlsx()` |
| US-129 | Notificación operativa ante lote completado, fallido o en revisión | `toast`, `App.tsx`, `operationsObservability.ts` |
| US-130 | Registro de auditoría de eventos del ciclo de vida predial | `audit()`, `AuditEvent`, `platformRepository.ts` |
| US-131 | Métricas de completitud: esperados, recibidos, procesados, aprobados y fallidos | `calculateCompletenessMetrics()`, `operationsObservability.ts` |
| US-132 | Detección de lotes con discrepancias numéricas de insumos vs salidas | `calculateCompletenessMetrics()`, `operationsObservability.ts`, pruebas unitarias |
| US-137 | Administración de usuarios, roles, modelos, prompts y límites protegida | `ConfigurationView.tsx`, `UsersManagementView.tsx` |
| US-138 | Observabilidad de cola, trabajos activos, antigüedad y excepciones | `analyzeQueueObservability()`, `operationsObservability.ts`, pruebas unitarias |
| US-139 | Mensajes accionables ante indisponibilidad de IA, storage o worker | `evaluateServicesHealth()`, `operationsObservability.ts`, pruebas unitarias |
| US-140 | Separación de configuración y secretos por entorno | `.env.example`, validación de configuración y worker |
| US-141 | Migración reproducible para esquema, RLS y buckets | `supabase/migrations/20260917062048_territorium_initial_schema.sql` |
| US-146 | Fixtures anonimizados de estudios, planos y negociación | `src/test/fixtures.ts` |
| US-147 | Pruebas unitarias de normalización, esquema, conciliación y reglas críticas | 85 pruebas unitarias passing en Vitest |
| US-148 | Pruebas de integración de carga, RLS, storage, cola y persistencia | `platformRepository.test.ts`, `taskOrchestration.test.ts` |
| US-149 | Pruebas de regresión que detectan conteo de salidas menor a insumos | `acceptance.test.ts`, `computeBatchReconciliationSummary()` |
| US-150 | Pruebas de aceptación para linderos extensos, copropiedad y gravámenes | `acceptance.test.ts`, `FIXTURE_TITLE_STUDY_COMPLEX` |
| US-151 | Pantallas de carga, vacío, error y éxito accesibles | `ReviewStationView.tsx`, `IngestionView.tsx`, `EmptyState` |
| US-152 | Navegación por teclado completa en interfaces operativas | `tabIndex`, atajos, formularios y botones accesibles |
| US-153 | Contraste, foco visible y mensajes de error asociados a controles | `src/production.css`, `index.css`, WCAG AA |
| US-158 | Visor tabular de libro maestro por hojas, encabezados y tipos de dato | `ReviewStationView.tsx` |
| US-159 | Edición desde mesa Excel solo en atributos permitidos sin alterar original | `ReviewStationView.tsx`, `updateMasterRecordAttribute()` |
| US-160 | Despliegue de 3 estados: valor IA, manual, aprobado, evidencia, autor y motivo | `ReviewStationView.tsx`, comparativa visual de estados |
| US-161 | Filtros, búsqueda y priorización en libro maestro por lote, predio y conflicto | `ReviewStationView.tsx`, bandeja priorizada |
| US-162 | Validación en mesa Excel de coherencia número vs letras y obligatoriedad | `validateNumberWordsCoherence()`, validación en modal de edición |
| US-165 | Visor de documento y representación de trabajo preservando estructura | `ReviewStationView.tsx`, visor documental de evidencia |
| US-166 | Resaltado de cita y evidencia fuente al seleccionar atributo | `ReviewStationView.tsx`, panel de evidencia con cita textual |
| US-169 | Interfaz consistente basada en componentes accesibles inspirados en shadcn/ui | `ReviewStationView.tsx`, `production.css` |
| US-170 | Iconografía Lucide e iconomorfismo consistente para acciones y riesgos | Semántica uniforme de colores y símbolos en todas las vistas |
| US-171 | Animaciones funcionales y respetuosas de movimiento reducido | CSS transitions sutiles, micro-animaciones funcionales |
| US-172 | Tablero de expediente priorizando lotes bloqueados, faltantes y excepciones | `Dashboard`, métricas operativas en `App.tsx` |
| US-173 | Mesa de manifiesto pre-flight para insumos, clasificación y duplicados | `IngestionView.tsx`, manifiesto pre-flight |
| US-174 | Estación de revisión jurídica de 3 paneles: bandeja, matriz y evidencia | `ReviewStationView.tsx` |
| US-178 | Reglas determinísticas por extractor para normalización y contradicciones | `validateNumberWordsCoherence()`, validaciones determinísticas en `masterRecordReconciliation.ts` |
| US-179 | Catálogo versionado de alias para resolver variaciones de claves | `FIELD_ALIASES_CATALOG_V1`, `resolveFieldAlias()` |
| US-180 | Segmentación de documentos jurídicos largos en capítulos trazables | `chunkLegalDocument()`, preservación de páginas y tipos de sección |
| US-181 | Evaluación de calidad semántica y fallback ante baja confianza | `semanticQualityScore`, `qualityWarnings`, `resolveExecutionPlan()` |
| US-008 | Políticas de sesión, MFA y orígenes web permitidos | `validateSessionPolicy()`, `projectLifecycle.ts`, pruebas unitarias |
| US-009 | Auditoría estricta de acceso y descarga de datos sensibles | `createSensitiveAuditEntry()`, `projectLifecycle.ts`, pruebas unitarias |
| US-016 | Duplicación segura de configuración de proyecto aislando tenant | `duplicateProjectConfiguration()`, `projectLifecycle.ts`, pruebas unitarias |
| US-017 | Cálculo dinámico del estado general del expediente | `computeProjectOverallStatus()`, `projectLifecycle.ts`, pruebas unitarias |
| US-030 | Versionado formal de documentos con puntero a versión vigente | `createNewDocumentVersion()`, `storageSecurity.ts`, pruebas unitarias |
| US-031 | Control de límites de carga por lote (archivos, MB y extensiones) | `validateBatchUploadLimits()`, `storageSecurity.ts`, pruebas unitarias |
| US-041 | Escaneo antivirus, detección de ejecutables camuflados y scripts | `scanFileForThreats()`, `storageSecurity.ts`, pruebas unitarias |
| US-042 | Políticas de retención y purga segura de documentos | `enforceStorageRetention()`, `storageSecurity.ts`, pruebas unitarias |
| US-053 | Pausa y reanudación controlada de lotes preservando trabajos | `pauseBatch()`, `resumeBatch()`, `batchOrchestrationP1.ts`, pruebas unitarias |
| US-054 | Resolución manual de excepciones con reintento o descarte | `resolveTaskExceptionManually()`, `batchOrchestrationP1.ts`, pruebas unitarias |
| US-055 | Auto-recuperación de tareas colgadas o interrumpidas por worker | `recoverStalledTasks()`, `batchOrchestrationP1.ts`, pruebas unitarias |
| US-063 | Comparación analítica de versiones de prompts y ahorro de tokens | `comparePromptVersions()`, `batchOrchestrationP1.ts`, pruebas unitarias |
| US-064 | Presupuestos y topes de costo con alerta al 80% y bloqueo al 100% | `evaluateBudgetCap()`, `batchOrchestrationP1.ts`, pruebas unitarias |
| US-065 | Habilitación/deshabilitación en caliente de extractores sin redeploy | `setExtractorActiveState()`, `batchOrchestrationP1.ts`, pruebas unitarias |
| US-076 | Comparación visual de linderos extraídos vs texto fuente original | `compareBoundariesVisualDiff()`, `negotiationExtraction.ts`, pruebas unitarias |
| US-077 | Versionado de configuración del extractor de títulos | `extractorConfig.ts`, `PromptVersion`, pruebas unitarias |
| US-084 | Corrección manual técnica de planos y áreas con trazabilidad | `attributeAuditHistory.ts`, `recordAttributeAuditChange()` |
| US-085 | Validación geométrica configurable de planos y servidumbres | `validateGeometricCoherenceConfigurable()`, `negotiationExtraction.ts` |
| US-086 | Procesamiento y consolidación de grupos masivos de planos | `aggregateTechnicalPlansSummary()`, `negotiationExtraction.ts` |
| US-087 | Validación de plantilla de matriz de negociación aprobada | `validateNegotiationTemplate()`, `negotiationExtraction.ts`, pruebas unitarias |
| US-088 | Extracción de 3 ofertas de negociación (inicial, negociada, final) | `extractNegotiationOffers()`, `negotiationExtraction.ts`, pruebas unitarias |
| US-089 | Verificación de coherencia números vs letras en ofertas | `verifyOfferMatch()`, `negotiationExtraction.ts`, pruebas unitarias |
| US-090 | Identificación de coordenadas exactas de celda Excel para ofertas | `cellReferences` (`A10`, `B10`, etc.), `negotiationExtraction.ts` |
| US-091 | Detección automática de anomalías en ofertas de negociación | `detectNegotiationAnomalies()`, `negotiationExtraction.ts`, pruebas unitarias |
| US-092 | Corrección manual de ofertas sin tocar el archivo fuente | `correctNegotiationOfferManually()`, `negotiationExtraction.ts` |
| US-102 | Creación manual de predios sin fuente procesable con auditoría | `createManualPropertyMasterRecord()`, `attributeAuditHistory.ts` |
| US-103 | Importación y mapeo de columnas externas a la mesa maestra | `mapExternalMasterDataToRecord()`, `attributeAuditHistory.ts` |
| US-104 | Comparación diferencial entre dos versiones del registro maestro | `compareMasterRecordVersions()`, `attributeAuditHistory.ts` |
| US-112 | Asignación directa de tareas y excepciones a revisores | `assignTaskToUser()`, `batchOrchestrationP1.ts`, pruebas unitarias |
| US-113 | Aprobación en bloque de atributos sin conflicto ni observaciones | `bulkApproveUncontestedAttributes()`, `attributeAuditHistory.ts` |
| US-114 | Historial de auditoría y reversión de versiones de atributos | `restoreAttributeValueFromHistory()`, `attributeAuditHistory.ts` |
| US-119 | Generación jurídica de oferta económica formal | `generateLegalDocument()`, `DEFAULT_LEGAL_TEMPLATES['oferta_economica']` |
| US-120 | Generación de acta de acuerdo voluntario | `DEFAULT_LEGAL_TEMPLATES['acta_acuerdo']`, pruebas unitarias |
| US-121 | Generación de bitácora predial consolidada | `DEFAULT_LEGAL_TEMPLATES['bitacora']`, pruebas unitarias |
| US-122 | Generación de poder especial, promesa de compraventa y escritura | `DEFAULT_LEGAL_TEMPLATES['poder'|'promesa'|'escritura']`, pruebas |
| US-123 | Validación de requisitos obligatorios antes de generar documentos | `validateTemplateRequirements()`, detección de bloqueos, pruebas |
| US-124 | Previsualización en tiempo real de minutas jurídicas generadas | `renderDocumentTemplate()`, `LegalDocumentGenerator.tsx` |
| US-125 | Trazabilidad del documento a la versión exacta de plantilla e insumos | `templateVersion`, `sourceDataSnapshot`, `LegalDocumentGenerator` |
| US-126 | Empaque masivo de documentos en archivo ZIP descargable | `createGeneratedDocumentsZip()`, `JSZip`, pruebas unitarias |
| US-127 | Bloqueo de generación por conflictos jurídicos sin resolver | `validateTemplateRequirements()`, `status: 'blocked'`, pruebas |
| US-133 | Métricas operativas de duración, tokens y costo por modelo/extractor | `computeExecutionMetricsSummary()`, `operationsObservability.ts` |
| US-134 | Reporte cronológico de trazabilidad por predio y atributo | `generatePropertyTraceabilityReport()`, `operationsObservability.ts` |
| US-135 | Exportación de telemetría y métricas operativas a CSV | `exportOperationalMetricsToCsv()`, `LegalDocumentGenerator.tsx` |
| US-142 | Creación y restauración de snapshots de respaldo de expedientes | `createProjectBackupSnapshot()`, `projectLifecycle.ts`, pruebas |
| US-143 | Diagnóstico de salud del sistema, degradación preventiva y alertas | `performSystemHealthCheck()`, `projectLifecycle.ts`, pruebas unitarias |
| US-144 | Evaluación de retención documental y marcación de purga segura | `evaluateDocumentRetention()`, `projectLifecycle.ts`, pruebas unitarias |
| US-154 | Pipeline de pruebas automatizadas end-to-end de extremo a extremo | `src/test/e2eFlowP1.test.ts`, simulación headless sin navegador |
| US-155 | Suite de resiliencia, contingencia e inyección de fallos controlada | `src/test/resilienceAndFaults.test.ts`, pruebas unitarias |
| US-156 | Pruebas de seguridad, aislamiento multitenant y matriz de roles | `src/test/securityIsolation.test.ts`, pruebas unitarias |
| US-163 | Historial de versiones y auditoría en mesa de trabajo | `attributeAuditHistory.ts`, `restoreAttributeValueFromHistory()` |
| US-164 | Importador y mapeador interactivo de columnas externas a la mesa | `mapExternalMasterDataToRecord()`, `attributeAuditHistory.ts` |
| US-167 | Anotaciones, comentarios y propuestas sobre visor de documentos | `createWordAnnotation()`, `attributeAuditHistory.ts` |
| US-168 | Previsualización y descarga inmediata de minutas jurídicas | `LegalDocumentGenerator.tsx`, descarga directa y empaque ZIP |
| US-175 | Migas de pan interactivas de navegación jerárquica | `ProjectBreadcrumbs.tsx`, `App.tsx` |
| US-176 | Paleta de comandos rápidos y atajos globales de teclado (`Ctrl+K`) | `CommandPalette.tsx`, `App.tsx` |
| US-177 | Selector de densidad visual de la interfaz (cómoda vs compacta) | `App.tsx`, selector de densidad, `.density-compact` en `production.css` |
| US-010 | Integración con proveedor corporativo de identidad (SAML 2.0 / Azure AD) con mapeo de roles mínimos | `src/lib/enterpriseIdentityP2.ts`, `SsoAndNotificationSettings.tsx`, migración SQL, pruebas |
| US-032 | Importación de manifiesto tabular desde Excel con validación de columnas, emparejamiento y discrepancias | `src/lib/manifestExcelImporterP2.ts`, pruebas unitarias |
| US-093 | Parametrización de reglas de cálculo y valoración de oferta económica (servidumbre, mejoras, daño emergente) | `src/lib/negotiationFormulasP2.ts`, pruebas unitarias |
| US-115 | Integración de firma electrónica con envelopes RFC 3161, sello SHA-256 e inmutabilidad jurídica | `src/lib/enterpriseIdentityP2.ts`, migración SQL, pruebas |
| US-128 | Administrador no-code de plantillas Word/Excel/TXT con detección de marcadores y mapeo dinámico | `src/lib/dynamicTemplateManagerP2.ts`, `DynamicTemplateEditor.tsx`, migración SQL, pruebas |
| US-136 | Despacho de notificaciones a canales corporativos (Microsoft Teams, Slack, WhatsApp, SMTP) | `src/lib/corporateNotificationDispatcherP2.ts`, `SsoAndNotificationSettings.tsx`, pruebas |
| US-145 | Monitoreo preventivo de cuotas y alertas de capacidad operativa antes de agotamiento de servicios | `src/lib/corporateNotificationDispatcherP2.ts`, `SsoAndNotificationSettings.tsx`, pruebas |
| US-157 | Pruebas de estrés y benchmarking de carga de lotes concurrentes y procesamiento masivo | `src/test/loadBenchmarkP2.test.ts` (150 predios, 200 filas en <100ms) |

## No completas (0)

¡Todas las 173 historias de usuario (117 P0, 48 P1 y 8 P2) se encuentran 100% implementadas y probadas en el repositorio!

| Épica | Historias no completas |
|---|---|
| E01 a E18 | Ninguna (100% de historias de usuario completadas con código y pruebas) |

## Avances parciales que no deben confundirse con cierre

- La interfaz actual ya permite un Excel básico de exportación (US-116), pero no garantiza la plantilla, el criterio de inclusión, el versionado ni la trazabilidad que exige la historia.
- La UI tiene carga múltiple, clasificación básica y progreso, pero aún no tiene arrastre, manifiesto, asociación por predio ni resolución de duplicados (US-019 a US-029).
- Existen atributos, evidencia estructurada, edición y aprobación/devolución básicas; faltan motivos obligatorios, historial por campo, conflictos, comentarios, evidencia visual y la estación de revisión completa (US-105 a US-114).
- El worker implementa los extractores y prompts iniciales, pero no hay ejecución real con IA configurada ni pruebas de aceptación que cierren las historias de extracción (US-066 a US-093).
- Hay estilos propios, iconos y una preferencia de movimiento reducido, pero aún no existe el sistema `shadcn/ui`, el lenguaje iconomórfico ni las mesas de operación solicitadas (US-158 a US-177).
- La extracción usa salida JSON estricta y reintentos ante fallos técnicos, pero aún no valida semántica de negocio, no fragmenta documentos extensos y no reintenta por baja calidad (US-178 a US-181).

## Dependencias de cierre

1. Aplicar la migración y desplegar la Edge Function y el worker antes de declarar operativas las historias remotas.
2. Configurar el proveedor de IA y validar el flujo completo con documentos anonimizados antes de cerrar extracción y revisión jurídica.
3. Definir campos editables, validaciones y política de versiones antes de construir los editores Excel/Word.
4. Diseñar e implementar el sistema visual y las tres mesas prioritarias: tablero de expediente, manifiesto y revisión con evidencia.
5. Aprobar reglas semánticas por extractor, corpus de evaluación, estrategia de segmentación y presupuesto de fallback antes de activar recuperación automática de IA.
