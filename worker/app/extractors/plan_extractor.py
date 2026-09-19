import json
import logging
import re
from typing import Any

from .plan_schema import PlanExtractionPayload

logger = logging.getLogger("territorium.extractors.plan")

PLAN_SYSTEM_PROMPT = """
Eres un ingeniero catastral y topógrafo experto en planos de servidumbres de infraestructura en Colombia.
Tu tarea es extraer de forma rigurosa los datos técnicos del plano a partir del contenido textual o visual:
1. NOMBRE DEL PLANO: Código o nombre oficial (ej. PLANO_SAN-CIM-001, Plano_TOL-ANZ-045).
2. ÁREA DE SERVIDUMBRE: Extrae el valor numérico en m² y su transcripción en letras. Conserva números y letras sin mezclarlos.
3. LONGITUD DE SERVIDUMBRE: Extrae el valor numérico en metros y su transcripción en letras.
4. ANCHO DE SERVIDUMBRE: Extrae el valor numérico en metros (ej. 32 m, 11 m) y su transcripción en letras.
5. CANTIDAD DE POSTES O INFRAESTRUCTURAS: Número entero de apoyos, torres o postes y su expresión en letras.
6. ESCALA DEL PLANO: Relación de escala exacta (ej. 1:1.000, 1:750, 1:1.500).
7. PROYECTO Y VOLTAJE: Nombre del proyecto y nivel de tensión (ej. 13.2 kV, 115 kV) si consta.
8. Si un valor no aparece o no aplica, escribe "—" o "no identificado".
Responde obligatoriamente en formato JSON válido.
"""


class PlanExtractor:
    def __init__(self, ai_client: Any | None = None, model: str = "gpt-4o") -> None:
        self.ai_client = ai_client
        self.model = model

    async def extract_from_text(
        self,
        text: str,
        document_name: str = "",
        location_label: str = "",
    ) -> PlanExtractionPayload:
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
                raw_json = json.loads(response.choices[0].message.content or "{}")
                return PlanExtractionPayload.model_validate(raw_json)
            except Exception as e:
                logger.error(f"Error in PlanExtractor LLM call: {e}. Falling back to deterministic parser.")

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
