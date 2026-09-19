# Historias de usuario — Territorium 2.0

## 1. Propósito

Este documento define el backlog funcional y técnico para reenfocar Territorium alrededor de una regla de negocio única:

> Un expediente corresponde a una sola gestión predial sobre un único predio. El expediente puede contener muchos documentos, pero todos deben aportar al estudio de ese mismo predio.

La entrega se divide en fases. La primera fase prioriza un prototipo frontend navegable dentro de **Ficha de expediente**, sin sustituir todavía la lógica, las rutas ni el modelo de datos actuales. Las fases posteriores incorporan persistencia, procesamiento asíncrono, extracción, consolidación, generación documental y retiro controlado del flujo anterior.

El prototipo debe permitir demostrar el recorrido completo con datos simulados, pero debe distinguir visual y técnicamente los estados simulados de una integración productiva.

## 2. Alcance funcional objetivo

El flujo objetivo es:

```text
Expediente — un predio
        │
        ├── Títulos ────── cargar → procesar → revisar/editar → aprobar
        ├── Planos ─────── cargar → procesar → revisar/editar → aprobar
        └── Negociación ── cargar → procesar → revisar/editar → aprobar
                                      │
                             los tres aprobados
                                      │
                            Consolidar resultados
                                      │
                          revisar/editar → aprobar
                                      │
                    Generar documento desde plantilla
                                      │
                 editar manualmente / reprocesar con comentarios
                                      │
                         Descargar PDF y Excel
```

## 3. Convenciones

### 3.1 Prioridad

| Nivel | Significado |
|---|---|
| **P0** | Imprescindible para que la fase o el flujo principal pueda demostrarse u operar. |
| **P1** | Necesario para completar el producto objetivo con seguridad y buena experiencia. |
| **P2** | Mejora posterior, optimización o capacidad condicionada por una decisión externa. |

### 3.2 Dificultad

| Nivel | Referencia |
|---|---|
| **S** | Cambio acotado; uno o dos componentes o servicios. |
| **M** | Historia de complejidad media; varios estados o entre tres y cinco piezas relacionadas. |
| **L** | Historia de alto riesgo o integración entre subsistemas; debe ejecutarse en subtareas dentro de una misma historia. |

No se definen historias XL. Si una historia L crece durante el refinamiento, deberá dividirse antes de implementarse.

### 3.3 Estados principales

Cada subconjunto documental —Títulos, Planos y Negociación— utilizará la misma máquina de estados:

```text
vacío → listo → en cola → procesando → listo para revisión → aprobado
                    └──────────────→ error
aprobado + cambio de archivos ─────→ desactualizado
```

El consolidado utilizará:

```text
bloqueado → disponible → consolidando → listo para revisión → aprobado
aprobado + cambio aguas arriba ─────────────────────────────→ desactualizado
```

El documento final utilizará:

```text
bloqueado → generando → editable → reprocesando → editable → final
```

## 4. Decisiones y supuestos de planificación

1. La nueva experiencia se construirá dentro de **Ficha de expediente**, mediante vistas internas: `Resumen`, `Extracción y consolidación` y `Documento final`.
2. En la fase de prototipo no se eliminarán el monitor, la revisión ni los entregables actuales. Se retirarán solo después de que el nuevo flujo esté integrado y validado.
3. El prototipo utilizará un repositorio de demostración aislado; no escribirá resultados simulados en Supabase.
4. TanStack Table será la base de las tablas editables. El archivo Excel se generará desde datos estructurados aprobados; no se integrará Google Sheets en el alcance inicial.
5. Tiptap será la base del editor documental del prototipo. Se asumirá una plantilla web controlada y salida PDF hasta que se decida si se necesita fidelidad DOCX completa.
6. La IA no aprobará información. Toda aprobación será una acción humana autenticada.
7. Los modales de resultados no mostrarán un panel de evidencias en esta versión. Los metadatos de origen se conservarán técnicamente para auditoría y evolución futura.
8. Agregar, reemplazar o eliminar documentos de un subconjunto revocará su aprobación e invalidará el consolidado y el documento final, sin eliminar versiones históricas.

## 5. Mapa de pantallas y transiciones del prototipo

### 5.1 Ficha de expediente — Resumen

- Presenta la identidad de un único predio: matrícula, cédula catastral, nombre, ubicación, responsable y estado.
- Resume los estados de Títulos, Planos, Negociación, Consolidado y Documento final.
- Acción principal: `Continuar extracción`.

### 5.2 Ficha de expediente — Extracción y consolidación

- Tres tarjetas de igual jerarquía en una fila de escritorio: Títulos, Planos y Negociación.
- Cada tarjeta conserva su cargador habilitado en todo momento.
- La lista de archivos tiene altura fija y scroll interno.
- Debajo del envío aparece el progreso; no existe una pantalla independiente de monitor.
- Cuando termina el procesamiento se habilita `Analizar resultados`.
- Cuando los tres subconjuntos están aprobados se habilita `Consolidar resultados`, centrado bajo las tarjetas.
- Cuando termina la consolidación se habilita `Analizar consolidado`.

### 5.3 Modal de resultados de subconjunto

- Encabezado con nombre del subconjunto, estado, versión y fecha.
- Tabla editable construida con TanStack Table.
- Sin panel de evidencias.
- Acciones persistentes en el pie: `Guardar borrador`, `Repetir análisis` y `Aprobar`.
- El cuerpo de la tabla podrá tener scroll interno cuando los registros no quepan; el encabezado y las acciones permanecen visibles.

### 5.4 Modal de consolidado

- Tabla editable del registro maestro del predio.
- Muestra el origen lógico del valor: títulos, planos, negociación o corrección manual, sin abrir evidencia documental.
- Acciones: `Guardar borrador`, `Repetir consolidación` y `Aprobar consolidado`.

### 5.5 Ficha de expediente — Documento final

- Durante la generación muestra progreso en la misma vista.
- Al terminar, presenta el documento en un editor Tiptap.
- Acciones: guardar, abrir solicitud de cambios a IA, consultar versiones, descargar PDF y descargar Excel consolidado.

### 5.6 Transiciones

| Origen | Acción | Destino o efecto |
|---|---|---|
| Resumen | Continuar extracción | Abre `Extracción y consolidación`. |
| Tarjeta lista | Enviar para análisis | Cambia a `procesando` y muestra progreso bajo el botón. |
| Tarjeta procesada | Analizar resultados | Abre el modal del subconjunto. |
| Modal de subconjunto | Guardar borrador | Conserva cambios y mantiene el modal abierto. |
| Modal de subconjunto | Repetir análisis | Cierra el modal y reinicia el progreso de esa tarjeta. |
| Modal de subconjunto | Aprobar | Guarda la versión, cierra el modal y marca la tarjeta aprobada. |
| Subconjunto aprobado | Agregar/quitar archivo | Marca el subconjunto como desactualizado e invalida resultados posteriores. |
| Tres subconjuntos aprobados | Consolidar resultados | Inicia progreso de consolidación. |
| Consolidación terminada | Analizar consolidado | Abre el modal de consolidado. |
| Modal de consolidado | Aprobar consolidado | Inicia generación y navega a `Documento final`. |
| Documento final | Solicitar cambios a IA | Abre modal de comentarios; al confirmar crea una nueva versión en progreso. |
| Documento final | Descargar | Entrega PDF final o Excel consolidado aprobado. |

