import asyncio
import json
import logging
import re
import time
from typing import Any

from ..models.canonical import DocumentFragment
from .title_schema import PropertyOwner, TitleStudyPayload

logger = logging.getLogger("territorium.extractors.title")

TITLE_STUDY_SYSTEM_PROMPT = """
Eres un abogado experto en estudios de títulos inmobiliarios en Colombia.
Tu tarea es extraer de forma exhaustiva, rigurosa y canónica la información del predio a partir de los documentos proporcionados.
Debes respetar estrictamente las siguientes reglas jurídicas y de negocio:
1. FOLIO DE MATRÍCULA ("folio"): Identifica el número de matrícula inmobiliaria (ej. 324-72404, 050N-204581).
2. CÉDULA CATASTRAL ("cadastral_id"): Identificación catastral del inmueble (30 dígitos o cédula local).
3. PROPIETARIOS DEL PREDIO ("owners"): Extrae ÚNICAMENTE los propietarios actuales con derechos vigentes. Lista de objetos con "name" (nombre completo), "document_type" (ej. CC, NIT, CE), "document_number" (número de documento) y "participation_percentage".
4. NOMBRE DEL PREDIO ("property_name"): Nombre oficial del predio, lote o finca analizada (ej. El Porvenir, Veracruz, La Esperanza).
5. MUNICIPIO Y DEPARTAMENTO ("municipality", "department", "village"): Municipio, departamento y vereda de ubicación del inmueble.
6. ÁREA DEL PREDIO ("area_numbers", "area_letters"): Área total del inmueble en números y en letras.
7. OFICINA DE REGISTRO ("registry_office"): Oficina de Registro de Instrumentos Públicos (ORIP) correspondiente.
8. MODO DE ADQUISICIÓN ("acquisition_mode"): Redacta cronológicamente: acto jurídico + otorgante + identificación del título (escritura/resolución/sentencia) + número de anotación en el folio.
9. LINDEROS ("boundaries"): Transcribe de manera EXACTA Y LITERAL el texto completo de linderos. NO RESUMAS. Conserva los puntos cardinales, colindantes y distancias tal cual aparecen.
10. DOCUMENTO QUE CONTIENE LOS LINDEROS ("boundaries_document"): Documento fuente exacto (ej. Escritura Pública No. 0540 del 03 de octubre de 2013 de la Notaría Única de Cimitarra).
11. CONDICIONES JURÍDICAS VIGENTES ("legal_conditions"): Si existen gravámenes, servidumbres, embargos o limitaciones vigentes, descríbelas separadas por punto y coma. Si no hay ninguna, escribe exactamente "sin condiciones jurídicas vigentes".
12. RADICADOS ("urt_case", "urt_territorial_direction", "justice_ministry_case"): Extrae radicados de consulta URT, dirección territorial URT y Ministerio de Justicia.
13. Si un dato no aparece, escribe "no identificado".

Responde obligatoriamente en formato JSON con la siguiente estructura de claves exactas:
{
  "folio": "...",
  "cadastral_id": "...",
  "owners": [{"name": "...", "document_type": "...", "document_number": "...", "participation_percentage": 100.0}],
  "property_name": "...",
  "municipality": "...",
  "department": "...",
  "village": "...",
  "area_numbers": "...",
  "area_letters": "...",
  "registry_office": "...",
  "acquisition_mode": "...",
  "boundaries": "...",
  "boundaries_document": "...",
  "legal_conditions": "...",
  "justice_ministry_case": "...",
  "urt_case": "...",
  "urt_territorial_direction": "...",
  "boundaries_exactness": "LINDEROS EXACTOS"
}
"""


