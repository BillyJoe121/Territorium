import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.document_ai_revision import (
    DocumentAiRevisionTask,
    extract_narrative,
    inject_narrative,
    process_document_ai_revision,
)


SOURCE_DOCUMENT = {
    "type": "doc",
    "content": [
        {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Estudio"}]},
        {"type": "table", "content": [{"type": "tableRow", "content": []}]},
        {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Consideraciones jurídicas"}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "Texto original."}]},
        {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Recomendaciones"}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "Recomendación original."}]},
        {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Anexos"}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "No cambiar."}]},
    ],
}


class DocumentAiRevisionTests(unittest.TestCase):
    def test_extracts_and_replaces_only_narrative_sections(self) -> None:
        self.assertIn("Texto original.", extract_narrative(SOURCE_DOCUMENT))

        revised = inject_narrative(SOURCE_DOCUMENT, "Nueva consideración.\n\nNueva recomendación.")

        self.assertEqual(revised["content"][1], SOURCE_DOCUMENT["content"][1])
        serialized = str(revised)
        self.assertIn("Nueva consideración.", serialized)
        self.assertIn("Nueva recomendación.", serialized)
        self.assertIn("No cambiar.", serialized)
        self.assertNotIn("Texto original.", serialized)

    def test_processes_provider_output_and_persists_structured_document(self) -> None:
        task = DocumentAiRevisionTask(
            id="revision-1",
            project_id="project-1",
            source_document_version_id="document-1",
            source_content=SOURCE_DOCUMENT,
            user_comment="Mejorar claridad sin inventar hechos.",
            lease_token="lease-1",
            attempt_count=1,
        )
        gateway = SimpleNamespace(complete_document_ai_revision=AsyncMock())
        completion = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="Texto revisado."))])
        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(return_value=completion))))

        asyncio.run(process_document_ai_revision(gateway, task, client, "gpt-test"))

        client.chat.completions.create.assert_awaited_once()
        stored_content = gateway.complete_document_ai_revision.call_args.kwargs["proposed_content"]
        self.assertIn("Texto revisado.", str(stored_content))
        self.assertEqual(stored_content["content"][1], SOURCE_DOCUMENT["content"][1])

    def test_reports_a_safe_error_when_provider_is_unavailable(self) -> None:
        task = DocumentAiRevisionTask("revision-1", "project-1", "document-1", SOURCE_DOCUMENT, "Ajustar", "lease-1", 1)
        gateway = SimpleNamespace(complete_document_ai_revision=AsyncMock())

        asyncio.run(process_document_ai_revision(gateway, task, None, "gpt-test"))

        gateway.complete_document_ai_revision.assert_awaited_once_with(
            "revision-1", "lease-1", error_code="AI_PROVIDER_UNAVAILABLE"
        )


if __name__ == "__main__":
    unittest.main()