---

# Fase 1 — Prototipo frontend navegable

## Objetivo de la fase

Producir un prototipo presentable que permita recorrer todo el flujo dentro de la ficha de un expediente, con estados y resultados simulados. Esta fase no modifica el backend ni elimina pantallas existentes.

## HU-V2-001 — Navegación interna de la ficha de expediente

**Historia:** Como usuario del expediente, quiero acceder a Resumen, Extracción y consolidación, y Documento final dentro de la ficha para completar el proceso sin salir del contexto del predio.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** Ninguna

**Criterios de aceptación:**

- [ ] La ficha presenta las tres vistas internas sin agregar opciones a la navegación global.
- [ ] La vista Documento final comunica visualmente cuándo está bloqueada.
- [ ] Cambiar de vista conserva el expediente activo y el estado del prototipo.
- [ ] Las pantallas actuales externas a la ficha permanecen disponibles y sin cambios funcionales.

**Verificación:** navegación por clic y teclado; recarga controlada; `npm run check` y pruebas de componente.

## HU-V2-002 — Contrato de estados y repositorio simulado

**Historia:** Como equipo de producto, quiero representar todos los estados del flujo con datos simulados para demostrar transiciones antes de conectar Supabase y la IA.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-001

**Criterios de aceptación:**

- [ ] Existe un tipo común para estados de subconjunto, consolidado y documento.
- [ ] Los datos simulados están aislados detrás de una interfaz de repositorio reemplazable.
- [ ] El modo demo no escribe en tablas ni Storage productivos.
- [ ] Se pueden cargar escenarios vacío, parcialmente procesado, aprobado y con error.

**Verificación:** pruebas unitarias de transiciones y revisión de que no se realizan llamadas remotas.

## HU-V2-003 — Resumen de expediente para un único predio

**Historia:** Como analista, quiero ver la identidad y el avance del único predio del expediente para entender su contexto antes de procesar documentos.

- **Prioridad:** P0
- **Dificultad:** S
- **Dependencias:** HU-V2-001, HU-V2-002

**Criterios de aceptación:**

- [ ] La pantalla no presenta lotes ni contadores de múltiples predios.
- [ ] Se muestran matrícula, cédula catastral, nombre, municipio, departamento, responsable y estado.
- [ ] Se resume el estado de los tres subconjuntos, el consolidado y el documento final.
- [ ] `Continuar extracción` lleva a la vista correcta.

**Verificación:** revisión visual con expediente vacío, activo y finalizado.

## HU-V2-004 — Espacio de extracción en tres columnas

**Historia:** Como operador, quiero ver Títulos, Planos y Negociación simultáneamente para trabajar cada fuente de manera independiente sin perder la visión general.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-001, HU-V2-002

**Criterios de aceptación:**

- [ ] En escritorio las tres tarjetas aparecen en una sola fila y con altura visual coherente.
- [ ] Cada tarjeta muestra título, descripción breve, estado, carga, archivos, procesamiento y revisión.
- [ ] En pantallas estrechas las tarjetas se adaptan sin desbordamiento horizontal.
- [ ] El botón de consolidación ocupa una zona común centrada debajo de las tarjetas.

**Verificación:** comprobación visual en anchos de 1440, 1024, 768 y 390 píxeles.

## HU-V2-005 — Tarjeta de carga de Títulos

**Historia:** Como operador, quiero cargar varios estudios y documentos de títulos del mismo predio para preparar su extracción jurídica.

- **Prioridad:** P0
- **Dificultad:** S
- **Dependencias:** HU-V2-004

**Criterios de aceptación:**

- [ ] La tarjeta acepta selección múltiple y arrastre de archivos DOCX y PDF en el prototipo.
- [ ] La interfaz aclara que todos los documentos pertenecen al mismo predio.
- [ ] Los archivos se pueden agregar y retirar incluso después de una aprobación simulada.
- [ ] Los formatos no admitidos muestran un error dentro de la tarjeta.

**Verificación:** carga simulada válida, formato inválido y retiro de archivo.

## HU-V2-006 — Tarjeta de carga de Planos

**Historia:** Como operador, quiero cargar los planos relacionados con el predio para preparar la extracción de medidas e información técnica.

- **Prioridad:** P0
- **Dificultad:** S
- **Dependencias:** HU-V2-004

**Criterios de aceptación:**

- [ ] La tarjeta acepta múltiples PDF e imágenes configuradas para el prototipo.
- [ ] Muestra que el resultado puede contener más de un plano del mismo predio.
- [ ] Permite agregar y retirar archivos durante todo el flujo.
- [ ] Los errores se muestran en contexto y no bloquean las otras tarjetas.

**Verificación:** escenarios sin archivo, con varios planos y con archivo rechazado.

## HU-V2-007 — Tarjeta de carga de Negociación

**Historia:** Como operador, quiero cargar la tabla de negociación vigente del predio para extraer y validar los valores económicos.

- **Prioridad:** P0
- **Dificultad:** S
- **Dependencias:** HU-V2-004

**Criterios de aceptación:**

- [ ] La tarjeta acepta archivos XLSX en el prototipo.
- [ ] Cuando se carga una nueva tabla, la interfaz permite reemplazar la vigente conservando la versión anterior en la demostración.
- [ ] El estado de Negociación es independiente de Títulos y Planos.
- [ ] Un error de formato no altera los otros dos subconjuntos.

**Verificación:** carga inicial, reemplazo y archivo inválido.

## HU-V2-008 — Lista compacta de archivos con scroll interno

**Historia:** Como operador, quiero revisar los archivos de cada subconjunto sin que las tarjetas crezcan indefinidamente para mantener visible el flujo completo.

- **Prioridad:** P0
- **Dificultad:** S
- **Dependencias:** HU-V2-005, HU-V2-006, HU-V2-007

**Criterios de aceptación:**

- [ ] Las tres tarjetas reutilizan el mismo componente de lista.
- [ ] La lista tiene altura fija y scroll interno al superar el número visible de archivos.
- [ ] Cada fila muestra nombre, tamaño, tipo, estado y acción de retirar.
- [ ] El foco de teclado permanece visible dentro del área desplazable.

**Verificación:** listas de 0, 1, 6 y 50 archivos simulados.

## HU-V2-009 — Procesamiento y progreso en línea

