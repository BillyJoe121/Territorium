import json
import logging
import re
import time
from typing import Any

from .plan_schema import PlanExtractionPayload

logger = logging.getLogger("territorium.extractors.plan")

PLAN_SYSTEM_PROMPT = """
Eres un ingeniero catastral y topógrafo experto en planos de servidumbres de infraestructura en Colombia.
Tu tarea es extraer de forma rigurosa los datos técnicos del plano para estructurar la información con las siguientes columnas exactas:
- NOMBRE DEL PLANO: Código o nombre oficial del plano (ej. PLANO_SAN-CIM-001, Plano_TOL-ANZ-045).
- AREA SERVIDUMBRE (m²) NUMEROS: Valor numérico del área de servidumbre en metros cuadrados (ej. 13356.93 o 4432.11).
- AREA SERVIDUMBRE (m²) LETRAS: Transcripción del área de servidumbre en letras sin abreviar.
- LONGITUD SERVIDUMBRE (m) NUMEROS: Valor numérico de la longitud de servidumbre en metros (ej. 412.05).
- LONGITUD SERVIDUMBRE (m) LETRAS: Transcripción de la longitud de servidumbre en letras.
- ANCHO SERVIDUMBRE (m) NUMEROS: Valor numérico del ancho o franja de servidumbre en metros (ej. 32).
- ANCHO SERVIDUMBRE (m) LETRAS: Transcripción del ancho de servidumbre en letras (ej. treinta y dos).
- CANTIDAD POSTES O INFRAESTRUCTURAS NUMEROS: Número entero de postes, torres o apoyos (ej. 1 o 0).
- CANTIDAD POSTES O INFRAESTRUCTURAS LETRAS: Cantidad de postes o infraestructuras en letras (ej. uno, cero).
- ESCALA DEL PLANO: Relación de escala exacta tal como aparece en el rótulo del plano (ej. 1:1.500, 1:750, 1:300).

Reglas obligatorias:
1. Conserva unidades y escritura originales del plano.
2. No calcules, conviertas ni inventes valores ausentes; si un dato no aparece, escribe "no identificado".
3. Transcribe números y letras sin mezclarlos.
4. Responde obligatoriamente en formato JSON con estas claves exactas.
"""



class PlanExtractor:
    def __init__(self, ai_client: Any | None = None, model: str = "gpt-4o") -> None:
        self.ai_client = ai_client
        self.model = model
        self.last_telemetry: dict[str, Any] = {}

    async def extract_from_text(
        self,
        text: str,
        document_name: str = "",
        location_label: str = "",
    ) -> PlanExtractionPayload:
        start_t = time.perf_counter()
        if self.ai_client:
            try:
                response = await self.ai_client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": PLAN_SYSTEM_PROMPT},
                        {
                            "role": "user",
                            "content": f"Archivo: {document_name}\nUbicación: {location_label}\n\nContenido técnico:\n{text}",
                        },
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.0,
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
                return PlanExtractionPayload.model_validate(raw_json)
            except Exception as e:
                latency_ms = int((time.perf_counter() - start_t) * 1000)
                logger.error(f"Error in PlanExtractor LLM call: {e}. Falling back to deterministic parser.")
                self.last_telemetry = {
                    "requested_model": self.model,
                    "used_model": "heuristic-engine",
                    "fallback_triggered": True,
                    "fallback_reason": str(e),
                    "status": "fallback_success",
                    "latency_ms": latency_ms,
                    "prompt_tokens": len(text) // 4,
                    "completion_tokens": 80,
                    "total_tokens": (len(text) // 4) + 80,
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
                "completion_tokens": 60,
                "total_tokens": (len(text) // 4) + 60,
            }

        return self._heuristic_extract(text, document_name)

    def _heuristic_extract(self, text: str, document_name: str) -> PlanExtractionPayload:
        payload = PlanExtractionPayload()

        # Plan name from document name or text
        name_cand = document_name.replace(".pdf", "").replace(".docx", "").strip()
        if name_cand:
            payload.plan_name = name_cand

        # Area extraction
        area_match = re.search(
            r"(?:[aá]rea(?:\s+de)?\s+servidumbre)[\s\.:#]*([0-9]+[\.,][0-9]+|[0-9]+)\s*(?:m2|m²)?",
            text,
            re.IGNORECASE,
        )
        if area_match:
            payload.easement_area_numbers = area_match.group(1).strip()

        area_letters_match = re.search(
            r"(?:[aá]rea(?:\s+de)?\s+servidumbre\s+en\s+letras)[\s\.:#]*([A-Za-záéíóúÁÉÍÓÚñÑ\s]{5,60})",
            text,
            re.IGNORECASE,
        )
        if area_letters_match:
            payload.easement_area_letters = area_letters_match.group(1).strip()

        # Length extraction
        len_match = re.search(
            r"(?:longitud(?:\s+de)?\s+servidumbre)[\s\.:#]*([0-9]+[\.,][0-9]+|[0-9]+)\s*(?:m|metros)?",
            text,
            re.IGNORECASE,
        )
        if len_match:
            payload.easement_length_numbers = len_match.group(1).strip()

        # Width extraction
        width_match = re.search(
            r"(?:ancho(?:\s+de)?\s+servidumbre|franja)[\s\.:#]*([0-9]+[\.,][0-9]+|[0-9]+)\s*(?:m|metros)?",
            text,
            re.IGNORECASE,
        )
        if width_match:
            payload.easement_width_numbers = width_match.group(1).strip()

        # Infrastructure / Postes count
        postes_match = re.search(
            r"(?:postes|apoyos|infraestructuras?)[\s\.:#]*([0-9]+)",
            text,
            re.IGNORECASE,
        )
        if postes_match:
            payload.infrastructure_count_numbers = postes_match.group(1).strip()

        # Scale extraction (1:XXX)
        scale_match = re.search(r"\b(1\s*:\s*[0-9]+(?:\.[0-9]+)?)\b", text)
        if scale_match:
            payload.plan_scale = scale_match.group(1).replace(" ", "")

        # Voltage
        volt_match = re.search(r"\b([0-9]+(?:[\.,][0-9]+)?\s*k[vV])\b", text)
        if volt_match:
            payload.voltage_level = volt_match.group(1).strip()

        return payload
