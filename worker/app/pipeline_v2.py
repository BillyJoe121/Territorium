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

    def to_output_record(self, execution_id: str, project_id: str, group_id: str) -> dict[str, Any]:
        """
        Formats the output payload according to the public.expediente_execution_outputs schema.
        """
        full_payload = {
            "canonical_data": self.canonical_payload,
            "validation_report": self.validation_report.model_dump(),
            "discrepancies": self.discrepancies,
            "provenance": self.provenance,
            "documents_summary": [
                {
                    "document_id": doc.document_id,
                    "original_name": doc.original_name,
                    "sha256": doc.sha256,
                    "page_count": doc.page_count,
                    "scan_status": doc.overall_scan_status.value,
                }
                for doc in self.parsed_documents
            ],
        }
        return {
            "execution_id": execution_id,
            "project_id": project_id,
            "group_id": group_id,
            "payload": full_payload,
            "payload_sha256": hashlib.sha256(json.dumps(full_payload, sort_keys=True).encode("utf-8")).hexdigest(),
        }


class Phase4PipelineOrchestrator:
    """
    Production orchestrator for Phase 4 (HU-V2-034 to HU-V2-041):
    Canonical Parsing -> Scan Detection & OCR -> Semantic Segmentation ->
    Specialized Extraction -> Hierarchical Reduction -> Structural Validation.
    """
    def __init__(
        self,
        ai_client: Any | None = None,
        max_concurrency: int = 3,
        primary_model: str = "gpt-4o",
    ) -> None:
        self.ai_client = ai_client
        self.title_extractor = TitleStudyExtractor(ai_client=ai_client, model=primary_model)
        self.plan_extractor = PlanExtractor(ai_client=ai_client, model=primary_model)
        self.negotiation_extractor = NegotiationExtractor()
        self.reducer = HierarchicalReducer(max_concurrency=max_concurrency)
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

            return Phase4ExecutionResult(
                group_key="negotiation",
                canonical_payload=validated_payload.model_dump(),
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

            for doc_id, file_bytes, filename in files:
                doc = self.parse_source_file(file_bytes, filename, document_id=doc_id)
                parsed_docs.append(doc)

                scan_info = detect_scan_and_ocr_needs(doc, is_plan=False)
                if not scan_info.can_proceed_textual and doc.overall_scan_status == ScanClassification.PROTECTED:
                    logger.warning(f"Documento protegido omitido de títulos: {filename}")
                    continue

                segments = segment_canonical_document(doc)
                for seg in segments:
                    if seg.is_omitted:
                        continue
                    # Extract partial result
                    partial = await self.title_extractor.extract_from_text(
                        text=seg.text,
                        document_name=filename,
                        location_label=seg.location_summary(),
                    )
                    data_dict = partial.model_dump()
                    data_dict["source_document"] = filename
                    data_dict["location_label"] = seg.location_summary()
                    extracted_fragments.append(data_dict)

            # Hierarchical Reduction (Map-Reduce)
            reduced = self.reducer.reduce_titles(extracted_fragments)
            from .extractors.title_schema import TitleStudyPayload
            reduced_obj = TitleStudyPayload.model_validate(reduced.canonical_payload)
            validated_payload, report = self.validator.validate_titles(reduced_obj)

            discrepancies_list = [
                {"field": d.field_name, "values": d.values, "description": d.description}
                for d in reduced.discrepancies
            ]
            provenance_list = [p.model_dump() for p in reduced.provenance]

            return Phase4ExecutionResult(
                group_key="titles",
                canonical_payload=validated_payload.model_dump(),
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

            for doc_id, file_bytes, filename in files:
                doc = self.parse_source_file(file_bytes, filename, document_id=doc_id, is_plan=True)
                parsed_docs.append(doc)

                plan_text = doc.full_text()
                plan_res = await self.plan_extractor.extract_from_text(
                    text=plan_text,
                    document_name=filename,
                    location_label="Plano completo",
                )
                plans_data.append(plan_res.model_dump())

            reduced = self.reducer.reduce_plans(plans_data)
            # Validate primary plan
            primary_plan_dict = plans_data[0] if plans_data else {}
            from .extractors.plan_schema import PlanExtractionPayload
            plan_obj = PlanExtractionPayload.model_validate(primary_plan_dict) if primary_plan_dict else PlanExtractionPayload()
            _, report = self.validator.validate_plan(plan_obj)

            return Phase4ExecutionResult(
                group_key="plans",
                canonical_payload=reduced.canonical_payload,
                validation_report=report,
                discrepancies=[{"field": d.field_name, "description": d.description} for d in reduced.discrepancies],
                provenance=[{"field": "plans", "source": f[2]} for f in files],
                parsed_documents=parsed_docs,
            )

        else:
            raise ValueError(f"Grupo desconocido: {group_key}")
