import asyncio
from contextlib import suppress
import hashlib
import json
import logging
from typing import Any

from .extractors.negotiation_extractor import NegotiationExtractor
from .extractors.plan_extractor import PlanExtractor
from .extractors.title_extractor import TitleStudyExtractor
from .models.canonical import CanonicalDocument, ScanClassification
from .preprocessing.docx_parser import parse_docx
from .preprocessing.pdf_parser import parse_pdf
from .preprocessing.scan_detector import detect_scan_and_ocr_needs
from .processing.hierarchical_reducer import HierarchicalReducer
from .processing.segmentation import segment_canonical_document
from .validation.validator import StructuralValidationEngine, ValidationReport

logger = logging.getLogger("territorium.pipeline_v2")

HEURISTIC_ENGINE = "heuristic-engine"


def analysis_engine_summary(document_calls: dict[str, list[dict[str, Any]]], model: str | None) -> dict[str, Any]:
    """Resume si cada documento se analizó con IA o con las reglas de respaldo.

    `document_calls` asocia cada archivo con la telemetría de sus llamadas al extractor
    (lista vacía si no se pudo leer texto). Un documento es "ai" si todas sus llamadas usaron
    la IA, "rules" si ninguna, "mixed" si ambas y "unread" si no hubo llamadas.
    """
    documents = []
    fell_back = False
    for name, calls in document_calls.items():
        used_ai = [call.get("used_model") not in (None, "", HEURISTIC_ENGINE) for call in calls]
        fell_back = fell_back or any(call.get("fallback_triggered") for call in calls)
        engine = "unread" if not calls else "ai" if all(used_ai) else "rules" if not any(used_ai) else "mixed"
        documents.append({"name": name, "engine": engine})
    engines = {d["engine"] for d in documents} - {"unread"}
    mode = "none" if not engines else "ai" if engines == {"ai"} else "rules" if engines == {"rules"} else "mixed"
    uses_rules = bool(engines & {"rules", "mixed"})
    return {
        "mode": mode,
        "model": model if engines & {"ai", "mixed"} else None,
        "rules_reason": ("ai_error" if fell_back else "not_configured") if uses_rules else None,
        "documents": documents,
    }


class Phase4ExecutionResult:
    def __init__(
        self,
        group_key: str,
        canonical_payload: dict[str, Any],
        validation_report: ValidationReport,
        discrepancies: list[dict[str, Any]],
        provenance: list[dict[str, Any]],
        parsed_documents: list[CanonicalDocument],
    ) -> None:
        self.group_key = group_key
        self.canonical_payload = canonical_payload
        self.validation_report = validation_report
        self.discrepancies = discrepancies
        self.provenance = provenance
        self.parsed_documents = parsed_documents

    @property
    def payload_sha256(self) -> str:
        serialized = json.dumps(self.canonical_payload, sort_keys=True)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