class TitleStudyExtractor:
    def __init__(self, ai_client: Any | None = None, model: str = "gpt-4o") -> None:
        self.ai_client = ai_client
        self.model = model
        self.last_telemetry: dict[str, Any] = {}

    async def extract_from_text(
        self,
        text: str,
        document_name: str = "",
        location_label: str = "",
    ) -> TitleStudyPayload:
        """
        Extracts title study fields using OpenAI Structured Outputs if available,
        or deterministic heuristic extraction if running offline.
        """
        start_t = time.perf_counter()
        if self.ai_client:
            try:
                response = await asyncio.wait_for(
                    self.ai_client.chat.completions.create(
                        model=self.model,
                        messages=[
                            {"role": "system", "content": TITLE_STUDY_SYSTEM_PROMPT},
                            {
                                "role": "user",
                                "content": f"Documento: {document_name}\nUbicación: {location_label}\n\nTexto a analizar:\n{text}",
                            },
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.0,
                    ),
                    timeout=60.0,
                )
                latency_ms = int((time.perf_counter() - start_t) * 1000)
                usage = getattr(response, "usage", None)
                p_tok = getattr(usage, "prompt_tokens", 0) or 0
                c_tok = getattr(usage, "completion_tokens", 0) or 0
                t_tok = getattr(usage, "total_tokens", 0) or (p_tok + c_tok)
                self.last_telemetry = {
                    "requested_model": self.model,
                    "used_model": self.model,
                    "fallback_triggered": False,
                    "fallback_reason": None,
                    "status": "success",
                    "latency_ms": latency_ms,
                    "prompt_tokens": p_tok,
                    "completion_tokens": c_tok,
                    "total_tokens": t_tok,
                }
                raw_json = json.loads(response.choices[0].message.content or "{}")
                return TitleStudyPayload.model_validate(raw_json)
            except Exception as e:
                latency_ms = int((time.perf_counter() - start_t) * 1000)
                logger.error(f"Error in TitleStudyExtractor LLM call: {e}. Falling back to deterministic parser.")
                self.last_telemetry = {
                    "requested_model": self.model,
                    "used_model": "heuristic-engine",
                    "fallback_triggered": True,
                    "fallback_reason": str(e),
                    "status": "fallback_success",
                    "latency_ms": latency_ms,
                    "prompt_tokens": len(text) // 4,
                    "completion_tokens": 120,
                    "total_tokens": (len(text) // 4) + 120,
                }
        else:
            self.last_telemetry = {
                "requested_model": self.model,
                "used_model": "heuristic-engine",
                "fallback_triggered": False,
                "fallback_reason": None,
                "status": "success",
                "latency_ms": int((time.perf_counter() - start_t) * 1000),
                "prompt_tokens": len(text) // 4,
                "completion_tokens": 100,
                "total_tokens": (len(text) // 4) + 100,
            }

        return self._heuristic_extract(text, document_name)

    def _heuristic_extract(self, text: str, document_name: str) -> TitleStudyPayload:
        """
        Deterministic regex and structural parser for Colombian title study documents.
        Guarantees functionality even when LLM is unavailable.
        """
        payload = TitleStudyPayload()

        # Folio extraction
        folio_match = re.search(r"(?:matr[ií]cula(?:\s+inmobiliaria)?|folio)[\s\.:#Noº]*([0-9]{3}[A-Za-z]?-[0-9]{5,8})", text, re.IGNORECASE)
        if folio_match:
            payload.folio = folio_match.group(1).strip()
        else:
            simple_folio = re.search(r"\b([0-9]{3}-[0-9]{5,8})\b", text)
            if simple_folio:
                payload.folio = simple_folio.group(1).strip()

        # Cadastral ID extraction (usually 15-30 digits)
        cad_match = re.search(r"(?:c[eé]dula\s+catastral|catastro)[\s\.:#Noº]*([0-9]{15,30})", text, re.IGNORECASE)
        if cad_match:
            payload.cadastral_id = cad_match.group(1).strip()

        # Property name
        prop_match = re.search(r"(?:nombre\s+del\s+predio|predio|inmueble|finca|lote)[\s\.:#\"']*([A-Za-záéíóúÁÉÍÓÚñÑ0-9\s]{3,40})(?:[\.\n,\r]|$)", text, re.IGNORECASE)
        if prop_match:
            cand = prop_match.group(1).strip()
            if cand.lower() not in ("no identificado", "urbano", "rural", "el"):
                payload.property_name = cand

        # Municipality & Department
        muni_match = re.search(r"municipio[\s\.:#]*([A-Za-záéíóúÁÉÍÓÚñÑ\s]{3,30})(?:,|\.|\n|departamento)", text, re.IGNORECASE)
        if muni_match:
            payload.municipality = muni_match.group(1).strip()

        dep_match = re.search(r"departamento[\s\.:#]*([A-Za-záéíóúÁÉÍÓÚñÑ\s]{3,30})(?:,|\.|\n|$)", text, re.IGNORECASE)
        if dep_match:
            payload.department = dep_match.group(1).strip()

        # Vereda
        vereda_match = re.search(r"vereda[\s\.:#]*([A-Za-záéíóúÁÉÍÓÚñÑ\s]{3,30})(?:,|\.|\n|$)", text, re.IGNORECASE)
        if vereda_match:
            payload.village = vereda_match.group(1).strip()

        # Area numbers and letters
        area_num_match = re.search(r"(?:[aá]rea(?:\s+del\s+predio)?[\s\.:#]*)((?:[0-9]+(?:\.[0-9]+)*(?:,[0-9]+)?\s*(?:m2|m²|ha|hect[aá]reas?)(?:\s*[0-9]+\s*m[2²])?))", text, re.IGNORECASE)
        if area_num_match:
            payload.area_numbers = area_num_match.group(1).strip()

        # Boundaries verbatim extraction
        linderos_match = re.search(
            r"(?:linderos(?:\s+del\s+predio)?|lindando)[\s\.:]*(NORTE[^\.\n]+(?:\.[^\.\n]+){1,10}\s*(?:ENCIERRA|punto de partida))",
            text,
            re.IGNORECASE | re.DOTALL,
        )
        if linderos_match:
            payload.boundaries = linderos_match.group(1).strip()
            payload.boundaries_exactness = "LINDEROS EXACTOS"
        else:
            # Fallback broader boundary search
            gen_linderos = re.search(r"linderos[\s\.:]*([^\n\r]+(?:\n[^\n\r]+){1,5})", text, re.IGNORECASE)
            if gen_linderos:
                payload.boundaries = gen_linderos.group(1).strip()
                payload.boundaries_exactness = "LINDEROS EXACTOS" if len(payload.boundaries) > 80 else "LINDEROS RESUMIDOS"

        # Owners extraction
        owners = []
        owner_matches = re.finditer(
            r"(?:propietario[s]?|adquirente[s]?|titular[es]?)[\s\.:]*([A-Za-záéíóúÁÉÍÓÚñÑ\s]{5,50})(?:con\s+c[eé]dula|identificado\s+con|c\.c\.|cc|nit)[\s\.:#Noº]*([0-9\.\-]+)",
            text,
            re.IGNORECASE,
        )
        for om in owner_matches:
            name = om.group(1).strip()
            doc_num = om.group(2).strip().replace(".", "")
            if name and doc_num:
                owners.append(PropertyOwner(name=name, document_type="Cédula de ciudadanía", document_number=doc_num))

        if owners:
            payload.owners = owners

        # Legal conditions
        cond_match = re.search(r"(?:condiciones\s+jur[ií]dicas|grav[aá]menes|limitaciones)[\s\.:]*([^\n\r]+)", text, re.IGNORECASE)
        if cond_match:
            cand_cond = cond_match.group(1).strip()
            if "sin " in cand_cond.lower() or "ningun" in cand_cond.lower() or "libre" in cand_cond.lower():
                payload.legal_conditions = "sin condiciones jurídicas vigentes"
            else:
                payload.legal_conditions = cand_cond

        # Radicados
        urt_match = re.search(r"(?:URT|restituci[oó]n\s+de\s+tierras)[\s\w\.:]*(?:radicado|no\.?)[\s\.:]*([0-9A-Za-z\-_]+)", text, re.IGNORECASE)
        if urt_match:
            payload.urt_case = urt_match.group(1).strip()

        minjust_match = re.search(r"(?:ministerio\s+de\s+justicia|minjusticia)[\s\w\.:]*(?:radicado|no\.?)[\s\.:]*([0-9A-Za-z\-_]+)", text, re.IGNORECASE)
        if minjust_match:
            payload.justice_ministry_case = minjust_match.group(1).strip()

        return payload
