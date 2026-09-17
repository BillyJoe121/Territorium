# Backlog de Modernización UI/UX: Superar la Calidad de PMO en Territorium

## 1. Visión y Objetivo Estratégico

Territorium ya posee un núcleo operativo, backend y de pruebas significativamente superior al de PMO (arquitectura de worker en Python con colas `SKIP LOCKED`, aislamiento zero-trust, neutralización de inyecciones en Excel y 161 pruebas unitarias y de estrés automatizadas, frente a 0 pruebas en PMO).

Sin embargo, para cerrar la brecha de percepción y **superar a PMO en calidad de producto SaaS comercial**, Territorium adoptará un ecosistema frontend de componentes enterprise, navegación declarativa por URL con deep links, gráficas analíticas interactivas, visor documental sincronizado (Split-View), microinteracciones fluidas y un portal de acceso público temporal para notarías y peritos externos.

---

## 2. Ecosistema de Componentes y Stack Tecnológico UI

| Capa / Dominio | Biblioteca Seleccionada | Justificación técnica y paridad vs PMO |
|---|---|---|
| **Enrutador** | `react-router` (v7) | Reemplaza el `useState<Screen>` en `App.tsx`. Ofrece deep linking, navegación con historial (`back`/`forward`), layouts anidados, loaders asíncronos y query params (`?filtro=...`). |
| **Primitivas Accesibles** | `@radix-ui/react-*` | Primitivas sin estilos con cumplimiento estricto de accesibilidad WAI-ARIA (Dialog, DropdownMenu, Tabs, Accordion, Popover, Tooltip, ScrollArea, Switch, Slider, ContextMenu). |
| **Estilos y Tokens** | `tailwindcss` (v4) + Tokens CSS | Paleta territorial sobria (verde esmeralda jurídico, pizarra oscura, dorados de advertencia y platino), tipografía de alta legibilidad y modo oscuro/claro gobernado. |
| **Visualización Gráfica** | `recharts` | Visualización ejecutiva interactiva: gráficos de dona para distribución predial, barras apiladas de avance de lote y radares de calidad documental. |
| **Animaciones y Transiciones** | `motion` (Framer Motion v12) | Animaciones con aceleración por hardware para entradas/salidas de modales, reordenamientos, transiciones de rutas y acordeones fluidos sin saltos de layout. |
| **Toasts y Notificaciones** | `sonner` | Notificaciones en esquina apilables con barra de progreso, botón de deshacer y enlace rápido de navegación ("Lote procesado. [Ver revisión]"). |
| **Búsqueda Global y Comandos** | `cmdk` | Paleta de comandos accesible (`Ctrl+K` / `Cmd+K`) con navegación rápida por teclado a cualquier predio, expediente o acción del sistema. |
| **Visor Documental** | Visor Canvas/PDF nativo con zoom | Panel sincronizado para visualizar el documento fuente, resaltar fragmentos extraídos y comparar lado a lado contra los campos jurídicos. |
| **Portal de Terceros** | Portal público tokenizado (`/public/portal/:token`) | Acceso seguro sin login con token firmado HMAC-SHA256 para notarías y peritos (equivalente superior a la encuesta pública de PMO). |

---

## 3. Mapa de Rutas de la Aplicación

```
/ (Redirección condicional según estado de sesión)
├── /login (Inicio de sesión con correo/contraseña y SSO corporativo)
├── /recuperar-password (Solicitud de enlace de restablecimiento)
├── /reset-password (Formulario de cambio seguro de contraseña)
│
├── /app (Layout maestro: Sidebar colapsable, Header global, Breadcrumbs, Toaster)
│   ├── /app/dashboard (Tablero de control ejecutivo con Recharts)
│   ├── /app/proyectos (Listado general de proyectos con filtros y vistas tabla/grid)
│   ├── /app/proyectos/nuevo (Modal / Wizard guiado para alta de expediente)
│   │
│   ├── /app/proyectos/:projectId (Hub central del proyecto)
│   │   ├── /app/proyectos/:projectId/resumen (Ficha técnica del proyecto y métricas)
│   │   ├── /app/proyectos/:projectId/lotes (Historial de entregas y lotes cargados)
│   │   ├── /app/proyectos/:projectId/lotes/nuevo (Área Drag & Drop, manifiesto y pre-validación)
│   │   ├── /app/proyectos/:projectId/lotes/:batchId (Detalle del lote y monitor de jobs en tiempo real)
│   │   │
│   │   ├── /app/proyectos/:projectId/predios (Directorio catastral y matriz de folios)
│   │   ├── /app/proyectos/:projectId/predios/:propertyId (Ficha maestra consolidada)
│   │   ├── /app/proyectos/:projectId/revision (Estación de revisión jurídica Split-View)
│   │   │
│   │   ├── /app/proyectos/:projectId/formatos (Gestor de plantillas y generación de minutas/escrituras)
│   │   ├── /app/proyectos/:projectId/exportaciones (Generación y descarga de libros Excel blindados)
│   │   └── /app/proyectos/:projectId/configuracion (Prompts, tolerancias, fórmulas y equipo)
│   │
│   ├── /app/usuarios (Gestión de usuarios corporativos y asignación de roles RBAC)
│   ├── /app/configuracion (Ajustes de SSO SAML, alertas Slack/Teams/WhatsApp y cuotas)
│   ├── /app/trazabilidad (Auditoría forense inmutable con exportación de logs)
│   └── /app/papelera (Proyectos y lotes eliminados con opción de restauración)
│
└── /public (Zona pública segura sin autenticación previa)
    ├── /public/portal/:shareToken (Portal de acceso para notaría o perito externo)
    ├── /public/portal/:shareToken/predio/:propertyId (Revisión notarial y firma de minuta)
    └── /public/portal/:shareToken/confirmacion (Sello digital y confirmación de trámite)
```

