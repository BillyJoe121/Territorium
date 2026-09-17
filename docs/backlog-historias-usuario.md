# Backlog de historias de usuario de Territorium

## Alcance y convenciones

Este backlog cubre todo el alcance conocido al 17 de septiembre de 2026: los tres extractores identificados en los insumos (estudios de títulos, planos y negociación), consolidación predial, revisión jurídica, Excel, formatos posteriores y operación de la plataforma. Las historias cuyo insumo o regla de negocio aún no existe se mantienen como pendientes explícitos; no autorizan inventar la regla.

- **P0**: necesario para el primer flujo operativo seguro.
- **P1**: segunda entrega, necesaria para ampliar el proceso.
- **P2**: mejora posterior o requiere una decisión de negocio externa.
- **Origen PMO**: `Reutilizar`, `Adaptar` o `Nuevo`.
- Todos los estados aprobados son humanos; la IA nunca aprueba, firma ni sustituye el criterio jurídico.

## E01 Seguridad, usuarios y acceso

| ID | Pri. | Origen PMO | Historia de usuario |
|---|---|---|---|
| US-001 | P0 | Reutilizar | Como usuario, quiero iniciar y cerrar sesión para acceder únicamente a mis proyectos autorizados. |
| US-002 | P0 | Adaptar | Como administrador, quiero invitar, activar, desactivar y recuperar el acceso de usuarios sin compartir credenciales. |
| US-003 | P0 | Nuevo | Como administrador, quiero asignar los roles administrador, operador, analista predial, revisor jurídico, aprobador y auditor para aplicar permisos mínimos. |
| US-004 | P0 | Nuevo | Como usuario, quiero ver solo los proyectos, lotes, predios y documentos para los que tengo autorización. |
| US-005 | P0 | Adaptar | Como usuario, quiero que las rutas protegidas muestren carga, acceso denegado y sesión expirada de forma comprensible. |
| US-006 | P0 | Nuevo | Como responsable de seguridad, quiero que toda Edge Function valide identidad y autorización por proyecto antes de usar privilegios de servicio. |
| US-007 | P0 | Nuevo | Como usuario autorizado, quiero descargar documentos mediante enlaces temporales y privados. |
| US-008 | P1 | Nuevo | Como administrador, quiero configurar duración de sesión, MFA y orígenes web permitidos según la política corporativa. |
| US-009 | P1 | Nuevo | Como auditor, quiero consultar quién accedió, descargó, corrigió o aprobó datos sensibles. |
| US-010 | P2 | Nuevo | Como administrador, quiero integrar el proveedor corporativo de identidad si la empresa lo define. |

## E02 Proyectos, participantes y ciclo de vida

| ID | Pri. | Origen PMO | Historia de usuario |
|---|---|---|---|
| US-011 | P0 | Adaptar | Como operador, quiero crear un proyecto territorial con nombre, cliente, ubicación, línea/proyecto eléctrico y responsables. |
| US-012 | P0 | Adaptar | Como líder, quiero editar los metadatos del proyecto sin modificar sus extracciones históricas. |
| US-013 | P0 | Adaptar | Como usuario, quiero listar, buscar y filtrar proyectos por estado, responsable, cliente y fecha. |
| US-014 | P0 | Adaptar | Como administrador, quiero asignar y retirar participantes y sus roles por proyecto. |
| US-015 | P0 | Adaptar | Como líder, quiero archivar un proyecto de forma recuperable, no eliminarlo físicamente. |
| US-016 | P1 | Nuevo | Como líder, quiero duplicar la configuración de un proyecto sin copiar documentos ni datos personales. |
| US-017 | P1 | Nuevo | Como auditor, quiero ver el estado general del proyecto: sin lotes, en carga, en revisión, aprobado, exportado o archivado. |

## E03 Lotes, carga y manifiesto de insumos

