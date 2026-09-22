"""Durable, content-safe preparation worker for Territorium expediente v2.

This is deliberately an ingestion worker. It validates binary inputs, records
cache provenance and completes leased tasks, but does not send legal content to
an AI provider. Structured extraction starts in Phase 4.
"""

from __future__ import annotations

import hashlib
import json
import zipfile
from dataclasses import dataclass
from datetime import UTC, datetime
from io import BytesIO
from typing import Any


class PermanentValidationError(RuntimeError):
    """An input can never succeed by retrying the same bytes."""


@dataclass(frozen=True)
class V2Task:
    id: str
    execution_id: str
    document_file_id: str
    lease_token: str
    attempt_count: int
    max_attempts: int


@dataclass(frozen=True)
class V2Execution:
    id: str
    project_id: str
    group_id: str
    extractor_key: str
    extractor_snapshot: dict[str, Any]
    prompt_snapshot: dict[str, Any]
    model_snapshot: dict[str, Any]
    input_version: int = 1


@dataclass(frozen=True)
class V2Document:
    id: str
    storage_path: str
    original_name: str
    mime_type: str
    sha256: str


def detect_mime(content: bytes) -> str:
    if content.startswith(b"%PDF-"):
        return "application/pdf"
    if content.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        return "application/msword"
    if content.startswith(b"PK\x03\x04"):
        return "application/zip"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    raise PermanentValidationError("PERMANENT_INVALID_FORMAT")