**Historia:** Como operador, quiero iniciar y observar el análisis directamente en cada tarjeta para no depender de una pantalla de monitor separada.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-002, HU-V2-008

**Criterios de aceptación:**

- [ ] `Enviar para análisis` solo se habilita cuando la tarjeta contiene insumos válidos.
- [ ] Durante el proceso el texto cambia a `Procesando` y aparece una barra bajo la acción.
- [ ] La demostración representa cola, procesamiento, finalización y error.
- [ ] El avance simulado no afecta las otras tarjetas y no se presenta como procesamiento real.

**Verificación:** pruebas de estados, reinicio y ejecución paralela de dos tarjetas.

## HU-V2-010 — Contenedor modal reutilizable de revisión

**Historia:** Como usuario, quiero revisar resultados en un modal consistente para permanecer dentro de la ficha y conservar el contexto del expediente.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-001

**Criterios de aceptación:**

- [ ] El modal tiene encabezado, cuerpo y pie de acciones fijos y claramente diferenciados.
- [ ] Se cierra con acción explícita, botón de cierre y tecla Escape cuando no hay cambios sin guardar.
- [ ] Si hay cambios pendientes, cerrar solicita confirmación.
- [ ] El foco queda atrapado en el modal y regresa al botón que lo abrió.

**Verificación:** teclado completo, cambios sin guardar y lectores de pantalla básicos.

## HU-V2-011 — Integración frontend de TanStack Table

**Historia:** Como revisor, quiero editar resultados en una tabla especializada para corregir valores sin manipular directamente un archivo Excel.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** HU-V2-010

**Criterios de aceptación:**

- [ ] TanStack Table queda instalado e integrado mediante un componente reutilizable.
- [ ] Las columnas se configuran por tipo: texto, número, fecha, selección y colección.
- [ ] Las celdas editables muestran estado normal, editado, inválido y solo lectura.
- [ ] La tabla admite navegación por teclado y conserva encabezados visibles durante su scroll interno.
- [ ] No se presenta como una integración completa de Microsoft Excel.

**Verificación:** pruebas de edición, validación, teclado y renderizado con conjuntos largos.

## HU-V2-012 — Modal de resultados por subconjunto

**Historia:** Como revisor, quiero abrir los resultados de Títulos, Planos o Negociación para corregirlos, guardarlos, reprocesarlos o aprobarlos.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-009, HU-V2-010, HU-V2-011

**Criterios de aceptación:**

- [ ] Cada tarjeta abre el mismo modal configurado con columnas y datos de su subconjunto.
- [ ] El modal no incluye panel de evidencias documentales.
- [ ] `Guardar borrador` conserva las ediciones durante toda la sesión del prototipo.
- [ ] `Repetir análisis` cierra el modal y reinicia la transición de procesamiento.
- [ ] `Aprobar` valida los campos requeridos, cierra el modal y marca la versión aprobada.

**Verificación:** recorrido completo para los tres subconjuntos y validación de campos inválidos.

## HU-V2-013 — Invalidación visual por cambio de insumos

**Historia:** Como revisor, quiero saber cuándo un resultado aprobado quedó desactualizado porque cambiaron sus archivos para evitar consolidar información obsoleta.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-008, HU-V2-012

**Criterios de aceptación:**

- [ ] Agregar, reemplazar o retirar un archivo de una tarjeta aprobada la marca `Desactualizada`.
- [ ] El subconjunto afectado requiere nuevo procesamiento y aprobación.
- [ ] El consolidado y el documento final pasan visualmente a desactualizados o bloqueados.
- [ ] Los otros subconjuntos conservan su aprobación si sus archivos no cambiaron.

**Verificación:** matriz de cambios aplicada por separado a las tres tarjetas.

## HU-V2-014 — Habilitación y progreso de la consolidación

**Historia:** Como analista, quiero consolidar únicamente cuando los tres subconjuntos estén aprobados para generar un registro maestro coherente.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-012, HU-V2-013

**Criterios de aceptación:**

- [ ] `Consolidar resultados` está deshabilitado hasta que las tres versiones estén aprobadas.
- [ ] La interfaz explica qué aprobación falta.
- [ ] Al iniciar, aparece progreso en la misma vista sin navegar a un monitor.
- [ ] Al terminar se habilita `Analizar consolidado`.

**Verificación:** combinaciones de cero, una, dos y tres aprobaciones.

## HU-V2-015 — Modal editable del consolidado

**Historia:** Como revisor, quiero revisar y editar el registro consolidado antes de aprobarlo para controlar la información que alimentará el documento final.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-011, HU-V2-014

**Criterios de aceptación:**

- [ ] El modal reutiliza TanStack Table y diferencia los grupos de campos jurídicos, técnicos y económicos.
- [ ] Muestra el origen lógico del valor sin añadir un visor de evidencias.
- [ ] Permite guardar borrador, repetir consolidación y aprobar.
- [ ] Aprobar desencadena la transición a generación documental.

**Verificación:** edición, validación, reproceso y aprobación del consolidado.

## HU-V2-016 — Pantalla de generación y edición documental

**Historia:** Como analista, quiero ver la generación y luego editar el documento final en la ficha para completar el entregable sin una sección externa de cierre.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-015

**Criterios de aceptación:**

- [ ] La vista comienza con un estado de generación y una barra de progreso.
- [ ] Cuando termina, muestra título, versión, última edición y estado del documento.
- [ ] El editor ocupa la zona principal y las acciones no desplazan inesperadamente el contenido.
- [ ] Se puede volver a Extracción y consolidación sin perder el borrador simulado.

**Verificación:** transición desde consolidado aprobado, recarga de escenario y navegación de retorno.

## HU-V2-017 — Integración frontend de Tiptap

**Historia:** Como analista, quiero editar el contenido del documento generado en un editor enriquecido para realizar correcciones manuales antes de descargarlo.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** HU-V2-016

**Criterios de aceptación:**

- [ ] Tiptap queda instalado y encapsulado en un componente reutilizable.
- [ ] El editor soporta títulos, párrafos, negrita, cursiva, listas, tablas básicas y saltos definidos por la plantilla del prototipo.
- [ ] El contenido se representa como JSON de Tiptap y no como HTML sin control.
- [ ] La interfaz diferencia cambios sin guardar, guardando y guardado.
- [ ] El editor no promete fidelidad DOCX completa.

**Verificación:** edición por teclado, pegado de texto, tabla básica y restauración del borrador.

## HU-V2-018 — Solicitud de cambios a IA mediante comentarios

**Historia:** Como analista, quiero describir ajustes para una nueva versión del documento para demostrar cómo la IA podrá reprocesar el borrador sin destruir la versión anterior.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-017

**Criterios de aceptación:**

