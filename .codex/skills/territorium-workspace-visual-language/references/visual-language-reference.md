# Referencia visual: lenguaje de workspace para Territorium

Este documento traduce una referencia visual de software de trabajo colaborativo a decisiones de interfaz reutilizables en Territorium. Es una guía de dirección visual y no una especificación de comportamiento, ni una copia de marca, contenido o componentes de un tercero.

## Dirección estética

La interfaz debe verse como una herramienta profesional activa: limpia, sobria y con gran capacidad para información. La impresión procede de cinco decisiones combinadas:

1. **Contraste estructural:** rail global oscuro frente a superficies de trabajo blancas.
2. **Jerarquía tipográfica clara:** título grande en negro azulado, rótulos y auditoría en grises moderados.
3. **Separación de baja fricción:** líneas de 1 px muy claras y espacios predecibles, no bloques pesados.
4. **Acento cromático escaso:** un morado/índigo de producto para foco, selección, enlaces y acción primaria; colores semánticos solo para estados reales.
5. **Densidad legible:** muchos datos alineados y agrupados, con respiración entre secciones importantes.

Evita una estética de dashboard genérico: gradientes decorativos, grandes zonas de color, glassmorphism, tarjetas con sombra excesiva, bordes gruesos, iconos rellenos heterogéneos y widgets que compiten por atención.

## Composición de la pantalla

### Proporciones de escritorio

En una captura panorámica de referencia, la composición tiene alrededor de 72 px de rail izquierdo, una barra superior de 56–64 px, un panel de contexto derecho de 480–540 px y contenido principal fluido. Estas cifras son rangos visuales, no requisitos fijos.

```css
:root {
  --app-rail-width: 72px;
  --app-topbar-height: 60px;
  --context-panel-width: clamp(360px, 28vw, 520px);
  --page-gutter: clamp(24px, 4vw, 88px);
  --page-content-max: 1120px;
}

.workspace-shell {
  display: grid;
  grid-template-columns: var(--app-rail-width) minmax(0, 1fr);
  min-height: 100dvh;
}

.workspace-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--context-panel-width);
  min-height: calc(100dvh - var(--app-topbar-height));
}

.workspace-main {
  min-width: 0;
  overflow: auto;
  padding: 36px var(--page-gutter) 48px;
}

.workspace-main__inner {
  max-width: var(--page-content-max);
}
```

Usa `minmax(0, 1fr)` y `min-width: 0` para que títulos, tablas y adjuntos no provoquen overflow horizontal. Define una región responsable de cada scroll: shell, contenido principal o feed de actividad; no conviertas toda la pantalla en tres scrolls independientes sin necesidad.

### Rail global

- Fondo: casi negro, no negro puro, para conservar detalle: `#141414`–`#1B1B1F`.
- Ancho: 64–76 px; iconos centrados y rótulos de 11–12 px debajo cuando el espacio lo permita.
- Cada destino tiene una zona activable amplia de 40–48 px de alto.
- Iconos: trazo uniforme, 18–22 px, color gris claro inactivo; blanco o acento para el activo.
- Estado activo: ligero fondo más claro, indicador lateral, icono destacado o combinación de estos. Nunca solo color de texto.
- Separa grupos de navegación mediante aire vertical, no divisores brillantes.

La navegación de Territorium debe conservar su arquitectura y sus nombres reales. La mejora consiste en compactar, alinear y dar una señal inequívoca de ubicación actual.

### Barra de contexto

- Fondo blanco; altura 56–64 px; borde inferior `1px solid var(--border-subtle)`.
- Izquierda: botón contextual opcional, breadcrumbs y entidad actual. Los antecesores usan gris secundario; el destino actual tiene más peso y color primario.
- Derecha: fecha/contexto auxiliar, identidad de espacio si corresponde y acciones de icono agrupadas con separación de 8–12 px.
- Los breadcrumbs se truncan desde los niveles intermedios antes de truncar el nombre de la entidad activa.
- Las acciones de solo icono requieren tooltip y etiqueta accesible.

No llenes la barra superior de CTAs. La acción primaria de la vista debe vivir cerca del título o del contenido que modifica.