| ID | Pri. | Origen PMO | Historia de usuario |
|---|---|---|---|
| US-018 | P0 | Adaptar | Como operador, quiero crear un lote dentro de un proyecto para procesar una entrega concreta y mantenerla separada de otras entregas. |
| US-019 | P0 | Adaptar | Como operador, quiero cargar archivos por arrastre, selección múltiple y carpeta comprimida cuando el navegador lo permita. |
| US-020 | P0 | Adaptar | Como operador, quiero clasificar cada archivo como estudio de títulos, plano, linderos, plantilla de negociación u otro insumo. |
| US-021 | P0 | Nuevo | Como operador, quiero indicar o importar la lista esperada de predios para que el sistema compare insumos esperados contra recibidos. |
| US-022 | P0 | Nuevo | Como sistema, quiero validar extensión, tipo MIME, tamaño, archivo vacío y archivo dañado antes de crear trabajos. |
| US-023 | P0 | Nuevo | Como sistema, quiero calcular hash y detectar archivos duplicados dentro del lote y contra lotes anteriores. |
| US-024 | P0 | Nuevo | Como operador, quiero que un duplicado pueda omitirse, reemplazarse o conservarse como nueva versión con una decisión explícita. |
| US-025 | P0 | Nuevo | Como sistema, quiero normalizar nombres de archivo para compararlos sin perder el nombre original. |
| US-026 | P0 | Nuevo | Como operador, quiero asociar manualmente un archivo a un predio cuando el identificador no pueda deducirse del nombre. |
| US-027 | P0 | Nuevo | Como sistema, quiero reconocer variantes de identificador como `SAN-CIM-036A` y `SAN-CIM-036B` sin fusionarlas. |
| US-028 | P0 | Nuevo | Como operador, quiero revisar un manifiesto antes de procesar que muestre recibidos, faltantes, duplicados, no compatibles y sin predio asociado. |
| US-029 | P0 | Nuevo | Como sistema, quiero bloquear el inicio del lote cuando existan errores críticos del manifiesto y permitir procesar con advertencias aprobadas. |
| US-030 | P1 | Nuevo | Como operador, quiero cargar una nueva versión de un documento conservando la anterior y su historial. |
| US-031 | P1 | Nuevo | Como administrador, quiero limitar cantidad, tamaño y tipo de archivos por lote para proteger la plataforma. |
| US-032 | P2 | Nuevo | Como operador, quiero importar manifiestos desde Excel cuando exista una plantilla aprobada. |

## E04 Almacenamiento y preprocesamiento documental

| ID | Pri. | Origen PMO | Historia de usuario |
|---|---|---|---|
| US-033 | P0 | Adaptar | Como sistema, quiero guardar el path privado estable del objeto, no una URL firmada, para que el acceso no caduque en la base de datos. |
| US-034 | P0 | Nuevo | Como sistema, quiero crear enlaces firmados únicamente cuando un usuario o worker autorizado necesite leer un archivo. |
| US-035 | P0 | Nuevo | Como sistema, quiero limpiar de forma compensatoria los objetos subidos si falla el registro del documento y viceversa. |
| US-036 | P0 | Nuevo | Como sistema, quiero extraer metadatos de archivo, páginas, checksum y fecha de carga para trazabilidad. |
| US-037 | P0 | Nuevo | Como operador, quiero saber si un PDF tiene texto seleccionable, es escaneado o necesita OCR. |
| US-038 | P0 | Nuevo | Como sistema, quiero aplicar OCR solo cuando sea necesario y señalar que el texto proviene de OCR. |
| US-039 | P0 | Nuevo | Como sistema, quiero convertir Word/PDF a una representación de trabajo sin alterar el archivo original. |
| US-040 | P0 | Nuevo | Como sistema, quiero detectar páginas ilegibles, protegidas por contraseña o sin contenido y enviarlas a excepción. |
| US-041 | P1 | Nuevo | Como responsable de seguridad, quiero analizar archivos cargados con la política antivirus que defina la empresa. |
| US-042 | P1 | Nuevo | Como administrador, quiero configurar retención, archivado y borrado seguro de originales, derivados y exportaciones. |

## E05 Trabajos, colas y recuperación ante fallos

