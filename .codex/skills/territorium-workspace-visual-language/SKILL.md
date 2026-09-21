---
name: territorium-workspace-visual-language
description: "Aplica a Territorium un lenguaje visual de software operativo inspirado en la referencia proporcionada: navegación oscura compacta, superficies claras, alta densidad ordenada, metadatos alineados y paneles laterales de contexto. Úsala para rediseñar o crear UI visual; no cambia los flujos, permisos ni la lógica de negocio."
metadata:
  short-description: Aplica el lenguaje visual de workspace a Territorium
---

# Lenguaje visual de workspace para Territorium

Esta skill transforma la **apariencia y composición visual** de Territorium para acercarla al estándar observado en la referencia: profesional, despejado, muy estructurado y capaz de mostrar mucha información sin parecer abrumador. No intenta clonar ClickUp ni implementar sus funcionalidades. Territorium conserva por completo sus conceptos jurídicos, rutas, acciones, permisos, modelos de datos, textos y flujos existentes.

La referencia es una fuente de decisiones de diseño, no de contenido. Nunca copies nombres de personas, tareas, archivos, organizaciones, fechas ni textos de una captura a la aplicación. Tampoco incorpores logos, marcas, recursos gráficos o denominaciones de terceros.

## Cuándo usarla

Úsala al crear, renovar o unificar una vista existente de Territorium —por ejemplo expedientes, bandejas, documentos, gestión de usuarios, actividad, configuración o paneles administrativos— cuando el objetivo sea que visualmente pertenezca al mismo sistema de workspace.

No la uses para cambiar la arquitectura de información, sustituir componentes funcionales sin necesidad visual, añadir automatizaciones, rediseñar reglas de negocio, inventar campos ni convertir una vista en una réplica de una pantalla ajena. Si el usuario pide una modificación de comportamiento, trátala como un requisito separado y conserva esta skill para la capa visual.

## Resultado de diseño

Cada superficie actualizada debe comunicar, en este orden:

1. **Dónde está la persona.** Navegación de producto y contexto/breadcrumb breves, silenciosos y persistentes.
2. **Qué está viendo.** Un título claro, destacado y con aire suficiente.
3. **Qué debe entender o decidir.** Información esencial agrupada, alineada y fácil de escanear.
4. **Qué puede hacer.** Acciones visibles con un único acento dominante; el resto permanece secundario.
5. **Qué contexto adicional existe.** Actividad, detalles, filtros, ayuda o auditoría en una región lateral o progresiva sin competir con el contenido.

El producto debe sentirse preciso y contemporáneo: superficies blancas, texto oscuro, bordes tenues, iconografía lineal, sombras excepcionales y color usado como señal semántica, no como decoración.

## Principios no negociables

- **Restyling, no reproducto.** Cambia presentación, tokens, composición, densidad y estados visuales; preserva APIs, datos, autorización, validaciones y rutas salvo que el encargo autorice expresamente otra cosa.
- **Jerarquía antes que ornamento.** Arregla el orden de atención, espacios, tipografía y alineación antes de añadir degradados, tarjetas o ilustraciones.
- **Densidad ordenada.** Muestra información mediante retículas, rótulos y agrupación; no encierres cada dato en una tarjeta pesada.
- **Un acento, muchos neutros.** El color de marca guía estado seleccionado, foco, enlaces y CTA. Blanco, gris y negro sostienen el resto.
- **Bordes antes que sombras.** Usa bordes muy sutiles para separar niveles. Reserva sombras suaves para overlays reales: menú, popover, modal o drawer.
- **Los datos determinan el layout.** Prueba nombres, títulos, archivos, roles y estados largos; no diseñes solo para contenido ideal.
- **Accesible por defecto.** El color nunca es el único indicador; todos los controles funcionales conservan etiqueta, foco y área de interacción adecuada.

## Proceso de aplicación

### 1. Auditar antes de tocar estilos

1. Identifica la ruta, componente, estilos y sistema de UI ya usados por la pantalla.
2. Distingue qué se debe conservar funcionalmente: acciones, permisos, formularios, tablas, vacíos, errores y datos del dominio jurídico.
3. Enumera los defectos visuales observables: jerarquía débil, exceso de tarjetas, bordes oscuros, texto poco legible, acciones dispersas, espacios inconsistentes o paneles sin rol claro.
4. Consulta [la referencia visual completa](references/visual-language-reference.md) antes de elegir valores de color, estructura, tipografía o responsive.
5. Extiende o reutiliza los tokens y primitivas existentes de Territorium. No abras una segunda familia visual desconectada del `ui-system.css` o de los componentes ya compartidos.

Si una vista ya contiene interacción compleja, realiza primero una refactorización visual de bajo riesgo: conserva nodos, manejadores y fuente de estado; cambia capas, clases, tokens y composición alrededor de ellos. No conviertas un botón o input accesible en un `div` meramente por coincidir con una captura.

### 2. Organizar el shell de workspace

Aplica la estructura siguiente solo en el grado que la vista permita. No fuerces un panel derecho si no hay contexto valioso para mostrar.

```text
Shell de Territorium
├── rail global oscuro: navegación entre áreas del producto
├── top bar clara: contexto, breadcrumb y utilidades
└── zona de trabajo
    ├── contenido primario: título, datos, controles y cuerpo
    └── contexto secundario opcional: actividad, inspector, filtros o detalles
```

- El rail global es estrecho, oscuro y estable. Cada destino muestra icono y, cuando cabe, rótulo breve. El estado actual se distingue por fondo/indicador además de color.
- La barra superior es una franja blanca compacta con borde inferior tenue. La ruta de navegación vive a la izquierda; las utilidades menos frecuentes se agrupan a la derecha.
- El contenido principal empieza con más margen que una tabla convencional. Alinea título, contenido y divisores a una misma columna visual.
- Un panel de contexto se separa con `border-left`, no con una sombra. Debe tener una cabecera clara y un scroll propio solo cuando sea necesario.