- [ ] `Solicitar cambios a IA` abre un modal con campo de comentarios y resumen de la versión actual.
- [ ] Confirmar cierra el modal, muestra reprocesamiento y crea una versión simulada nueva.
- [ ] Cancelar no modifica el documento.
- [ ] La versión previa continúa disponible en el historial del prototipo.

**Verificación:** comentario vacío, cancelación, reproceso y comparación de versión.

## HU-V2-019 — Acciones finales y descargas del prototipo

**Historia:** Como usuario, quiero identificar las descargas finales disponibles para validar el cierre esperado del proceso durante la demostración.

- **Prioridad:** P1
- **Dificultad:** S
- **Dependencias:** HU-V2-015, HU-V2-017

**Criterios de aceptación:**

- [ ] La vista muestra `Descargar PDF` y `Descargar Excel consolidado` únicamente cuando corresponda.
- [ ] En modo prototipo las acciones están rotuladas como demostración o entregan archivos de muestra controlados.
- [ ] Descargar no cambia el estado de aprobación.

**Verificación:** estados bloqueado, editable y final.

## HU-V2-020 — Accesibilidad, adaptación y recorrido de demostración

**Historia:** Como presentador, quiero ejecutar un recorrido estable en distintos tamaños de pantalla y con teclado para mostrar el prototipo sin interrupciones.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-003 a HU-V2-019

**Criterios de aceptación:**

- [ ] Existe un escenario demo reiniciable que recorre carga, proceso, revisión, consolidación y documento.
- [ ] Todos los controles tienen nombre accesible, foco visible y orden lógico.
- [ ] Los modales gestionan foco y cambios sin guardar correctamente.
- [ ] No existen desbordamientos ni scroll horizontal en los tamaños soportados.
- [ ] Las animaciones respetan `prefers-reduced-motion`.

**Verificación:** `npm run verify`, recorrido manual completo y comprobación visual responsive.

### Checkpoint de Fase 1

- [ ] El prototipo completo puede demostrarse sin backend.
- [ ] Las tres tarjetas y ambos modales representan todas las transiciones acordadas.
- [ ] TanStack Table y Tiptap están integrados detrás de componentes propios.
- [ ] Las pantallas existentes fuera de la ficha continúan funcionando.
- [ ] El usuario valida el prototipo antes de iniciar la Fase 2.

---

# Fase 2 — Dominio, persistencia y seguridad

## HU-V2-021 — Modelo un expediente–un predio

**Historia:** Como responsable del proceso, quiero que cada expediente represente exactamente un predio para evitar mezclar gestiones prediales distintas.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** Aprobación del checkpoint de Fase 1

**Criterios de aceptación:**

- [ ] El expediente tiene una identidad predial única y versionable.
- [ ] La base de datos impide asociar registros maestros de varios predios al mismo expediente.
- [ ] Los campos obligatorios y opcionales están documentados.
- [ ] Se define una migración compatible con los expedientes existentes.

**Verificación:** pruebas de restricciones, migración y aislamiento entre expedientes.

## HU-V2-022 — Grupos documentales y versiones de archivos

**Historia:** Como operador, quiero que los documentos se agrupen en Títulos, Planos y Negociación para ejecutar y versionar cada análisis independientemente.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-021

**Criterios de aceptación:**

- [ ] Cada expediente tiene como máximo un grupo activo de cada tipo.
- [ ] Cada grupo admite múltiples documentos y conserva versiones retiradas o reemplazadas.
- [ ] Negociación identifica cuál archivo es la versión vigente.
- [ ] Ningún cambio elimina físicamente el historial aprobado.

**Verificación:** restricciones de unicidad, reemplazo y consulta histórica.

## HU-V2-023 — Ejecuciones y tareas versionadas

**Historia:** Como sistema, quiero registrar una ejecución por análisis y tareas por archivo o fragmento para reintentar fallos sin repetir todo el subconjunto.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** HU-V2-022

**Criterios de aceptación:**

- [ ] Una ejecución captura la versión exacta de sus documentos, extractor, prompt y modelo.
- [ ] Las tareas tienen estados, intentos, errores e idempotencia.
- [ ] Un resultado tardío no puede sobrescribir una ejecución posterior o cancelada.
- [ ] El progreso puede calcularse a partir de trabajo real completado.

**Verificación:** pruebas de doble envío, resultado tardío y reintento parcial.

## HU-V2-024 — Resultados, correcciones y aprobaciones inmutables

**Historia:** Como revisor, quiero que las salidas de IA, mis correcciones y la versión aprobada permanezcan diferenciadas para no perder trazabilidad.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** HU-V2-023

**Criterios de aceptación:**

- [ ] La salida original de una ejecución es inmutable.
- [ ] Las correcciones humanas crean borradores o versiones, sin sobrescribir la salida original.
- [ ] La aprobación referencia una versión exacta, usuario y fecha.
- [ ] Reabrir un modal muestra el último borrador autorizado.

**Verificación:** comparación histórica y pruebas de edición concurrente.

## HU-V2-025 — Reglas transaccionales de invalidación

**Historia:** Como sistema, quiero invalidar resultados aguas abajo cuando cambien los insumos para impedir el uso de entregables obsoletos.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** HU-V2-022, HU-V2-024

**Criterios de aceptación:**

- [ ] Un cambio de documentos invalida únicamente el grupo afectado y sus descendientes.
- [ ] Consolidado y documento quedan desactualizados sin borrar sus versiones anteriores.
- [ ] La operación es transaccional y queda auditada.
- [ ] Los artefactos obsoletos no se ofrecen como descarga vigente.

**Verificación:** matriz de invalidación para altas, bajas y reemplazos.

## HU-V2-026 — RLS, permisos y auditoría del nuevo dominio

**Historia:** Como responsable de seguridad, quiero aplicar permisos y auditoría al nuevo flujo para proteger documentos y decisiones jurídicas.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** HU-V2-021 a HU-V2-025

**Criterios de aceptación:**

- [ ] RLS restringe expediente, archivos, resultados, aprobaciones y artefactos por membresía y rol.
- [ ] Solo roles autorizados pueden corregir, aprobar, reprocesar o descargar.
- [ ] Se auditan carga, retiro, proceso, corrección, aprobación, reproceso y descarga.
- [ ] Las pruebas demuestran aislamiento entre expedientes.

**Verificación:** suite de RLS y pruebas con roles operador, revisor, aprobador y auditor.

### Checkpoint de Fase 2

- [ ] El nuevo dominio está migrado y protegido.
- [ ] La máquina de estados está implementada en servidor, no solo en la interfaz.
- [ ] El frontend puede cambiar del repositorio simulado al repositorio real mediante el mismo contrato.

---

# Fase 3 — Carga y procesamiento asíncrono

## HU-V2-027 — Carga privada, reanudable y validada

**Historia:** Como operador, quiero cargar documentos grandes de forma segura y reanudable para no perder el avance ante fallos de red.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** HU-V2-022, HU-V2-026