| ID | Pri. | Origen PMO | Historia de usuario |
|---|---|---|---|
| US-043 | P0 | Adaptar | Como operador, quiero iniciar un proceso de extracción y ver sus estados pendiente, en cola, procesando, requiere revisión, fallido, cancelado y finalizado. |
| US-044 | P0 | Adaptar | Como sistema, quiero crear trabajos independientes por documento y extractor para que un fallo no detenga el lote completo. |
| US-045 | P0 | Nuevo | Como sistema, quiero ejecutar estudios de títulos y planos en paralelo cuando no exista dependencia entre ellos. |
| US-046 | P0 | Nuevo | Como sistema, quiero ejecutar negociación solo cuando sus insumos y dependencias estén completos. |
| US-047 | P0 | Adaptar | Como usuario, quiero cancelar un trabajo y asegurar que un resultado tardío no sobrescriba el estado cancelado. |
| US-048 | P0 | Adaptar | Como usuario, quiero reprocesar un documento, predio o extractor sin repetir todo el lote. |
| US-049 | P0 | Nuevo | Como sistema, quiero usar una clave idempotente para impedir que un doble clic o reintento cree resultados duplicados. |
| US-050 | P0 | Nuevo | Como sistema, quiero reintentar solo errores transitorios con límite, espera incremental y registro de intentos. |
| US-051 | P0 | Nuevo | Como operador, quiero que errores permanentes o agotados lleguen a una bandeja de excepciones con causa y acción sugerida. |
| US-052 | P0 | Nuevo | Como sistema, quiero limitar concurrencia por lote y por proveedor de IA para evitar saturación y sobrecostos. |
| US-053 | P1 | Nuevo | Como supervisor, quiero pausar y reanudar un lote sin perder sus trabajos ya terminados. |
| US-054 | P1 | Nuevo | Como administrador, quiero reintentar o descartar manualmente un trabajo de excepción. |
| US-055 | P1 | Nuevo | Como sistema, quiero recuperar trabajos interrumpidos por despliegue, reinicio o timeout del worker. |

## E06 Configuración de extractores, prompts y modelos

| ID | Pri. | Origen PMO | Historia de usuario |
|---|---|---|---|
| US-056 | P0 | Adaptar | Como administrador, quiero configurar proveedor, modelo y parámetros permitidos para cada extractor. |
| US-057 | P0 | Adaptar | Como administrador, quiero crear versiones de prompt sin alterar ejecuciones aprobadas. |
| US-058 | P0 | Nuevo | Como administrador, quiero definir el contrato de salida JSON y reglas de validación para cada extractor. |
| US-059 | P0 | Adaptar | Como sistema, quiero registrar modelo solicitado, modelo usado, fallback, timeout, tokens y error por ejecución. |
| US-060 | P0 | Adaptar | Como sistema, quiero intentar un proveedor/modelo alterno solo para fallos transitorios configurados. |
| US-061 | P0 | Nuevo | Como sistema, quiero rechazar una salida que no cumpla el contrato antes de consolidarla. |
| US-062 | P0 | Nuevo | Como administrador, quiero probar un prompt con insumos de prueba sin escribir datos productivos. |
| US-063 | P1 | Nuevo | Como administrador, quiero comparar resultados de dos versiones de prompt sobre el mismo conjunto de prueba. |
| US-064 | P1 | Nuevo | Como administrador, quiero definir presupuestos y topes de costo por proyecto, lote y ejecución. |
| US-065 | P1 | Nuevo | Como administrador, quiero deshabilitar un extractor o modelo sin desplegar código. |

## E07 Extracción de estudios de títulos

| ID | Pri. | Origen PMO | Historia de usuario |
|---|---|---|---|
| US-066 | P0 | Nuevo | Como analista, quiero extraer matrícula, cédula catastral, propietarios actuales, documento e identificación del predio desde el estudio de títulos. |
| US-067 | P0 | Nuevo | Como analista, quiero extraer ubicación, nombre del predio, área en números y letras, y oficina de registro. |
| US-068 | P0 | Nuevo | Como analista, quiero que el sistema redacte modo de adquisición a partir de los actos y anotaciones encontrados, preservando su orden cronológico. |
| US-069 | P0 | Nuevo | Como revisor jurídico, quiero que propietarios históricos no se presenten como propietarios actuales. |
| US-070 | P0 | Nuevo | Como revisor jurídico, quiero transcripción literal de linderos, sin resumen, junto con el documento fuente. |
| US-071 | P0 | Nuevo | Como sistema, quiero marcar linderos largos, incompletos o posiblemente resumidos para revisión obligatoria. |
| US-072 | P0 | Nuevo | Como analista, quiero extraer gravámenes, limitaciones y medidas cautelares vigentes o declarar `sin condiciones jurídicas vigentes` conforme a la regla aprobada. |
| US-073 | P0 | Nuevo | Como analista, quiero extraer radicados y dirección territorial de consultas cuando aparezcan, y usar `no identificado` cuando la regla lo ordene. |
| US-074 | P0 | Nuevo | Como revisor, quiero ver documento, página/sección y texto fuente que soportan cada atributo extraído. |
| US-075 | P0 | Nuevo | Como sistema, quiero preferir Word sobre PDF cuando ambos documenten el mismo estudio y dejar constancia de la elección. |
| US-076 | P1 | Nuevo | Como revisor, quiero comparar visualmente el lindero extraído contra su fuente antes de aprobarlo. |
| US-077 | P1 | Nuevo | Como administrador, quiero ajustar campos, instrucciones y reglas de este extractor mediante una versión de configuración. |

