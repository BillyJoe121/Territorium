# Referencia visual exacta del checkout `legalitica-backoffice-front`

Esta guía describe **el código recibido**, no una propuesta estética ni la identidad histórica de Legalitica. El checkout se llama Legalitica, pero su tema predeterminado, logotipos, página de inicio y varios estilos ya están personalizados para **Territorium**. La referencia se tomó de la rama `prod`, commit `08657bd829a64f78b9711d6ae389f77ec15faf89`.

## Alcance y procedencia

- Fuente: `../legalitica-backoffice-front` desde la raíz de Territorium; repositorio remoto declarado: `https://github.com/legalitica/legalitica-backoffice-front.git`.
- Copia: `fuente/` contiene **50 archivos sin cambios**. Los SHA-256 de cada copia y su original coincidían al crear esta referencia. No se modificó ningún archivo del repositorio de origen.
- Se copió la totalidad de `src/scss/`, los temas claro/oscuro, configuración de Vuetify, la estructura principal de navegación, la página de bienvenida y pestañas de servicios, tres logotipos utilizados por esas piezas, además de `index.html`, `.nvmrc` y `package.json` como evidencia de fuentes y stack.
- No se copiaron repositorios de datos, stores de autenticación, configuración de Cognito, servicios, pantallas funcionales extensas ni dependencias instaladas. Los archivos Vue copiados son **referencia de anatomía visual**, no módulos ejecutables aislados.
- No encontré un archivo `LICENSE` en la raíz del checkout. Hay indicios de componentes heredados de una plantilla de administración; antes de publicar o redistribuir código o imágenes copiados, confirmar la licencia y titularidad del material de plantilla. Esta copia permanece como referencia interna, sin importarse al build.

## Fuente de verdad y cascada

La apariencia efectiva no proviene de un único archivo. `src/main.ts` carga `src/scss/style.scss`; este agrega, en orden, las variables Sass, estilos base de Vuetify, `_override.scss`, layout, componentes, páginas y scrollbar. `src/plugins/vuetify.ts` define el tema activo y valores por defecto de componentes. Los estilos `scoped` de cada `.vue` agregan excepciones locales. Para reproducir una pantalla hay que considerar **estas tres capas y su orden**, no solo extraer colores de `LightTheme.ts`.

Archivos principales en `fuente/`:

| Propósito | Archivo de referencia |
| --- | --- |
| Tema activo y alternativas | `src/theme/LightTheme.ts`, `src/theme/DarkTheme.ts` |
| Configuración y defaults de Vuetify | `src/plugins/vuetify.ts` |
| Tipografía, radios, sombras y ajustes Sass | `src/scss/_variables.scss` |
| Orden de importación | `src/scss/style.scss` |
| Sobrescrituras visuales y animaciones | `src/scss/_override.scss` |
| Sidebar y topbar | `src/scss/layout/_sidebar.scss`, `_topbar.scss` |
| Contenedor y navegación horizontal | `src/scss/layout/_container.scss`, `_horizontal.scss` |
| Componentes | `src/scss/components/` completo |
| Estructura de la aplicación | `src/layouts/full/FullLayout.vue`, `vertical-sidebar/VerticalSidebar.vue`, `vertical-header/VerticalHeader.vue` |
| Logo y menú de perfil | `src/layouts/full/logo/LogoLight.vue`, `vertical-header/ProfileDD.vue` |
| Ejemplos visibles de inicio y pestañas | `src/views/dashboards/services/EstudioJuridico.vue`, `src/components/dashboards/analytical/Services.vue` |
| Fuentes cargadas por la página | `index.html` |

## Especificación visual observada

### Color

El tema predeterminado es `TERRITORIUM_THEME`, claro. Estos valores vienen de `src/theme/LightTheme.ts`; son los valores de tema, no sustitutos de todos los colores puntuales que aparecen en SCSS o en las vistas.