No copies etiquetas o elementos de navegación de la referencia. Usa siempre los módulos reales de Territorium y los nombres que el proyecto ya utiliza.

### 3. Construir la jerarquía interna

En cada vista, ordena los elementos por importancia:

1. **Identidad de la pantalla:** título, subtítulo o identificador de expediente/documento. Es el texto visualmente dominante.
2. **Acción primaria:** una acción clara por contexto —por ejemplo crear, guardar, enviar, cargar o resolver—. Si hay varias, una usa acento y las demás un tratamiento neutro.
3. **Datos clave:** organiza estado, responsable, fecha, etapa, tipo, prioridad, etiquetas o campos jurídicos equivalentes en filas compactas y alineadas.
4. **Contenido principal:** tablas, formularios, documentos, resultados o texto. Debe conservar un fondo neutro y una anchura legible.
5. **Actividad y metadatos secundarios:** auditoría, comentarios, adjuntos y marcas temporales usan escala tipográfica y contraste secundarios, pero siguen siendo legibles.

Usa agrupaciones por proximidad y divisores finos. Evita paneles dentro de paneles, titulares con más de un color llamativo, CTAs repetidos o chips de colores sin significado.

### 4. Aplicar tokens y componentes visuales

Usa los valores de [tokens y reglas de componente](references/visual-language-reference.md#tokens-de-diseño) como punto de partida. Integra los valores en variables existentes o en una capa de tokens coherente; no repitas hexadecimales o valores de espacio en selectores dispersos.

Adapta las siguientes primitivas en lugar de diseñar cada pantalla desde cero:

- `AppRail`: navegación global oscura, compacta y accesible.
- `ContextBar`: breadcrumb, contexto del área y acciones de utilidad.
- `PageHeader`: sobrelínea opcional, título, descripción breve y acciones.
- `MetadataGrid` o filas de detalle: icono opcional, rótulo, valor y control cuando aplique.
- `Section`: separación vertical, encabezado y cuerpo; no una tarjeta por defecto.
- `Panel`: contenedor para actividad, inspector, resultado contextual o composición de comentarios.
- `Button`, `IconButton`, `StatusChip`, `Avatar`, `Tag` y `EmptyState`: todos derivados de los mismos tokens de borde, radio, foco y densidad.

Cuando una tabla tenga información crítica, prioriza legibilidad de columnas, headers pegajosos si ya existen y acciones por fila discretas. No la conviertas en una colección de cards en escritorio solo para que parezca más moderna.

### 5. Estados de interacción

Todo componente visual debe definir, de manera consistente, reposo, hover, foco, activo/seleccionado, deshabilitado, carga y error cuando aplique.

- El foco usa un anillo perceptible de color de acento sobre un fondo de contraste suficiente; no lo elimines con `outline: none` sin reemplazo.
- El hover aumenta claridad de destino con fondo tenue o borde, no mediante un salto brusco de layout.
- Un estado seleccionado combina fondo de acento suave, texto o indicador y semántica programática (`aria-current`, `aria-selected` o equivalente).
- Los estados de negocio combinan etiqueta textual, icono opcional y color. "Pendiente", "En revisión", "Completado", "Error" o sus equivalentes de Territorium no dependen solo de un punto de color.
- Las transiciones son breves y no bloquean la operación. Respeta `prefers-reduced-motion`.

### 6. Responsive sin perder la identidad

La apariencia debe adaptarse por prioridad de información:

- **≥1280 px:** rail, contenido principal y panel contextual pueden coexistir; las propiedades usan dos columnas si los valores no se comprimen.
- **900–1279 px:** reduce espacios horizontales, preserva el título y permite que el panel contextual se estreche o se colapse con un disparador visible.
- **<900 px:** una única columna de contenido; el rail se vuelve navegación móvil y el panel contextual se convierte en drawer, pestaña o sección posterior con un control etiquetado.
- **<480 px:** propiedades en una columna, texto de acción visible para operaciones críticas y objetivos táctiles de al menos 44 × 44 px.

No ocultes funciones esenciales para conseguir una captura limpia. Si una región pasa a drawer, controla foco, Escape, retorno de foco y `aria-expanded`; si muestra conversación o metadatos imprescindibles, ofrece una forma evidente de abrirla.

### 7. Verificación visual y de calidad

Al terminar una aplicación de esta skill, verifica el resultado contra estos criterios:

- El título sigue siendo el punto de entrada visual y no compite con botones, navegación o paneles secundarios.
- Las separaciones provienen de una escala coherente de espacio, bordes claros y alineación; no de sombras repetidas.
- El color de acento tiene funciones consistentes y los estados mantienen significado sin él.
- La vista soporta títulos, nombres, chips, adjuntos y valores vacíos extensos sin overflow ni truncado irreversible.
- En escritorio amplio hay una composición de workspace estable; en móvil no existe scroll horizontal, ni rail persistente que robe contenido, ni panel que tape controles.
- El teclado recorre controles en orden lógico, el foco es visible y los iconos funcionales tienen nombre accesible.
- Las partes existentes de Territorium continúan con sus mismas acciones y fuentes de datos; el cambio no introdujo regresión funcional.

Documenta brevemente en la entrega: vista actualizada, archivos cambiados, decisiones visuales aplicadas, prueba de viewport/teclado realizada y cualquier elemento que deba validarse con usuarios. Describe el resultado como "lenguaje visual de workspace aplicado a Territorium", nunca como una copia o integración de ClickUp.