## E08 Extracción técnica de planos

| ID | Pri. | Origen PMO | Historia de usuario |
|---|---|---|---|
| US-078 | P0 | Nuevo | Como analista, quiero extraer nombre de plano, área, longitud, ancho, infraestructura/postes y escala. |
| US-079 | P0 | Nuevo | Como analista, quiero conservar valores en números y en letras cuando el plano los proporcione o el proceso los requiera. |
| US-080 | P0 | Nuevo | Como sistema, quiero conservar unidades y distinguir m, m2, hectáreas, cantidades y escalas. |
| US-081 | P0 | Nuevo | Como revisor, quiero saber qué página o zona del plano soporta cada valor técnico. |
| US-082 | P0 | Nuevo | Como sistema, quiero marcar una medida ambigua, ilegible o inconsistente en lugar de inferirla silenciosamente. |
| US-083 | P0 | Nuevo | Como sistema, quiero relacionar el plano con el predio correcto y detectar planos sin estudio o estudios sin plano. |
| US-084 | P1 | Nuevo | Como revisor, quiero corregir manualmente valores técnicos y registrar la razón. |
| US-085 | P1 | Nuevo | Como sistema, quiero validar coherencia configurable entre área, longitud y ancho sin reemplazar el valor fuente. |
| US-086 | P1 | Nuevo | Como operador, quiero procesar grupos grandes de planos y obtener una salida individual por plano y consolidada por lote. |

## E09 Extracción de plantilla de negociación

| ID | Pri. | Origen PMO | Historia de usuario |
|---|---|---|---|
| US-087 | P1 | Nuevo | Como analista, quiero identificar el insumo de negociación aprobado antes de habilitar este extractor. |
| US-088 | P1 | Nuevo | Como analista, quiero extraer las tres ofertas por predio en números y letras. |
| US-089 | P1 | Nuevo | Como sistema, quiero verificar y reportar la coincidencia entre el valor numérico y su expresión en letras. |
| US-090 | P1 | Nuevo | Como revisor, quiero ver las celdas o evidencia de origen de cada oferta. |
| US-091 | P1 | Nuevo | Como sistema, quiero marcar predios sin oferta, con oferta duplicada o con rango económico incompleto. |
| US-092 | P1 | Nuevo | Como revisor, quiero aprobar o corregir los valores sin modificar el archivo fuente. |
| US-093 | P2 | Nuevo | Como administrador, quiero parametrizar las reglas de cálculo de oferta si Territorium las formaliza. |

## E10 Registro maestro y conciliación por predio

| ID | Pri. | Origen PMO | Historia de usuario |
|---|---|---|---|
| US-094 | P0 | Adaptar | Como sistema, quiero crear un registro maestro versionado por predio y lote. |
| US-095 | P0 | Nuevo | Como sistema, quiero consolidar atributos jurídicos, técnicos, económicos y manuales en el esquema equivalente a `CORRESPONDENCIA.xlsx`. |
| US-096 | P0 | Nuevo | Como sistema, quiero usar identificadores estables para unir fuentes y no depender únicamente del nombre de archivo. |
| US-097 | P0 | Nuevo | Como revisor, quiero ver conflictos entre fuentes sin que el sistema elija automáticamente un valor jurídico. |
| US-098 | P0 | Nuevo | Como sistema, quiero comparar cantidad de predios esperados, recibidos, procesados y consolidados. |
| US-099 | P0 | Nuevo | Como supervisor, quiero bloquear una exportación final si existen predios faltantes, duplicados o conflictos críticos sin resolver. |
| US-100 | P0 | Nuevo | Como analista, quiero completar manualmente los campos que el esquema maestro declara manuales: datos corporativos comunes, resultado de negociación y datos personales autorizados. |
| US-101 | P0 | Nuevo | Como sistema, quiero mantener separado el valor original de IA, el valor manual y el valor aprobado. |
| US-102 | P1 | Nuevo | Como revisor, quiero crear un registro manual para un predio que no tenga una fuente procesable, dejando la causa. |
| US-103 | P1 | Nuevo | Como analista, quiero importar campos aprobados desde una base maestra existente usando una asignación de columnas revisable. |
| US-104 | P1 | Nuevo | Como supervisor, quiero comparar dos versiones del registro maestro de un mismo lote. |

