"""El plano debe traer su FMI para vincularse 1 a 1 con su estudio de títulos."""
import asyncio
import io
import unittest

from app.extractors.plan_extractor import PLAN_SYSTEM_PROMPT, PlanExtractor
from app.extractors.plan_schema import PlanExtractionPayload


class PlanFmiExtractionTests(unittest.TestCase):
    def test_heuristic_reads_fmi_and_cadastral_id(self) -> None:
        text = """
        PLANO DE SERVIDUMBRE Plano_TOL-ANZ-045
        PREDIO: LA PLAYA  FMI No. 350 - 108418
        CÉDULA CATASTRAL: 73-043-00-02-00-02-0024-000
        ÁREA SERVIDUMBRE: 3374,06 m2   ESCALA 1:1500
        """
        payload = asyncio.run(PlanExtractor().extract_from_text(text, "Plano_TOL-ANZ-045.pdf"))
        self.assertEqual(payload.folio, "350-108418")
        self.assertEqual(payload.cadastral_id, "73043000200020024000")
        self.assertEqual(payload.easement_area_numbers, "3374,06")

    def test_heuristic_reads_matricula_variant(self) -> None:
        payload = asyncio.run(PlanExtractor().extract_from_text("Matrícula inmobiliaria: 050N-204581", "plano.pdf"))
        self.assertEqual(payload.folio, "050N-204581")

    def test_missing_fmi_stays_unidentified(self) -> None:
        payload = asyncio.run(PlanExtractor().extract_from_text("Escala 1:500 sin datos del predio", "plano.pdf"))
        self.assertEqual(payload.folio, "no identificado")

    def test_schema_normalizes_llm_column_names(self) -> None:
        payload = PlanExtractionPayload.model_validate({
            "FOLIO DE MATRICULA": "350-108418",
            "CEDULA CATASTRAL": "73043000200020024000",
            "NOMBRE DEL PREDIO": "LA PLAYA",
            "PROPIETARIOS": ["ROSA ELENA RONCANCIO", {"nombre": "ALEJO MORENO"}],
            "MUNICIPIO": "ANZOÁTEGUI",
            "VEREDA": "PALOMAR",
            "AREA DEL PREDIO": "12 ha 4580 m2",
            "NOMBRE DEL PLANO": "Plano_TOL-ANZ-045",
        })
        self.assertEqual(payload.folio, "350-108418")
        self.assertEqual(payload.property_name, "LA PLAYA")
        self.assertEqual(payload.owners, "ROSA ELENA RONCANCIO; ALEJO MORENO")
        self.assertEqual(payload.municipality, "ANZOÁTEGUI")
        self.assertEqual(payload.village, "PALOMAR")
        self.assertEqual(payload.property_area, "12 ha 4580 m2")
        self.assertEqual(payload.plan_name, "Plano_TOL-ANZ-045")

    def test_prompt_requests_fmi(self) -> None:
        self.assertIn("FOLIO DE MATRICULA", PLAN_SYSTEM_PROMPT)
        self.assertIn("AREA DEL PREDIO", PLAN_SYSTEM_PROMPT)


def _build_pdf(text: str) -> bytes:
    """PDF mínimo de una página con texto extraíble (sin dependencias externas)."""
    content = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode("latin-1")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for index, obj in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(f"{index} 0 obj\n".encode() + obj + b"\nendobj\n")
    xref = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for offset in offsets:
        out.write(f"{offset:010d} 00000 n \n".encode())
    out.write(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode())
    return out.getvalue()


class PlanGroupProcessingTests(unittest.TestCase):
    def test_plans_group_returns_fmi_and_source_document_per_plan(self) -> None:
        from app.pipeline_v2 import Phase4PipelineOrchestrator

        orchestrator = Phase4PipelineOrchestrator(ai_client=None)
        files = [
            ("doc-1", _build_pdf("PLANO PREDIO LA PLAYA FMI 350-108418 ESCALA 1:1500"), "Plano_A.pdf"),
            ("doc-2", _build_pdf("PLANO PREDIO VILLA CLAUDIA FMI 352-5 ESCALA 1:750"), "Plano_B.pdf"),
        ]
        result = asyncio.run(orchestrator.process_group("plans", files))
        plans = {plan["source_document"]: plan for plan in result.canonical_payload["plans"]}
        self.assertEqual(plans["Plano_A.pdf"]["folio"], "350-108418")
        self.assertEqual(plans["Plano_B.pdf"]["folio"], "352-5")


class TitleReducerFmiTests(unittest.TestCase):
    def test_later_segment_fills_fmi_left_unidentified(self) -> None:
        from app.processing.hierarchical_reducer import HierarchicalReducer

        reduced = HierarchicalReducer().reduce_titles([
            {"source_document": "Estudio.docx", "folio": "no identificado", "property_name": "no identificado"},
            {"source_document": "Estudio.docx", "folio": "350-108418", "property_name": "LA PLAYA"},
        ])
        title = reduced.canonical_payload["titles"][0]
        self.assertEqual(title["folio"], "350-108418")
        self.assertEqual(title["property_name"], "LA PLAYA")


if __name__ == "__main__":
    unittest.main()
