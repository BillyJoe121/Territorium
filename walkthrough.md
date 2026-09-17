
- **E06 P0 (Extractores, Prompts y Modelos):**
  - `US-056`: Configuración administrable de modelos, parámetros y límites por extractor.
  - `US-057`: Versionado inmutable de prompts con trazabilidad histórica.
  - `US-058`: Contrato JSON estricto (`EXTRACTION_SCHEMA` y Pydantic).
  - `US-059`: Telemetría técnica (`ai_execution_logs`, tokens prompt/completion, modelo y latencia).
  - `US-060`: Fallback determinístico configurado ante errores 429, timeout o 503.
  - `US-061`: Rechazo de salidas fuera de contrato.
  - `US-062`: Sandbox playground de pruebas de prompts sin contaminar expedientes.

- **E07 P0 (Extracción de Estudios de Títulos):**
  - `US-066`: Extracción estructurada de folio, cédula catastral, propietarios actuales e identificación.
  - `US-067`: Ubicación canónica, nombre del predio, áreas en cifras y letras, y ORIP.
  - `US-068`: Reconstrucción cronológica de actos del modo de adquisición (`sortAcquisitionActs`).
  - `US-069`: Segregación estricta entre propietarios actuales y titulares históricos (`segregateOwners`).
  - `US-070` & `US-071`: Transcripción literal obligatoria de linderos, validación de cardinalidad (Norte, Sur, Oriente, Occidente) y marcado de revisión obligatoria para linderos extensos (>2000 car) o sospechosamente resumidos.
  - `US-072`: Clasificación de gravámenes y limitaciones con declaración explícita de *"sin condiciones jurídicas vigentes"*.
  - `US-073`: Extracción de radicados SNR y dirección territorial con valor canónico *"no identificado"*.
  - `US-074`: Soporte de evidencia: documento, página/sección y cita textual por atributo.
  - `US-075`: Preferencia sistemática de documento Word (.docx) sobre PDF para el mismo estudio predial.

- **E08 P0 (Extracción Técnica de Planos):**
  - `US-078`: Extracción de metadatos técnicos: nombre, área, longitud de servidumbre, ancho de franja, infraestructura/postes y escala.
  - `US-079` & `US-080`: Conservación estricta de valores en números y en letras, y unidades físicas (`m`, `m2`, `ha`, escala cartográfica).
  - `US-081`: Localización de evidencia por página o cuadrante del plano técnico.
  - `US-082`: Detección de inconsistencias geométricas (área de afectación mayor al área total del predio, o discrepancias longitud × ancho).
  - `US-083`: Conciliación relacional entre planos y estudios con detección de planos huérfanos y estudios sin plano (`reconcileTitlesAndPlans`).

- **E10 P0 (Registro Maestro y Conciliación Predial):**
  - `US-094`: Registro maestro versionado por predio y lote (`PropertyMasterRecord`).
  - `US-095`: Consolidación en esquema oficial equivalente a `CORRESPONDENCIA.xlsx`.
  - `US-096`: Identificadores prediales estables (`propertyCode`).
  - `US-097`: Detección y visibilidad de conflictos entre fuentes sin resolución automática.
  - `US-098`: Comparación cuantitativa de predios esperados, recibidos, procesados y consolidados.
  - `US-099`: Bloqueo estricto de exportación final ante predios faltantes o conflictos críticos.
  - `US-100`: Captura de atributos manuales (resultado de negociación, datos corporativos).
  - `US-101`: Mantenimiento separado de los 3 estados de atributo: valor IA original, valor manual y valor aprobado (`sourceState`).

- **E11 P0 (Revisión Jurídica, Excepciones y Aprobación):**
  - `US-105`: Bandeja de pendientes filtrable por proyecto, lote, predio, severidad y estado.
  - `US-106`: Mesa de comparación de atributo, valor extraído, evidencia fuente y regla.
  - `US-107`: Corrección de atributos con registro obligatorio de motivo del cambio, autor, fecha y valor previo.
  - `US-108`: Acciones jurídicas de predio: Aprobar, Rechazar o Devolver para reproceso selectivo.
  - `US-109`: Revisión obligatoria para linderos, gravámenes y conflictos de titularidad.
  - `US-110`: Inmutabilidad: bloqueo de sobrescritura sobre atributos aprobados sin nueva justificación expresa.
  - `US-111`: Comentarios estructurados y solicitud de cambios en contexto de campo.

- **E12 P0 (Exportaciones y Documentos Jurídicos):**
  - `US-116`: Descarga de libro Excel certificado con hojas `CORRESPONDENCIA`, `Trazabilidad Atributos` y `Metadatos Exportación`.
  - `US-117`: Selector de criterio de inclusión: *Entrega Oficial (Solo Aprobados)*, *Borrador Completo* o *Reporte de Excepciones y Conflictos*.
  - `US-118`: Inclusión obligatoria de versión de lote, fecha ISO, usuario y criterios de inclusión en hoja de auditoría.