## E11 Revisión jurídica, excepciones y aprobación

| ID | Pri. | Origen PMO | Historia de usuario |
|---|---|---|---|
| US-105 | P0 | Adaptar | Como revisor, quiero una bandeja de pendientes filtrable por proyecto, lote, predio, extractor, severidad y estado. |
| US-106 | P0 | Adaptar | Como revisor, quiero abrir un predio y comparar atributo, valor extraído, evidencia fuente, confianza/regla y estado. |
| US-107 | P0 | Nuevo | Como revisor, quiero corregir un atributo y registrar motivo, autor, fecha y valor previo. |
| US-108 | P0 | Adaptar | Como revisor, quiero aprobar, rechazar o devolver un predio para reproceso. |
| US-109 | P0 | Nuevo | Como sistema, quiero exigir revisión jurídica para linderos, gravámenes/limitaciones y conflictos de titularidad. |
| US-110 | P0 | Nuevo | Como sistema, quiero impedir que un atributo aprobado sea sobrescrito por una nueva ejecución sin una nueva revisión explícita. |
| US-111 | P0 | Nuevo | Como revisor, quiero agregar comentarios y solicitar cambios con contexto de campo. |
| US-112 | P1 | Adaptar | Como supervisor, quiero asignar excepciones y revisiones a usuarios concretos. |
| US-113 | P1 | Nuevo | Como revisor, quiero aprobar en bloque únicamente atributos sin conflictos ni revisión obligatoria pendiente. |
| US-114 | P1 | Nuevo | Como auditor, quiero consultar el historial completo de cambios y aprobaciones de cada atributo. |
| US-115 | P2 | Nuevo | Como aprobador, quiero aplicar firma electrónica si la empresa define proveedor, política y valor jurídico. |

## E12 Exportaciones y documentos jurídicos

| ID | Pri. | Origen PMO | Historia de usuario |
|---|---|---|---|
| US-116 | P0 | Nuevo | Como analista, quiero descargar el Excel consolidado con el orden, encabezados y formato aprobado. |
| US-117 | P0 | Nuevo | Como usuario, quiero exportar solo predios aprobados o descargar un reporte de pendientes y excepciones. |
| US-118 | P0 | Nuevo | Como auditor, quiero que cada exportación incluya versión de lote, fecha, usuario y criterios de inclusión. |
| US-119 | P1 | Nuevo | Como analista, quiero generar oferta económica por predio solo con datos aprobados. |
| US-120 | P1 | Nuevo | Como analista, quiero generar acta de acuerdo por predio solo con datos aprobados. |
| US-121 | P1 | Nuevo | Como analista, quiero generar bitácora predial por predio solo con datos aprobados. |
| US-122 | P1 | Nuevo | Como analista, quiero generar poder, promesa y escritura pública desde plantillas aprobadas. |
| US-123 | P1 | Nuevo | Como sistema, quiero validar campos obligatorios de cada plantilla antes de generar un documento. |
| US-124 | P1 | Nuevo | Como usuario, quiero previsualizar el documento generado antes de descargarlo. |
| US-125 | P1 | Nuevo | Como sistema, quiero conservar versión de plantilla, datos de origen y documento generado. |
| US-126 | P1 | Nuevo | Como analista, quiero generar documentos seleccionados en lote y descargarlos en un paquete. |
| US-127 | P1 | Nuevo | Como sistema, quiero informar campos faltantes o conflictos que impiden generar cada documento. |
| US-128 | P2 | Nuevo | Como administrador, quiero administrar plantillas Word/Excel y mapear sus campos sin desplegar código. |

## E13 Notificaciones, auditoría y reportes operativos

