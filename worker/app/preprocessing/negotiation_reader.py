import io
import re
import unicodedata
from typing import Any
import openpyxl
from pydantic import BaseModel, Field

from ..models.canonical import FragmentLocator, UnitType


def _normalize_text(text: str) -> str:
    """Removes accents, lowercases and trims for deterministic matching."""
    text = unicodedata.normalize("NFKD", text).encode("ASCII", "ignore").decode("utf-8")
    return re.sub(r"\s+", " ", text).strip().lower()


class NegotiationCell(BaseModel):
    coordinate: str  # e.g. "Sheet1!C5"
    sheet_name: str
    row: int
    column: int
    formula: str | None = None
    calculated_value: Any = None
    data_type: str = "string"


class NegotiationOfferRow(BaseModel):
    property_code: str | None = None
    property_coordinate: str | None = None

    first_offer_number: float | None = None
    first_offer_number_cell: str | None = None
    first_offer_letters: str | None = None
    first_offer_letters_cell: str | None = None

    second_offer_number: float | None = None
    second_offer_number_cell: str | None = None
    second_offer_letters: str | None = None
    second_offer_letters_cell: str | None = None

    third_offer_number: float | None = None
    third_offer_number_cell: str | None = None
    third_offer_letters: str | None = None
    third_offer_letters_cell: str | None = None

    appraisal_value: float | None = None
    appraisal_coordinate: str | None = None

    raw_cells: dict[str, NegotiationCell] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)


class NegotiationBookResult(BaseModel):
    document_id: str
    original_name: str
    sheets: list[str]
    rows: list[NegotiationOfferRow] = Field(default_factory=list)
    active_row: NegotiationOfferRow | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


SPANISH_NUMBER_WORDS = {
    "pesos", "peso", "millon", "millones", "mil", "ciento", "cientos",
    "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos",
    "setecientos", "ochocientos", "novecientos", "veinti", "veinticinco",
    "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa",
    "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
}


def _is_spanish_words(val: Any) -> bool:
    if not val or not isinstance(val, str):
        return False
    norm = _normalize_text(val)
    tokens = set(re.findall(r"[a-z]+", norm))
    return bool(tokens & SPANISH_NUMBER_WORDS)


def _is_property_code_header(norm: str) -> bool:
    if norm in ("carpeta", "codigo", "codigo carpeta", "cod carpeta", "id predio", "codigo predio", "cod predio", "id carpeta", "predio"):
        return True
    if norm.startswith(("carpeta", "codigo carpeta", "cod carpeta")):
        return True
    if norm.startswith(("codigo predio", "id predio", "cod predio")):
        return True
    return False


def _classify_header(norm: str) -> str | None:
    if _is_property_code_header(norm):
        return "property_code"

    # Offer 1
    if any(k in norm for k in ["oferta 1", "oferta no. 1", "oferta no 1", "primera oferta", "valor oferta 1"]):
        if any(w in norm for w in ["letras", "letra", "texto", "escrita"]):
            return "first_offer_letters"
        if any(w in norm for w in ["numeros", "numero", "cifra", "(num)"]):
            return "first_offer_number"
        return "first_offer_number"

    # Offer 2
    if any(k in norm for k in ["oferta 2", "oferta no. 2", "oferta no 2", "segunda oferta", "valor oferta 2"]):
        if any(w in norm for w in ["letras", "letra", "texto", "escrita"]):
            return "second_offer_letters"
        if any(w in norm for w in ["numeros", "numero", "cifra", "(num)"]):
            return "second_offer_number"
        return "second_offer_number"

    # Offer 3
    if any(k in norm for k in ["oferta 3", "oferta no. 3", "oferta no 3", "tercera oferta", "valor oferta 3"]):
        if any(w in norm for w in ["letras", "letra", "texto", "escrita"]):
            return "third_offer_letters"
        if any(w in norm for w in ["numeros", "numero", "cifra", "(num)"]):
            return "third_offer_number"
        return "third_offer_number"

    # Appraisal
    if any(k in norm for k in ["avaluo", "avaluo comercial", "valor comercial"]):
        return "appraisal_value"

    return None


