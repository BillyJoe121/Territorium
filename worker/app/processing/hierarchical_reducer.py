import asyncio
from typing import Any, Callable, Coroutine
from pydantic import BaseModel, Field

from ..models.canonical import FragmentLocator


class FieldDiscrepancy(BaseModel):
    field_name: str
    values: list[Any]
    sources: list[str]
    description: str


class ProvenanceReference(BaseModel):
    field_name: str
    source_document: str
    location: str
    quote: str | None = None


class ReducedExtractionResult(BaseModel):
    group_key: str
    is_complete: bool = True
    canonical_payload: dict[str, Any] = Field(default_factory=dict)
    collections: dict[str, list[Any]] = Field(default_factory=dict)
    discrepancies: list[FieldDiscrepancy] = Field(default_factory=list)
    provenance: list[ProvenanceReference] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class HierarchicalReducer:
    """
    Executes tasks with bounded concurrency (asyncio.Semaphore)
    and reduces partial extraction results into a unified canonical record (HU-V2-037).
    """
    def __init__(self, max_concurrency: int = 3) -> None:
        self.semaphore = asyncio.Semaphore(max_concurrency)

    async def execute_concurrent(
        self,
        tasks: list[Callable[[], Coroutine[Any, Any, dict[str, Any]]]],
    ) -> list[dict[str, Any]]:
        """Executes a list of coroutine factories with bounded concurrency."""
        async def _bounded_exec(task_fn: Callable[[], Coroutine[Any, Any, dict[str, Any]]]) -> dict[str, Any]:
            async with self.semaphore:
                return await task_fn()

        results = await asyncio.gather(*[_bounded_exec(t) for t in tasks], return_exceptions=False)
        return results

    def reduce_titles(self, partial_results: list[dict[str, Any]]) -> ReducedExtractionResult:
        """
        Reduces title extraction fragments into a single canonical title study record.
        Preserves complete owners list, literal boundaries, chronological acquisitions,
        and records any conflicting data as discrepancies.
        """
        canonical: dict[str, Any] = {}
        owners_map: dict[str, dict[str, Any]] = {}
        acquisitions: list[str] = []
        conditions: list[str] = []
        discrepancies: list[FieldDiscrepancy] = []
        provenance: list[ProvenanceReference] = []
        warnings: list[str] = []

        scalar_fields = [
            "folio", "cadastral_id", "property_name", "municipality", "department",
            "village", "area_numbers", "area_letters", "registry_office",
            "boundaries_document", "justice_ministry_case", "urt_case",
            "urt_territorial_direction", "antecedents_consultation_date"
        ]

        seen_scalar_values: dict[str, dict[str, str]] = {f: {} for f in scalar_fields}
        longest_boundaries = ""

        for idx, res in enumerate(partial_results):
            source_doc = res.get("source_document", f"Fragmento {idx + 1}")
            loc = res.get("location_label", f"Sección {idx + 1}")

            # Check scalar fields
            for f in scalar_fields:
                val = res.get(f)
                if val and str(val).strip() and str(val).strip().lower() not in ("no identificado", "—", "none"):
                    cleaned_val = str(val).strip()
                    seen_scalar_values[f][source_doc] = cleaned_val
                    if f not in canonical or not canonical[f]:
                        canonical[f] = cleaned_val
                        provenance.append(ProvenanceReference(
                            field_name=f,
                            source_document=source_doc,
                            location=loc,
                            quote=cleaned_val[:100],
                        ))

            # Owners collection (de-duplicate by document_number if available, else by name)
            for owner in res.get("owners", []):
                if isinstance(owner, dict):
                    doc_num = str(owner.get("document_number") or "").strip()
                    name = str(owner.get("name") or "").strip()
                    key = doc_num if doc_num and doc_num.lower() != "no identificado" else name.lower()
                    if key and key not in owners_map:
                        owners_map[key] = owner

            # Acquisition mode
            acq = res.get("acquisition_mode")
            if acq and str(acq).strip() and str(acq).strip().lower() not in ("no identificado", "—", "sin modo registrado"):
                if str(acq).strip() not in acquisitions:
                    acquisitions.append(str(acq).strip())

            # Legal conditions
            leg = res.get("legal_conditions")
            if leg and str(leg).strip() and str(leg).strip().lower() not in ("no identificado", "—"):
                if str(leg).strip() not in conditions:
                    conditions.append(str(leg).strip())

            # Boundaries: preserve longest literal transcription
            bound = res.get("boundaries")
            if bound and len(str(bound).strip()) > len(longest_boundaries):
                longest_boundaries = str(bound).strip()

        # Check for scalar discrepancies
        for f, val_by_source in seen_scalar_values.items():
            distinct_values = list(set(val_by_source.values()))
            if len(distinct_values) > 1:
                discrepancies.append(
                    FieldDiscrepancy(
                        field_name=f,
                        values=distinct_values,
                        sources=list(val_by_source.keys()),
                        description=f"Valores divergentes encontrados para el campo '{f}': {distinct_values}",
                    )
                )

        canonical["owners"] = list(owners_map.values())
        canonical["acquisition_mode"] = " // ".join(acquisitions) if acquisitions else "no identificado"
        canonical["boundaries"] = longest_boundaries if longest_boundaries else "no identificado"
        canonical["boundaries_exactness"] = "LINDEROS EXACTOS" if len(longest_boundaries) > 50 else "LINDEROS RESUMIDOS"
        canonical["legal_conditions"] = "; ".join(conditions) if conditions else "sin condiciones jurídicas vigentes"

        return ReducedExtractionResult(
            group_key="titles",
            is_complete=bool(canonical.get("folio") and canonical.get("owners")),
            canonical_payload=canonical,
            collections={"owners": list(owners_map.values())},
            discrepancies=discrepancies,
            provenance=provenance,
            warnings=warnings,
        )

    def reduce_plans(self, plan_results: list[dict[str, Any]]) -> ReducedExtractionResult:
        """
        Reduces multi-plan extractions into a consolidated technical view.
        Retains individual plan records and summarizes total servitude area/length.
        """
        plans_list: list[dict[str, Any]] = []
        total_area = 0.0
        total_length = 0.0
        total_infrastructure = 0
        discrepancies: list[FieldDiscrepancy] = []
        warnings: list[str] = []

        for p in plan_results:
            plans_list.append(p)
            try:
                area_val = float(str(p.get("easement_area_numbers") or 0).replace(".", "").replace(",", "."))
                total_area += area_val
            except ValueError:
                pass

            try:
                len_val = float(str(p.get("easement_length_numbers") or 0).replace(".", "").replace(",", "."))
                total_length += len_val
            except ValueError:
                pass

            try:
                inf_val = int(p.get("infrastructure_count_numbers") or 0)
                total_infrastructure += inf_val
            except ValueError:
                pass

        primary_plan = plans_list[0] if plans_list else {}

        canonical = {
            "primary_plan_name": primary_plan.get("plan_name", "no identificado"),
            "plan_count": len(plans_list),
            "plans": plans_list,
            "total_easement_area_numbers": f"{total_area:,.2f} m²" if total_area > 0 else primary_plan.get("easement_area_numbers", "—"),
            "total_easement_length_numbers": f"{total_length:,.2f} m" if total_length > 0 else primary_plan.get("easement_length_numbers", "—"),
            "total_infrastructure_count": total_infrastructure if total_infrastructure > 0 else primary_plan.get("infrastructure_count_numbers", "0"),
            "plan_scale": primary_plan.get("plan_scale", "no identificada"),
        }

        return ReducedExtractionResult(
            group_key="plans",
            is_complete=len(plans_list) > 0,
            canonical_payload=canonical,
            collections={"plans": plans_list},
            discrepancies=discrepancies,
            warnings=warnings,
        )
