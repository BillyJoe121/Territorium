# Títulos de historias de usuario no completas y reabiertas por auditoría

Corte: 2026-09-17 (Actualización según auditoría de consultoría).
* **Historias Reabiertas en Cierre y Endurecimiento Real (US-002 a US-296)**: Reabiertas por exigencia de persistencia, controles efectivos, firma no simulada, Excel/ZIP verídicos y aislamiento real.
* **Historias de Extracción Parciales (US-066 a US-093)**: 28 historias en estado Parcial, pendientes de validación con corpus documental real anonimizado y contraste jurídico colegiado.
* **Historias P0 y P1 UI/UX (US-201 a US-300)**: 62/62 cerradas funcionalmente en frontend.
* **Historias P2 UI/UX pendientes**: 38 historias en cola de backlog sensorial.

Este documento funciona como la lista de control activa de trabajo pendiente y reabierto. A medida que se implementen y verifiquen los controles efectivos de persistencia real, se irán cerrando con evidencia.

---

## Resumen de Estado del Backlog UI/UX Activo

| Prioridad | Descripción de Alcance | Total | Completadas | Pendientes | Estado |
|---|---|:---:|:---:|:---:|:---:|
| **P0** | Núcleo crítico UI: Enrutamiento base, layouts, diálogo/dropdown Radix, estación Split-View, Drag&Drop, Toasts Sonner y Gateway Notarial | 27 | **27** | **0** | **100% Completado** |
| **P1** | Ampliación operativa: Lazy loading, popovers, tabs, bento grid y gráficos Recharts (área, radar, dona), cajón lateral, filtros facetados y OTP notarial | 35 | **35** | **0** | **100% Completado** |
| **P2** | Excelencia sensorial y micro-interacciones: Bloqueador de cambios sucios, matriz de riesgo, zoom en planos, atajos avanzados, modo compacto y descarga de paquete ZIP notarial | 38 | 0 | **38** | Pendiente de ejecución |
| **TOTAL** | **Historias activas del backlog de modernización** | **100** | **62** | **38** | **En progreso (P0 y P1 cerrados)** |

---

## Historias P0 Completadas y Verificadas (27/27)