| ID | Pri. | Origen PMO | Historia de usuario |
|---|---|---|---|
| US-129 | P0 | Adaptar | Como usuario, quiero recibir una notificación cuando el lote termine, falle o requiera revisión. |
| US-130 | P0 | Nuevo | Como sistema, quiero registrar eventos de carga, ejecución, fallback, error, corrección, aprobación y exportación. |
| US-131 | P0 | Nuevo | Como supervisor, quiero ver métricas de completitud: insumos esperados, recibidos, procesados, aprobados y fallidos. |
| US-132 | P0 | Nuevo | Como supervisor, quiero identificar lotes con discrepancias como “52 insumos y 48 resultados”. |
| US-133 | P1 | Adaptar | Como administrador, quiero consultar duración, reintentos, proveedor, modelo, consumo y costo estimado de cada ejecución. |
| US-134 | P1 | Nuevo | Como auditor, quiero generar un reporte de trazabilidad por predio y atributo. |
| US-135 | P1 | Nuevo | Como líder, quiero filtrar y exportar métricas operativas por periodo, proyecto y extractor. |
| US-136 | P2 | Nuevo | Como sistema, quiero enviar notificaciones a los canales corporativos que la empresa autorice. |

## E14 Administración, operación y continuidad

| ID | Pri. | Origen PMO | Historia de usuario |
|---|---|---|---|
| US-137 | P0 | Adaptar | Como administrador, quiero administrar usuarios, roles, modelos, prompts y límites desde una interfaz protegida. |
| US-138 | P0 | Nuevo | Como administrador, quiero observar cola, trabajos activos, antigüedad, fallos, reintentos y excepciones. |
| US-139 | P0 | Nuevo | Como operador, quiero recibir un mensaje accionable cuando un proveedor de IA, storage o worker no esté disponible. |
| US-140 | P0 | Nuevo | Como sistema, quiero separar entornos de desarrollo, pruebas y producción con secretos fuera del repositorio. |
| US-141 | P0 | Nuevo | Como responsable técnico, quiero tener migraciones reproducibles de base de datos, políticas RLS, buckets y configuraciones mínimas. |
| US-142 | P1 | Nuevo | Como administrador, quiero ejecutar respaldos y restauraciones probadas de datos, archivos y configuraciones. |
| US-143 | P1 | Nuevo | Como responsable técnico, quiero desplegar worker y aplicación con health checks, logs y rollback. |
| US-144 | P1 | Nuevo | Como administrador, quiero configurar límites de retención y eliminación por proyecto conforme a la política aprobada. |
| US-145 | P2 | Nuevo | Como responsable técnico, quiero usar alertas de presupuesto y capacidad antes de agotar servicios externos. |

## E15 Calidad, pruebas y accesibilidad

| ID | Pri. | Origen PMO | Historia de usuario |
|---|---|---|---|
| US-146 | P0 | Nuevo | Como desarrollador, quiero fixtures anonimizados de estudios, planos y negociación para probar sin datos productivos. |
| US-147 | P0 | Nuevo | Como desarrollador, quiero pruebas unitarias de normalización, validación de esquema, conciliación y reglas críticas. |
| US-148 | P0 | Nuevo | Como desarrollador, quiero pruebas de integración para carga, RLS, storage, cola, worker y persistencia de resultados. |
| US-149 | P0 | Nuevo | Como desarrollador, quiero pruebas de regresión que detecten un conteo de salidas menor al número de insumos esperados. |
| US-150 | P0 | Nuevo | Como revisor, quiero pruebas de aceptación de linderos extensos, múltiples propietarios, gravámenes múltiples y datos no identificados. |
| US-151 | P0 | Adaptar | Como usuario, quiero pantallas de carga, vacío, error y éxito accesibles y comprensibles. |
| US-152 | P0 | Adaptar | Como usuario de teclado, quiero navegar carga, revisión, diálogos y exportación sin depender del mouse. |
| US-153 | P0 | Adaptar | Como usuario, quiero contraste, foco visible, mensajes de error asociados a controles y movimiento reducido cuando corresponda. |
| US-154 | P1 | Nuevo | Como desarrollador, quiero pruebas end-to-end para el recorrido cargar → procesar → revisar → aprobar → exportar. |
| US-155 | P1 | Nuevo | Como responsable técnico, quiero pruebas de falla: timeout, duplicado, worker detenido, resultado tardío, proveedor caído y archivo corrupto. |
| US-156 | P1 | Nuevo | Como responsable de seguridad, quiero pruebas de aislamiento entre proyectos y roles antes de producción. |
| US-157 | P2 | Nuevo | Como responsable técnico, quiero pruebas de carga con lotes representativos antes de aumentar concurrencia. |

## E16 Espacios de trabajo Excel y Word