### Contenido principal

La primera zona visual tiene que seguir una columna estable:

```text
tipo o sobrelínea opcional
título de la vista / entidad
ayuda o mensaje contextual opcional
datos esenciales / acciones
divisor sutil
contenido principal
```

- El título usa 32–38 px, peso 600–700, color `--text-primary` y `line-height` de 1.15–1.25. En vistas con menor importancia, reduce a 28–32 px, no a un encabezado de tarjeta.
- Evita que la descripción o documento se estire por todo el monitor: utiliza `max-width` de 68–78 caracteres o un contenedor de 860–1120 px según el tipo de dato.
- Deja 24–32 px entre título y bloque de datos; 32–48 px entre bloques estructurales relevantes.
- Un divisor sutil y margen amplio separan la cabecera del contenido. No uses separadores dobles, cajas anidadas y sombras a la vez.

### Panel contextual derecho

Es una región opcional para actividad, acciones de expediente, inspector de documentos o filtros persistentes.

- Fondo blanco y `border-left: 1px solid var(--border-subtle)`.
- Cabecera fija o pegajosa dentro del panel: título de 16–18 px semibold y herramientas discretas a la derecha.
- El feed usa padding de 16 px y elementos separados por 12–16 px.
- El compositor, si lo hay, se posiciona al final del panel, con su propio borde superior o una superficie ligeramente elevada; reserva `padding-bottom` en el feed para no tapar el último elemento.
- En texto de auditoría, baja tamaño y contraste respecto a comentarios humanos, pero cumple contraste y mantiene fecha/actor recuperables.

No uses este panel como cajón de sastre. Cada sección debe responder una pregunta: "¿qué pasó?", "¿qué puedo cambiar?", "¿qué contexto necesito?". Si hay más de una, usa pestañas o acordeones accesibles.

## Tokens de diseño

Integra estos tokens con la capa actual de Territorium. Son una base de ajuste visual, no una obligación de reemplazar el branding existente.

```css
:root {
  /* Superficies y bordes */
  --surface-canvas: #ffffff;
  --surface-subtle: #f7f7f8;
  --surface-hover: #f2f3f5;
  --surface-selected: #f0edff;
  --surface-inverse: #17171a;
  --border-subtle: #e7e8ec;
  --border-default: #d7dae0;
  --border-focus: #6045e8;

  /* Texto */
  --text-primary: #20242d;
  --text-secondary: #737b89;
  --text-muted: #969da8;
  --text-on-inverse: #f8f8fa;
  --text-on-accent: #ffffff;

  /* Marca y estados */
  --accent: #6045e8;
  --accent-hover: #4f35d3;
  --accent-pressed: #4026ba;
  --accent-subtle: #f0edff;
  --status-success: #14865d;
  --status-warning: #b95e00;
  --status-danger: #ca3a3a;
  --status-info: #356bd6;

  /* Forma y elevación */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --shadow-overlay: 0 12px 32px rgb(32 36 45 / 16%);

  /* Espacio */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
}
```

### Aplicación de tokens

| Situación | Tratamiento |
| --- | --- |
| Fondo de página | `--surface-canvas`; solo cambia a `--surface-subtle` para zonas de soporte claramente distintas. |
| División entre columnas/secciones | `--border-subtle`, 1 px; el aire vertical complementa el borde. |
| Acción primaria | Fondo `--accent`, texto blanco, hover y pressed definidos. Una acción dominante por grupo. |
| Acción secundaria | Fondo blanco o sutil, borde tenue y texto primario. |
| Selección | Fondo `--accent-subtle` + texto/indicador, nunca solo un matiz de fondo imperceptible. |
| Error | Color semántico + icono + texto explícito; no solo rojo. |
| Overlay | Fondo sólido y `--shadow-overlay`; no uses sombras para cada card normal. |

No publiques tokens nuevos con nombres específicos de una pantalla. Por ejemplo, prefiere `--surface-selected` a `--expediente-purple-bg`, salvo que el token describa semántica de dominio real.

## Tipografía

