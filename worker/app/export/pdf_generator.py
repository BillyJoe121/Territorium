from datetime import datetime
import io
import re
from typing import Any

from ..processing.consolidator import ConsolidatedMasterRecord


def compute_pdf_verification_hash(record: ConsolidatedMasterRecord, version_number: int = 1) -> str:
    """
    Computes deterministic verification hash identical to client-side and Excel metadata (HU-V2-051).
    """
    seed = f"{record.folio}|{record.cadastral_id}|{record.property_name}|{record.metadata.get('consolidated_at', '')}|v{version_number}"
    h = 0
    for char in seed:
        h = (((h << 5) - h) + ord(char)) & 0xFFFFFFFF
    hex_str = f"{h:08X}"
    return f"TRT-AUD-{hex_str[:4]}-{hex_str[4:8]}"


def _clean_text(s: str) -> str:
    """Sanitizes text for standard ASCII PDF Type1 fonts."""
    if not s:
        return "-"
    trans = {
        "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u",
        "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U",
        "ñ": "n", "Ñ": "N", "ü": "u", "Ü": "U",
        "—": "-", "–": "-", "“": '"', "”": '"', "‘": "'", "’": "'",
    }
    for k, v in trans.items():
        s = s.replace(k, v)
    # Remove control chars, parentheses, and any remaining non-ascii characters
    s = re.sub(r"[\n\r\t]", " ", s)
    s = re.sub(r"[\\()]", "", s)
    s = s.encode("ascii", "replace").decode("ascii")
    return s.strip()


