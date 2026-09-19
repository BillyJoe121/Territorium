from typing import Any
from pydantic import BaseModel, Field

from ..extractors.negotiation_schema import NegotiationExtractionPayload
from ..extractors.plan_schema import PlanExtractionPayload
from ..extractors.title_schema import TitleStudyPayload
from .rules import (
    AuditRepair,
    ValidationIssue,
    validate_and_normalize_cadastral_id,
    validate_and_normalize_doc_number,
    validate_and_normalize_folio,
    validate_boundaries_text,
)


class ValidationReport(BaseModel):
    schema_version: str = "v2.0.0"
    is_valid: bool = True
    errors: list[ValidationIssue] = Field(default_factory=list)
    warnings: list[ValidationIssue] = Field(default_factory=list)
    audit_repairs: list[AuditRepair] = Field(default_factory=list)

    def add_issue(self, issue: ValidationIssue) -> None:
        if issue.severity == "error":
            self.errors.append(issue)
            self.is_valid = False
        else:
            self.warnings.append(issue)


class StructuralValidationEngine:
    """
    Validates and performs auditable non-destructive repairs on canonical extraction outputs (HU-V2-041).
    Never replaces substantive legal values without an explicit audit log.
    """
    def validate_titles(self, payload: TitleStudyPayload) -> tuple[TitleStudyPayload, ValidationReport]:
        report = ValidationReport()

        # Folio validation
        valid_folio, cleaned_folio, folio_repairs, folio_issues = validate_and_normalize_folio(payload.folio)
        report.audit_repairs.extend(folio_repairs)
        for issue in folio_issues:
            report.add_issue(issue)
        if cleaned_folio:
            payload.folio = cleaned_folio

        # Cadastral ID validation
        valid_cad, cleaned_cad, cad_repairs, cad_issues = validate_and_normalize_cadastral_id(payload.cadastral_id)
        report.audit_repairs.extend(cad_repairs)
        for issue in cad_issues:
            report.add_issue(issue)
        if cleaned_cad:
            payload.cadastral_id = cleaned_cad

        # Owners check
        if not payload.owners:
            report.add_issue(ValidationIssue(
                severity="error",
                field_name="owners",
                message="El predio no tiene ningún propietario actual identificado.",
                suggested_action="Revisar las últimas anotaciones de adjudicación o compraventa del certificado.",
            ))
        else:
            for owner in payload.owners:
                cleaned_doc, doc_repairs, doc_issues = validate_and_normalize_doc_number(owner.document_type, owner.document_number)
                report.audit_repairs.extend(doc_repairs)
                for issue in doc_issues:
                    report.add_issue(issue)
                owner.document_number = cleaned_doc

        # Boundaries check
        bound_issues = validate_boundaries_text(payload.boundaries)
        for issue in bound_issues:
            report.add_issue(issue)

        # Property Name check
        if not payload.property_name or payload.property_name.strip().lower() in ("no identificado", "—"):
            report.add_issue(ValidationIssue(
                severity="warning",
                field_name="property_name",
                message="El nombre del predio no fue identificado.",
                suggested_action="Verificar la carátula del folio o la cláusula de identificación de la escritura.",
            ))

        return payload, report

    def validate_plan(self, payload: PlanExtractionPayload) -> tuple[PlanExtractionPayload, ValidationReport]:
        report = ValidationReport()

        if not payload.plan_name or payload.plan_name.strip().lower() in ("no identificado", "—"):
            report.add_issue(ValidationIssue(
                severity="error",
                field_name="plan_name",
                message="El plano no tiene un nombre o código técnico identificado.",
                suggested_action="Verificar la cartela o rótulo del plano topográfico.",
            ))

        if payload.easement_area_numbers in ("—", "no identificado", "", None):
            report.add_issue(ValidationIssue(
                severity="warning",
                field_name="easement_area_numbers",
                message="No se identificó el área numérica de servidumbre en el plano.",
                suggested_action="Verificar el cuadro de áreas o polígono de afectación.",
            ))

        return payload, report

    def validate_negotiation(self, payload: NegotiationExtractionPayload) -> tuple[NegotiationExtractionPayload, ValidationReport]:
        report = ValidationReport()

        if not payload.first_offer_matches:
            report.add_issue(ValidationIssue(
                severity="error",
                field_name="first_offer_numbers",
                message=f"Discrepancia en la primera oferta: el valor numérico no coincide con las letras ({payload.first_offer_numbers} vs '{payload.first_offer_letters}').",
                suggested_action="Corregir manualmente en la tabla de revisión antes de aprobar.",
            ))

        if not payload.second_offer_matches:
            report.add_issue(ValidationIssue(
                severity="error",
                field_name="second_offer_numbers",
                message=f"Discrepancia en la segunda oferta: el valor numérico no coincide con las letras ({payload.second_offer_numbers} vs '{payload.second_offer_letters}').",
                suggested_action="Corregir manualmente en la tabla de revisión antes de aprobar.",
            ))

        if payload.first_offer_numeric_value is None and payload.second_offer_numeric_value is None:
            report.add_issue(ValidationIssue(
                severity="error",
                field_name="first_offer_numbers",
                message="El archivo de negociación no contiene ninguna oferta económica válida.",
                suggested_action="Verificar si la columna de ofertas está presente en la hoja activa.",
            ))

        return payload, report
