import io
import unittest
import pypdf

from app.export.pdf_generator import (
    compute_pdf_verification_hash,
    generate_consolidated_pdf_bytes,
)
from app.processing.consolidator import ConsolidatedMasterRecord


class TestPhase6DocumentPdf(unittest.TestCase):
    def setUp(self):
        self.record = ConsolidatedMasterRecord(
            folio="050N-204581",
            cadastral_id="05001010400230012000",
            property_name="La Esperanza",
            municipality="Medellin",
            department="Antioquia",
            village="El Salado",
            owners="Carlos Gomez (CC 70123456)",
            acquisition_mode="Compraventa",
            boundaries="Norte: Quebrada; Sur: Camino",
            boundaries_document="Escritura 1234 de 2010",
            legal_conditions="Sin gravamenes",
            justice_ministry_case="RAD-JUS-2024-001",
            urt_case="RAD-URT-2024-999",
            urt_territorial_direction="DT Antioquia",
            easement_area="450.00",
            easement_length="30.00",
            easement_width="15.00",
            infrastructure_count="2",
            plan_name="PLANO-TOP-01",
            plan_scale="1:500",
            voltage_level="230 kV",
            property_code="PRED-001",
            first_offer="$ 232.800.000",
            second_offer="$ 232.800.000",
            third_offer="-",
            values_match="Si, coinciden",
            metadata={
                "titles_result_version_id": "titles-v2",
                "plans_result_version_id": "plans-v1",
                "negotiation_result_version_id": "negotiation-v3",
                "consolidated_at": "2026-09-18T10:00:00Z",
                "is_valid": True,
            },
        )

    def test_deterministic_verification_hash(self):
        hash1 = compute_pdf_verification_hash(self.record, 1)
        hash2 = compute_pdf_verification_hash(self.record, 1)
        self.assertEqual(hash1, hash2)
        self.assertTrue(hash1.startswith("TRT-AUD-"))

    def test_generate_pdf_bytes_and_pypdf_validation(self):
        pdf_bytes = generate_consolidated_pdf_bytes(
            self.record,
            project_id="EXP-001",
            project_name="Proyecto Transmision",
            version_number=1,
        )

        self.assertIsInstance(pdf_bytes, bytes)
        self.assertGreater(len(pdf_bytes), 500)
        self.assertTrue(pdf_bytes.startswith(b"%PDF-1.4"))
        self.assertTrue(pdf_bytes.strip().endswith(b"%%EOF"))

        # Verify parsing by pypdf
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        self.assertEqual(len(reader.pages), 1)

        text = reader.pages[0].extract_text()
        self.assertIn("GRUPO JURIDICO TERRITORIUM", text)
        self.assertIn("050N-204581", text)
        self.assertIn("La Esperanza", text)
        self.assertIn("Carlos Gomez", text)
        self.assertIn("450.00 m2", text)
        self.assertIn("CORRESPONDENCIA.xlsx", text)


if __name__ == "__main__":
    unittest.main()
