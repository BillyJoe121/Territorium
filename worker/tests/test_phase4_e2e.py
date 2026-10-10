import os
import unittest
import asyncio

from app.pipeline_v2 import Phase4PipelineOrchestrator


class Phase4EndToEndTests(unittest.TestCase):
    def setUp(self) -> None:
        self.orchestrator = Phase4PipelineOrchestrator()
        workspace = os.path.join(os.path.dirname(__file__), "..", "..", "..")
        # Los insumos reales pueden estar en la raíz o dentro de "Insumos entregados".
        candidates = [
            os.path.join(workspace, "Insumos entregados", "1. Proyecto extracción información"),
            os.path.join(workspace, "1. Proyecto extracción información"),
        ]
        self.base_real_dir = os.path.abspath(next((c for c in candidates if os.path.isdir(c)), candidates[0]))

    def test_e2e_real_negotiation_xlsx(self) -> None:
        # Find RESULTADO_VALORES_SERVIDUMBRE.xlsx
        target_path = None
        for root, _, files in os.walk(self.base_real_dir):
            for f in files:
                if f == "RESULTADO_VALORES_SERVIDUMBRE.xlsx":
                    target_path = os.path.join(root, f)
                    break
            if target_path:
                break

        if not target_path or not os.path.exists(target_path):
            self.skipTest("No se encontró el archivo real RESULTADO_VALORES_SERVIDUMBRE.xlsx")

        with open(target_path, "rb") as f:
            file_bytes = f.read()

        result = asyncio.run(
            self.orchestrator.process_group(
                group_key="negotiation",
                files=[("doc-neg-real-1", file_bytes, "RESULTADO_VALORES_SERVIDUMBRE.xlsx")],
                target_property_code="TOL-ANZ-103",
            )
        )

        self.assertEqual(result.group_key, "negotiation")
        self.assertTrue(result.validation_report.is_valid)
        self.assertIn("1.485.142", result.canonical_payload["first_offer_numbers"])
        self.assertEqual(result.canonical_payload["property_code"], "TOL-ANZ-103")

    def test_e2e_real_plan_pdf(self) -> None:
        target_path = None
        for root, _, files in os.walk(self.base_real_dir):
            for f in files:
                if f == "Plano_SAN-CIM-001_20251201.pdf":
                    target_path = os.path.join(root, f)
                    break
            if target_path:
                break

        if not target_path or not os.path.exists(target_path):
            self.skipTest("No se encontró el archivo real Plano_SAN-CIM-001_20251201.pdf")

        with open(target_path, "rb") as f:
            file_bytes = f.read()

        result = asyncio.run(
            self.orchestrator.process_group(
                group_key="plans",
                files=[("doc-plan-real-1", file_bytes, "Plano_SAN-CIM-001_20251201.pdf")],
            )
        )

        self.assertEqual(result.group_key, "plans")
        self.assertGreaterEqual(result.canonical_payload["plan_count"], 1)
        self.assertIn("Plano_SAN-CIM-001", result.canonical_payload["primary_plan_name"])

    def test_e2e_real_title_study_docx(self) -> None:
        target_path = None
        for root, _, files in os.walk(self.base_real_dir):
            for f in files:
                if f.startswith("ESTUDIO DE T") and f.endswith(".docx"):
                    target_path = os.path.join(root, f)
                    break
            if target_path:
                break

        if not target_path or not os.path.exists(target_path):
            self.skipTest("No se encontró un archivo DOCX real de estudio de títulos")

        with open(target_path, "rb") as f:
            file_bytes = f.read()

        result = asyncio.run(
            self.orchestrator.process_group(
                group_key="titles",
                files=[("doc-title-real-1", file_bytes, os.path.basename(target_path))],
            )
        )

        self.assertEqual(result.group_key, "titles")
        self.assertIn("owners", result.canonical_payload)
        self.assertIn("boundaries", result.canonical_payload)
        self.assertTrue(len(result.payload_sha256) == 64)


if __name__ == "__main__":
    unittest.main()