**Criterios de aceptación:**

- [ ] Los archivos se cargan directamente a Storage privado mediante TUS cuando corresponda.
- [ ] Se validan extensión, MIME, tamaño, archivo vacío, protegido y dañado.
- [ ] La aplicación conserva el path estable y genera enlaces temporales bajo autorización.
- [ ] Una falla entre Storage y base de datos se compensa sin dejar registros huérfanos.

**Verificación:** interrupción y reanudación, formatos inválidos y limpieza compensatoria.

## HU-V2-028 — Hash, duplicados y reutilización documental

**Historia:** Como sistema, quiero identificar documentos idénticos para advertir duplicados y evitar procesamiento innecesario.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-027

**Criterios de aceptación:**

- [ ] Se calcula SHA-256 de cada archivo.
- [ ] El operador puede omitir, conservar como versión o reemplazar un duplicado según permisos.
- [ ] Un archivo sin cambios puede reutilizar resultados compatibles.
- [ ] La decisión queda auditada.

**Verificación:** duplicado en el mismo grupo, en otro expediente y nueva versión distinta.

## HU-V2-029 — API de creación idempotente de análisis

**Historia:** Como frontend, quiero solicitar un análisis y recibir aceptación inmediata para no mantener una petición abierta durante varios minutos.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-023, HU-V2-027

**Criterios de aceptación:**

- [ ] La función valida usuario, expediente, grupo y estado antes de crear el trabajo.
- [ ] Responde con `202` y un identificador de ejecución.
- [ ] Una misma clave idempotente no crea ejecuciones duplicadas.
- [ ] La función no intenta completar la extracción dentro de su petición.

**Verificación:** doble clic, solicitud no autorizada y grupo sin archivos.

## HU-V2-030 — Cola durable y worker externo

**Historia:** Como sistema, quiero procesar los análisis fuera de las Edge Functions para soportar ejecuciones largas, reintentos y concurrencia controlada.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** HU-V2-029

**Criterios de aceptación:**

- [ ] El worker reclama tareas con lease o ventana de visibilidad.
- [ ] La concurrencia se configura por extractor y proveedor.
- [ ] Los reinicios recuperan tareas abandonadas sin duplicar resultados.
- [ ] El worker no registra contenido jurídico sensible en logs.

**Verificación:** caída del worker, expiración de lease y ejecución concurrente.

## HU-V2-031 — Progreso real mediante Realtime

**Historia:** Como usuario, quiero ver progreso real dentro de cada tarjeta para saber qué está ocurriendo sin abrir un monitor.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-023, HU-V2-030

**Criterios de aceptación:**

- [ ] El avance se calcula con tareas o etapas ponderadas completadas.
- [ ] Realtime actualiza estado, porcentaje y mensaje de etapa.
- [ ] Recargar o reconectar recupera el estado actual desde la base de datos.
- [ ] Un reintento no hace retroceder visualmente el porcentaje confirmado.

**Verificación:** pérdida de conexión, refresco y reintento de una tarea.

## HU-V2-032 — Caché versionada de extracción

**Historia:** Como responsable de costos, quiero reutilizar extracciones compatibles para no enviar repetidamente a IA documentos que no cambiaron.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-028, HU-V2-030

**Criterios de aceptación:**

- [ ] La clave considera hash, extractor, prompt, esquema y modelo.
- [ ] Un cambio de cualquiera de esas versiones fuerza una extracción nueva.
- [ ] Los aciertos y fallos de caché quedan registrados sin exponer contenido sensible.
- [ ] La reducción del subconjunto se vuelve a ejecutar cuando cambia su conjunto documental.

**Verificación:** matriz de coincidencia y cambio de versiones.

## HU-V2-033 — Errores, reintentos y recuperación en contexto

**Historia:** Como operador, quiero entender y recuperar fallos desde la tarjeta afectada para continuar sin una pantalla de excepciones independiente.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-030, HU-V2-031

**Criterios de aceptación:**

- [ ] Los errores transitorios se reintentan con límite y espera incremental.
- [ ] Los errores permanentes muestran causa y acción sugerida en la tarjeta o modal.
- [ ] Es posible reprocesar solo el grupo o documento afectado cuando sea seguro.
- [ ] Un fallo de un grupo no bloquea el procesamiento de los otros.

**Verificación:** timeout, límite de proveedor, archivo corrupto y salida inválida.

### Checkpoint de Fase 3

- [ ] La carga y el procesamiento sobreviven refrescos, desconexiones y reinicios.
- [ ] El progreso mostrado proviene de trabajo real.
- [ ] No existen llamadas largas desde el navegador o Edge Functions.

---

# Fase 4 — Preprocesamiento y extractores

## HU-V2-034 — Representación documental canónica

**Historia:** Como sistema, quiero convertir cada fuente a una representación trazable para que los extractores procesen texto, tablas y ubicación sin alterar el original.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** HU-V2-027, HU-V2-030

**Criterios de aceptación:**

- [x] DOCX conserva párrafos, tablas, secciones y referencias de ubicación.
- [x] PDF con texto conserva páginas y bloques.
- [x] El archivo original permanece inmutable.
- [x] Cada fragmento puede rastrearse hasta documento y ubicación, aunque la UI actual no muestre evidencia.

**Verificación:** documentos con tablas, saltos, encabezados y múltiples páginas.

## HU-V2-035 — Detección de escaneo y OCR selectivo

**Historia:** Como sistema, quiero aplicar OCR o visión solo a páginas que lo necesiten para mejorar cobertura y controlar costos.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** HU-V2-034

**Criterios de aceptación:**

- [x] Se distingue PDF con texto, escaneado y mixto.
- [x] OCR se aplica por página y registra su calidad o advertencias.
- [x] Las páginas ilegibles o protegidas se reportan sin inventar contenido.
- [x] Los planos pueden usar visión cuando la extracción textual sea insuficiente.

**Verificación:** PDF textual, escaneado, mixto, rotado y protegido.

## HU-V2-036 — Lectura determinista de negociación XLSX

**Historia:** Como sistema, quiero leer primero las celdas de la tabla de negociación de forma determinista para usar IA solo cuando la estructura sea ambigua.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-034

**Criterios de aceptación:**

- [x] Se detectan hojas, encabezados, tipos de celda y valores numéricos o textuales.
- [x] Fórmulas se diferencian de sus valores calculados.
- [x] Los encabezados ambiguos se envían a un mapeo controlado, no a una interpretación libre.
- [x] El resultado conserva coordenadas de celda para auditoría.

**Verificación:** libro esperado, encabezados variantes, celdas vacías y fórmulas.

## HU-V2-037 — Segmentación exhaustiva y reducción jerárquica

**Historia:** Como sistema, quiero procesar cada documento por secciones manejables y combinar todos sus resultados para evitar depender de recuperación RAG incompleta.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** HU-V2-034, HU-V2-035