def generate_consolidated_pdf_bytes(
    record: ConsolidatedMasterRecord,
    project_id: str = "",
    project_name: str = "",
    version_number: int = 1,
    narrative_override: str | None = None,
) -> bytes:
    """
    Generates a production PDF binary for the approved consolidated record (HU-V2-051)
    matching the corporate Territorium styling and metadata synchronized with CORRESPONDENCIA.xlsx.
    """
    verification_hash = compute_pdf_verification_hash(record, version_number)
    narrative = narrative_override or (
        "Se verifico la cadena de tradicion del inmueble sin medidas cautelares ni gravamenes impeditivos. "
        "Se recomienda proceder con la promesa de compraventa conforme al avaluo vigente."
    )

    title_text = _clean_text("GRUPO JURIDICO TERRITORIUM - INFORME PREDIAL OFICIAL")
    prop_line = _clean_text(f"Predio: {record.property_name} | Folio: {record.folio} | Cedula: {record.cadastral_id}")
    muni_line = _clean_text(f"Ubicacion: {record.municipality}, {record.department} (Vereda: {record.village or 'N/A'})")
    owners_line = _clean_text(f"Propietarios: {record.owners}")
    bounds_line = _clean_text(f"Linderos: {record.boundaries}")
    tech_line = _clean_text(
        f"Servidumbre: Area {record.easement_area} m2 | Long: {record.easement_length} m | Ancho: {record.easement_width} m"
    )
    plan_line = _clean_text(
        f"Plano: {record.plan_name} | Escala: {record.plan_scale} | Infraestructuras: {record.infrastructure_count}"
    )
    offer_line = _clean_text(
        f"Oferta 1: {record.first_offer} | Oferta 2: {record.second_offer} | Oferta 3: {record.third_offer}"
    )
    match_line = _clean_text(f"Coincidencia Cifras y Letras: {record.values_match}")
    narrative_line = _clean_text(f"Consideraciones: {narrative}")

    meta_titles = record.metadata.get("titles_result_version_id", "—")
    meta_plans = record.metadata.get("plans_result_version_id", "—")
    meta_neg = record.metadata.get("negotiation_result_version_id", "—")
    meta_date = record.metadata.get("consolidated_at", datetime.now().isoformat())

    sync_line = _clean_text(f"Sincronizado con CORRESPONDENCIA.xlsx | Codigo: {verification_hash} | Version: v{version_number}")
    audit_line = _clean_text(f"Origen: Titulos {meta_titles} | Planos {meta_plans} | Negociacion {meta_neg} | Fecha: {meta_date}")

    # Build PDF graphics & text stream
    stream_parts = []

    # 1. Corporate Header Box (#1E3A2B -> 0.12 0.23 0.17 rgb)
    stream_parts.append("0.12 0.23 0.17 rg\n")
    stream_parts.append("25 715 562 65 re\n")
    stream_parts.append("f\n")

    # Header Text in White
    stream_parts.append("BT\n")
    stream_parts.append("/F1 13 Tf\n")
    stream_parts.append("1 1 1 rg\n")
    stream_parts.append("35 755 Td\n")
    stream_parts.append(f"({title_text}) Tj\n")
    stream_parts.append("/F1 9 Tf\n")
    stream_parts.append("0 -18 Td\n")
    stream_parts.append(f"(EXPEDIENTE UNICO PREDIAL | CODIGO VERIFICACION: {verification_hash}) Tj\n")
    stream_parts.append("ET\n")

    # Body sections in dark grey
    stream_parts.append("BT\n")
    stream_parts.append("0.1 0.1 0.1 rg\n")

    # Section 1
    stream_parts.append("/F1 11 Tf\n")
    stream_parts.append("35 685 Td\n")
    stream_parts.append("(1. IDENTIFICACION PREDIAL Y CATASTRAL) Tj\n")
    stream_parts.append("/F1 9 Tf\n")
    stream_parts.append("0 -16 Td\n")
    stream_parts.append(f"({prop_line}) Tj\n")
    stream_parts.append("0 -14 Td\n")
    stream_parts.append(f"({muni_line}) Tj\n")

    # Section 2
    stream_parts.append("0 -24 Td\n")
    stream_parts.append("/F1 11 Tf\n")
    stream_parts.append("(2. DIAGNOSTICO JURIDICO Y TITULARIDAD) Tj\n")
    stream_parts.append("/F1 9 Tf\n")
    stream_parts.append("0 -16 Td\n")
    stream_parts.append(f"({owners_line[:95]}) Tj\n")
    if len(owners_line) > 95:
        stream_parts.append("0 -12 Td\n")
        stream_parts.append(f"({owners_line[95:190]}) Tj\n")
    stream_parts.append("0 -14 Td\n")
    stream_parts.append(f"({bounds_line[:95]}) Tj\n")

    # Section 3
    stream_parts.append("0 -24 Td\n")
    stream_parts.append("/F1 11 Tf\n")
    stream_parts.append("(3. PARAMETROS TECNICOS Y AFECTACION) Tj\n")
    stream_parts.append("/F1 9 Tf\n")
    stream_parts.append("0 -16 Td\n")
    stream_parts.append(f"({tech_line}) Tj\n")
    stream_parts.append("0 -14 Td\n")
    stream_parts.append(f"({plan_line}) Tj\n")

    # Section 4
    stream_parts.append("0 -24 Td\n")
    stream_parts.append("/F1 11 Tf\n")
    stream_parts.append("(4. VALORACION ECONOMICA Y NEGOCIACION) Tj\n")
    stream_parts.append("/F1 9 Tf\n")
    stream_parts.append("0 -16 Td\n")
    stream_parts.append(f"({offer_line}) Tj\n")
    stream_parts.append("0 -14 Td\n")
    stream_parts.append(f"({match_line}) Tj\n")

    # Section 5
    stream_parts.append("0 -24 Td\n")
    stream_parts.append("/F1 11 Tf\n")
    stream_parts.append("(5. CONSIDERACIONES JURIDICAS Y RECOMENDACIONES) Tj\n")
    stream_parts.append("/F1 8.5 Tf\n")
    stream_parts.append("0 -16 Td\n")
    stream_parts.append(f"({narrative_line[:100]}) Tj\n")
    if len(narrative_line) > 100:
        stream_parts.append("0 -12 Td\n")
        stream_parts.append(f"({narrative_line[100:200]}) Tj\n")

    # Section 6: Audit
    stream_parts.append("0 -35 Td\n")
    stream_parts.append("0.3 0.3 0.3 rg\n")
    stream_parts.append("/F1 8 Tf\n")
    stream_parts.append(f"({sync_line}) Tj\n")
    stream_parts.append("0 -12 Td\n")
    stream_parts.append(f"({audit_line}) Tj\n")
    stream_parts.append("ET\n")

    # Divider line above footer
    stream_parts.append("0.7 0.7 0.7 RG\n")
    stream_parts.append("35 150 m 575 150 l S\n")

    stream_content = "".join(stream_parts)
    stream_len = len(stream_content)

    objects = [
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
        f"4 0 obj\n<< /Length {stream_len} >>\nstream\n{stream_content}\nendstream\nendobj\n",
        "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    ]

    pdf_text = "%PDF-1.4\n"
    xref_offsets = [0]
    for obj in objects:
        xref_offsets.append(len(pdf_text))
        pdf_text += obj

    start_xref = len(pdf_text)
    pdf_text += f"xref\n0 {len(objects) + 1}\n"
    pdf_text += "0000000000 65535 f \n"
    for i in range(1, len(objects) + 1):
        pdf_text += f"{xref_offsets[i]:010d} 00000 n \n"

    pdf_text += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{start_xref}\n%%EOF\n"

    return pdf_text.encode("latin1")