| Uso | Valor exacto |
| --- | --- |
| Primario | `#316842` |
| Primario oscuro auxiliar | `#3A5441` |
| Secundario | `#0CB9C5` |
| Acento | `#E97025` |
| Información | `#539BFF` |
| Éxito | `#13DEB9` |
| Advertencia | `#FFAE1F` |
| Error | `#CF2D45` |
| Texto primario / secundario | `#1A1A1A` / `#4A4A4A` |
| Texto atenuado | `#7D8A99` |
| Borde | `#E5EAEF` |
| Borde de campo | `#DFE5EF` |
| Fondo del tema / superficie | `#FAFBF9` / `#FFFFFF` |
| Hover del tema | `#F3F6F2` |
| Fondo claro primario | `#EDF2EE` |
| Resaltado auxiliar | `#FFC107` |
| Deshabilitado auxiliar | `#B0BEC5` |

**Corrección de cascada (auditoría del 26/09/2026):** `style.scss` importa `_override.scss` **antes** de `layout/_container.scss`. Ambos declaran `.v-main` con la misma especificidad y `!important`; por ello prevalece la regla posterior `background: rgb(var(--v-theme-background))`, que con `TERRITORIUM_THEME` equivale a `#FAFBF9`. La declaración previa `#F2F6F3` no es el fondo efectivo de `.v-main`. Una versión anterior de esta guía afirmaba lo contrario.

El sidebar no usa simplemente el color primario: tiene un gradiente vertical de `#18302A` a `#1F3D32`; texto blanco con opacidad `0.82`, rótulos tenues con `0.45`, hover blanco con opacidad `0.08`, y estado activo naranja `#E97025` con texto blanco y sombra `0 4px 14px rgba(233,112,37,.35)`. Los elementos activos tienen radio de `10px`.

El topbar es blanco (`#FFFFFF`), con borde inferior negro al `7%`, iconos/texto `textPrimary` y un título de página Poppins semibold de `1.05rem` con espaciado `-0.01em`.

### Tipografía

`index.html` solicita **Lato** (300, 400, 700; cursiva 400) y **Poppins** (400, 500, 600, 700, 800) a Google Fonts. `_variables.scss` usa Lato para cuerpo y Poppins para encabezados; botones y algunos títulos fuerzan Poppins. No hay archivos `.woff`, `.woff2`, `.ttf` u `.otf` propios en `src/assets`.

La escala base configurada en Vuetify es `1rem`; encabezados `h1` a `h6`: `2.25rem`, `1.875rem`, `1.5rem`, `1.3125rem`, `1.125rem`, `1rem`. `body-1` y botones usan `0.875rem`; `body-2`, captions y overlines, `0.75rem`. Otra capa, `layout/_text.scss`, ofrece utilidades de `44`, `40`, `30`, `36`, `30`, `21`, `18`, `16`, `14`, `10`, `13`, `18`, `20` y `24px`: no asumir que cada título respeta una sola escala. La cabecera de bienvenida usa Poppins `1.6rem`, peso `700` y altura de línea `1.3`.

Para una réplica fiel de la fuente, cargar las mismas familias y pesos. Para producción en Territorium, descargar y servir las fuentes localmente si la licencia lo permite; la referencia original hace una llamada de terceros en tiempo de visita.

### Geometría, espaciado y elevación

| Elemento | Medida/decisión observada |
| --- | --- |
| Sidebar expandido | `256px` (`v-navigation-drawer` y variable Sass) |
| Sidebar tipo rail | `75px`; expansión en hover |
| Punto móvil del drawer | `960px` (`mobile-breakpoint`) |
| Topbar | `64px` |
| Padding del contenido | `24px`; bajo `767px`: `20px 10px` |
| Anchos auxiliares de contenedor | `1200px` (`.maxWidth`) y `1300px` (`.fixed-width`) |
| Radio Sass base | `12px`; `sm=6px`, `md=12px`, `lg=24px`, `xl=72px`, pill `9999px` |
| Radio del banner de bienvenida | `20px` |
| Padding base de texto de card | `24px` |
| Padding de encabezado de card | `30px 30px 24px` |
| Padding de acciones de card | `10px 24px 24px` |
| Altura de renglón y cabecera de Easy Data Table | `50px` |
| Tipografía de renglón y cabecera de Easy Data Table | `14px` |