**Criterios de aceptación:**

- [x] La segmentación considera páginas, secciones, tablas y límite de tokens; no solo megabytes.
- [x] Todos los fragmentos válidos generan una tarea o una decisión explícita de omisión.
- [x] La reducción conserva listas, discrepancias y referencias de origen.
- [x] La concurrencia es limitada y configurable.

**Verificación:** documento corto, documento extenso y conjunto de 50 archivos.

## HU-V2-038 — Extractor de Títulos

**Historia:** Como analista, quiero obtener los campos jurídicos acordados de todos los documentos de títulos del predio para revisar un resultado canónico único.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** HU-V2-037

**Criterios de aceptación:**

- [x] Extrae matrícula, cédula catastral, propietarios, identificaciones, ubicación, áreas, oficina, adquisición, linderos, condiciones jurídicas, radicados y URT según contrato aprobado.
- [x] Propietarios, antecedentes y condiciones repetibles se conservan como colecciones.
- [x] Los linderos se mantienen literales y no se resumen silenciosamente.
- [x] La salida cumple un esquema JSON estricto o falla de forma controlada.

**Verificación:** casos con múltiples propietarios, antecedentes, gravámenes y campos ausentes.

## HU-V2-039 — Extractor de Planos

**Historia:** Como analista, quiero obtener la información técnica de todos los planos del predio para revisar medidas y elementos de infraestructura.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** HU-V2-035, HU-V2-037

**Criterios de aceptación:**

- [x] Extrae nombre, área de servidumbre, longitud, ancho, infraestructura y escala.
- [x] Conserva números, expresiones en letras y unidades sin mezclarlas.
- [x] Mantiene resultados por plano y una vista resumida del subconjunto.
- [x] Valores ambiguos o ilegibles se marcan para revisión.

**Verificación:** varios planos, distintas unidades y zonas ilegibles.

## HU-V2-040 — Extractor de Negociación

**Historia:** Como analista, quiero extraer y validar los valores de negociación para incorporarlos al registro maestro del predio.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-036

**Criterios de aceptación:**

- [x] Extrae las columnas de oferta definidas en el contrato vigente.
- [x] Conserva valor numérico y valor en letras por separado.
- [x] Compara ambos valores y reporta discrepancias sin corregirlas silenciosamente.
- [x] Selecciona únicamente la versión vigente del archivo para el resultado aprobable.

**Verificación:** coincidencia, discrepancia, campo vacío y versión reemplazada.

## HU-V2-041 — Validación estructural y reglas deterministas

**Historia:** Como revisor, quiero que los resultados incumplidos o incoherentes sean identificados antes de revisar para no aprobar salidas técnicamente inválidas.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** HU-V2-038, HU-V2-039, HU-V2-040

**Criterios de aceptación:**

- [x] Cada extractor valida su JSON contra una versión de esquema.
- [x] Se aplican reglas para fechas, identificaciones, unidades, campos obligatorios y número frente a letras.
- [x] Una reparación automática nunca sustituye un valor jurídico sin dejar registro.
- [x] Los errores aparecen en el modal o tarjeta correspondiente.

**Verificación:** suite de contratos y casos límite por extractor.

### Checkpoint de Fase 4

- [x] Los tres subconjuntos se procesan de extremo a extremo.
- [x] Ningún extractor depende de RAG para cubrir exhaustivamente los archivos.
- [x] Las salidas están versionadas, validadas y listas para revisión humana.

---

# Fase 5 — Revisión persistente, consolidación y Excel

## HU-V2-042 — TanStack Table conectado a resultados reales

**Historia:** Como revisor, quiero que las tablas del prototipo carguen resultados reales y sus contratos de columnas para trabajar con la misma experiencia validada.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-024, HU-V2-041

**Criterios de aceptación:**

- [x] Cada tabla carga la versión correcta del grupo o consolidado.
- [x] Los tipos y validaciones provienen de contratos versionados.
- [x] Estados de carga, vacío, error y conflicto son accesibles.
- [x] La virtualización se evalúa y activa si el volumen real lo exige.

**Verificación:** datasets reales pequeños y máximos esperados.

## HU-V2-043 — Autoguardado y concurrencia de edición

**Historia:** Como revisor, quiero que mis correcciones permanezcan y no sobrescriban cambios de otra persona para editar con confianza.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** HU-V2-024, HU-V2-042

**Criterios de aceptación:**

- [x] Las ediciones se guardan con indicador visible y reintento seguro.
- [x] Cada escritura usa versión o control optimista de concurrencia.
- [x] Un conflicto presenta opciones de recargar o conservar una propuesta, sin sobrescribir silenciosamente.
- [x] Cerrar y reabrir conserva el último borrador autorizado.

**Verificación:** pérdida de red, edición simultánea y reapertura de modal.

## HU-V2-044 — Aprobación y reproceso de versiones reales

**Historia:** Como aprobador, quiero aprobar o reprocesar una versión exacta para asegurar que la decisión corresponda a los valores revisados.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-043

**Criterios de aceptación:**

- [x] No se aprueba con cambios sin guardar o validaciones críticas pendientes.
- [x] Reprocesar crea una nueva ejecución y no elimina correcciones históricas.
- [x] La nueva salida puede compararse con la versión revisada anterior.
- [x] La acción queda auditada con usuario, fecha y versión.

**Verificación:** aprobación, reproceso, salida nueva y permisos insuficientes.

## HU-V2-045 — Consolidación versionada del predio

**Historia:** Como analista, quiero combinar las tres versiones aprobadas en un registro maestro para revisar la información completa antes de generar documentos.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** HU-V2-025, HU-V2-044

**Criterios de aceptación:**

- [x] La ejecución referencia las tres versiones exactas aprobadas.
- [x] Las reglas deterministas preceden cualquier reducción asistida por IA.
- [x] Los valores repetibles no se pierden al formar el registro maestro.
- [x] Repetir consolidación crea una nueva versión y conserva la anterior.

**Verificación:** consolidación completa, cambio aguas arriba y discrepancias.

## HU-V2-046 — Generación y descarga del Excel consolidado

**Historia:** Como analista, quiero descargar el consolidado aprobado en Excel para usarlo como entregable estructurado del expediente.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-045

**Criterios de aceptación:**

- [x] El XLSX respeta encabezados, orden, tipos y formato acordados.
- [x] El archivo identifica expediente, versión, fecha y estado de aprobación.
- [x] Solo la versión vigente aprobada se ofrece como descarga principal.
- [x] Generar el archivo no modifica la información aprobada.

**Verificación:** comparación automatizada contra una plantilla de referencia.

### Checkpoint de Fase 5

