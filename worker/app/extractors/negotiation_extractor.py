from typing import Any

from ..preprocessing.negotiation_reader import NegotiationOfferRow, read_negotiation_xlsx
from ..utils.spanish_currency import compare_number_and_letters
from .negotiation_schema import NegotiationExtractionPayload


def _format_currency_cop(val: float | None) -> str:
    if val is None:
        return "—"
    return f"$ {val:,.0f}".replace(",", ".")


class NegotiationExtractor:
    def extract_from_xlsx_bytes(
        self,
        file_bytes: bytes,
        original_name: str,
        document_id: str,
        target_property_code: str | None = None,
    ) -> NegotiationExtractionPayload:
        """
        Deterministically extracts and validates negotiation values from an XLSX workbook (HU-V2-040).
        """
        book_res = read_negotiation_xlsx(
            file_bytes=file_bytes,
            original_name=original_name,
            document_id=document_id,
            target_property_code=target_property_code,
        )

        row = book_res.active_row
        if not row:
            return NegotiationExtractionPayload(
                property_code=target_property_code or "no identificado",
                values_match="Sin datos de negociación en el archivo",
                discrepancies=["No se encontraron filas con ofertas válidas en el archivo Excel."],
            )

        # Compare offer 1
        m1, exp1 = compare_number_and_letters(row.first_offer_number, row.first_offer_letters)
        # Compare offer 2
        m2, exp2 = compare_number_and_letters(row.second_offer_number, row.second_offer_letters)
        # Compare offer 3
        m3, exp3 = compare_number_and_letters(row.third_offer_number, row.third_offer_letters)

        discrepancies: list[str] = []
        if not m1:
            discrepancies.append(f"Oferta 1: {exp1}")
        if not m2:
            discrepancies.append(f"Oferta 2: {exp2}")
        if row.third_offer_number and not m3:
            discrepancies.append(f"Oferta 3: {exp3}")

        overall_match_label = "Sí, coinciden" if not discrepancies else f"Discrepancia detectada ({len(discrepancies)})"

        cell_refs = {}
        if row.first_offer_number_cell:
            cell_refs["first_offer_numbers"] = row.first_offer_number_cell
        if row.first_offer_letters_cell:
            cell_refs["first_offer_letters"] = row.first_offer_letters_cell
        if row.second_offer_number_cell:
            cell_refs["second_offer_numbers"] = row.second_offer_number_cell
        if row.second_offer_letters_cell:
            cell_refs["second_offer_letters"] = row.second_offer_letters_cell
        if row.third_offer_number_cell:
            cell_refs["third_offer_numbers"] = row.third_offer_number_cell

        return NegotiationExtractionPayload(
            property_code=row.property_code or target_property_code or "no identificado",
            first_offer_numbers=_format_currency_cop(row.first_offer_number),
            first_offer_numeric_value=row.first_offer_number,
            first_offer_letters=row.first_offer_letters or "—",
            first_offer_matches=m1,
            second_offer_numbers=_format_currency_cop(row.second_offer_number),
            second_offer_numeric_value=row.second_offer_number,
            second_offer_letters=row.second_offer_letters or "—",
            second_offer_matches=m2,
            third_offer_numbers=_format_currency_cop(row.third_offer_number),
            third_offer_numeric_value=row.third_offer_number,
            third_offer_letters=row.third_offer_letters or "—",
            third_offer_matches=m3,
            appraisal_value=row.appraisal_value,
            values_match=overall_match_label,
            discrepancies=discrepancies,
            cell_references=cell_refs,
        )