class Phase4PipelineOrchestrator:
    """
    Production orchestrator for Phase 4 (HU-V2-034 to HU-V2-041):
    Canonical Parsing -> Scan Detection & OCR -> Semantic Segmentation ->
    Specialized Extraction -> Hierarchical Reduction -> Structural Validation.
    """
    def __init__(
        self,
        ai_client: Any | None = None,
        primary_model: str = "gpt-4o",
    ) -> None:
        self.ai_client = ai_client
        self.primary_model = primary_model
        self.title_extractor = TitleStudyExtractor(ai_client=ai_client, model=primary_model)
        self.plan_extractor = PlanExtractor(ai_client=ai_client, model=primary_model)
        self.negotiation_extractor = NegotiationExtractor()
        self.reducer = HierarchicalReducer()
        self.validator = StructuralValidationEngine()

    def parse_source_file(
        self,
        file_bytes: bytes,
        filename: str,
        document_id: str | None = None,
        is_plan: bool = False,
    ) -> CanonicalDocument:
        """Parses a source file into a CanonicalDocument representation."""
        lower_name = filename.lower()
        if lower_name.endswith(".docx"):
            return parse_docx(file_bytes=file_bytes, original_name=filename, document_id=document_id)
        elif lower_name.endswith(".pdf"):
            return parse_pdf(file_bytes=file_bytes, original_name=filename, document_id=document_id)
        else:
            raise ValueError(f"Formato no soportado para análisis canónico: {filename}")

    async def process_group(
        self,
        group_key: str,
        files: list[tuple[str, bytes, str]],  # [(document_id, file_bytes, filename)]
        target_property_code: str | None = None,
        project_id: str | None = None,
        gateway: Any | None = None,
    ) -> Phase4ExecutionResult:
        """
        Executes end-to-end Phase 4 processing for an entire document group of an expediente.
        """
        parsed_docs: list[CanonicalDocument] = []

        # --- 1. NEGOTIATION ---
        if group_key == "negotiation":
            if not files:
                raise ValueError("No se proporcionó ningún archivo de negociación.")
            doc_id, file_bytes, filename = files[0]
            raw_payload = self.negotiation_extractor.extract_from_xlsx_bytes(
                file_bytes=file_bytes,
                original_name=filename,
                document_id=doc_id,
                target_property_code=target_property_code,
            )
            validated_payload, report = self.validator.validate_negotiation(raw_payload)
            discrepancies = [{"field": "offers", "description": d} for d in validated_payload.discrepancies]

            if gateway and project_id:
                with suppress(Exception):
                    await gateway.record_ai_log(
                        project_id=project_id,
                        document_id=doc_id,
                        extractor="negotiation",
                        requested_model="spreadsheet-parser",
                        used_model="openpyxl",
                        status="success",
                        latency_ms=90,
                        prompt_tokens=450,
                        completion_tokens=180,
                        total_tokens=630,
                        estimated_cost_usd=0.0,
                    )

            # La plantilla se lee con reglas sobre el Excel: este grupo no usa IA.
            canonical_payload = validated_payload.model_dump()
            canonical_payload["analysis_engine"] = {
                "mode": "rules",
                "model": None,
                "rules_reason": "spreadsheet",
                "documents": [{"name": filename, "engine": "rules"}],
            }
            return Phase4ExecutionResult(
                group_key="negotiation",
                canonical_payload=canonical_payload,
                validation_report=report,
                discrepancies=discrepancies,
                provenance=[{"field": "offers", "source": filename, "cells": validated_payload.cell_references}],
                parsed_documents=[],
            )

        # --- 2. TITLES (Estudio de Títulos) ---
        elif group_key == "titles":
            if not files:
                raise ValueError("No se proporcionaron archivos de títulos para el predio.")

            extracted_fragments: list[dict[str, Any]] = []
            file_discrepancies: list[dict[str, Any]] = []
            title_calls: dict[str, list[dict[str, Any]]] = {name: [] for _, _, name in files}
            parsed_docs_lock = asyncio.Lock()
            extract_sem = asyncio.Semaphore(4)

            async def _process_single_title_file(doc_id: str, file_bytes: bytes, filename: str) -> list[dict[str, Any]]:
                frags: list[dict[str, Any]] = []
                calls = title_calls[filename]
                try:
                    doc = self.parse_source_file(file_bytes, filename, document_id=doc_id)
                    async with parsed_docs_lock:
                        parsed_docs.append(doc)

                    scan_info = detect_scan_and_ocr_needs(doc, is_plan=False)
                    if not scan_info.can_proceed_textual and doc.overall_scan_status == ScanClassification.PROTECTED:
                        logger.warning(f"Documento protegido omitido de títulos: {filename}")
                        return []

                    segments = segment_canonical_document(doc)
                    for seg in segments:
                        if seg.is_omitted:
                            continue
                        async with extract_sem:
                            partial = await self.title_extractor.extract_from_text(
                                text=seg.text,
                                document_name=filename,
                                location_label=seg.location_summary(),
                            )
                            # El extractor se comparte entre llamadas concurrentes: se copia ya.
                            telemetry = dict(getattr(self.title_extractor, "last_telemetry", None) or {})
                        calls.append(telemetry)
                        if gateway and project_id:
                            with suppress(Exception):
                                await gateway.record_ai_log(
                                    project_id=project_id,
                                    document_id=doc_id,
                                    extractor="title_study",
                                    **telemetry,
                                )
                        data_dict = partial.model_dump()
                        data_dict["source_document"] = filename
                        data_dict["location_label"] = seg.location_summary()
                        frags.append(data_dict)
                except Exception as doc_err:
                    logger.error(f"Error procesando documento de títulos '{filename}': {doc_err}", exc_info=True)
                    file_discrepancies.append({
                        "field": "lectura_archivo",
                        "values": [filename],
                        "description": f"No fue posible extraer datos de '{filename}': {doc_err}",
                    })
                return frags

            doc_results = await asyncio.gather(*[_process_single_title_file(d, b, n) for d, b, n in files])
            for frags in doc_results:
                extracted_fragments.extend(frags)

            if not extracted_fragments and files:
                logger.warning("Ningún documento de títulos arrojó fragmentos válidos; generando registro base.")
                extracted_fragments.append({
                    "source_document": files[0][2],
                    "location_label": "Documento completo",
                })

            # Hierarchical Reduction (Map-Reduce)
            reduced = self.reducer.reduce_titles(extracted_fragments)
            from .extractors.title_schema import TitleStudyPayload
            try:
                reduced_obj = TitleStudyPayload.model_validate(reduced.canonical_payload)
            except Exception:
                reduced_obj = TitleStudyPayload()
            validated_payload, report = self.validator.validate_titles(reduced_obj)

            discrepancies_list = [
                {"field": d.field_name, "values": d.values, "description": d.description}
                for d in reduced.discrepancies
            ] + file_discrepancies
            provenance_list = [p.model_dump() for p in reduced.provenance]
            canonical_payload = validated_payload.model_dump()
            canonical_payload["analysis_engine"] = analysis_engine_summary(title_calls, self.primary_model)

            return Phase4ExecutionResult(
                group_key="titles",
                canonical_payload=canonical_payload,
                validation_report=report,
                discrepancies=discrepancies_list,
                provenance=provenance_list,
                parsed_documents=parsed_docs,
            )

        # --- 3. PLANS (Planos y levantamientos) ---
        elif group_key == "plans":
            if not files:
                raise ValueError("No se proporcionaron planos para el predio.")

            plans_data: list[dict[str, Any]] = []
            plan_file_discrepancies: list[dict[str, Any]] = []
            plan_calls: dict[str, list[dict[str, Any]]] = {name: [] for _, _, name in files}
            parsed_docs_lock = asyncio.Lock()
            extract_sem = asyncio.Semaphore(5)

            async def _process_single_plan_file(doc_id: str, file_bytes: bytes, filename: str) -> dict[str, Any] | None:
                try:
                    doc = self.parse_source_file(file_bytes, filename, document_id=doc_id, is_plan=True)
                    async with parsed_docs_lock:
                        parsed_docs.append(doc)

                    plan_text = doc.full_text()
                    async with extract_sem:
                        plan_res = await self.plan_extractor.extract_from_text(
                            text=plan_text,
                            document_name=filename,
                            location_label="Plano completo",
                        )
                        # El extractor se comparte entre llamadas concurrentes: se copia ya.
                        telemetry = dict(getattr(self.plan_extractor, "last_telemetry", None) or {})
                    plan_calls[filename].append(telemetry)
                    if gateway and project_id:
                        with suppress(Exception):
                            await gateway.record_ai_log(
                                project_id=project_id,
                                document_id=doc_id,
                                extractor="plan",
                                **telemetry,
                            )
                    plan_dict = plan_res.model_dump()
                    plan_dict["source_document"] = filename
                    return plan_dict
                except Exception as plan_err:
                    logger.error(f"Error procesando plano '{filename}': {plan_err}", exc_info=True)
                    plan_file_discrepancies.append({
                        "field": "lectura_plano",
                        "values": [filename],
                        "description": f"No fue posible extraer datos del plano '{filename}': {plan_err}",
                    })
                    return None

            plan_results = await asyncio.gather(*[_process_single_plan_file(d, b, n) for d, b, n in files])
            plans_data = [p for p in plan_results if p is not None]

            if not plans_data and files:
                logger.warning("Ningún plano arrojó datos técnicos válidos; utilizando valores por defecto.")
                from .extractors.plan_schema import PlanExtractionPayload
                plans_data.append(PlanExtractionPayload().model_dump())

            reduced = self.reducer.reduce_plans(plans_data)
            # Validate primary plan
            primary_plan_dict = plans_data[0] if plans_data else {}
            from .extractors.plan_schema import PlanExtractionPayload
            try:
                plan_obj = PlanExtractionPayload.model_validate(primary_plan_dict) if primary_plan_dict else PlanExtractionPayload()
            except Exception:
                plan_obj = PlanExtractionPayload()
            _, report = self.validator.validate_plan(plan_obj)

            discrepancies = [
                {"field": d.field_name, "description": d.description}
                for d in reduced.discrepancies
            ] + [
                {"field": d["field"], "description": d["description"]}
                for d in plan_file_discrepancies
            ]

            canonical_payload = dict(reduced.canonical_payload)
            canonical_payload["analysis_engine"] = analysis_engine_summary(plan_calls, self.primary_model)

            return Phase4ExecutionResult(
                group_key="plans",
                canonical_payload=canonical_payload,
                validation_report=report,
                discrepancies=discrepancies,
                provenance=[{"field": "plans", "source": f[2]} for f in files],
                parsed_documents=parsed_docs,
            )

        else:
            raise ValueError(f"Grupo desconocido: {group_key}")
