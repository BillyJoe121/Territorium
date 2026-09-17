# Decisiones de implementación

## 2026-09-17 — Base paralela, no renombrar PMO

Territorium es un producto y dominio distintos. Se reutilizan ideas de PMO (estado de ejecución, cancelación, mensajes de error, separación UI/servicio) sin acoplar su monolito de agente ni heredar sus límites de autorización.

## 2026-09-17 — Procesamiento fuera de Edge Functions

Una ejecución puede abarcar decenas de PDF/DOCX y depender de IA y OCR. Las Edge Functions se limitan a autorizar/enviar estados; un worker Python, con timeout y despliegue propios, procesa el trabajo durable. Esto evita agotar el tiempo de una request y permite reintentos controlados.

## 2026-09-17 — Resultados sujetos a revisión

Ninguna extracción es un concepto jurídico ni se aprueba automáticamente. Se almacenan fuente, evidencia, confianza y estado de revisión antes de habilitar una entrega confiable.

## 2026-09-17 — Mesas de trabajo, no editores de archivos fuente

La conciliación se realizará en una mesa Excel y la revisión documental en un visor Word con anotaciones. Ambos usan una representación de trabajo y registros de cambios; nunca editan el archivo original cargado. Así se conservan evidencia, versiones, valor de IA, corrección humana y valor aprobado como datos distinguibles y auditables.

## 2026-09-17 — Sistema visual operacional propio

`shadcn/ui` se usará como base local de componentes accesibles y componibles, con Lucide para iconos y Motion/CSS para transiciones breves y funcionales. No se copia el sistema visual de PMO: Territorium mantiene su lenguaje territorial y prioriza estados de riesgo, evidencia y siguiente acción sobre decoración.

## 2026-09-17 — IA con validación semántica y recuperación acotada

La validación de esquema no basta para datos jurídicos y técnicos. Después de extraer, Territorium aplicará reglas determinísticas y versionadas por extractor, con valor crudo y causa de cada normalización. Las inconsistencias materiales no se corrigen automáticamente: se bloquean o se envían a revisión. Documentos extensos se procesarán por segmentos trazables y los reintentos o modelos alternos se permitirán únicamente por criterios de calidad aprobados, presupuesto y auditoría de cada intento.