La referencia utiliza una sans serif moderna y funcional. Respeta la fuente ya cargada por Territorium; si no hay una decisión de marca, una sans de interfaz con pesos 400, 500, 600 y 700 es suficiente.

| Rol | Tamaño | Peso | Color | Uso |
| --- | ---: | ---: | --- | --- |
| Título principal | 32–38 px | 600–700 | primario | Nombre de vista, expediente o documento. |
| Título de sección | 18–22 px | 600–700 | primario | Divide el contenido principal. |
| Texto de contenido | 15–17 px | 400 | primario | Párrafos, tablas y mensajes. |
| Etiqueta de campo | 14–16 px | 400–500 | secundario | Qué representa un valor. |
| Valor de campo | 14–16 px | 400–600 | primario | Estado, fecha, responsable, etc. |
| Metadata/auditoría | 12–14 px | 400–500 | secundario | Hora, actor, cambios, contexto. |
| Navegación rail | 11–12 px | 500–600 | inverso/secundario | Rótulos compactos. |

No uses mayúsculas extensas como texto de párrafo. Para una etiqueta de estado se permiten por reconocimiento rápido, siempre con un tamaño legible y letra no excesivamente condensada.

## Componentes visuales

### Botones

- Alturas de 32–36 px para controles densos de escritorio; 40–44 px cuando es una acción principal o táctil.
- Radio de 8 px; padding horizontal 10–14 px; icono a 16–18 px con separación de 6–8 px.
- Primario: acento sólido; secundario: blanco, borde tenue; terciario/icono: fondo transparente y hover suave.
- Deshabilitado: contraste menor pero texto y forma distinguibles; no aparentar una acción disponible.
- Al hacer foco, `outline` o `box-shadow` de 2–3 px usando `--border-focus` con offset de 2 px.

### Iconos y acciones de overflow

- Usa una única familia de iconos lineales ya disponible en el proyecto.
- Tamaños frecuentes: 16 px en metadatos, 18–20 px en acciones, 22–24 px solo en navegación destacada.
- No mezcles iconos rellenos, emojis y SVG de estilos distintos en la misma superficie.
- Los iconos puramente decorativos llevan `aria-hidden="true"`; los botones solo con icono reciben `aria-label` y tooltip.
- Agrupa acciones poco frecuentes bajo menú de overflow en vez de replicar cinco botones visualmente iguales.

### Campos, filtros y selectores

- Fondo blanco o gris muy leve, borde `--border-default`, radio de 8 px y altura alineada con botones.
- Hover refuerza borde o fondo; foco usa el anillo de acento. Error añade mensaje y color semántico, no solo borde rojo.
- En un bloque de metadatos, el valor puede verse como texto hasta que se activa; al editar debe mantener posición y dimensión aproximadas para no mover el layout.
- Los selectores de estado se presentan como chip/botón compacto: color semántico, etiqueta completa y chevron o icono de acción.

### Chips, etiquetas y estado

- Altura 24–30 px; padding 6–10 px; radio de 6–8 px, no una píldora extrema salvo que la familia existente lo requiera.
- Máximo un color semántico dominante por chip. Un chip de estado muestra texto; un punto de color puede acompañar, nunca reemplazarlo.
- El estado "vacío" usa una llamada a acción o texto claro —por ejemplo "Sin asignar"—, no un hueco invisible.

### Avatares y presencia

- Avatar circular de 24–28 px en filas y 32–36 px en cabeceras/comentarios.
- El fondo de iniciales sigue una paleta limitada; no genera colores aleatorios que rompan el sistema.
- Un indicador de presencia tiene borde de superficie para separarlo del avatar y equivalente textual para tecnología asistiva.
- Siempre que sea relevante, el nombre acompaña o está disponible mediante tooltip/etiqueta; una inicial no identifica con suficiente precisión.

### Tarjetas y paneles

- Una card es una agrupación autónoma: comentario, resultado de búsqueda, adjunto o bloque de formulario. No la uses para cada fila.
- Fondo blanco, borde `--border-subtle`, radio 10–12 px y padding 16–20 px.
- Sombra: ninguna por defecto. Una card no debe parecer flotante dentro de otra card.
- En vistas con secciones de lectura, prefiere el separador horizontal y margen a una card exterior.