Estas historias extienden la revisión y la generación documental: no autorizan modificar un archivo fuente. Todo cambio humano queda separado del valor original y conserva usuario, fecha, motivo, evidencia y versión.

| ID | Pri. | Origen PMO | Historia de usuario |
|---|---|---|
| US-158 | P0 | Nuevo | Como analista, quiero abrir el libro maestro en un visualizador tabular por hojas, con encabezados, tipos de dato y estado de cada fila, sin alterar el archivo fuente. |
| US-159 | P0 | Nuevo | Como analista autorizado, quiero editar desde la mesa Excel únicamente las celdas o atributos permitidos para completar la conciliación predial sin sobrescribir el valor original de IA ni el dato fuente. |
| US-160 | P0 | Nuevo | Como revisor, quiero que cada celda editable muestre valor de IA, valor manual, valor aprobado, evidencia, autor, fecha y motivo de cambio para decidir con trazabilidad. |
| US-161 | P0 | Nuevo | Como revisor, quiero filtrar, buscar y priorizar filas del libro por lote, predio, conflicto, estado de revisión, campo obligatorio y severidad. |
| US-162 | P0 | Nuevo | Como sistema, quiero validar en la mesa Excel tipos, listas permitidas, fórmulas aprobadas, campos obligatorios y coherencia entre número y letras, sin reemplazar silenciosamente el dato capturado. |
| US-163 | P1 | Nuevo | Como supervisor, quiero comparar dos versiones de una fila, un predio o un libro maestro y restaurar solo una propuesta revisable, preservando el historial. |
| US-164 | P1 | Nuevo | Como analista, quiero importar una base maestra externa mediante un mapeo de columnas visible en la mesa Excel, revisar sus cambios propuestos y aprobarlos antes de consolidar. |
| US-165 | P0 | Nuevo | Como revisor jurídico, quiero abrir un estudio, lindero o documento Word en un visor que preserve su estructura de páginas y secciones, sin modificar el original. |
| US-166 | P0 | Nuevo | Como revisor, quiero seleccionar un atributo y ver resaltada su evidencia en el Word o representación de trabajo, con documento, página, sección o párrafo de origen. |
| US-167 | P1 | Nuevo | Como revisor, quiero dejar anotaciones y propuestas de corrección sobre un Word, separadas del original y vinculadas al atributo, predio y evidencia correspondientes. |
| US-168 | P1 | Nuevo | Como analista, quiero previsualizar en un visor Word el documento jurídico generado desde una plantilla y conocer los campos faltantes o bloqueos antes de descargarlo. |

## E17 Experiencia de operación y sistema visual

El sistema visual debe mejorar la operación, no decorar pantallas. `shadcn/ui` se adopta como base de componentes accesibles y componibles; Lucide como iconografía y Motion/CSS como capa de movimiento. La identidad, los estados y los flujos siguen siendo propios de Territorium.

| ID | Pri. | Origen PMO | Historia de usuario |
|---|---|---|
| US-169 | P0 | Adaptar | Como usuario, quiero una interfaz consistente basada en componentes `shadcn/ui` adaptados a la marca Territorium, para que formularios, tablas, diálogos, filtros, alertas y estados se comporten de forma predecible y accesible. |
| US-170 | P0 | Nuevo | Como usuario, quiero iconografía Lucide e iconomorfismo consistente —un mismo símbolo y color para una misma acción, entidad o riesgo— para reconocer rápidamente cargar, procesar, revisar, aprobar, devolver, exportar y bloquear. |
| US-171 | P0 | Nuevo | Como usuario, quiero animaciones breves y funcionales para confirmar cambios de estado, progreso, apertura de paneles y navegación, con reducción de movimiento configurable y sin retrasar tareas críticas. |
| US-172 | P0 | Nuevo | Como líder, quiero un tablero de expediente que priorice lotes bloqueados, predios faltantes, excepciones críticas, revisiones pendientes, progreso, responsables y siguiente acción, en lugar de limitarse a contadores. |
| US-173 | P0 | Nuevo | Como operador, quiero una mesa de manifiesto antes de procesar que permita arrastrar archivos, clasificar cada uno, asociarlo a un predio y resolver duplicados, faltantes, incompatibilidades y advertencias. |
| US-174 | P0 | Nuevo | Como revisor, quiero una estación de revisión de tres paneles —bandeja priorizada, atributo editable y evidencia fuente— para resolver decisiones jurídicas con menos cambios de contexto. |
| US-175 | P1 | Adaptar | Como usuario, quiero ver siempre la jerarquía Proyecto → Expediente → Lote → Predio → Atributo mediante contexto persistente, migas de pan y navegación contextual. |
| US-176 | P1 | Adaptar | Como usuario frecuente, quiero búsqueda global y comandos rápidos para abrir un predio, lote, documento, excepción o acción permitida sin recorrer todo el menú. |
| US-177 | P1 | Nuevo | Como usuario de escritorio o tableta, quiero densidad, tamaño tipográfico, columnas y paneles adaptables a la tarea, manteniendo las decisiones críticas visibles y operables por teclado. |

