from datetime import UTC, datetime
import hashlib
import json
from typing import Any
from pydantic import BaseModel, Field


class ConsolidatedMasterRecord(BaseModel):
    folio: str = Field(default="no identificado")
    cadastral_id: str = Field(default="no identificado")
    property_name: str = Field(default="no identificado")
    municipality: str = Field(default="no identificado")
    department: str = Field(default="no identificado")
    village: str = Field(default="no identificado")
    owners: str = Field(default="no identificado")
    acquisition_mode: str = Field(default="no identificado")
    boundaries: str = Field(default="no identificado")
    boundaries_document: str = Field(default="no identificado")
    legal_conditions: str = Field(default="sin condiciones jurídicas vigentes")
    justice_ministry_case: str = Field(default="no identificado")
    urt_case: str = Field(default="no identificado")
    urt_territorial_direction: str = Field(default="no identificado")

    easement_area: str = Field(default="—")
    easement_length: str = Field(default="—")
    easement_width: str = Field(default="—")
    infrastructure_count: str = Field(default="0")
    plan_name: str = Field(default="—")
    plan_scale: str = Field(default="—")
    voltage_level: str = Field(default="—")

    property_code: str = Field(default="—")
    first_offer: str = Field(default="—")
    second_offer: str = Field(default="—")
    third_offer: str = Field(default="—")
    values_match: str = Field(default="Sí, coinciden")

    metadata: dict[str, Any] = Field(default_factory=dict)


def consolidate_property_records(
    titles_payload: dict[str, Any],
    titles_version_id: str,
    plans_payload: dict[str, Any],
    plans_version_id: str,
    negotiation_payload: dict[str, Any],
    negotiation_version_id: str,
    user_id: str | None = None,
) -> ConsolidatedMasterRecord:
    """
    Deterministic consolidation of 3 approved document groups into a master property record (HU-V2-045).
    """
    # Extract primary plan if multiple
    plans_list = plans_payload.get("plans", [])
    primary_plan = plans_list[0] if isinstance(plans_list, list) and plans_list else plans_payload

    # Extract owners string
    owners_list = titles_payload.get("owners", [])
    if isinstance(owners_list, list) and owners_list:
        owners_str = "; ".join(
            f"{o.get('name', '')} ({o.get('document_type', 'CC')} {o.get('document_number', '')})".strip()
            for o in owners_list if isinstance(o, dict) and o.get("name")
        )
    else:
        owners_str = str(titles_payload.get("owners_str") or titles_payload.get("owners") or "no identificado")

    meta = {
        "titles_result_version_id": titles_version_id,
        "plans_result_version_id": plans_version_id,
        "negotiation_result_version_id": negotiation_version_id,
        "consolidated_at": datetime.now(UTC).isoformat(),
        "consolidated_by": user_id,
        "is_valid": True,
    }

    return ConsolidatedMasterRecord(
        folio=str(titles_payload.get("folio") or "no identificado"),
        cadastral_id=str(titles_payload.get("cadastral_id") or "no identificado"),
        property_name=str(titles_payload.get("property_name") or "no identificado"),
        municipality=str(titles_payload.get("municipality") or "no identificado"),
        department=str(titles_payload.get("department") or "no identificado"),
        village=str(titles_payload.get("village") or "no identificado"),
        owners=owners_str,
        acquisition_mode=str(titles_payload.get("acquisition_mode") or "no identificado"),
        boundaries=str(titles_payload.get("boundaries") or "no identificado"),
        boundaries_document=str(titles_payload.get("boundaries_document") or "no identificado"),
        legal_conditions=str(titles_payload.get("legal_conditions") or "sin condiciones jurídicas vigentes"),
        justice_ministry_case=str(titles_payload.get("justice_ministry_case") or "no identificado"),
        urt_case=str(titles_payload.get("urt_case") or "no identificado"),
        urt_territorial_direction=str(titles_payload.get("urt_territorial_direction") or "no identificado"),

        easement_area=str(plans_payload.get("total_easement_area_numbers") or primary_plan.get("easement_area_numbers") or "—"),
        easement_length=str(plans_payload.get("total_easement_length_numbers") or primary_plan.get("easement_length_numbers") or "—"),
        easement_width=str(primary_plan.get("easement_width_numbers") or "—"),
        infrastructure_count=str(plans_payload.get("total_infrastructure_count") or primary_plan.get("infrastructure_count_numbers") or "0"),
        plan_name=str(primary_plan.get("plan_name") or "—"),
        plan_scale=str(primary_plan.get("plan_scale") or "—"),
        voltage_level=str(primary_plan.get("voltage_level") or "—"),

        property_code=str(negotiation_payload.get("property_code") or "—"),
        first_offer=str(negotiation_payload.get("first_offer_numbers") or "—"),
        second_offer=str(negotiation_payload.get("second_offer_numbers") or "—"),
        third_offer=str(negotiation_payload.get("third_offer_numbers") or "—"),
        values_match=str(negotiation_payload.get("values_match") or "Sí, coinciden"),

        metadata=meta,
    )
