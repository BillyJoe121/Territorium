import re
from typing import Any
from pydantic import BaseModel


class AuditRepair(BaseModel):
    field_name: str
    original_value: Any
    repaired_value: Any
    repair_rule: str
    is_substantive: bool = False  # Always False: automatic repairs are never substantive


class ValidationIssue(BaseModel):
    severity: str  # "error" | "warning"
    field_name: str
    message: str
    suggested_action: str | None = None


def validate_and_normalize_folio(raw_folio: str | None) -> tuple[bool, str | None, list[AuditRepair], list[ValidationIssue]]:
    repairs: list[AuditRepair] = []
    issues: list[ValidationIssue] = []

    if not raw_folio or raw_folio.strip().lower() in ("no identificado", "—", ""):
        issues.append(ValidationIssue(
            severity="error",
            field_name="folio",
            message="El folio de matrícula inmobiliaria no está identificado.",
            suggested_action="Verificar la carátula o encabezado del certificado de tradición y libertad.",
        ))
        return False, None, repairs, issues

    cleaned = raw_folio.strip().upper()
    if cleaned != raw_folio:
        repairs.append(AuditRepair(
            field_name="folio",
            original_value=raw_folio,
            repaired_value=cleaned,
            repair_rule="Limpieza de espacios y mayúsculas en folio registral",
        ))

    # Standard pattern: 3 digits + optional letter + '-' + 5 to 8 digits
    if not re.match(r"^[0-9]{3}[A-Z]?-[0-9]{4,8}$", cleaned):
        issues.append(ValidationIssue(
            severity="warning",
            field_name="folio",
            message=f"El formato del folio '{cleaned}' no coincide con el estándar registral colombiano (ej. 350-108418 o 050N-204581).",
            suggested_action="Confirmar si corresponde a una oficina especial o matrícula antigua.",
        ))
        return False, cleaned, repairs, issues

    return True, cleaned, repairs, issues


def validate_and_normalize_cadastral_id(raw_cadastral: str | None) -> tuple[bool, str | None, list[AuditRepair], list[ValidationIssue]]:
    repairs: list[AuditRepair] = []
    issues: list[ValidationIssue] = []

    if not raw_cadastral or raw_cadastral.strip().lower() in ("no identificado", "—", ""):
        issues.append(ValidationIssue(
            severity="warning",
            field_name="cadastral_id",
            message="La cédula catastral no está identificada en el documento.",
            suggested_action="Consultar el geoportal catastral o recibo de impuesto predial.",
        ))
        return False, None, repairs, issues

    # Remove non-alphanumeric except hyphen
    cleaned = re.sub(r"[\s\.]", "", raw_cadastral)
    if cleaned != raw_cadastral:
        repairs.append(AuditRepair(
            field_name="cadastral_id",
            original_value=raw_cadastral,
            repaired_value=cleaned,
            repair_rule="Eliminación de puntos y espacios en identificador catastral",
        ))

    digits_only = re.sub(r"\D", "", cleaned)
    if len(digits_only) not in (15, 20, 30):
        issues.append(ValidationIssue(
            severity="warning",
            field_name="cadastral_id",
            message=f"La cédula catastral '{cleaned}' tiene {len(digits_only)} dígitos; el estándar nacional colombiano es de 20 o 30 dígitos (o 15 en catastro municipal anterior).",
            suggested_action="Verificar consistencia con la ficha catastral oficial.",
        ))

    return True, cleaned, repairs, issues


def validate_and_normalize_doc_number(doc_type: str, raw_num: str | None) -> tuple[str, list[AuditRepair], list[ValidationIssue]]:
    repairs: list[AuditRepair] = []
    issues: list[ValidationIssue] = []

    if not raw_num or raw_num.strip().lower() in ("no identificado", "—", ""):
        issues.append(ValidationIssue(
            severity="warning",
            field_name="document_number",
            message="El número de identificación del propietario no está especificado.",
            suggested_action="Completar con la copia de la cédula del titular.",
        ))
        return "no identificado", repairs, issues

    cleaned = re.sub(r"[\s\.]", "", raw_num.strip())
    if cleaned != raw_num:
        repairs.append(AuditRepair(
            field_name="document_number",
            original_value=raw_num,
            repaired_value=cleaned,
            repair_rule="Limpieza de puntos en número de identificación",
        ))

    return cleaned, repairs, issues


def validate_boundaries_text(boundaries: str | None) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    if not boundaries or boundaries.strip().lower() in ("no identificado", "—", ""):
        issues.append(ValidationIssue(
            severity="error",
            field_name="boundaries",
            message="No se encontraron linderos transcritos para el predio.",
            suggested_action="Localizar la cláusula de linderos en la escritura o resolución de adjudicación.",
        ))
    elif len(boundaries.strip()) < 30:
        issues.append(ValidationIssue(
            severity="warning",
            field_name="boundaries",
            message="La descripción de linderos parece incompleta o resumida (menos de 30 caracteres).",
            suggested_action="Revisar el documento fuente para transcribir la totalidad de colindancias.",
        ))
    return issues