## E18 Calidad semántica y recuperación de IA

Las salidas estructuradas garantizan forma, no verdad jurídica o técnica. Esta épica añade defensas posteriores a la extracción sin convertir al sistema en un decisor autónomo: las normalizaciones deben ser determinísticas, reversibles y auditables; las contradicciones materiales se marcan para revisión humana.

| ID | Pri. | Origen PMO | Historia de usuario |
|---|---|---|
| US-178 | P0 | Adaptar | Como sistema, quiero aplicar reglas determinísticas por extractor para normalizar formatos y unidades, y detectar contradicciones, rangos imposibles y campos incompatibles antes de consolidar resultados, preservando siempre el valor crudo, la regla aplicada y el motivo. |
| US-179 | P0 | Adaptar | Como sistema, quiero resolver variaciones conocidas de claves y etiquetas mediante un catálogo versionado de alias, y enviar a excepción cualquier mapeo ambiguo en lugar de adivinar un campo jurídico. |
| US-180 | P0 | Adaptar | Como sistema, quiero dividir documentos jurídicos largos en segmentos trazables por página o sección, ejecutar extracciones especializadas, conservar resultados parciales y conciliarlos sin perder su evidencia de origen. |
| US-181 | P0 | Adaptar | Como sistema, quiero evaluar la calidad semántica de una extracción y, ante confianza insuficiente o reglas críticas fallidas, ejecutar un reintento correctivo o un modelo alterno dentro de límites de costo, registrando modelo, causa, intento y resultado. |

## Orden sugerido de implementación

1. US-001 a US-007, US-011 a US-015 y US-140 a US-141: fundación segura y reproducible.
2. US-018 a US-042: proyecto, lote, manifiesto, storage y preprocesamiento.
3. US-043 a US-065: cola, worker, contratos de IA y configuración.
4. US-066 a US-086: estudios de títulos y planos, que forman el primer flujo de negocio completo.
5. US-094 a US-118: consolidación, revisión, aprobación y Excel.
6. US-158 a US-168: espacios Excel y Word, una vez que existan consolidación, evidencia y permisos de revisión.
7. US-169 a US-177: sistema visual, tablero, manifiesto y estación de revisión; se inicia con los flujos P0 para no maquillar una operación incompleta.
8. US-178 a US-181: defensas semánticas, partición y recuperación de IA, antes de habilitar extracción masiva o generación documental.
9. US-129 a US-157: observabilidad, pruebas y endurecimiento.
10. US-087 a US-093 y US-119 a US-128: negociación y generación documental, después de definir sus insumos y plantillas.

## Dependencias y decisiones abiertas

- El extractor de negociación no inicia hasta que se entregue su plantilla de entrada, prompt y regla de `COINCIDEN`.
- La generación de promesa, escritura y demás formatos requiere plantillas aprobadas y definición de campos obligatorios por formato.
- Firma electrónica, SSO, antivirus y canales de notificación requieren decisión corporativa y, si aplica, proveedor.
- Se debe definir formalmente la política de tratamiento, retención y eliminación de datos personales y documentos jurídicos antes del despliegue productivo.
- La adopción de `shadcn/ui` requiere definir el inventario inicial de componentes, tokens y variantes de Territorium; no se copiará el sistema visual ni los módulos de PMO.
- Los visores/editores de Excel y Word requieren definir la representación de trabajo, los campos editables, las validaciones y la retención de versiones antes de habilitar edición productiva.
- Las reglas de validación semántica, los umbrales de calidad, los alias permitidos, los límites de segmentos y los modelos de fallback requieren aprobación por extractor. Ninguna regla puede corregir silenciosamente un hecho jurídico o técnico material.
