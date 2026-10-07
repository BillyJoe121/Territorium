from typing import Any

from ..preprocessing.negotiation_reader import NegotiationOfferRow, read_negotiation_xlsx
from ..utils.spanish_currency import amount_in_words, compare_number_and_letters
from .negotiation_schema import NegotiationExtractionPayload


def _format_currency_cop(val: float | None) -> str:
    if val is None:
        return "—"
    return f"$ {val:,.0f}".replace(",", ".")


def _offer(number: float | None, letters: str | None) -> dict[str, Any]:
    """Oferta en números y letras. Si la plantilla no trae letras, se redactan desde el número."""
    generated = number is not None and not (letters and letters.strip())
    text = amount_in_words(number) if generated else (letters or "")
    if generated:
        # Redactadas desde el mismo número: coinciden por construcción.
        matches, explanation = True, "Letras redactadas a partir del valor en números"
    else:
        matches, explanation = compare_number_and_letters(number, text) if number is not None or text else (True, "")
    return {
        "numbers": _format_currency_cop(number),
        "numeric_value": number,
        "letters": text or "—",
        "letters_generated": generated,
        "matches": matches,
        "explanation": explanation,
    }


def _row_score(row: NegotiationOfferRow) -> int:
    return sum(v is not None for v in (row.fmi, row.cadastral_id, row.first_offer_number, row.second_offer_number, row.third_offer_number))


def negotiation_rows(rows: list[NegotiationOfferRow]) -> list[dict[str, Any]]:
    """Una fila por predio: el libro puede repetir carpetas en hojas resumen; se conserva la más completa."""
    best: dict[str, NegotiationOfferRow] = {}
    order: list[str] = []
    for row in rows:
        key = (row.property_code or row.fmi or "").strip().upper()
        if not key:
            continue
        if key not in best:
            order.append(key)
            best[key] = row
        elif _row_score(row) > _row_score(best[key]):
            best[key] = row
    result = []
    for key in order:
        row = best[key]
        no_offers = row.first_offer_number is None and row.second_offer_number is None and row.third_offer_number is None
        if no_offers and not row.warnings:
            continue
        o1 = _offer(row.first_offer_number, row.first_offer_letters)
        o2 = _offer(row.second_offer_number, row.second_offer_letters)
        o3 = _offer(row.third_offer_number, row.third_offer_letters)
        mismatches = [label for label, o in (("Oferta 1", o1), ("Oferta 2", o2), ("Oferta 3", o3)) if not o["matches"]]
        result.append({
            "property_code": row.property_code or "",
            "fmi": row.fmi or "",
            "cadastral_id": row.cadastral_id or "",
            "first_offer_numbers": o1["numbers"], "first_offer_letters": o1["letters"],
            "second_offer_numbers": o2["numbers"], "second_offer_letters": o2["letters"],
            "third_offer_numbers": o3["numbers"], "third_offer_letters": o3["letters"],
            "letters_generated": any(o["letters_generated"] for o in (o1, o2, o3)),
            "values_match": (
                f"Ofertas sin valor: {row.warnings[0].lower()}. Abre el archivo en Excel, guárdalo y vuelve a cargarlo"
                if no_offers and row.warnings
                else "Sí, coinciden" if not mismatches else f"No coinciden: {', '.join(mismatches)}"
            ),
            "read_warnings": row.warnings,
            "appraisal_value": row.appraisal_value,
            "source": f"{row.sheet_name}!fila {row.row_number}" if row.sheet_name else "",
        })
    return result


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
                negotiations=negotiation_rows(book_res.rows),
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

        has_any_offers = any([
            row.first_offer_number is not None,
            row.first_offer_letters is not None,
            row.second_offer_number is not None,
            row.second_offer_letters is not None,
            row.third_offer_number is not None,
            row.third_offer_letters is not None,
        ])
        if not has_any_offers:
            overall_match_label = "Sin ofertas registradas"
        else:
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
        if row.third_offer_letters_cell:
            cell_refs["third_offer_letters"] = row.third_offer_letters_cell

        payload = NegotiationExtractionPayload(
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
            negotiations=negotiation_rows(book_res.rows),
        )
        gaps = sum(len(r.warnings) for r in book_res.rows)
        if gaps:
            payload.discrepancies.append(
                f"El archivo tiene {gaps} celda(s) con fórmulas sin valor calculado. Ábrelo en Excel, guárdalo y vuelve a cargarlo."
            )
        return payload