- [x] Las correcciones sobreviven recargas y conflictos de edición.
- [x] Las aprobaciones e invalidaciones operan sobre versiones exactas.
- [x] El Excel se genera desde datos aprobados, no desde la tabla visual.

---

# Fase 6 — Plantillas y documento final

## HU-V2-047 — Plantilla documental versionada

**Historia:** Como administrador, quiero administrar una plantilla aprobada y su mapeo de campos para reproducir documentos y conocer qué versión se utilizó.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** Decisión sobre fidelidad DOCX; HU-V2-045

**Criterios de aceptación:**

- [x] La plantilla tiene versión, estado, campos requeridos y responsable de publicación.
- [x] Una ejecución histórica conserva la versión de plantilla utilizada.
- [x] Publicar una nueva plantilla no altera documentos anteriores.
- [x] Se valida que los campos obligatorios existan antes de generar.

**Verificación:** publicación, reemplazo y regeneración histórica.

## HU-V2-048 — Combinación determinista de campos

**Historia:** Como responsable jurídico, quiero que los datos aprobados se inserten determinísticamente en la plantilla para evitar omisiones o invenciones de la IA.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** HU-V2-046, HU-V2-047

**Criterios de aceptación:**

- [x] Los campos estructurados se reemplazan sin intervención generativa.
- [x] Los faltantes bloquean o marcan la generación según una regla explícita.
- [x] La IA se limita a secciones narrativas identificadas.
- [x] Cada sección puede rastrearse a datos, plantilla y, cuando aplique, ejecución de IA.

**Verificación:** plantilla completa, campo faltante y colección repetible.

## HU-V2-049 — Documento real editable con Tiptap

**Historia:** Como analista, quiero editar y guardar el documento generado para realizar correcciones manuales versionadas antes de finalizarlo.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** HU-V2-017, HU-V2-048

**Criterios de aceptación:**

- [x] El documento generado se transforma al esquema controlado del editor.
- [x] Guardar crea una versión o revisión auditable.
- [x] Las ediciones manuales no modifican el consolidado aprobado.
- [x] La plantilla restringe estructuras que no puedan exportarse correctamente.

**Verificación:** edición, guardado, reapertura y comparación de versiones.

## HU-V2-050 — Revisión del documento por IA con comentarios

**Historia:** Como analista, quiero pedir ajustes narrativos indicando comentarios para obtener una nueva propuesta sin perder mi documento actual.

- **Prioridad:** P1
- **Dificultad:** L
- **Dependencias:** HU-V2-049

**Criterios de aceptación:**

- [x] La solicitud conserva comentario, autor, versión fuente y alcance.
- [x] La IA devuelve una versión nueva; nunca sobrescribe la vigente.
- [x] Los datos estructurados aprobados no pueden alterarse silenciosamente mediante una revisión narrativa.
- [x] El usuario puede comparar, aceptar o descartar la propuesta.

**Verificación:** cambio aceptado, descartado e intento de alterar un campo protegido.

## HU-V2-051 — PDF final y artefactos vinculados

**Historia:** Como usuario, quiero descargar el PDF final y el Excel consolidado de la misma versión para entregar un paquete coherente y trazable.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** HU-V2-046, HU-V2-049

**Criterios de aceptación:**

- [x] El PDF respeta el diseño aprobado de la plantilla soportada.
- [x] PDF y XLSX registran expediente, versiones de origen y fecha de generación.
- [x] Los enlaces de descarga son privados y temporales.
- [x] Una invalidación posterior marca ambos artefactos como no vigentes sin borrarlos.

**Verificación:** comparación visual del PDF, permisos y caducidad de enlaces.

### Checkpoint de Fase 6

- [x] El consolidado aprobado genera un documento editable y versionado.
- [x] Los cambios de IA son propuestas comparables.
- [x] PDF y Excel pertenecen a una misma línea de versiones aprobadas.

---

# Fase 7 — Migración, retiro del flujo anterior y endurecimiento

## HU-V2-052 — Migración controlada de expedientes existentes

**Historia:** Como administrador, quiero clasificar o migrar los datos existentes al modelo de un predio por expediente para conservar información válida sin mezclar gestiones.

- **Prioridad:** P1
- **Dificultad:** L
- **Dependencias:** Fases 2 a 6 completas

**Criterios de aceptación:**

- [x] Se genera un diagnóstico antes de modificar datos.
- [x] Los proyectos con varios predios se dividen o se mantienen en solo lectura según decisión aprobada.
- [x] La migración es repetible, auditable y cuenta con reversión probada.
- [x] Ningún archivo o aprobación se reasigna silenciosamente.

**Verificación:** ensayo sobre copia de datos y reconciliación de conteos.

## HU-V2-053 — Retiro de navegación y pantallas obsoletas

**Historia:** Como usuario, quiero una navegación alineada con el nuevo flujo para no encontrar monitor, revisión, negociación, excepciones o cierre duplicados.

- **Prioridad:** P1
- **Dificultad:** M
- **Dependencias:** HU-V2-052 y aprobación funcional del nuevo flujo

**Criterios de aceptación:**

- [x] Se retiran de la subnavegación las vistas reemplazadas.
- [x] Monitor, revisión, negociación, excepciones y entregables dejan de ser rutas activas solo cuando su reemplazo está operativo.
- [x] Los enlaces antiguos redirigen de forma controlada a la vista equivalente de la ficha.
- [x] Componentes y estilos sin uso se eliminan después de comprobar referencias.

**Verificación:** inventario de rutas, enlaces directos y búsqueda de código huérfano.

## HU-V2-054 — Autorizaciones finales por acción

**Historia:** Como administrador, quiero permisos diferenciados para cargar, procesar, editar, aprobar, configurar y descargar para aplicar separación de responsabilidades.

- **Prioridad:** P0
- **Dificultad:** M
- **Dependencias:** HU-V2-026, flujo final aprobado

**Criterios de aceptación:**

- [x] Los permisos se validan tanto en UI como en servidor.
- [x] Un operador no puede aprobar si su rol no lo permite.
- [x] Un auditor puede consultar versiones y eventos sin editar.
- [x] Acciones no autorizadas no se ocultan como única defensa: el servidor las rechaza.

**Verificación:** matriz automatizada de rol por acción.

## HU-V2-055 — Pruebas integrales y accesibilidad

**Historia:** Como responsable de calidad, quiero pruebas del recorrido completo y sus fallos para liberar el nuevo flujo con confianza.

- **Prioridad:** P0
- **Dificultad:** L
- **Dependencias:** HU-V2-051, HU-V2-054

**Criterios de aceptación:**

- [x] Existe una prueba end-to-end de carga → análisis → revisión → aprobación → consolidación → documento → descarga.
- [x] Se prueban timeout, duplicado, worker detenido, archivo corrupto, salida inválida y edición concurrente.
- [x] Las pantallas y modales cumplen navegación de teclado, foco, nombres y mensajes accesibles.
- [x] La regresión cubre invalidación después de agregar un documento.