def _clean_numeric_value(val: Any) -> float | None:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    # Parse formatted string like "$ 218.450.000,00" or "218450000"
    s = str(val).strip().replace("$", "").replace(" ", "")
    # Check if dot is thousands separator: e.g. 218.450.000
    if s.count(".") > 1 and "," not in s:
        s = s.replace(".", "")
    elif "." in s and "," in s:
        # e.g. 218.450.000,50
        s = s.replace(".", "").replace(",", ".")
    elif "," in s and "." not in s:
        # e.g. 218450000,50 or 218,450,000
        if len(s.split(",")[-1]) == 3 and len(s) > 6:
            s = s.replace(",", "")
        else:
            s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def read_negotiation_xlsx(
    file_bytes: bytes,
    original_name: str,
    document_id: str,
    target_property_code: str | None = None,
) -> NegotiationBookResult:
    """
    Reads an XLSX file deterministically using openpyxl, loading both
    raw formula expressions and calculated numerical values, mapping
    headers with a controlled synonym table and retaining cell coordinates.
    """
    stream_formulas = io.BytesIO(file_bytes)
    stream_values = io.BytesIO(file_bytes)

    wb_formulas = openpyxl.load_workbook(stream_formulas, data_only=False)
    wb_values = openpyxl.load_workbook(stream_values, data_only=True)

    sheet_names = wb_values.sheetnames
    all_rows: list[NegotiationOfferRow] = []

    for sheet_name in sheet_names:
        ws_formulas = wb_formulas[sheet_name]
        ws_values = wb_values[sheet_name]

        # Locate header row: scan first 15 rows
        header_map: dict[int, str] = {}  # col_idx -> canonical field
        header_row_idx = None

        for r_idx in range(1, min(15, ws_values.max_row + 1)):
            matches = 0
            row_map: dict[int, str] = {}
            for c_idx in range(1, ws_values.max_column + 1):
                cell_val = ws_values.cell(row=r_idx, column=c_idx).value
                if cell_val and isinstance(cell_val, str):
                    norm = _normalize_text(cell_val)
                    canon = _classify_header(norm)
                    if canon:
                        # Check duplicate mappings
                        existing = [col for col, f in row_map.items() if f == canon]
                        if existing and canon.endswith("_number"):
                            prefix = canon.replace("_number", "")
                            # Check next row to see if this duplicate column has letters
                            sample_val = ws_values.cell(row=r_idx + 1, column=c_idx).value
                            if _is_spanish_words(sample_val):
                                canon = f"{prefix}_letters"
                        elif canon == "property_code" and existing:
                            # Keep primary property code column (e.g. CARPETA)
                            continue
                        row_map[c_idx] = canon
                        matches += 1
            if matches >= 2:  # found header row
                header_map = row_map
                header_row_idx = r_idx
                break

        if not header_row_idx:
            continue

        # Extract rows under header
        for r_idx in range(header_row_idx + 1, ws_values.max_row + 1):
            row_data: dict[str, Any] = {}
            cell_coords: dict[str, str] = {}
            raw_cells: dict[str, NegotiationCell] = {}
            has_data = False

            for c_idx in range(1, ws_values.max_column + 1):
                val_cell = ws_values.cell(row=r_idx, column=c_idx)
                f_cell = ws_formulas.cell(row=r_idx, column=c_idx)
                coord = f"{sheet_name}!{val_cell.coordinate}"

                c_value = val_cell.value
                f_value = str(f_cell.value) if f_cell.value is not None and str(f_cell.value).startswith("=") else None

                if c_value is not None:
                    has_data = True

                canon = header_map.get(c_idx)
                if canon:
                    row_data[canon] = c_value
                    cell_coords[canon] = coord

                raw_cells[coord] = NegotiationCell(
                    coordinate=coord,
                    sheet_name=sheet_name,
                    row=r_idx,
                    column=c_idx,
                    formula=f_value,
                    calculated_value=c_value,
                    data_type=val_cell.data_type,
                )

            if not has_data:
                continue

            prop_code = str(row_data.get("property_code") or "").strip() or None
            offer1_num = _clean_numeric_value(row_data.get("first_offer_number"))
            offer1_let = str(row_data.get("first_offer_letters") or "").strip() or None
            if offer1_num is None and _is_spanish_words(row_data.get("first_offer_number")):
                if not offer1_let:
                    offer1_let = str(row_data.get("first_offer_number")).strip()

            offer2_num = _clean_numeric_value(row_data.get("second_offer_number"))
            offer2_let = str(row_data.get("second_offer_letters") or "").strip() or None
            if offer2_num is None and _is_spanish_words(row_data.get("second_offer_number")):
                if not offer2_let:
                    offer2_let = str(row_data.get("second_offer_number")).strip()

            offer3_num = _clean_numeric_value(row_data.get("third_offer_number"))
            offer3_let = str(row_data.get("third_offer_letters") or "").strip() or None
            if offer3_num is None and _is_spanish_words(row_data.get("third_offer_number")):
                if not offer3_let:
                    offer3_let = str(row_data.get("third_offer_number")).strip()

            appraisal = _clean_numeric_value(row_data.get("appraisal_value"))

            # Skip metadata/notes rows with no property code and no offer values
            if not prop_code and offer1_num is None and offer2_num is None and offer3_num is None and not offer1_let:
                continue

            row_obj = NegotiationOfferRow(
                property_code=prop_code,
                property_coordinate=cell_coords.get("property_code"),
                first_offer_number=offer1_num,
                first_offer_number_cell=cell_coords.get("first_offer_number"),
                first_offer_letters=offer1_let,
                first_offer_letters_cell=cell_coords.get("first_offer_letters"),
                second_offer_number=offer2_num,
                second_offer_number_cell=cell_coords.get("second_offer_number"),
                second_offer_letters=offer2_let,
                second_offer_letters_cell=cell_coords.get("second_offer_letters"),
                third_offer_number=offer3_num,
                third_offer_number_cell=cell_coords.get("third_offer_number"),
                third_offer_letters=offer3_let,
                third_offer_letters_cell=cell_coords.get("third_offer_letters"),
                appraisal_value=appraisal,
                appraisal_coordinate=cell_coords.get("appraisal_value"),
                raw_cells=raw_cells,
            )
            all_rows.append(row_obj)

    active_row = None
    if target_property_code:
        norm_target = _normalize_text(target_property_code)
        for r in all_rows:
            if r.property_code and _normalize_text(r.property_code) == norm_target:
                active_row = r
                break
    if not active_row and all_rows:
        # Prioritize rows that contain valid offer amounts or property code
        for r in all_rows:
            if r.first_offer_number is not None or r.second_offer_number is not None or r.third_offer_number is not None:
                active_row = r
                break
        if not active_row:
            active_row = all_rows[0]

    return NegotiationBookResult(
        document_id=document_id,
        original_name=original_name,
        sheets=sheet_names,
        rows=all_rows,
        active_row=active_row,
        metadata={"total_extracted_rows": len(all_rows)},
    )
