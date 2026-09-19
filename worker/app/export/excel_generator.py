import io
from typing import Any
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from ..processing.consolidator import ConsolidatedMasterRecord


def generate_consolidated_excel_bytes(
    record: ConsolidatedMasterRecord,
    project_id: str = "",
    project_name: str = "",
    version_number: int = 1,
) -> bytes:
    """
    Generates a production Excel workbook for the approved consolidated record (HU-V2-046)
    adhering to the official CORRESPONDENCIA.xlsx format and metadata standards.
    """
    wb = openpyxl.Workbook()

    # --- SHEET 1: Consolidado Predial ---
    ws = wb.active
    ws.title = "Consolidado Predial"

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
    data_font = Font(name="Calibri", size=10)
    border_thin = Side(style="thin", color="D3D3D3")
    box_border = Border(left=border_thin, right=border_thin, top=border_thin, bottom=border_thin)

    headers = [
        "CARPETA",
        "FOLIO DE MATRICULA",
        "CEDULA CATASTRAL",
        "PROPIETARIOS DEL PREDIO",
        "NOMBRE DEL PREDIO",
        "MUNICIPIO DEL PREDIO",
        "DEPARTAMENTO DEL PREDIO",
        "VEREDA DEL PREDIO",
        "MODO DE ADQUISICION DEL PREDIO",
        "LINDEROS DEL PREDIO",
        "DOCUMENTO QUE CONTIENE LOS LINDEROS DEL PREDIO",
        "CONDICIONES JURÍDICAS VIGENTES",
        "RADICADO CONSULTA MINISTERIO DE JUSTICIA",
        "RADICADO CONSULTA URT",
        "DIRECCIÓN TERRITORIAL DE LA URT",
        "AREA SERVIDUMBRE (m²)",
        "LONGITUD SERVIDUMBRE (m)",
        "ANCHO SERVIDUMBRE (m)",
        "CANTIDAD POSTES O INFRAESTRUCTURAS",
        "NOMBRE DEL PLANO",
        "ESCALA DEL PLANO",
        "VALOR OFERTA NO. 1",
        "VALOR OFERTA NO. 2",
        "VALOR OFERTA NO. 3",
        "COINCIDEN NÚMEROS Y LETRAS",
    ]

    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = box_border

    # Data row
    row_values = [
        record.property_code or record.folio,
        record.folio,
        record.cadastral_id,
        record.owners,
        record.property_name,
        record.municipality,
        record.department,
        record.village,
        record.acquisition_mode,
        record.boundaries,
        record.boundaries_document,
        record.legal_conditions,
        record.justice_ministry_case,
        record.urt_case,
        record.urt_territorial_direction,
        record.easement_area,
        record.easement_length,
        record.easement_width,
        record.infrastructure_count,
        record.plan_name,
        record.plan_scale,
        record.first_offer,
        record.second_offer,
        record.third_offer,
        record.values_match,
    ]

    for col_idx, val in enumerate(row_values, 1):
        cell = ws.cell(row=2, column=col_idx, value=val)
        cell.font = data_font
        cell.alignment = Alignment(vertical="top", wrap_text=True)
        cell.border = box_border

    # Auto-fit column widths
    for col_idx in range(1, len(headers) + 1):
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = max(18, min(45, len(headers[col_idx - 1]) + 4))

    # --- SHEET 2: Metadatos y Auditoría ---
    ws_meta = wb.create_sheet(title="Metadatos y Trazabilidad")
    meta_headers = ["Propiedad / Metadato", "Valor Registrado"]
    for col_idx, h in enumerate(meta_headers, 1):
        cell = ws_meta.cell(row=1, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = PatternFill(start_color="333333", end_color="333333", fill_type="solid")
        cell.border = box_border

    meta_items = [
        ("Proyecto", project_name or project_id),
        ("ID Expediente", project_id),
        ("Versión Consolidada", f"v{version_number}"),
        ("Estado de Aprobación", "APROBADO"),
        ("Fecha de Consolidación", record.metadata.get("consolidated_at", "—")),
        ("Versión Aprobada Títulos", record.metadata.get("titles_result_version_id", "—")),
        ("Versión Aprobada Planos", record.metadata.get("plans_result_version_id", "—")),
        ("Versión Aprobada Negociación", record.metadata.get("negotiation_result_version_id", "—")),
        ("Generado por", "Sistema Territorium 2.0 (Fase 5)"),
    ]

    for row_idx, (k, v) in enumerate(meta_items, 2):
        cell_k = ws_meta.cell(row=row_idx, column=1, value=k)
        cell_k.font = Font(name="Calibri", size=10, bold=True)
        cell_k.border = box_border
        cell_v = ws_meta.cell(row=row_idx, column=2, value=str(v))
        cell_v.font = data_font
        cell_v.border = box_border

    ws_meta.column_dimensions["A"].width = 30
    ws_meta.column_dimensions["B"].width = 50

    stream = io.BytesIO()
    wb.save(stream)
    return stream.getvalue()