La sombra global declarada es `rgba(145 158 171 / 30%) 0 0 2px 0, rgba(145 158 171 / 12%) 0 12px 24px -4px`. `.elevation-10` la aplica explícitamente. El banner inicial usa `0 8px 32px -8px rgba(49,104,66,.4)`.

### Contratos visuales de componentes

- Campos de texto, textarea y select: `outlined`, densidad `comfortable`, color `primary`; letra de input `14px`, borde `inputBorder`, radio base `12px`. Los campos no tienen un estilo genérico de borde tomado de CSS puro: se apoyan en la anatomía de Vuetify.
- Botones: texto sin mayúsculas forzadas, peso `500`, Poppins; elevación `0` normal, `4` hover y `8` activo en la configuración Sass. Las vistas pueden elegir `flat`, `text`, `tonal` u `outlined`.
- Cards: `rounded="md"` por defecto, superficie blanca, texto `textPrimary`; cards delimitadas con borde `borderColor`; las tarjetas de servicios usan `rounded-xl` y borde, por lo que no todas tienen radio de `12px`.
- Navegación: lista con íconos blancos, etiquetas de `0.875rem` y separación horizontal de `12px`; item activo naranja; encabezados de grupo de `0.68rem`, peso `700`, mayúsculas y tracking `0.08em`. La lógica de grupos y permisos está en componentes Vue no incluidos íntegramente en esta referencia.
- Tabs de servicios: card con pestañas a todo lo ancho, íconos Tabler de `18px`, selected semibold/bold y slider de `3px`; la superficie de la barra usa blanco translúcido al `85%` con blur `8px`.
- Tablas: separadores `borderColor`; Easy Data Table tiene fondo blanco, 50px de fila y hover negro al `2%`. No se puede portar esa clase a otra biblioteca de tabla sin recrear sus variables y estados.
- Iconografía: mezcla de `vue-tabler-icons`, Material Design Icons (`@mdi/font`/`@mdi/js`) y SVG/PNG propios. No existe un sistema único de íconos.

### Pantalla de bienvenida y movimiento

El hero de `EstudioJuridico.vue` usa gradiente `#316842 → #243F30`, radio `20px`, padding `28px 32px`, texto blanco, dos círculos decorativos con opacidades `0.04` y `0.08`, e ícono flotante. `_override.scss` define `.glass-card` con blanco al `72%`, blur de `18px` y hover que eleva `4px`; `.rise-in` dura `0.7s` y `.drift` `16s`. El logo flotante de la portada anima en un ciclo de `3s`. La fuente no declara una variante `prefers-reduced-motion` para estas animaciones: al reproducirlas en Territorium hay que agregarla sin cambiar su aspecto estático.

### Responsive y temas

Los cortes explícitos relevantes son `960px` para el drawer móvil, `767px` para padding del contenido, `1170px` para reglas de sidebar mini, `1279px` para margen de `v-main` y `500px` para alertas. Se copió `DarkTheme.ts`, pero el tema seleccionado por defecto es el claro `TERRITORIUM_THEME`; **no hay un `TERRITORIUM_DARK_THEME` equivalente**. No prometer paridad oscura sin diseñarla y probarla.

## Tecnología del checkout y contraste con Territorium

Versiones de esta copia, verificadas en `package-lock.json` del origen; rangos declarados en `fuente/package.json`:

| Área | Checkout Legalitica | Territorium actual |
| --- | --- | --- |
| Lenguaje de UI | Vue Single-File Components + TypeScript 4.9.3 | React + TypeScript 5.9.3 |
| Framework | Vue 3.5.17 | React 19.2.4 |
| UI kit | Vuetify 3.7.13 | CSS propio + Radix UI |
| Build | Vite 4.1.1 | Vite 8.3.0 |
| Estado / navegación | Pinia 2.0.11, Vue Router 4.0.12 | Estado React y rutas de la app actual |
| CSS | Sass 1.69.5 + estilos globales de Vuetify | CSS existente de Territorium |
| Node declarado | `18.20.4` (`.nvmrc`; `>=18.20.4 <19`) | Comprobar la versión del entorno actual antes de combinar builds |
| Backend según README | Django + AWS S3/iTierra Bucket | Supabase + worker del proyecto |

También hay dependencias de Tiptap Vue 2.0 beta, iconos Tabler/MDI, Easy Data Table, ApexCharts y otras bibliotecas. Copiar componentes funcionales implicaría revisar **todas** sus dependencias, APIs, autenticación y permisos. El README del origen no declara una suite automatizada de tests.

## ¿Cómo integrarlo como módulo?

**Recomendación para el objetivo visual:** mantener Territorium en React y traducir los tokens, geometría y componentes necesarios a un *scope* React (`.legalitica-reference-module` o un sistema propio de tokens). Esto preserva navegación, sesión, Supabase, worker y comparador; no exige incorporar Vue ni Vuetify. Es una migración visual, no una copia ejecutable. Primero trasladar sidebar/topbar y una pantalla representativa, comparar a varias anchuras y después extender. No importar `style.scss` directamente: sus reglas `.v-*`, `html`, `v-main`, scrollbar y otros selectores globales pueden sobrescribir la app, como ya ocurrió con un CSS global ajeno en el Comparador.

**Si se necesita ejecutar una funcionalidad Vue completa:** la vía de menor acoplamiento técnico es desplegarla como subaplicación independiente y abrirla en una ruta o iframe del producto. Requiere resolver SSO/sesión, intercambio de mensajes con `postMessage` validando origen, permisos, CSP/frame-ancestors, navegación profunda, despliegue y consistencia de datos. Un custom element/microfrontend puede compartir la página, pero exige aislar CSS, coordinar routers y mantener dos runtimes. Ninguna opción hace que Django/S3 se convierta automáticamente en Supabase/worker.

**Migrar todo Territorium a Vue/Vuetify** no es un prerrequisito para adoptar la apariencia y sería la opción más costosa: reescribir vistas y componentes React, rutas, estado, integración de Tiptap, pruebas y diseño del Comparador. Tampoco se puede importar directamente un `.vue` como componente React.

Estimación orientativa, dependiente del alcance: reproducir únicamente los tokens y un shell/pantalla representativa puede tomar varios días; portar un módulo Vue funcional, con autenticación y datos reales, normalmente requiere más de un día y debe estimarse por flujo; migrar toda la aplicación sería un proyecto de semanas o más. La compatibilidad de Node entre el checkout legado (18.x) y el build actual es un bloqueo adicional para un build unificado, no para una referencia visual o despliegues separados.

## Reglas de adopción y límites de esta guía

1. Conservar `fuente/` como snapshot inerte. No importar sus SCSS ni cargar sus logos por accidente en producción hasta resolver alcance y licencias.
2. Definir tokens semánticos para React a partir del tema **efectivo**: primitivos (`#316842`), intención (`acción primaria`, `fondo de trabajo`) y contratos por componente (`sidebar activo`). Resolver siempre la cascada completa; en `.v-main` gana `#FAFBF9`, no la regla anterior `#F2F6F3`.
3. Para cada componente migrado, documentar estados normal/hover/activo/deshabilitado/error, teclado/foco, responsive y `prefers-reduced-motion`; el origen no es una prueba automática de accesibilidad.
4. Verificar visualmente contra el checkout original ejecutado en las mismas anchuras y con las mismas fuentes. Esta guía es una extracción **exacta del código revisado**, no una medición de capturas renderizadas ni una garantía de paridad píxel a píxel.