**Verificación:** suite E2E, pruebas de componentes, auditoría accesible y `npm run verify`.

## HU-V2-056 — Observabilidad, costos y preparación productiva

**Historia:** Como responsable técnico, quiero observar tiempos, errores y consumo por etapa para operar el sistema y controlar costos sin registrar contenido sensible.

- **Prioridad:** P1
- **Dificultad:** L
- **Dependencias:** HU-V2-030 a HU-V2-055

**Criterios de aceptación:**

- [x] Se registran métricas de cola, duración, reintentos, caché, tokens, costos y tasa de error.
- [x] Logs y métricas no contienen texto jurídico, documentos ni datos personales innecesarios.
- [x] Existen alertas para trabajos atascados, fallos repetidos y consumo anómalo.
- [x] El runbook incluye recuperación, despliegue y reversión.

**Verificación:** simulación de incidentes, revisión de logs y pruebas de alertas.

### Checkpoint de Fase 7

- [x] El flujo anterior está retirado sin enlaces rotos.
- [x] Los datos migrados están reconciliados.
- [x] Seguridad, accesibilidad, resiliencia y observabilidad cumplen la definición de terminado.

---

# Dependencias resumidas

```text
FASE 1 — Prototipo frontend
HU-V2-001 → HU-V2-002 → HU-V2-003/HU-V2-004
HU-V2-004 → HU-V2-005/HU-V2-006/HU-V2-007 → HU-V2-008 → HU-V2-009
HU-V2-010 → HU-V2-011
HU-V2-009 + HU-V2-011 → HU-V2-012 → HU-V2-013 → HU-V2-014 → HU-V2-015
HU-V2-015 → HU-V2-016 → HU-V2-017 → HU-V2-018
HU-V2-015 + HU-V2-017 → HU-V2-019
HU-V2-003..HU-V2-019 → HU-V2-020

FASE 2 — Dominio
HU-V2-021 → HU-V2-022 → HU-V2-023 → HU-V2-024 → HU-V2-025 → HU-V2-026

FASE 3 — Procesamiento
HU-V2-022 + HU-V2-026 → HU-V2-027 → HU-V2-028
HU-V2-023 + HU-V2-027 → HU-V2-029 → HU-V2-030 → HU-V2-031/HU-V2-033
HU-V2-028 + HU-V2-030 → HU-V2-032

FASE 4 — Extractores
HU-V2-027 + HU-V2-030 → HU-V2-034 → HU-V2-035/HU-V2-036
HU-V2-034 + HU-V2-035 → HU-V2-037 → HU-V2-038/HU-V2-039
HU-V2-036 → HU-V2-040
HU-V2-038 + HU-V2-039 + HU-V2-040 → HU-V2-041

FASE 5 — Revisión y consolidación
HU-V2-024 + HU-V2-041 → HU-V2-042 → HU-V2-043 → HU-V2-044 → HU-V2-045 → HU-V2-046

FASE 6 — Documento final
HU-V2-045 → HU-V2-047 → HU-V2-048 → HU-V2-049 → HU-V2-050
HU-V2-046 + HU-V2-049 → HU-V2-051

FASE 7 — Cierre
Fases 2..6 → HU-V2-052 → HU-V2-053
HU-V2-026 → HU-V2-054
HU-V2-051 + HU-V2-054 → HU-V2-055 → HU-V2-056
```

## 7. Orden recomendado de ejecución y paralelización

| Tramo | Trabajo secuencial obligatorio | Trabajo paralelizable después del contrato |
|---|---|---|
| Prototipo | Navegación → estados → composición de pantallas | Tarjetas de Títulos, Planos y Negociación; TanStack y Tiptap tras definir sus adaptadores. |
| Dominio | Expediente → grupos → ejecuciones → versiones → invalidación | RLS y auditoría pueden avanzar cuando el esquema se estabilice. |
| Procesamiento | API de cola → worker → progreso | Carga reanudable, caché y presentación de errores. |
| Extracción | Representación canónica → segmentación | Extractores de Títulos, Planos y Negociación. |
| Consolidación | Aprobaciones → consolidación → Excel | Persistencia de la tabla y pruebas de contratos. |
| Documento | Plantilla → combinación → editor → artefactos | Revisión por IA y pruebas visuales de PDF. |

## 8. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Confundir un prototipo simulado con procesamiento real | Alto | Etiqueta de modo demo, repositorio aislado y ausencia de escrituras remotas. |
| Intentar procesar todos los archivos en una petición | Alto | Cola durable, tareas por archivo/fragmento y worker externo. |
| Usar RAG como única fuente de extracción | Alto | Cobertura exhaustiva, segmentación y reducción jerárquica. |
| Pérdida de correcciones humanas | Alto | Versiones inmutables, autoguardado y concurrencia optimista. |
| Documento desactualizado tras una nueva carga | Alto | Invalidación transaccional de todos los descendientes. |
| Esperar fidelidad Word de Tiptap | Alto | Limitar la plantilla a estructuras soportadas o evaluar ONLYOFFICE/Collabora antes de prometer DOCX exacto. |
| Crecimiento de costos de IA | Medio/alto | Hash, caché versionada, procesamiento determinista y métricas de consumo. |
| Retirar pantallas actuales demasiado pronto | Medio | Mantenerlas hasta completar migración, pruebas y redirecciones. |

## 9. Decisiones pendientes antes de la fase correspondiente

1. **Antes de Fase 2:** contrato definitivo de campos del expediente y reglas de migración de proyectos con varios predios.
2. **Antes de Fase 4:** ejemplos reales y columnas definitivas para Títulos, Planos, Negociación y Consolidado.
3. **Antes de Fase 4:** proveedor o proveedores de IA, política de tratamiento de información y objetivo de tiempo de respuesta.
4. **Antes de Fase 6:** confirmar si el entregable requiere DOCX descargable y fidelidad exacta con Word, o si PDF desde plantilla web controlada es suficiente.
5. **Antes de Fase 6:** definir qué secciones son reemplazo determinista y cuáles pueden ser redactadas por IA.
6. **Antes de Fase 7:** estrategia para expedientes históricos incompatibles con la regla de un predio.

## 10. Definición de terminado por historia

Una historia solo se considera terminada cuando:

- [ ] Cumple todos sus criterios de aceptación.
- [ ] Tiene pruebas proporcionales al riesgo.
- [ ] Mantiene `npm run verify` en verde para cambios frontend.
- [ ] Incluye estados de carga, vacío, error, éxito y acceso denegado cuando apliquen.
- [ ] Es navegable por teclado y conserva foco visible.
- [ ] No expone secretos ni contenido jurídico en logs.
- [ ] Documenta migraciones, variables o decisiones nuevas.
- [ ] No rompe funcionalidades existentes fuera de su alcance.
