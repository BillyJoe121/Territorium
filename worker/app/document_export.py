import io
import os
import re
from typing import Any, Dict
import docx

TEMPLATES_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "plantillas documentos finales")
)

TEMPLATE_FILES = {
    "tpl-escritura-publica": "ESCRITURA TOL-ANZ-045.docx",
    "tpl-descripcion-linderos": "ID02 descripción de linderos.docx",
    "tpl-minuta-tipo": "MINUTA_TIPO_TERRITORIUM.docx",
}

def _replace_text_in_paragraph(paragraph, replacements: Dict[str, str]):
    full_text = paragraph.text
    if not full_text:
        return
    modified = False
    new_text = full_text
    for target, replacement in replacements.items():
        if target in new_text:
            new_text = new_text.replace(target, replacement)
            modified = True
            
    if modified:
        # If paragraph has runs, update runs cleanly
        if len(paragraph.runs) == 1:
            paragraph.runs[0].text = new_text
        elif len(paragraph.runs) > 1:
            # Keep first run formatting and assign full new text, clear remainder
            paragraph.runs[0].text = new_text
            for run in paragraph.runs[1:]:
                run.text = ""
        else:
            paragraph.text = new_text

def _replace_in_table(table, replacements: Dict[str, str]):
    for row in table.rows:
        for cell in row.cells:
            for p in cell.paragraphs:
                _replace_text_in_paragraph(p, replacements)

def generate_populated_docx(template_id: str, record: Dict[str, Any]) -> io.BytesIO:
    """Populates the original DOCX template with consolidated master record fields."""
    filename = TEMPLATE_FILES.get(template_id)
    if not filename:
        # Fallback to escritura publica
        filename = "ESCRITURA TOL-ANZ-045.docx"
        
    filepath = os.path.join(TEMPLATES_DIR, filename)
    if not os.path.exists(filepath):
        # Fallback check for .doc
        if filename.endswith(".docx"):
            alt_path = filepath[:-1]
            if os.path.exists(alt_path):
                filepath = alt_path
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Template file not found at: {filepath}")

    doc = docx.Document(filepath)

    # Build replacements dictionary
    folio = str(record.get("folio") or "—")
    cadastral_id = str(record.get("cadastral_id") or "—")
    prop_name = str(record.get("property_name") or "—")
    municipality = str(record.get("municipality") or "—")
    department = str(record.get("department") or "—")
    owners = str(record.get("owners") or "—")
    first_offer = str(record.get("first_offer") or "—")
    first_offer_let = str(record.get("first_offer_letters") or first_offer)
    easement_area = str(record.get("easement_area") or "—")
    easement_area_let = str(record.get("easement_area_letters") or easement_area)
    easement_len = str(record.get("easement_length") or "—")
    easement_len_let = str(record.get("easement_length_letters") or easement_len)
    easement_w = str(record.get("easement_width") or "—")
    easement_w_let = str(record.get("easement_width_letters") or easement_w)
    plan_name = str(record.get("plan_name") or "—")
    plan_scale = str(record.get("plan_scale") or "—")
    infra_count = str(record.get("infrastructure_count") or "0")

    replacements: Dict[str, str] = {}

    if template_id == "tpl-escritura-publica":
        replacements = {
            "ROSA ELENA RONCANCIO DE GARCÍA, ALEJO MORENO CASTELLANOS": owners,
            "NUEVE MILLONES SEISCIENTOS VEINTIOCHO MIL SETECIENTOS DOCE PESOS ($ 9.628.712)": f"{first_offer_let} ($ {first_offer})",
            "350-108418": folio,
            "73043000200020024000": cadastral_id,
            "ANZOATEGUI - TOLIMA": f"{municipality} - {department}",
            "LA PLAYA": prop_name,
            "Plano_TOL-ANZ-045_20241107": plan_name,
            "TRESCIENTOS SEIS PUNTO CUARENTA Y TRES METROS (306,43 m)": f"{easement_len_let} ({easement_len} m)",
            "TRES MIL TRESCIENTOS SETENTA Y CUATRO PUNTO SEIS METROS CUADRADOS (3374,06 m²)": f"{easement_area_let} ({easement_area} m²)",
            "TRES (3)": f"{infra_count}",
        }
    elif template_id == "tpl-descripcion-linderos":
        replacements = {
            "OCHO MIL QUINIENTOS OCHENTA Y CUATRO PUNTO SETECIENTOS NOVENTA Y NUEVE METROS CUADRADOS (8584.799 m2)": f"{easement_area_let} ({easement_area} m2)",
            "DOSCIENTOS SETENTA Y CUATRO PUNTO CIENTO SETENTA Y CINCO METROS (274.175 m)": f"{easement_len_let} ({easement_len} m)",
            "TREINTA Y DOS METROS (32 m)": f"{easement_w_let} ({easement_w} m)",
            "TOL-ARM-02-T1": plan_name,
            "VILLA CLAUDIA": prop_name,
        }
    elif template_id == "tpl-minuta-tipo":
        replacements = {
            "CATHERINE ALBA AYALA, LEIDY VANESSA ALBA AYALA, y NORA LIZ AYALA MURCIA": owners,
            "352-5": folio,
            "730550003000000020115000000000": cadastral_id,
            "VILLA CLAUDIA": prop_name,
            "ARMERO - TOLIMA": f"{municipality} - {department}",
            "ARMERO": municipality,
            "Armero": municipality,
            "TOLIMA": department,
            "Tolima": department,
            "$ 93.468.040": first_offer,
            "$93’468.040": first_offer,
            "NOVENTA Y TRES MILLONES CUATROCIENTOS SESENTA Y OCHO MIL CUARENTA PESOS MONEDA CORRIENTE LEGAL COLOMBIANA": first_offer_let,
            "TOL-ARM-02-T1": plan_name,
        }

    # Execute replacements across all paragraphs
    for p in doc.paragraphs:
        _replace_text_in_paragraph(p, replacements)

    # Execute replacements across all tables
    for t in doc.tables:
        _replace_in_table(t, replacements)

    stream = io.BytesIO()
    doc.save(stream)
    stream.seek(0)
    return stream