- [x] **US-201**: `react-router` Root Layout persistente con navegación sin parpadeo ni recargas. *(Implementado en `App.tsx` con hash-router SPA y layout persistente)*.
- [x] **US-202**: Acceso directo por URL y deep linking a proyectos (`/app/proyectos/:id`). *(Integrado en `App.tsx` con sincronización de estado de proyectos)*.
- [x] **US-203**: Sincronización de predio seleccionado en query params para navegación con historial atrás/adelante (`/app/proyectos/:id/revision?predio=:folio`). *(Implementado en estación de revisión y routing)*.
- [x] **US-204**: Migas de pan dinámicas automáticas en la barra superior (`ProjectBreadcrumbs`). *(Componente de migas dinámicas integrado en topbar de `App.tsx`)*.
- [x] **US-205**: Guardián de autenticación con redirección inteligente preservando ruta previa (`/login?from=...`). *(Manejador de sesión activa y preservación de ruta de retorno)*.
- [x] **US-216**: Menús de acciones accesibles en tablas de predios con `@radix-ui/react-dropdown-menu`. *(Componente `ActionDropdown.tsx` con soporte accesible de teclado y foco)*.
- [x] **US-217**: Diálogos modales accesibles con bloqueo de foco para acciones destructivas con `@radix-ui/react-dialog`. *(Componente `ConfirmDialog.tsx` con roles WAI-ARIA y portal)*.
- [x] **US-218**: Interruptores booleanos táctiles para gravámenes y discrepancias con `@radix-ui/react-switch`. *(Componente `RadixSwitch.tsx` animado con thumb deslizante)*.
- [x] **US-219**: Píldoras de estado predial con tokens semánticos de color WCAG AA (Aprobado, En Revisión, Discrepancia). *(Componente `StatusPill.tsx` con contraste verificado)*.
- [x] **US-231**: Gráfico de dona con `recharts` para la distribución de estados de predios en Dashboard. *(Componente `DashboardDonutChart` con leyenda interactiva)*.
- [x] **US-232**: Tarjetas KPI estilo Bento Grid en cabecera de Dashboard con cifras clave y micro-gráficos. *(Componente `BentoGridKpis.tsx` con métricas ejecutivas)*.
- [x] **US-233**: Gráfico de barras horizontales con `recharts` para clasificación de discrepancias por categoría y severidad. *(Componente `DiscrepanciesBarChart` integrado en Dashboard)*.
- [x] **US-246**: Divisor vertical arrastrable (Split-Pane) entre visor PDF (izquierda) y atributos prediales (derecha). *(Componente `SplitReviewStation.tsx` con handle interactivo y límites 20%-80%)*.
- [x] **US-247**: Resaltado automático en visor PDF del fragmento de texto o área donde la IA extrajo el atributo. *(Tarjetas de evidencia con cita textual, página y badge de extracción)*.
- [x] **US-248**: Indicador con píldora de extractor y porcentaje de confianza en cada campo de atributo. *(Píldoras semánticas verde/ámbar/rojo con % de certeza en `SplitReviewStation`)*.
- [x] **US-249**: Modo de edición inline en campos de atributos con guardado inmediato en auditoría al pulsar Enter. *(Edición en tiempo real con tecla Enter / Escape y registro de autoría)*.
- [x] **US-250**: Barra de acción fija en base de revisión con botones estables y atajos de teclado (`Alt+A`, `Alt+D`). *(Barra fija inferior con listeners globales de teclado)*.
- [x] **US-261**: Zona Drag & Drop interactiva con animación al arrastrar y selector de carpeta completa. *(Componente `EnhancedDropZone.tsx` con feedback visual arrastrable)*.
- [x] **US-262**: Píldoras de archivo cargado con icono de tipo documental y barra de progreso de subida individual. *(Píldoras con porcentaje animado y cancelación individual)*.
- [x] **US-263**: Paleta de comandos global modal accesible con `Cmd+K` / `Ctrl+K` para navegación instantánea. *(Modal accesible de comandos rápidos con atajo de teclado)*.
- [x] **US-276**: Sistema global de notificaciones Toaster con `sonner` para feedback no invasivo. *(Integrado en raíz de `App.tsx` con tema claro/oscuro)*.
- [x] **US-277**: Notificación Toast con botón de acción interactivo al terminar el procesamiento de un lote ("Ir a revisión"). *(Acciones interactivas con `toast.success` y botón directo)*.
- [x] **US-278**: Notificación Toast de seguimiento en descargas y generación de libros Excel pesados. *(Feedback de exportación mediante notificaciones temporizadas)*.
- [x] **US-289**: Layout y pasarela del Portal Notarial público mediante enlaces seguros temporales (`/public/portal/:shareToken`). *(Componente `PublicNotaryPortal.tsx` con validación criptográfica HMAC-SHA256)*.
- [x] **US-290**: Modal para generación de enlaces externos para notarías con fecha de expiración y permisos. *(Componente `ShareNotaryLinkModal.tsx` con selección de 24h, 48h o 7d)*.
- [x] **US-291**: Vista optimizada de lectura jurídica de minutas y transcripción de linderos en Portal Notarial. *(Visor de lectura tipográfica sin distracciones para el notario)*.
- [x] **US-292**: Botón de conformidad notarial externa ("Minuta conforme" / "Requiere ajustes") con registro de autoría e IP. *(Formulario con radicación de concepto, observaciones y emisión de recibo digital)*.

---

## Historias P1 Completadas y Verificadas (35/35)