- **E13 P0 (Notificaciones, Auditoría y Reportes Operativos):**
  - `US-129`: Notificaciones reactivas ante finalización, fallo o necesidad de revisión en lotes.
  - `US-130`: Registro de auditoría para eventos de carga, ejecución, fallback, corrección, aprobación y exportación.
  - `US-131` & `US-132`: Métricas de completitud y detector automático de discrepancias numéricas (ej. 52 insumos vs 48 resultados).

- **E14 P0 (Administración, Operación y Continuidad):**
  - `US-137`: Consola protegida para usuarios, roles, extractores, prompts y límites.
  - `US-138`: Observabilidad de colas, trabajos activos, antigüedad y excepciones.
  - `US-139`: Diagnóstico de salud de servicios (DB, Storage, IA, Worker) con mensajes accionables.

- **E15 P0 (Calidad, Pruebas y Accesibilidad):**
  - `US-146`: Banco de fixtures anonimizados para pruebas (`src/test/fixtures.ts`).
  - `US-147` & `US-148`: Suite completa de 85 pruebas unitarias y de integración pasando al 100%.
  - `US-149`: Pruebas de regresión que detectan discrepancias de conteo de insumos vs salidas consolidadas.
  - `US-150`: Pruebas de aceptación con casos complejos: linderos extensos (>2000 car), copropietarios, gravámenes múltiples y radicados no identificados.
  - `US-151`, `US-152`, `US-153`: Accesibilidad WCAG AA, foco visible, navegación completa por teclado y soporte de movimiento reducido.

- **E16 P0 (Espacios de Trabajo Excel y Word):**
  - `US-158`: Visualizador tabular del libro maestro organizado por pestañas temáticas.
  - `US-159` & `US-160`: Edición restringida a atributos autorizados con despliegue de los 3 estados (IA, Manual, Aprobado), autor y motivo.
  - `US-161`: Búsqueda, filtros y priorización por lote, predio, conflicto y estado.
  - `US-162`: Validación determinística de coherencia entre números y letras (`validateNumberWordsCoherence`).
  - `US-165` & `US-166`: Visor de trabajo con resaltado de citas textuales, número de página y sección documental.

- **E17 P0 (Experiencia de Operación y Sistema Visual):**
  - `US-169`: Interfaz unificada con componentes inspirados en `shadcn/ui` adaptados a la marca Territorium.
  - `US-170`: Iconografía Lucide con lenguaje iconomórfico consistente de colores y acciones.
  - `US-171`: Micro-animaciones funcionales con respeto a `prefers-reduced-motion`.
  - `US-172`: Tablero de expediente enfocado en lotes bloqueados, discrepancias y revisiones.
  - `US-173`: Mesa de manifiesto previa al procesamiento en `IngestionView`.
  - `US-174`: Estación de revisión jurídica de tres paneles (Bandeja priorizada, Matriz de atributos maestra, Evidencia documental).

- **E18 P0 (Calidad Semántica y Recuperación de IA):**
  - `US-178`: Reglas determinísticas por extractor y detección de contradicciones materiales.
  - `US-179`: Catálogo versionado de alias de campos (`FIELD_ALIASES_CATALOG_V1`).
  - `US-180`: Segmentador de documentos extensos (`chunkLegalDocument`) preservando capítulos y citas.
  - `US-181`: Puntuación de calidad semántica (`semanticQualityScore`) y planificador de fallback correctivo.

---

## 2. Evidencia de Verificación (`npm run verify`)

Ejecutado sin interfaz de navegador, reportando 0 errores:

```text
> territorium-legal-extraction@0.1.0 verify
> npm run check && npm run test && npm run build

> territorium-legal-extraction@0.1.0 check
> tsc --noEmit

> territorium-legal-extraction@0.1.0 test
> vitest run

 ✓ src/lib/masterRecordReconciliation.test.ts (10 tests)
 ✓ src/lib/taskOrchestration.test.ts (5 tests)
 ✓ src/test/acceptance.test.ts (6 tests)
 ✓ src/lib/legalTechnicalExtraction.test.ts (15 tests)
 ✓ src/lib/operationsObservability.test.ts (4 tests)
 ✓ src/lib/excel.test.ts (2 tests)
 ✓ src/lib/extractorConfig.test.ts (12 tests)
 ✓ src/lib/batchValidation.test.ts (11 tests)
 ✓ src/lib/documentPreprocessor.test.ts (7 tests)
 ✓ src/data/platformRepository.test.ts (13 tests)

 Test Files  10 passed (10)
      Tests  85 passed (85)
   Duration  1.30s

> territorium-legal-extraction@0.1.0 build
> tsc -b && vite build

✓ 1904 modules transformed.
dist/index.html                             0.88 kB │ gzip:   0.42 kB
dist/assets/index-JG6wLeSY.css             37.83 kB │ gzip:   8.58 kB
dist/assets/rolldown-runtime-W7wSyTde.js    0.97 kB │ gzip:   0.56 kB
dist/assets/icons-NXd8UMkE.js              22.26 kB │ gzip:   7.64 kB
dist/assets/supabase-u6CgwU-i.js          162.85 kB │ gzip:  42.52 kB
dist/assets/react-CaHhP--e.js             182.10 kB │ gzip:  57.29 kB
dist/assets/index-A4JnkqcD.js             438.35 kB │ gzip: 124.54 kB
✓ built in 1.66s
```
