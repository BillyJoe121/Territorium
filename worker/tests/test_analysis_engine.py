"""Cada resultado indica si el análisis se generó con IA o con las reglas de respaldo."""
import asyncio
import json
import unittest
from types import SimpleNamespace

from app.pipeline_v2 import Phase4PipelineOrchestrator
from tests.test_plan_fmi_linking import _build_pdf


class _FakeCompletions:
    """Responde JSON válido, salvo para los archivos cuyo nombre contiene FALLA."""

    async def create(self, **kwargs):
        user = kwargs["messages"][-1]["content"]
        if "FALLA" in user:
            raise RuntimeError("proveedor no disponible")
        content = json.dumps({"folio": "350-108418", "FOLIO DE MATRICULA": "350-108418"})
        usage = SimpleNamespace(prompt_tokens=10, completion_tokens=5, total_tokens=15)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))], usage=usage)


def _fake_client():
    return SimpleNamespace(chat=SimpleNamespace(completions=_FakeCompletions()))


def _plans(*names: str) -> list[tuple[str, bytes, str]]:
    return [(f"doc-{i}", _build_pdf(f"PLANO FMI 350-10841{i} ESCALA 1:500"), name) for i, name in enumerate(names)]


class AnalysisEngineTests(unittest.TestCase):
    def run_group(self, client, group_key: str, files):
        orchestrator = Phase4PipelineOrchestrator(ai_client=client, primary_model="modelo-prueba")
        return asyncio.run(orchestrator.process_group(group_key, files)).canonical_payload["analysis_engine"]

    def test_all_documents_with_ai(self) -> None:
        engine = self.run_group(_fake_client(), "plans", _plans("Plano_A.pdf", "Plano_B.pdf"))
        self.assertEqual(engine["mode"], "ai")
        self.assertEqual(engine["model"], "modelo-prueba")
        self.assertEqual({d["name"]: d["engine"] for d in engine["documents"]}, {"Plano_A.pdf": "ai", "Plano_B.pdf": "ai"})

    def test_ai_failure_falls_back_to_rules_and_is_reported(self) -> None:
        engine = self.run_group(_fake_client(), "plans", _plans("Plano_A.pdf", "Plano_FALLA.pdf"))
        self.assertEqual(engine["mode"], "mixed")
        self.assertEqual(engine["rules_reason"], "ai_error")
        self.assertEqual({d["name"]: d["engine"] for d in engine["documents"]}, {"Plano_A.pdf": "ai", "Plano_FALLA.pdf": "rules"})

    def test_without_ai_client_everything_is_rules(self) -> None:
        engine = self.run_group(None, "titles", [("doc-1", _build_pdf("ESTUDIO DE TITULOS FOLIO 350-108418"), "Estudio.pdf")])
        self.assertEqual(engine["mode"], "rules")
        self.assertEqual(engine["rules_reason"], "not_configured")
        self.assertIsNone(engine["model"])

    def test_unreadable_document_is_reported(self) -> None:
        engine = self.run_group(_fake_client(), "plans", [("doc-1", b"\x89PNG\r\n\x1a\n", "Plano.png")])
        self.assertEqual(engine["mode"], "none")
        self.assertEqual(engine["documents"], [{"name": "Plano.png", "engine": "unread"}])


if __name__ == "__main__":
    unittest.main()