---

## 4. Backlog de 100 Nuevas Historias de Usuario (US-201 a US-300)

### Épica UX-01: Enrutamiento Declarativo, Layouts Anidados y Deep Linking (US-201 a US-215)

| ID | Pri. | Ruta / Componente | Elemento UI | Historia de Usuario y Criterio de Aceptación |
|---|---|---|---|---|
| **US-201** | P0 | `/app/*` | `react-router` Root Layout | **Como usuario**, quiero una estructura de layout con navegación persistente para no perder la posición del menú ni recargar la app al navegar. *Criterio*: Navegar entre rutas hijas no desmonta el Sidebar ni el Header. |
| **US-202** | P0 | `/app/proyectos/:id` | Route Param Matching | **Como analista**, quiero acceder directamente a un proyecto por su URL para compartirlo por correo o chat corporativo. *Criterio*: Cargar la URL `/app/proyectos/PRJ-101` monta directamente los datos del proyecto. |
| **US-203** | P0 | `/app/proyectos/:id/revision?predio=:folio` | Query Params Sync | **Como revisor**, quiero que el predio seleccionado en la estación de revisión se refleje en los query params para usar los botones atrás/adelante del navegador. *Criterio*: Al cambiar de predio la URL cambia sin recargar y el botón "Atrás" regresa al anterior. |
| **US-204** | P0 | Global | `ProjectBreadcrumbs` dinámicos | **Como usuario**, quiero migas de pan automáticas en la barra superior para conocer mi ubicación exacta en la jerarquía. *Criterio*: Muestra `Inicio > Proyectos > Río Grande > Lote 04 > Predio 12` con enlaces navegables en cada nivel. |
| **US-205** | P0 | `/login`, `/reset-password` | Auth Guard & Redirection | **Como usuario no autenticado**, quiero ser redirigido a `/login?from=/ruta-original` al intentar acceder a una pantalla protegida para que tras loguearme vuelva a donde estaba. *Criterio*: Tras el login exitoso, redirige al `from` original. |
| **US-206** | P1 | `/app/*` | React Suspense + Lazy Loading | **Como usuario con conexión lenta**, quiero que cada ruta descargue su bundle de forma asíncrona para que el inicio de la app sea casi instantáneo (<500ms). *Criterio*: Cada pantalla pesada usa `React.lazy` y muestra un esqueleto de carga temático. |
| **US-207** | P1 | `/app/papelera` | Soft-Delete Route | **Como líder de proyecto**, quiero una ruta dedicada `/app/papelera` para revisar expedientes archivados y poder restaurarlos en un clic. *Criterio*: Lista solo elementos con `is_deleted = true` con botón "Restaurar" y confirmación. |
| **US-208** | P1 | `/app/proyectos/:id/lotes/nuevo` | Full-Screen Wizard Route | **Como operador**, quiero que la carga de lotes tenga una ruta dedicada a pantalla completa para enfocarme en la validación del manifiesto sin distracciones. *Criterio*: Ruta limpia con opción explícita de "Cancelar y volver". |
| **US-209** | P1 | Global | Scroll Restoration | **Como analista**, quiero que al volver de la ficha de un predio a la lista de predios, la posición del scroll vertical se mantenga intacta. *Criterio*: `ScrollRestoration` de react-router devuelve el viewport a la fila previa. |
| **US-210** | P1 | `/app/proyectos/:id/formatos` | Nested Template Editor Route | **Como abogado**, quiero editar plantillas en una sub-ruta `/formatos/editor/:plantillaId` para alternar entre edición y previsualización. *Criterio*: La ruta preserva el borrador en memoria mientras no se guarde. |
| **US-211** | P2 | Global | Dirty Form Navigation Blocker | **Como revisor**, quiero que el sistema me advierta si intento salir de una página con cambios pendientes sin guardar para no perder correcciones manuales. *Criterio*: `useBlocker` dispara un diálogo Radix modal de advertencia antes de cambiar de URL. |
| **US-212** | P2 | `/app/proyectos?tab=mis-proyectos` | Tab State via URL | **Como gestor**, quiero que las pestañas de filtros en proyectos se sincronicen en la URL para compartir listas filtradas exactas. *Criterio*: Copiar la URL con `?tab=archivados&responsable=maria` abre la vista exactamente filtrada. |
| **US-213** | P2 | `/app/trazabilidad` | Paginated Deep Links | **Como auditor**, quiero que la paginación de la auditoría se guarde en la URL (`?page=4&limit=50`) para regresar a un hallazgo específico. *Criterio*: Compartir el enlace abre exactamente la página 4 con los mismos 50 eventos. |
| **US-214** | P2 | Global | ErrorBoundary por Ruta | **Como usuario**, quiero que si una pantalla específica falla por datos corruptos, solo falle esa sección y no toda la aplicación. *Criterio*: Cada ruta hija tiene su propio `errorElement` con botón "Reintentar vista". |
| **US-215** | P2 | `/app/proyectos/:id/exportaciones` | Download Stream State Route | **Como operador**, quiero una sub-ruta de exportaciones donde pueda ver el progreso de empaquetado de archivos ZIP/Excel pesados. *Criterio*: Muestra barra de progreso continua sin congelar la navegación en otras pestañas. |

