import json
import unittest

from app.expediente_v2 import PermanentValidationError, V2Execution, V2Document, cache_key, validate_binary, validation_payload


class ExpedienteV2WorkerTests(unittest.TestCase):
    def test_validates_pdf_magic_bytes(self) -> None:
        self.assertEqual(validate_binary(b"%PDF-1.7 test", "application/pdf"), "application/pdf")

    def test_rejects_mime_confusion(self) -> None:
        with self.assertRaisesRegex(PermanentValidationError, "PERMANENT_MIME_MISMATCH"):
            validate_binary(b"%PDF-1.7 test", "image/png")

    def test_rejects_invalid_office_archive(self) -> None:
        with self.assertRaisesRegex(PermanentValidationError, "PERMANENT_CORRUPT_FILE"):
            validate_binary(b"PK\x03\x04not-a-zip", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")

    def test_cache_key_changes_when_model_snapshot_changes(self) -> None:
        execution = V2Execution("e", "p", "g", "title_study", {"version": 1}, {"schema": {"v": 1}}, {"model": "a"})
        changed_model = V2Execution("e", "p", "g", "title_study", {"version": 1}, {"schema": {"v": 1}}, {"model": "b"})
        self.assertNotEqual(cache_key("a" * 64, execution), cache_key("a" * 64, changed_model))

    def test_validation_payload_contains_no_source_name_or_content(self) -> None:
        document = V2Document("document-id", "project/expediente/titles/id/secret.pdf", "secret.pdf", "application/pdf", "a" * 64)
        payload = validation_payload(document, "application/pdf")
        serialized = json.dumps(payload)
        self.assertNotIn("secret.pdf", serialized)
        self.assertNotIn("expediente/titles", serialized)
        self.assertEqual(payload["content_sha256"], "a" * 64)

    def test_trigger_phase4_extraction_skips_when_not_ready(self) -> None:
        import asyncio
        from app.expediente_v2 import trigger_phase4_extraction_if_ready

        class MockGatewayNotReady:
            async def is_execution_ready_for_extraction(self, execution_id: str) -> bool:
                return False

        execution = V2Execution("exec-1", "proj-1", "group-1", "title_study", {}, {}, {})
        result = asyncio.run(trigger_phase4_extraction_if_ready(MockGatewayNotReady(), execution, None))
        self.assertIsNone(result)

    def test_trigger_phase4_extraction_runs_and_saves_when_ready(self) -> None:
        import asyncio
        from unittest.mock import AsyncMock, MagicMock
        from app.expediente_v2 import trigger_phase4_extraction_if_ready, process_expediente_v2_task, V2Task
        from app.pipeline_v2 import Phase4ExecutionResult
        from app.validation.validator import ValidationReport

        gateway = MagicMock()
        gateway.is_execution_ready_for_extraction = AsyncMock(return_value=True)
        gateway.update_execution_stage = AsyncMock()
        gateway.get_v2_group_info = AsyncMock(return_value={"group_key": "titles", "input_version": 2})
        gateway.get_v2_group_files = AsyncMock(return_value=[
            {"id": "doc-1", "storage_path": "proj/titles/doc-1/estudio.docx", "original_name": "estudio.docx"}
        ])
        gateway.download = AsyncMock(return_value=b"PK\x03\x04mock-bytes")
        gateway.save_v2_phase4_output = AsyncMock(return_value="output-v2-456")
        gateway.v2_audit = AsyncMock()

        orchestrator = MagicMock()
        mock_result = Phase4ExecutionResult(
            group_key="titles",
            canonical_payload={"folio": "350-12345", "cadastral_id": "01020304"},
            validation_report=ValidationReport(is_valid=True, errors=[], warnings=[], repairs=[]),
            discrepancies=[],
            provenance=[{"field": "folio", "source": "estudio.docx"}],
            parsed_documents=[],
        )
        orchestrator.process_group = AsyncMock(return_value=mock_result)

        execution = V2Execution("exec-1", "proj-1", "group-1", "title_study", {}, {}, {}, input_version=2)
        out_id = asyncio.run(trigger_phase4_extraction_if_ready(gateway, execution, orchestrator))

        self.assertEqual(out_id, "output-v2-456")
        gateway.update_execution_stage.assert_awaited_once_with(
            "exec-1", "extracting", "Insumos validados. Extrayendo información estructurada canónica..."
        )
        orchestrator.process_group.assert_awaited_once()
        gateway.save_v2_phase4_output.assert_awaited_once()
        self.assertEqual(gateway.save_v2_phase4_output.call_args.kwargs["execution_id"], "exec-1")
        self.assertEqual(gateway.save_v2_phase4_output.call_args.kwargs["input_version"], 2)
        gateway.v2_audit.assert_awaited_once()

    def test_trigger_phase4_extraction_fails_gracefully(self) -> None:
        import asyncio
        from unittest.mock import AsyncMock, MagicMock
        from app.expediente_v2 import trigger_phase4_extraction_if_ready

        gateway = MagicMock()
        gateway.is_execution_ready_for_extraction = AsyncMock(return_value=True)
        gateway.update_execution_stage = AsyncMock()
        gateway.get_v2_group_info = AsyncMock(return_value={"group_key": "titles"})
        gateway.get_v2_group_files = AsyncMock(side_effect=RuntimeError("Connection timeout to Storage"))
        gateway.fail_v2_execution = AsyncMock()

        execution = V2Execution("exec-err", "proj-1", "group-err", "title_study", {}, {}, {})
        with self.assertRaises(RuntimeError):
            asyncio.run(trigger_phase4_extraction_if_ready(gateway, execution, MagicMock()))

        gateway.fail_v2_execution.assert_awaited_once()
        self.assertEqual(gateway.fail_v2_execution.call_args.args[0], "exec-err")
        self.assertEqual(gateway.fail_v2_execution.call_args.args[2], "EXTRACTION_FAILED")

    def test_process_expediente_v2_task_calls_orchestrator(self) -> None:
        import asyncio
        import hashlib
        from unittest.mock import AsyncMock, MagicMock
        from app.expediente_v2 import process_expediente_v2_task, V2Task

        file_content = b"%PDF-1.7 sample-pdf"
        file_sha256 = hashlib.sha256(file_content).hexdigest()

        gateway = MagicMock()
        task = V2Task(id="task-1", execution_id="exec-1", document_file_id="doc-1", lease_token="lease-1", attempt_count=1, max_attempts=3)
        execution = V2Execution("exec-1", "proj-1", "group-1", "plan", {}, {}, {})
        document = V2Document("doc-1", "proj-1/plans/doc-1/plano.pdf", "plano.pdf", "application/pdf", file_sha256)

        gateway.v2_execution = AsyncMock(return_value=execution)
        gateway.v2_document = AsyncMock(return_value=document)
        gateway.download = AsyncMock(return_value=file_content)
        gateway.v2_cache_hit = AsyncMock(return_value=None)
        gateway.v2_store_cache = AsyncMock()
        gateway.v2_mark_document_validated = AsyncMock()
        gateway.v2_audit = AsyncMock()
        gateway.v2_complete = AsyncMock()
        gateway.is_execution_ready_for_extraction = AsyncMock(return_value=False)

        orchestrator = MagicMock()
        asyncio.run(process_expediente_v2_task(gateway, task, orchestrator=orchestrator))

        gateway.v2_mark_document_validated.assert_awaited_once_with("doc-1", "application/pdf")
        gateway.v2_complete.assert_awaited_once()
        gateway.is_execution_ready_for_extraction.assert_awaited_once_with("exec-1")


if __name__ == "__main__":
    unittest.main()

