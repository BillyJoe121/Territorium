# Arquitectura de producción

## Flujo

1. El usuario se autentica con Supabase Auth.
2. RLS resuelve su rol (`owner`, `operator`, `reviewer`, `viewer`) por expediente.
3. El navegador carga archivos directamente a Storage privado y registra metadatos y SHA-256.
4. La Edge Function valida la sesión y crea un trabajo idempotente.
5. El worker reclama un trabajo con `FOR UPDATE SKIP LOCKED` y lease renovable.
6. Procesa documentos en orden: estudio de títulos, plano, negociación.
7. Cada llamada usa prompt versionado y un esquema JSON estricto.
8. Los resultados se consolidan por folio; cada atributo conserva documento, extractor, evidencia y confianza.
9. La interfaz recibe cambios por Realtime, permite corrección/aprobación y registra auditoría.
10. El Excel se genera bajo demanda y neutraliza valores que podrían interpretarse como fórmulas.

## Límites de confianza

- El navegador solo usa la clave publicable y está sujeto a RLS.
- La Edge Function usa el JWT del usuario; no recibe claves privilegiadas del navegador.
- Solo el worker conserva la clave secreta de Supabase y la clave del proveedor de IA.
- Los buckets son privados y la consulta humana usa URL firmada de cinco minutos.
- La IA propone; la aprobación final es humana.