---

### Épica UX-02: Sistema de Diseño, Tokens Visuales y Primitivas Radix UI (US-216 a US-230)

| ID | Pri. | Pantalla / Componente | Elemento UI | Historia de Usuario y Criterio de Aceptación |
|---|---|---|---|---|
| **US-216** | P0 | Menús de acción en tablas | `@radix-ui/react-dropdown-menu` | **Como usuario**, quiero menús contextuales accesibles por teclado en cada fila de predio para ejecutar acciones rápidas (ver, editar, aprobar). *Criterio*: Abre con Enter o clic, navega con flechas y cierra con Escape. |
| **US-217** | P0 | Modales de confirmación | `@radix-ui/react-dialog` | **Como operador**, quiero diálogos modales accesibles con bloqueo de foco para acciones irreversibles (eliminar, cancelar lote). *Criterio*: Atrapa el foco dentro del diálogo y desactiva el scroll del fondo mientras está abierto. |
| **US-218** | P0 | Formularios de edición | `@radix-ui/react-switch` | **Como revisor**, quiero interruptores booleanos táctiles para activar/desactivar gravámenes y marcas de discrepancia en predios. *Criterio*: Interruptor animado con estados ON/OFF claros y etiquetas ARIA descriptivas. |
| **US-219** | P0 | Píldoras de estado predial | Badge Primitives con Tokens | **Como analista**, quiero píldoras de estado con códigos de color semánticos (Verde=Aprobado, Ámbar=Requiere Revisión, Rojo=Discrepancia Crítica). *Criterio*: Cada píldora incluye icono SVG y ratio de contraste WCAG AA > 4.5:1. |
| **US-220** | P1 | Selector de columnas | `@radix-ui/react-popover` | **Como analista**, quiero un popover flotante en las tablas para mostrar u ocultar columnas de atributos según mi preferencia. *Criterio*: El popover se posiciona inteligentemente evitando colisiones con los bordes de la pantalla. |
| **US-221** | P1 | Ayuda contextual | `@radix-ui/react-tooltip` | **Como nuevo operador**, quiero tooltips explicativos al pasar el cursor sobre términos jurídicos (ej. "Cabida", "Gravamen", "Tradición"). *Criterio*: Aparece tras 300ms de hover y desaparece inmediatamente al mover el cursor. |
| **US-222** | P1 | Matriz de atributos | `@radix-ui/react-tabs` | **Como revisor**, quiero pestañas fluidas en la ficha predial (Identificación, Propietarios, Linderos, Jurídico, Económico) para navegar sin scroll excesivo. *Criterio*: Transición animada de contenido activo sin recálculo de layout brusco. |
| **US-223** | P1 | Listados extensos | `@radix-ui/react-scroll-area` | **Como usuario**, quiero barras de desplazamiento estilizadas y discretas que no desfiguren el diseño en Windows o navegadores web. *Criterio*: Barras personalizadas que aparecen al scroll y respetan la paleta oscura/clara de Territorium. |
| **US-224** | P1 | Acordeón de discrepancias | `@radix-ui/react-accordion` | **Como revisor**, quiero colapsar y expandir secciones de inconsistencias entre planos y títulos de forma independiente. *Criterio*: Flechas animadas al abrir y soporte de cierre automático de paneles hermanos (modo single/multiple). |
| **US-225** | P1 | Modo Oscuro / Claro | CSS Token Manager + LocalStorage | **Como usuario nocturno**, quiero alternar entre tema oscuro profundo y tema claro de alto contraste para reducir la fatiga visual. *Criterio*: El cambio es instantáneo, no produce parpadeo blanco (FOUC) y persiste en el navegador. |
| **US-226** | P2 | Selector de rango de tolerancia | `@radix-ui/react-slider` | **Como administrador**, quiero un control deslizante de doble punto para ajustar la tolerancia de discrepancia de áreas (ej. 2% a 5%). *Criterio*: Arrastre fluido táctil y por teclado, con valor numérico en tiempo real. |
| **US-227** | P2 | Previsualización rápida | `@radix-ui/react-hover-card` | **Como operador**, quiero pasar el cursor sobre el número de matrícula inmobiliaria para ver una tarjeta flotante con el resumen del predio sin salir de la tabla. *Criterio*: Muestra miniatura del plano, área y propietario principal en 250ms. |
| **US-228** | P2 | Menú contextual con clic derecho | `@radix-ui/react-context-menu` | **Como usuario avanzado**, quiero hacer clic derecho en cualquier fila de predio para abrir un menú contextual nativo web con acciones avanzadas. *Criterio*: Menú flotante posicionado exactamente en las coordenadas del puntero del ratón. |
| **US-229** | P2 | Selector de densidad de interfaz | Design Token Scaling | **Como analista con monitor de alta resolución**, quiero alternar entre densidad "Compacta", "Normal" y "Espaciosa" en tablas maestras. *Criterio*: Reduce paddings y fuentes en modo compacto aumentando las filas visibles por pantalla un 40%. |
| **US-230** | P2 | Esqueletos temáticos de carga | Skeleton Pulse UI Primitives | **Como usuario**, quiero que las pantallas en carga muestren siluetas animadas con pulso suave idénticas a los componentes que se cargarán. *Criterio*: Sustituye los spinners genéricos por bloques grises con la forma exacta de tablas y tarjetas. |