def validate_binary(content: bytes, declared_mime: str) -> str:
    if not content:
        raise PermanentValidationError("PERMANENT_EMPTY_FILE")
    detected = detect_mime(content)
    office_mimes = {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
    if declared_mime in office_mimes:
        if detected != "application/zip":
            raise PermanentValidationError("PERMANENT_MIME_MISMATCH")
        try:
            with zipfile.ZipFile(BytesIO(content)) as archive:
                entries = archive.infolist()
                if not entries or len(entries) > 2_000:
                    raise PermanentValidationError("PERMANENT_INVALID_ARCHIVE")
                expanded_size = sum(entry.file_size for entry in entries)
                if expanded_size > 200 * 1024 * 1024:
                    raise PermanentValidationError("PERMANENT_ARCHIVE_TOO_LARGE")
                if any(entry.flag_bits & 0x1 for entry in entries):
                    raise PermanentValidationError("PERMANENT_ENCRYPTED_FILE")
                if any(entry.filename.startswith(("/", "\\")) or ".." in entry.filename.replace("\\", "/").split("/") for entry in entries):
                    raise PermanentValidationError("PERMANENT_INVALID_ARCHIVE")
                if archive.testzip() is not None:
                    raise PermanentValidationError("PERMANENT_CORRUPT_FILE")
        except zipfile.BadZipFile as error:
            raise PermanentValidationError("PERMANENT_CORRUPT_FILE") from error
        return declared_mime
    if detected != declared_mime:
        raise PermanentValidationError("PERMANENT_MIME_MISMATCH")
    return detected


def cache_key(document_sha256: str, execution: V2Execution) -> str:
    snapshots = {
        "document_sha256": document_sha256,
        "extractor": execution.extractor_snapshot,
        "prompt": execution.prompt_snapshot,
        "schema": execution.prompt_snapshot.get("schema", {}),
        "model": execution.model_snapshot,
    }
    return hashlib.sha256(json.dumps(snapshots, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def payload_sha256(payload: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def validation_payload(document: V2Document, detected_mime: str) -> dict[str, Any]:
    return {
        "phase": "ingestion_validation",
        "document_file_id": document.id,
        "content_sha256": document.sha256,
        "detected_mime_type": detected_mime,
        "validated_at": datetime.now(UTC).isoformat(),
    }


async def trigger_phase4_extraction_if_ready(
    gateway: Any,
    execution: V2Execution,
    orchestrator: Any,
) -> str | None:
    """
    Checks if all inputs for the execution are validated. If so, triggers
    Phase 4 canonical extraction and saves the results to Supabase.
    """
    is_ready = await gateway.is_execution_ready_for_extraction(execution.id)
    if not is_ready:
        return None

    try:
        await gateway.update_execution_stage(
            execution.id,
            "extracting",
            "Insumos validados. Extrayendo información estructurada canónica...",
        )

        group_info = await gateway.get_v2_group_info(execution.group_id)
        group_key = group_info.get("group_key")
        if not group_key:
            mapping = {"title_study": "titles", "plan": "plans", "negotiation": "negotiation"}
            group_key = mapping.get(execution.extractor_key, execution.extractor_key)

        doc_files = await gateway.get_v2_group_files(execution.group_id)
        if not doc_files:
            raise RuntimeError("No se encontraron archivos activos para el grupo documental.")

        files_payload: list[tuple[str, bytes, str]] = []
        for doc_meta in doc_files:
            storage_path = doc_meta["storage_path"]
            file_bytes = await gateway.download(storage_path)
            files_payload.append((doc_meta["id"], file_bytes, doc_meta["original_name"]))

        extraction_res = await orchestrator.process_group(
            group_key=group_key,
            files=files_payload,
            target_property_code=None,
            project_id=execution.project_id,
            gateway=gateway,
        )

        output_id = await gateway.save_v2_phase4_output(
            execution_id=execution.id,
            project_id=execution.project_id,
            group_id=execution.group_id,
            input_version=execution.input_version,
            canonical_payload=extraction_res.canonical_payload,
            validation_report=extraction_res.validation_report.model_dump(),
            discrepancies=extraction_res.discrepancies,
            provenance=extraction_res.provenance,
            documents_summary=[
                {
                    "document_id": doc.document_id,
                    "original_name": doc.original_name,
                    "sha256": doc.sha256,
                    "page_count": doc.page_count,
                    "scan_status": doc.overall_scan_status.value,
                }
                for doc in extraction_res.parsed_documents
            ],
        )

        await gateway.v2_audit(
            execution.project_id,
            "expediente.extraction_completed",
            "execution",
            execution.id,
            {
                "group_id": execution.group_id,
                "group_key": group_key,
                "output_id": output_id,
                "input_version": execution.input_version,
                "validation_valid": extraction_res.validation_report.is_valid,
                "discrepancies_count": len(extraction_res.discrepancies),
            },
        )
        return output_id
    except Exception as exc:
        await gateway.fail_v2_execution(
            execution.id,
            execution.group_id,
            "EXTRACTION_FAILED",
            f"Fallo durante la extracción estructurada canónica: {exc}",
        )
        raise


async def process_expediente_v2_task(
    gateway: Any,
    task: V2Task,
    orchestrator: Any | None = None,
) -> None:
    """Complete one lease and trigger Phase 4 extraction if all tasks are ready."""
    document: V2Document | None = None
    try:
        execution = await gateway.v2_execution(task.execution_id)
        document = await gateway.v2_document(task.document_file_id)
        content = await gateway.download(document.storage_path)
        actual_hash = hashlib.sha256(content).hexdigest()
        if actual_hash != document.sha256:
            raise PermanentValidationError("PERMANENT_HASH_MISMATCH")
        detected_mime = validate_binary(content, document.mime_type)
        key = cache_key(actual_hash, execution)
        cached = await gateway.v2_cache_hit(key)
        if cached is not None:
            # Cache entries are document-content compatible, never document-row
            # compatible. Refresh provenance for the newly completed task.
            cached = {**cached, "document_file_id": document.id, "validated_at": datetime.now(UTC).isoformat()}
            await gateway.v2_mark_document_validated(document.id, detected_mime)
            await gateway.v2_audit(execution.project_id, "expediente.cache_hit", "execution", execution.id, {"task_id": task.id, "cache_key": key})
            await gateway.v2_complete(task, cached, payload_sha256(cached))
            if orchestrator is not None:
                await trigger_phase4_extraction_if_ready(gateway, execution, orchestrator)
            return

        payload = validation_payload(document, detected_mime)
        await gateway.v2_store_cache(key, actual_hash, execution, payload, payload_sha256(payload))
        await gateway.v2_mark_document_validated(document.id, detected_mime)
        await gateway.v2_audit(execution.project_id, "expediente.cache_miss", "execution", execution.id, {"task_id": task.id, "cache_key": key})
        await gateway.v2_complete(task, payload, payload_sha256(payload))
        if orchestrator is not None:
            await trigger_phase4_extraction_if_ready(gateway, execution, orchestrator)
    except PermanentValidationError as error:
        if document is not None:
            await gateway.v2_mark_document_rejected(document.id, str(error))
        await gateway.v2_complete(task, None, None, str(error), "El archivo no supera la validación de seguridad o integridad.")
    except Exception:
        # No filename, path, byte content or provider response is logged.
        await gateway.v2_complete(task, None, None, "TRANSIENT_PREPARATION_FAILURE", "No fue posible preparar el archivo; se reintentará automáticamente.")