### Comentarios y actividad

- Cabecera de comentario: avatar, autor semibold, timestamp secundario en una línea que puede envolver con intención.
- Cuerpo: tamaño 15–16 px, `line-height` 1.5–1.6, enlaces con acento y subrayado o estado hover distinguible.
- Adjuntos: icono de tipo, nombre truncado visualmente solo si hay tooltip/nombre completo y acción verificable.
- Pie: reacciones, responder y más opciones como acciones terciarias discretas; no las confundas con el botón de envío.
- Eventos automáticos: menor intensidad visual, lista cronológica, actor y transición textual claros.

## Responsive y comportamiento espacial

```css
@media (max-width: 1279px) {
  :root { --context-panel-width: clamp(320px, 34vw, 420px); }
  .workspace-main { padding-inline: clamp(24px, 3vw, 48px); }
}

@media (max-width: 899px) {
  .workspace-shell { grid-template-columns: minmax(0, 1fr); }
  .app-rail { display: none; }
  .workspace-body { grid-template-columns: minmax(0, 1fr); }
  .context-panel { display: none; } /* Solo si existe un drawer/pestaña alterna accesible. */
  .metadata-grid { grid-template-columns: minmax(0, 1fr); }
}
```

Antes de ocultar una región contextual en móvil, construye su sustituto: botón visible con nombre, estado `aria-expanded`, panel con foco gestionado y Escape si se abre como modal. La combinación de `display: none` en móvil no es un diseño responsive completo.

Reduce primero gutters, columnas de metadata y acciones secundarias. Nunca reduzcas el título, el contraste, la zona táctil o el área de texto hasta volverlos difíciles de usar.

## Accesibilidad y calidad perceptual

- Objetivos táctiles: 44 × 44 px para iconos aislados en interfaces táctiles; en escritorio denso se puede usar contenedor visual menor con área interactiva suficiente.
- Contraste: verifica texto normal, bordes de foco, botones y estados semánticos contra su superficie real.
- Teclado: Tab y Shift+Tab siguen el orden visual; Enter/Espacio activan controles; Escape cierra menús, popovers y drawers devolviendo el foco al disparador.
- Movimiento: transiciones de 120–200 ms como máximo para hover y estado; desactiva o reduce desplazamientos con `prefers-reduced-motion`.
- Scroll: los contenedores con overflow reciben un tamaño definido. Evita scrolls anidados que atrapen la rueda o el foco sin indicarlo.
- Carga: usa skeletons o indicadores que respeten la estructura final; no cambies drásticamente la disposición al llegar datos.
- Vacíos y errores: presenta mensaje, siguiente acción y jerarquía igual de cuidada; no dejes una superficie en blanco.

## Checklist de evaluación visual

Evalúa cada vista actualizada en 1440 px, 1024 px, 768 px y 375–430 px de ancho, usando además zoom de 200 % cuando sea viable.

- [ ] La navegación, la cabecera y el contenido se distinguen como capas sin depender de sombras.
- [ ] El título es claramente el primer elemento de lectura.
- [ ] Las acciones primarias son escasas y evidentes; las secundarias no compiten.
- [ ] Los datos se escanean por alineación y rótulo, no por una sucesión de cards.
- [ ] Los grises secundarios siguen siendo legibles y los estados no dependen solo de color.
- [ ] Los nombres, identificadores y adjuntos largos no rompen el layout.
- [ ] Un panel contextual es útil, tiene rol inequívoco y no tapa su propio último contenido.
- [ ] En móvil, la información y acciones imprescindibles siguen disponibles sin overflow horizontal.
- [ ] Los controles de icono, menús, drawers, foco y reducción de movimiento funcionan de forma accesible.
- [ ] Los flujos y datos de Territorium no cambiaron como consecuencia del rediseño visual.

Si una decisión de la referencia entra en conflicto con la marca, accesibilidad, consistencia o utilidad del proyecto, prioriza Territorium y documenta el ajuste. La meta es adoptar el grado de claridad y madurez visual del patrón, no replicar literalmente otra aplicación.