---

### Épica UX-03: Dashboard Analítico Ejecutivo y Visualización Recharts (US-231 a US-245)

| ID | Pri. | Pantalla / Componente | Elemento UI | Historia de Usuario y Criterio de Aceptación |
|---|---|---|---|---|
| **US-231** | P0 | `/app/dashboard` | `ResponsiveContainer` Recharts | **Como director de tierras**, quiero un gráfico de dona con la distribución de predios por estado (Aprobados, En revisión, Con discrepancias, Bloqueados). *Criterio*: Gráfica vectorial responsiva con leyenda interactiva y tooltip con porcentajes exactos. |
| **US-232** | P0 | `/app/dashboard` | KPI Bento Grid Cards | **Como gerente**, quiero tarjetas de métricas estilo bento grid en la cabecera (Predios totales, Área total hectáreas, Discrepancias activas, Tasa de aprobación). *Criterio*: Tarjetas con números en tipografía monospace, micro-gráficos de tendencia e iconos distintivos. |
| **US-233** | P0 | `/app/proyectos/:id/resumen` | `BarChart` Discrepancias | **Como líder técnico**, quiero un gráfico de barras horizontales que clasifique las discrepancias por tipo (Cabida/Área, Titularidad, Gravámenes, Linderos). *Criterio*: Barras coloreadas según severidad (rojo/naranja) con etiquetas numéricas legibles. |
| **US-234** | P1 | `/app/dashboard` | `AreaChart` Flujo de Procesamiento | **Como jefe de operaciones**, quiero una gráfica de área temporal que muestre predios ingresados vs predios revisados en las últimas semanas. *Criterio*: Curva suavizada bicromática con selector de rango de fechas (7d, 30d, 90d). |
| **US-235** | P1 | `/app/proyectos/:id/resumen` | `RadarChart` Madurez de Expediente | **Como auditor**, quiero un gráfico de radar (tipo PMO) que evalúe la completitud documental del proyecto (Estudios, Planos, Minutas, Paz y Salvos, Catastro). *Criterio*: Polígono de 5 ejes que compara la línea base vs el estado actual del expediente. |
| **US-236** | P1 | `/app/dashboard` | Donut Chart de Confianza IA | **Como auditor de IA**, quiero un gráfico de anillo que muestre la proporción de extracciones por nivel de confianza (>90%, 75-90%, <75%). *Criterio*: Clic en el segmento de baja confianza filtra automáticamente la lista de predios por revisar. |
| **US-237** | P1 | `/app/proyectos/:id/predios` | Mini Sparklines en Tabla | **Como analista**, quiero micro-gráficas de barra dentro de las celdas de la tabla para ver visualmente el porcentaje de avance de cada predio. *Criterio*: Renderizado ligero de barras de 60px sin degradar el rendimiento de la tabla. |
| **US-238** | P1 | `/app/dashboard` | Treemap de Lotes por Tamaño | **Como operador**, quiero un mapa de árbol (Treemap) que represente el tamaño y volumen documental de cada lote cargado. *Criterio*: Bloques proporcionales al número de folios con gradiente de color según el estado del lote. |
| **US-239** | P2 | `/app/proyectos/:id/resumen` | Funnel Chart de Aprobación | **Como coordinador**, quiero un embudo de conversión que visualice el paso de los predios (Cargados → Extraídos → Conciliados → Aprobados → En Escritura). *Criterio*: Muestra el porcentaje de abandono o retención en cada etapa del proceso predial. |
| **US-240** | P2 | `/app/dashboard` | Gráfico de Dispersión (Scatter) | **Como analista territorial**, quiero un gráfico de dispersión que correlacione el área del predio contra la diferencia porcentual entre plano y escritura. *Criterio*: Puntos interactivos con tooltip del nombre del predio y línea guía de tolerancia del 3%. |
| **US-241** | P2 | `/app/dashboard` | Exportación de Gráficos a PNG/PDF | **Como líder de proyecto**, quiero un botón en cada gráfico para descargarlo como imagen vectorial PNG de alta resolución para informes de comité. *Criterio*: Exporta la gráfica limpia con marca de agua y fecha sin incluir controles de la UI. |
| **US-242** | P2 | `/app/dashboard` | Filtro cruzado interactivo | **Como analista**, quiero que al hacer clic en una barra o sector de cualquier gráfica, todas las demás gráficas y tablas se filtren por esa categoría. *Criterio*: Interacción reactiva en menos de 100ms mediante estado contextual unificado. |
| **US-243** | P2 | `/app/dashboard` | Indicador de Velocidad de Resolución | **Como gerente**, quiero un medidor tipo velocímetro (Gauge Chart) con el tiempo promedio en horas de resolución de discrepancias. *Criterio*: Aguja animada con zonas verde (<24h), amarilla (24-72h) y roja (>72h). |
| **US-244** | P2 | `/app/proyectos/:id/resumen` | Matriz de Riesgo Jurídico | **Como abogado líder**, quiero una matriz visual 3x3 de Impacto vs Probabilidad con las alertas jurídicas del proyecto (demandas, embargos, falsas tradiciones). *Criterio*: Celdas interactivas con conteo de predios en riesgo alto, medio y bajo. |
| **US-245** | P2 | `/app/dashboard` | Live Pulse Animation en Gráficos | **Como operador**, quiero que los gráficos muestren un pulso animado cuando ingresen nuevos datos por Supabase Realtime. *Criterio*: La serie de datos se actualiza suavemente mediante Framer Motion sin parpadear. |