- [x] **US-206**: División de bundle con `React.lazy` y `<Suspense>` temático para inicio de app <500ms. *(Configurado en router SPA con Suspense y fallback fluido)*.
- [x] **US-207**: Ruta dedicada `/app/papelera` para recuperación y restauración de expedientes archivados. *(Ruta activa en `App.tsx` con listado y restauración en 1 clic)*.
- [x] **US-208**: Ruta de pantalla completa para el asistente de carga y validación de manifiesto de lotes. *(Ruta `lotes_nuevo` con wizard modal/pantalla completa)*.
- [x] **US-209**: Restauración automática de la posición de scroll (`ScrollRestoration`) al volver de una ficha predial. *(Integrado en `App.tsx` con preservación de `scrollY` por ruta)*.
- [x] **US-210**: Sub-ruta dedicada `/app/proyectos/:id/formatos/editor/:plantillaId` para edición y previsualización. *(Componente `TemplateEditorWithVariables.tsx` con pestañas y vista en vivo)*.
- [x] **US-220**: Popover flotante inteligente con `@radix-ui/react-popover` para selector de columnas visibles. *(Componente `ColumnSelectorPopover.tsx` con toggle de visibilidad)*.
- [x] **US-221**: Tooltips explicativos contextuales en términos jurídicos complejos con `@radix-ui/react-tooltip`. *(Componente `LegalTooltip.tsx` con diccionario jurídico colombiano)*.
- [x] **US-222**: Pestañas fluidas en ficha predial con `@radix-ui/react-tabs` para separar linderos, gravámenes y tradición. *(Componente `AccessibleTabs.tsx` accesible con flechas del teclado)*.
- [x] **US-223**: Barras de desplazamiento discretas y tematizadas con `@radix-ui/react-scroll-area`. *(Integrado en paneles y tablas con scroll estilizado sin desborde)*.
- [x] **US-224**: Acordeón colapsable animado con `@radix-ui/react-accordion` para panel de discrepancias jurídicas. *(Componente `AccessibleAccordion.tsx` con badges de severidad)*.
- [x] **US-225**: Gestor de temas Claro / Oscuro con variables CSS sin parpadeo (FOUC) y persistencia local. *(Componente `ThemeToggle.tsx` con persistencia en localStorage y tokens CSS)*.
- [x] **US-234**: Gráfico de área temporal suavizada con `recharts` que muestre predios ingresados vs revisados por semana. *(Componente `ProcessingFlowAreaChart` con degradados semánticos)*.
- [x] **US-235**: Gráfico de radar (estilo PMO) con `recharts` que evalúe la completitud documental del expediente. *(Componente `MaturityRadarChart` con ejes de tradición, linderos y catastro)*.
- [x] **US-236**: Gráfico de anillo de nivel de confianza de extracciones con filtro reactivo al hacer clic en segmentos. *(Componente `AiConfidenceDonutChart` con desglose alto/medio/bajo)*.
- [x] **US-237**: Micro-gráficas de barra (Sparklines) dentro de celdas de tabla para visualizar el avance de cada predio. *(Componente `MiniSparkline.tsx` con barra de progreso embebida)*.
- [x] **US-238**: Mapa de árbol (Treemap) interactivo que represente el volumen y proporción de folios por lote. *(Componente `BatchesTreemap.tsx` con ponderación de complejidad)*.
- [x] **US-251**: Controles de zoom fluido (50%-300%), rotación de 90° y desplazamiento panorámico en visor PDF. *(Integrado en barra de visor PDF en `SplitReviewStation.tsx`)*.
- [x] **US-252**: Comparativa de 3 columnas simultáneas (Estudio de Títulos vs Plano vs Negociación) para resolver discrepancias. *(Modal y vista tripartita en `SplitReviewStation.tsx`)*.
- [x] **US-253**: Cajón lateral colapsable (Drawer) con listado virtualizado de predios para cambio rápido sin salir de revisión. *(Sheet drawer lateral en `SplitReviewStation.tsx`)*.
- [x] **US-254**: Pestañas en visor documental para alternar en <200ms entre el PDF del estudio, plano y minuta. *(Selector tipo tabs sobre el visor en `SplitReviewStation.tsx`)*.
- [x] **US-255**: Popover con historial de versiones y auditoría individual de cada atributo predial. *(Popover emergente con autor, timestamp y motivo del cambio)*.
- [x] **US-264**: Panel lateral deslizante (Drawer/Sheet) en lista de proyectos para consulta rápida sin abandonar la tabla. *(Componente `SideDrawer.tsx` con Radix Dialog y animaciones)*.
- [x] **US-265**: Barra de filtros facetados superiores con píldoras combinables y botón de limpieza masiva. *(Componente `FacetedFilters.tsx` con tags de conteo activo y clear all)*.
- [x] **US-266**: Modal de selección de hojas y columnas a incluir en el libro de exportación Excel. *(Componente `ExcelExportConfigModal.tsx` con 4 matrices configurables)*.
- [x] **US-267**: Modal de invitación de usuarios corporativos con validación de sintaxis en tiempo real y asignación de rol. *(Componente `InviteUserModal.tsx` con roles y feedback regex)*.
- [x] **US-268**: Selector dinámico de variables jurídicas (`{{propietario}}`, `{{area}}`) mediante píldoras en el editor de minutas. *(Componente `VariablePillsSelector.tsx` con catálogo temático)*.
- [x] **US-279**: Animación de reordenamiento y deslizamiento suave de filas en tablas con Framer Motion. *(Clases `.table-row-smooth` con aceleración por hardware)*.
- [x] **US-280**: Estado de carga con spinner integrado y bloqueo de doble clic en botones de acción pesada. *(Componente `ButtonWithSpinner.tsx` con prevención de pulsación concurrente)*.
- [x] **US-281**: Micro-animación de destello verde y transición física al aprobar un predio en la estación de revisión. *(Efecto visual y sonoro/toast en aprobación predial)*.
- [x] **US-282**: Micro-texto de guardado automático con retardo debounce ("Guardando...", "Cambios guardados"). *(Componente `AutoSaveIndicator.tsx` estilo Google Docs)*.
- [x] **US-283**: Animación de sacudida horizontal (Shake Effect) en campos con errores de validación. *(Keyframe `shake` en `production.css` y clase `.animate-shake`)*.
- [x] **US-293**: Opción en Portal Notarial para que la notaría adjunte paz y salvos y minutas firmadas al bucket privado. *(Módulo `registerNotarySupportDocument` e interfaz de subida en portal)*.
- [x] **US-294**: Visor PDF en Portal Notarial con marca de agua disuasoria ("Copia informativa - Notaría X"). *(Capa superpuesta diagonal con `pointer-events-none` y opacidad legal)*.
- [x] **US-295**: Panel de administración y revocación inmediata de enlaces públicos externos en `/app/configuracion/enlaces`. *(Modal `NotaryLinksAdminModal.tsx` y función `revokeNotaryShareToken`)*.
- [x] **US-296**: Pantalla de verificación por código OTP de 6 dígitos (`input-otp`) para acceso al portal de la notaría. *(Flujo de reto OTP con límite estricto de 3 intentos en `PublicNotaryPortal.tsx`)*.

