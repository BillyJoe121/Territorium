# Comparador documental (primera versión)

## Alcance

- Un proyecto admite hasta diez documentos **activos**, PDF o DOCX de máximo 50 MB. El catálogo de tipos sigue abierto: no se inventaron diez nombres. `document_label` queda disponible para fijarlos cuando el equipo jurídico defina la lista.
- El abogado elige dos documentos distintos y solicita una comparación 1:1. Los archivos permanecen inmutables en el bucket privado `source-documents`; retirar un archivo solo lo excluye de nuevos cotejos y conserva el historial.
- Una Edge Function autentica al usuario, encola el trabajo y despierta el worker mediante el secreto ya existente. El worker extrae texto con los parsers canónicos, pide a la IA atributos con citas y comprueba cada cita y cada valor contra un fragmento real antes de publicar un resultado.
- La igualdad exacta compara los caracteres del valor literalmente. La similitud amarilla usa `SequenceMatcher >= 0.82`, pero **no equivale a conformidad jurídica**. Un valor ausente o muy diferente es rojo.
- La vista muestra ambos originales lado a lado. PDF.js renderiza el PDF; `docx-preview` renderiza el DOCX cargado, sin modificarlo. Al elegir un atributo, CSS Highlights subraya la cita verificable. Cuando no se puede localizar visualmente, la vista lo indica en vez de dibujar un subrayado ficticio.

## Puesta en marcha

1. Aplicar `supabase/migrations/20260925200751_document_comparison.sql` al proyecto Supabase correspondiente.
2. Desplegar la Edge Function `document-comparison-request`. Usa los secretos `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (o `SUPABASE_ANON_KEY`), `APP_ORIGINS`, `WORKER_WAKE_URL` y `WORKER_WAKE_TOKEN`. Los dos últimos ya se requieren para el procesamiento del expediente y **no** van al navegador.
3. Desplegar la nueva versión del worker y del frontend. El worker necesita `SUPABASE_SECRET_KEY`, proveedor IA y `EXPEDIENTE_V2_WORKER_ENABLED=true`.
4. Verificar con dos documentos de prueba que: carga 1–10, bloqueo del undécimo, rechazo de formatos distintos, cola→análisis→resultado, igualdad literal, diferencia de un carácter, campo ausente, navegación al fragmento y acceso denegado desde otro proyecto.

La migración se aplicó al proyecto remoto `sdjkcvktxtgaeqryjltv` el 25 de septiembre de 2026. La función `document-comparison-request` también está desplegada y exige JWT. Para ejecutar cotejos reales todavía se debe desplegar el código actualizado del worker en Render y configurar `WORKER_WAKE_URL` y `WORKER_WAKE_TOKEN` en los secretos de Supabase y el worker. El endpoint `/ready` solo confirma que el servicio está despierto; no comprueba que procese trabajos de comparación. La prueba de esquema local requiere Docker/Supabase local, que no estaba disponible en este entorno.

## Pareja de prueba

Los archivos ficticios `output/pdf/Comparador_A_Ficha_Titulo.pdf` y `output/docx/Comparador_B_Ficha_Registral.docx` ejercitan ambos parsers y visores. Sus valores se verificaron con los parsers del worker; las clases siguientes son las esperadas **si la IA extrae esos atributos con citas válidas**:

| Resultado | A y B |
| --- | --- |
| Verde, exacto | Titular `Ana María Torres`; matrícula `050N-1234567`; municipio `Chía`; departamento `Cundinamarca`; fecha `15/03/2024` |
| Amarillo, cercano | Dirección `Vereda Fagua, Lote 7` / `Vereda Fagua, Lote 8`; área `12,50 hectáreas` / `12,55 hectáreas` |
| Rojo, diferente | Identificación `52.123.456` / `91.987.654`; predio `La Aurora` / `El Roble` |
| Rojo, ausente | `Servidumbre inscrita: No registra` aparece solo en A; el visor B no debe dibujar una marca inventada |

El clasificador determinista produce cinco coincidencias exactas, dos cercanas, dos diferentes y una ausente para este conjunto de valores. El número de hallazgos que devuelve el modelo puede variar hasta que el catálogo jurídico se convierta en reglas obligatorias.

## Límites conscientes

- PDF escaneado sin capa de texto requiere OCR con coordenadas antes de poder subrayarse de forma fiable. Este flujo falla explícitamente con `NO_EXTRACTABLE_TEXT` en vez de inventar una ubicación. Documentos con más de 60 000 caracteres extraíbles por lado se rechazan hasta incorporar análisis por segmentos.
- `docx-preview` representa el archivo DOCX original en HTML, pero no garantiza paginación idéntica a Microsoft Word. El original descargable es la referencia autoritativa. La ubicación canónica DOCX es párrafo o tabla, no página.
- El resaltado visual depende de la API CSS Highlights del navegador y de que el texto del visor coincida con la cita canónica. Si no se encuentra, se conserva la cita y se indica la limitación.
- No se necesita entrenar una RNN. El modelo existente descubre atributos y aporta evidencia; verificación de citas, comparación literal y clasificación son deterministas. Los casos ambiguos siguen requiriendo decisión del abogado.
- Cada cotejo llama al proveedor de IA y por tanto puede generar costo por tokens. PDF.js y `docx-preview` son bibliotecas Apache-2.0; este módulo **no requiere licencia de Microsoft 365**.

## Evolución siguiente

Cuando se conozcan los diez tipos, definir un catálogo versionado (clave, nombre, campos obligatorios, pares comparables y reglas críticas), usarlo para etiquetar la carga y añadir validaciones por tipo. No convertir porcentajes de similitud de nombres o identificadores legales en aprobación automática. Para PDFs escaneados, incorporar OCR con cajas de texto y guardar coordenadas verificadas; para fidelidad visual DOCX estricta, evaluar una conversión controlada a PDF, manteniendo el DOCX fuente inmutable.