---

### Épica UX-04: Estación de Revisión Jurídica Split-View y Visor Documental (US-246 a US-260)

| ID | Pri. | Pantalla / Componente | Elemento UI | Historia de Usuario y Criterio de Aceptación |
|---|---|---|---|---|
| **US-246** | P0 | `/app/proyectos/:id/revision` | Split-Pane Redimensionable | **Como revisor jurídico**, quiero un divisor vertical arrastrable entre el documento PDF original (izquierda) y los atributos prediales (derecha). *Criterio*: Permite redimensionar las dos áreas libremente y recuerda la proporción seleccionada. |
| **US-247** | P0 | Visor de PDF | Canvas / SVG Highlight Overlay | **Como revisor**, quiero que al enfocar un campo de atributo (ej. "Área de terreno"), el visor PDF resalte el fragmento exacto donde la IA leyó el valor. *Criterio*: Desplaza automáticamente el PDF a la página correspondiente y coloca un recuadro amarillo en el texto. |
| **US-248** | P0 | Ficha de Atributos | Input con estado de certeza | **Como revisor**, quiero ver junto a cada campo de atributo una píldora con el extractor que lo originó y el porcentaje de confianza (ej. "Títulos • 94%"). *Criterio*: Si la confianza es menor a 80%, el campo muestra borde ámbar de advertencia. |
| **US-249** | P0 | Ficha de Atributos | Botón de corrección inline | **Como revisor**, quiero poder editar directamente cualquier valor numérico o texto con tecla Enter, registrando automáticamente el cambio en la auditoría. *Criterio*: El campo pasa a modo edición en un clic y muestra un icono de "Editado manualmente". |
| **US-250** | P0 | Barra de acción de revisión | Botones de decisión estables | **Como abogado**, quiero botones fijos en la base del panel ("Aprobar predio", "Marcar con discrepancia", "Siguiente predio") para trabajar con rapidez. *Criterio*: Teclas rápidas asociadas (`Alt+A` Aprobar, `Alt+D` Discrepancia, `Alt+Derecha` Siguiente). |
| **US-251** | P1 | Visor de PDF | Controles de Zoom y Rotación | **Como analista**, quiero controles de zoom fluido (50% a 300%), rotación de 90° y ajuste a pantalla para leer planos escaneados verticalmente. *Criterio*: Mantiene la nitidez del documento y permite arrastrar el visor (pan) con la barra espaciadora. |
| **US-252** | P1 | Ficha de Atributos | Comparativa lado a lado de fuentes | **Como revisor**, quiero una vista de 3 columnas cuando existan discrepancias para comparar el valor del Estudio de Títulos vs Plano vs Negociación. *Criterio*: Muestra los tres valores simultáneos con botón "Elegir este valor como oficial". |
| **US-253** | P1 | Estación de Revisión | Lista lateral colapsable de predios | **Como revisor**, quiero un drawer lateral con la lista de todos los predios del lote con iconos de su estado para cambiar de predio sin salir de la estación. *Criterio*: Lista virtualizada que soporta 1,000 predios fluidamente con buscador por número de cédula o matrícula. |
| **US-254** | P1 | Visor de Documentos | Selector de documento fuente | **Como revisor**, quiero pestañas superiores en el visor para alternar instantáneamente entre el PDF del Estudio de Títulos, el Plano Topográfico y el Acta de Negociación. *Criterio*: El cambio de documento toma menos de 200ms mediante caché de URL firmada. |
| **US-255** | P1 | Ficha de Atributos | Historial de versiones del atributo | **Como auditor**, quiero hacer clic en un icono de reloj junto a cualquier atributo para ver un popover con todas las modificaciones humanas y de IA anteriores. *Criterio*: Muestra fecha, hora, autor, valor anterior y motivo de la corrección. |
| **US-256** | P2 | Visor de PDF | Mini-mapa de navegación de páginas | **Como analista**, quiero un panel de miniaturas de todas las páginas del PDF en el margen izquierdo para saltar a escrituras extensas de 50 páginas. *Criterio*: Genera miniaturas ligeras y resalta las páginas que contienen evidencias extraídas. |
| **US-257** | P2 | Visor de PDF | Herramienta de medición en planos | **Como topógrafo**, quiero una regla virtual en el visor para verificar escalas y distancias aproximadas en el PDF del plano. *Criterio*: Permite calibrar una cota conocida y medir segmentos con precisión visual en metros. |
| **US-258** | P2 | Ficha de Atributos | Notas y comentarios jurídicos | **Como abogado**, quiero agregar comentarios y etiquetas a un atributo o predio para que otro colega del equipo pueda resolver una duda. *Criterio*: Hilo de notas con menciones `@usuario` y estado "Pendiente" o "Resuelto". |
| **US-259** | P2 | Estación de Revisión | Modo Pantalla Completa | **Como revisor**, quiero maximizar la estación de revisión a pantalla completa ocultando la cabecera general para aprovechar monitores secundarios. *Criterio*: Tecla `F11` o botón dedicado que oculta barras del sistema y maximiza el área útil al 100%. |
| **US-260** | P2 | Ficha de Atributos | Asistente de autocompletado jurídico | **Como analista**, quiero que los campos de departamento, municipio, vereda y tipo de gravamen ofrezcan autocompletado basado en el catálogo oficial de la DANE y SNR. *Criterio*: Lista desplegable que filtra mientras escribe y previene errores ortográficos. |