---

## Historias de Usuario Pendientes de Implementación (38 restantes)

### Prioridad P2: Excelencia Sensorial, Analítica Avanzada y Flujos de Cierre (38 historias)

---

### Prioridad P2: Excelencia Sensorial, Analítica Avanzada y Flujos de Cierre (38 historias)

- [ ] **US-211**: Bloqueador de navegación con cambios pendientes sin guardar (`useBlocker`) y modal de advertencia.
- [ ] **US-212**: Sincronización de pestañas activas en la URL mediante query params (`?tab=archivados`).
- [ ] **US-213**: Paginación reflejada en deep links de auditoría (`?page=4&limit=50`) para enlaces compartibles.
- [ ] **US-214**: Límites de error (`ErrorBoundary`) aislados por sub-ruta para evitar cierres globales de aplicación.
- [ ] **US-215**: Sub-ruta dedicada con monitor de progreso para descargas pesadas en segundo plano.
- [ ] **US-226**: Control deslizante de doble punto con `@radix-ui/react-slider` para calibrar tolerancias de cabida/área.
- [ ] **US-227**: Tarjeta flotante rápida (`@radix-ui/react-hover-card`) al pasar el cursor sobre la matrícula inmobiliaria.
- [ ] **US-228**: Menú contextual nativo web con clic derecho (`@radix-ui/react-context-menu`) en filas de predios.
- [ ] **US-229**: Selector de densidad de interfaz (Compacta, Normal, Espaciosa) con persistencia en preferencias.
- [ ] **US-230**: Esqueletos temáticos de carga con pulso animado idénticos a las tablas y tarjetas finales.
- [ ] **US-239**: Gráfico de embudo de conversión predial (Cargados → Extraídos → Conciliados → Aprobados → Escriturados).
- [ ] **US-240**: Gráfico de dispersión (Scatter Plot) que correlacione área vs porcentaje de discrepancia con línea de tolerancia.
- [ ] **US-241**: Botón de exportación limpia de gráficos a imágenes PNG/PDF vectoriales para informes de comité.
- [ ] **US-242**: Filtrado cruzado interactivo: hacer clic en una gráfica filtra automáticamente el resto del dashboard.
- [ ] **US-243**: Medidor tipo velocímetro (Gauge Chart) con el tiempo promedio de resolución de discrepancias.
- [ ] **US-244**: Matriz visual de riesgo jurídico 3x3 (Probabilidad vs Impacto) para alertas prediales críticas.
- [ ] **US-245**: Animación de pulso en gráficos al recibir eventos de actualización por Supabase Realtime.
- [ ] **US-256**: Panel lateral con mini-mapa de miniaturas de páginas para navegación ágil en PDF de gran extensión.
- [ ] **US-257**: Herramienta de regla virtual en visor PDF para calibrar cotas y verificar mediciones en planos topográficos.
- [ ] **US-258**: Hilo de comentarios y notas jurídicas con menciones `@usuario` en cada atributo predial.
- [ ] **US-259**: Modo de revisión a pantalla completa (`F11`) que oculta cabeceras y maximiza el área de lectura.
- [ ] **US-260**: Asistente de autocompletado jurídico con catálogo oficial de municipios y tipos de gravamen de la SNR.
- [ ] **US-269**: Alternador de visualización tipo hoja de cálculo con primera columna congelada en tablas extensas.
- [ ] **US-270**: Ordenamiento multi-columna simultáneo en tablas manteniendo presionada la tecla Shift.
- [ ] **US-271**: Modal lightbox oscuro a pantalla completa para visualización detallada de planos y croquis.
- [ ] **US-272**: Confirmación de doble paso obligatoria antes de activar una nueva versión de prompt de extracción.
- [ ] **US-273**: Anillo de progreso SVG circular en tarjetas de lote que ilustre el avance de completitud.
- [ ] **US-274**: Menú desplegable en avatar de usuario con iniciales, rol institucional y cierre seguro de sesión.
- [ ] **US-275**: Píldora indicadora de estado de conexión WebSocket / Realtime en la barra superior.
- [ ] **US-284**: Micro-animación de confeti discreto al completar la revisión del 100% de los predios de un proyecto.
- [ ] **US-285**: Animación de check verde en botones de copiar al enviar matrículas o cédulas al portapapeles.
- [ ] **US-286**: Efecto flash azul de celda actualizada en tiempo real cuando otro operador edita el mismo predio.
- [ ] **US-287**: Indicador flotante adherido al puntero con el conteo de archivos detectados en arrastre.
- [ ] **US-288**: Píldora de fondo deslizante (`layoutId` Framer Motion) en la navegación activa entre pestañas.
- [ ] **US-297**: Comentarios de ajustes puntuales sobre párrafos de la minuta realizados directamente por la notaría.
- [ ] **US-298**: Descarga en un clic de paquete notarial comprimido en ZIP con nombres de archivo normalizados.
- [ ] **US-299**: Generación de acta de confirmación con sello de tiempo RFC 3161 y hash SHA-256 de los documentos aprobados.
- [ ] **US-300**: Notificación instantánea al equipo interno por Teams/Slack/Correo cuando la notaría emite concepto.
