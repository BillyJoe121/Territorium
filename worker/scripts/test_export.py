import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.document_export import generate_populated_docx

sample = {
    "folio": "350-999999",
    "cadastral_id": "73043000200020099999",
    "property_name": "HACIENDA EL PARAISO",
    "municipality": "IBAGUE",
    "department": "TOLIMA",
    "owners": "JUAN PEREZ (CC 123456)",
    "first_offer": "50.000.000",
    "first_offer_letters": "CINCUENTA MILLONES DE PESOS",
    "easement_area": "1500.50",
    "easement_area_letters": "MIL QUINIENTOS PUNTO CINCUENTA METROS CUADRADOS",
    "easement_length": "120.00",
    "easement_length_letters": "CIENTO VEINTE METROS",
    "easement_width": "12.00",
    "easement_width_letters": "DOCE METROS",
    "plan_name": "PLANO_TEST_001",
    "infrastructure_count": "4"
}

for tpl in ["tpl-escritura-publica", "tpl-descripcion-linderos", "tpl-minuta-tipo"]:
    stream = generate_populated_docx(tpl, sample)
    data = stream.getvalue()
    print(f"Successfully generated {tpl}: {len(data)} bytes")
    # Verify that stream is a valid docx
    import docx
    import io
    d = docx.Document(io.BytesIO(data))
    print(f"  Verified docx! Paragraphs: {len(d.paragraphs)}, Tables: {len(d.tables)}")