---

### Épica UX-05: Modales, Drawers, Píldoras y Componentes de Interacción Rica (US-261 a US-275)

| ID | Pri. | Pantalla / Componente | Elemento UI | Historia de Usuario y Criterio de Aceptación |
|---|---|---|---|---|
| **US-261** | P0 | Carga de archivos | Zona Drag & Drop interactiva | **Como operador**, quiero un área de arrastre amplia con animaciones al pasar archivos por encima y selector de carpeta completa. *Criterio*: La zona se ilumina en verde al detectar archivos válidos y en rojo si hay extensiones no permitidas. |
| **US-262** | P0 | Carga de archivos | Píldoras de archivo con progreso individual | **Como operador**, quiero que cada archivo cargado muestre una píldora con nombre, tamaño, icono de tipo de documento y barra de progreso TUS. *Criterio*: Si un archivo falla, la píldora muestra botón de reintento individual sin reiniciar el lote entero. |
| **US-263** | P0 | Global | Paleta de Comandos (`Cmd+K`) | **Como usuario**, quiero presionar `Cmd+K` o `Ctrl+K` en cualquier pantalla para abrir un buscador modal rápido tipo Mac Spotlight. *Criterio*: Busca en tiempo real expedientes, predios, acciones rápidas ("Nuevo proyecto", "Ir a configuración") y navega al pulsar Enter. |
| **US-264** | P1 | `/app/proyectos` | Drawer lateral de detalle rápido | **Como gestor**, quiero hacer clic en un proyecto para que se deslice un panel lateral derecho (Sheet/Drawer) con el resumen sin abandonar la lista. *Criterio*: Drawer fluido con animación de entrada desde la derecha y cierre al pulsar Escape o clic fuera. |
| **US-265** | P1 | Tabla de Predios | Filtros facetados en barra superior | **Como analista**, quiero píldoras de filtros combinables (Estado, Municipio, Tipo de Discrepancia, Confianza) con botón "Limpiar todo". *Criterio*: Cada filtro activo muestra una píldora con cruz de eliminación individual y conteo de resultados. |
| **US-266** | P1 | Exportación | Modal de configuración de Excel | **Como operador**, quiero un modal para seleccionar qué hojas y columnas incluir en el libro Excel (Folio, Linderos, Propietarios, Gravámenes, Trazabilidad). *Criterio*: Casillas de verificación con selector "Seleccionar todo / ninguno" y estimación de tamaño de descarga. |
| **US-267** | P1 | `/app/usuarios` | Modal de invitación de usuario | **Como administrador**, quiero un modal para invitar nuevos miembros ingresando correo, nombre y asignando rol mediante radio buttons estilizados. *Criterio*: Valida sintaxis de correo en tiempo real y muestra retroalimentación inmediata. |
| **US-268** | P1 | Generador de Formatos | Selector dinámico de variables | **Como abogado**, quiero insertar marcadores dinámicos (`{{propietario}}`, `{{cedula}}`, `{{area}}`) haciendo clic en píldoras flotantes sobre el editor. *Criterio*: Al hacer clic en la píldora, la etiqueta se inserta en la posición exacta del cursor en el editor de texto. |
| **US-269** | P2 | Tablas maestras | Menú de densidad y vista compacta | **Como usuario intensivo**, quiero un botón en la esquina superior de la tabla para alternar entre vista estándar de tarjetas y vista tabular compacta tipo hoja de cálculo. *Criterio*: La vista compacta congela la primera columna con el número de matrícula mientras se desplaza horizontalmente. |
| **US-270** | P2 | Tablas maestras | Ordenamiento multi-columna | **Como analista**, quiero ordenar la tabla por múltiples criterios (ej. primero por Municipio y luego por Estado de Aprobación) manteniendo presionada la tecla Shift. *Criterio*: Flechas indicadoras en cada cabecera con números de jerarquía de orden (1, 2). |
| **US-271** | P2 | Ficha de Predio | Modal de visualización de imagen a pantalla completa | **Como topógrafo**, quiero hacer clic en el croquis o plano del predio para expandirlo en un modal lightbox oscuro con zoom de alta resolución. *Criterio*: Fondo negro semitransparente con controles de cierre y navegación entre planos adjuntos. |
| **US-272** | P2 | `/app/proyectos/:id/configuracion` | Diálogo de advertencia de cambio de prompt | **Como administrador**, quiero un modal con confirmación de doble paso antes de activar una nueva versión de prompt de extracción para evitar regresiones operativas. *Criterio*: El botón "Activar versión" permanece deshabilitado hasta que el usuario marque una casilla de confirmación. |
| **US-273** | P2 | Tabla de Lotes | Indicador circular de progreso de lote | **Como operador**, quiero ver un anillo de progreso SVG en cada tarjeta de lote que muestre el porcentaje exacto de predios completados. *Criterio*: Anillo animado que cambia de color de azul (procesando) a verde (100% completado). |
| **US-274** | P2 | Menú de usuario | Dropdown de perfil con avatar y rol | **Como usuario**, quiero un menú desplegable en mi avatar con mi rol actual, opción de cambiar contraseña, alternar tema y cerrar sesión de forma segura. *Criterio*: Muestra mis iniciales con un badge del color correspondiente a mi rol institucional. |
| **US-275** | P2 | Barra de navegación | Indicador de conectividad Realtime | **Como operador**, quiero un indicador tipo píldora en la barra superior (Verde=Conectado en vivo, Ámbar=Reconectando, Gris=Modo local/desconectado). *Criterio*: Si la conexión WebSocket se cae, muestra un tooltip explicativo con botón "Reintentar conexión". |

---

### Épica UX-06: Feedback Sensorial, Microinteracciones y Sistema de Notificaciones Toaster (US-276 a US-288)

| ID | Pri. | Pantalla / Componente | Elemento UI | Historia de Usuario y Criterio de Aceptación |
|---|---|---|---|---|
| **US-276** | P0 | Global | Toaster con `sonner` | **Como usuario**, quiero recibir notificaciones no invasivas en la esquina inferior derecha cuando ocurran eventos del sistema. *Criterio*: Toasts claros, con iconos distintivos por tipo (éxito, información, alerta, error) y cierre automático tras 4 segundos. |
| **US-277** | P0 | Carga de lotes | Toast con botón de acción | **Como operador**, quiero que al terminar de procesar un lote aparezca un toast con el mensaje "Lote 03 finalizado con éxito" y un botón directo "Ir a revisión". *Criterio*: Hacer clic en el botón redirige inmediatamente a la ruta de revisión sin clics extra. |
| **US-278** | P0 | Exportación Excel | Toast de descarga en curso | **Como analista**, quiero un toast que muestre el estado de empaquetado del archivo Excel ("Generando libro con 150 predios...") y confirme cuando comience la descarga. *Criterio*: Cambia automáticamente de spinner a checkmark verde al iniciar la descarga del archivo. |
| **US-279** | P1 | Tablas y Listados | Animación de reordenamiento y filtrado | **Como usuario**, quiero que al aplicar un filtro o cambiar el orden de una lista, las filas se reorganicen con una transición fluida mediante Framer Motion. *Criterio*: Los elementos no desaparecen y aparecen bruscamente; se deslizan suavemente a su nueva posición. |
| **US-280** | P1 | Botones de acción pesada | Estado de carga con spinner y texto | **Como operador**, quiero que los botones de inicio de procesamiento muestren un spinner integrado y cambien su texto a "Procesando..." mientras se deshabilitan. *Criterio*: Evita clics duplicados y proporciona certeza visual inmediata. |
| **US-281** | P1 | Estación de Revisión | Animación de confirmación de aprobación | **Como revisor**, quiero que al aprobar un predio la tarjeta muestre una sutil micro-animación de destello verde y avance suavemente al siguiente predio. *Criterio*: Transición de 250ms que transmite certeza de guardado sin retrasar el ritmo del operador. |
| **US-282** | P1 | Formulario de edición | Indicador de guardado automático | **Como analista**, quiero ver un micro-texto en la barra superior ("Guardando...", "Todos los cambios guardados") al editar atributos. *Criterio*: Retroalimentación tipo Google Docs con retardo de 400ms (debounce). |
| **US-283** | P1 | Errores de validación | Animación de sacudida (Shake Effect) | **Como operador**, quiero que si un campo obligatorio queda vacío al enviar un formulario, el campo resalte en rojo y ejecute una suave sacudida horizontal. *Criterio*: Dirige la atención visual inmediatamente al error sin mostrar alertas invasivas. |
| **US-284** | P2 | Cierre de proyecto | Celebración visual discreta | **Como líder de proyecto**, quiero que al completar la revisión del 100% de los predios de un proyecto se active una sutil animación de confeti temporal. *Criterio*: Ráfaga ligera de confeti en pantalla y tarjeta de felicitación con resumen final exportable. |
| **US-285** | P2 | Botón Copiar | Retroalimentación de portapapeles | **Como analista**, quiero que al hacer clic en cualquier botón de copiar (cédula, matrícula, enlace) el icono cambie a un check verde durante 2 segundos. *Criterio*: Copia el valor al portapapeles y restaura el icono original automáticamente. |
| **US-286** | P2 | Cambios por Realtime | Resaltado de celda actualizada | **Como revisor en equipo**, quiero que si otro colega aprueba o edita un predio en simultáneo, la celda en mi pantalla se ilumine brevemente en azul. *Criterio*: Efecto flash de 1.5 segundos que alerta sobre la sincronización concurrente sin interrumpir el foco. |
| **US-287** | P2 | Drag & Drop | Indicador de arrastre flotante | **Como operador**, quiero que al arrastrar archivos sobre la pantalla aparezca una miniatura flotante con el número de archivos detectados. *Criterio*: Indicador adherido al puntero con el texto "Soltar 12 archivos aquí". |
| **US-288** | P2 | Navegación entre pestañas | Indicador de barra deslizante (Sliding Pill) | **Como usuario**, quiero que la pestaña activa en las barras de menú tenga una píldora de fondo que se deslice suavemente al cambiar de opción. *Criterio*: Efecto de transición física `layoutId` de Framer Motion idéntico a las interfaces modernas de Apple y PMO. |

---

### Épica UX-07: Portal Externo para Notarías, Peritos y Terceros con Enlaces Públicos (US-289 a US-300)

*(Inspirado en la encuesta pública `/survey/:id` de PMO, pero adaptado y potenciado para el flujo legal y predial)*

| ID | Pri. | Pantalla / Componente | Elemento UI | Historia de Usuario y Criterio de Aceptación |
|---|---|---|---|---|
| **US-289** | P0 | `/public/portal/:shareToken` | Public Gateway Layout | **Como notario o perito externo**, quiero ingresar a un portal mediante un enlace seguro temporal sin necesidad de crear cuenta o contraseña. *Criterio*: Valida el token criptográfico; si está vencido o revocado muestra pantalla explicativa de contacto. |
| **US-290** | P0 | Modal de generación de enlace | `@radix-ui/react-dialog` | **Como abogado líder**, quiero generar un enlace de consulta externa para una notaría definiendo fecha de expiración (24h, 7d, 30d) y permisos. *Criterio*: Genera un token HMAC-SHA256 único y ofrece botón de "Copiar enlace para la notaría". |
| **US-291** | P0 | Portal Notarial | Ficha de Minuta y Linderos | **Como notario**, quiero revisar la minuta generada y los linderos transcritos del predio con diseño limpio y optimizado para lectura jurídica. *Criterio*: Interfaz de lectura sin barras laterales de la plataforma interna, con tipografía jurídica de alta legibilidad. |
| **US-292** | P0 | Portal Notarial | Botón de Conformidad Notarial | **Como notario**, quiero poder marcar "Minuta conforme" o "Requiere ajustes con observaciones", firmando digitalmente con mi nombre y número de notaría. *Criterio*: Registra la decisión en la auditoría de Territorium con marca de tiempo e IP de la notaría. |
| **US-293** | P1 | Portal Notarial | Adjuntar documento de soporte | **Como perito o notario**, quiero adjuntar el paz y salvo o la minuta firmada directamente en el portal sin enviarlo por correo electrónico. *Criterio*: Carga el archivo PDF directamente al bucket privado asociado al predio y notifica al equipo interno. |
| **US-294** | P1 | Portal Notarial | Visor PDF protegido en solo lectura | **Como tercero**, quiero visualizar el plano y el estudio de títulos en el navegador con marca de agua disuasoria ("Copia informativa - Notaría X"). *Criterio*: El visor superpone marca de agua semitransparente con el nombre del destinatario del token. |
| **US-295** | P1 | Administración de Enlaces | Tabla de enlaces públicos activos | **Como administrador**, quiero consultar en `/app/configuracion/enlaces` todos los tokens emitidos, fecha de creación, último acceso y estado. *Criterio*: Permite revocar cualquier enlace en cualquier momento con efecto inmediato. |
| **US-296** | P1 | Portal Notarial | Verificación por código OTP | **Como responsable de seguridad**, quiero que el enlace público solicite un código OTP enviado al WhatsApp o correo del notario para autorizar la entrada. *Criterio*: Componente de entrada de 6 dígitos con foco automático (`input-otp`) y reintento limitado a 3 intentos. |
| **US-297** | P2 | Portal Notarial | Registro de observaciones puntuales | **Como notario**, quiero hacer clic en un párrafo de la minuta para dejar un comentario de ajuste antes de otorgar la escritura. *Criterio*: El comentario se sincroniza inmediatamente con la estación de revisión interna de Territorium. |
| **US-298** | P2 | Portal Notarial | Descarga de paquete notarial en un clic | **Como oficial de notaría**, quiero un botón para descargar en un archivo ZIP ordenado el estudio de títulos, el plano topográfico y la minuta editable en Word. *Criterio*: Descarga un archivo con nombres normalizados (`01_Estudio.pdf`, `02_Plano.pdf`, `03_Minuta.docx`). |
| **US-299** | P2 | Portal Notarial | Sello de tiempo RFC 3161 de confirmación | **Como auditor**, quiero que al recibir la aprobación externa se genere una constancia en PDF con sello de tiempo y hash SHA-256 de los documentos aprobados. *Criterio*: La constancia queda archivada en el expediente y puede descargarse en cualquier momento. |
| **US-300** | P2 | Portal Notarial | Notificación de cierre automático | **Como equipo legal de Territorium**, quiero recibir una alerta por Slack/Teams y correo cuando la notaría emita su concepto en el portal. *Criterio*: Notificación instantánea con enlace directo al expediente interno para proceder con la firma. |

---

## 5. Plan de Ejecución por Fases

1. **Fase 1 (Arquitectura y Rutas)**:
   * Instalación de `react-router` v7.
   * Migración del estado de pantalla de `App.tsx` hacia rutas declarativas (`/app/dashboard`, `/app/proyectos`, etc.).
   * Implementación de layouts, breadcrumbs automáticos y guards de autenticación.

2. **Fase 2 (Primitivas Radix y Toaster)**:
   * Adopción de componentes Radix UI (Dropdowns, Dialogs, Tabs, Tooltips).
   * Sustitución de alertas genéricas por el sistema de toasts de `sonner`.
   * Pulido de tokens visuales y animaciones fluidas con Framer Motion (`motion`).

3. **Fase 3 (Dashboard Analítico con Recharts)**:
   * Creación del panel de control ejecutivo con gráficos interactivos de dona, barras y radar de madurez.
   * Bento grid con KPIs territoriales en tiempo real.

4. **Fase 4 (Estación de Revisión Split-View)**:
   * Visor de PDF sincronizado con resaltado de evidencias textuales y comparación simultánea contra el plano.

5. **Fase 5 (Portal Externo para Notarías y Peritos)**:
   * Rutas `/public/portal/:token` con tokenización segura, OTP y flujo de aprobación notarial sin login.
