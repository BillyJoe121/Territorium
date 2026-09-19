import unittest
import asyncio

from app.extractors.title_extractor import TitleStudyExtractor
from app.extractors.title_schema import TitleStudyPayload, PropertyOwner
from app.extractors.plan_extractor import PlanExtractor
from app.extractors.plan_schema import PlanExtractionPayload
from app.processing.hierarchical_reducer import HierarchicalReducer
from app.validation.validator import StructuralValidationEngine


class ExtractorsAndValidationTests(unittest.TestCase):
    def test_title_study_heuristic_extraction(self) -> None:
        sample_text = """
        ESTUDIO DE TÍTULOS
        PREDIO: LA PLAYA
        MUNICIPIO: Anzoátegui, DEPARTAMENTO: Tolima, VEREDA: VERDUN
        MATRÍCULA INMOBILIARIA: 350-108418
        CÉDULA CATASTRAL: 73043000200020024000
        ÁREA DEL PREDIO: 6 ha 9524 m2
        PROPIETARIO: ROSA ELENA RONCANCIO DE GARCÍA con cédula No. 28.586.080
        LINDEROS: NORTE con Río Frío en 252 m; SUR con Antonio Mira en 197 m; ESTE con Mercedes Monroy; OESTE con Zanja Seca y ENCIERRA.
        CONDICIONES JURÍDICAS: una servidumbre de energía eléctrica a favor de INTERCONEXIÓN ELÉCTRICA
        RADICADO MINISTERIO DE JUSTICIA: MJD-EXT24-0060393
        RADICADO URT: 202430050793532
        """

        extractor = TitleStudyExtractor()
        res = asyncio.run(extractor.extract_from_text(sample_text, "Estudio_TOL-ANZ-045.docx"))

        self.assertEqual(res.folio, "350-108418")
        self.assertEqual(res.cadastral_id, "73043000200020024000")
        self.assertEqual(res.property_name, "LA PLAYA")
        self.assertIn("Tolima", res.department)
        self.assertIn("Anzo", res.municipality)
        self.assertGreaterEqual(len(res.owners), 1)
        self.assertEqual(res.owners[0].document_number, "28586080")
        self.assertIn("Río Frío", res.boundaries)
        self.assertIn("servidumbre", res.legal_conditions.lower())

    def test_plan_heuristic_extraction(self) -> None:
        sample_plan_text = """
        PLANO TOPOGRÁFICO DE SERVIDUMBRE
        PLANO: PLANO_SAN-CIM-001
        ÁREA DE SERVIDUMBRE: 13356.93 m2
        LONGITUD DE SERVIDUMBRE: 412.05 m
        ANCHO DE SERVIDUMBRE: 32 m
        POSTES O INFRAESTRUCTURAS: 1
        ESCALA: 1:1.500
        NIVEL DE TENSIÓN: 13,2 kV
        """

        extractor = PlanExtractor()
        res = asyncio.run(extractor.extract_from_text(sample_plan_text, "Plano_SAN-CIM-001.pdf"))

        self.assertEqual(res.plan_name, "Plano_SAN-CIM-001")
        self.assertIn("13356.93", res.easement_area_numbers)
        self.assertIn("412.05", res.easement_length_numbers)
        self.assertEqual(res.infrastructure_count_numbers, "1")
        self.assertEqual(res.plan_scale, "1:1.500")

    def test_hierarchical_reducer_discrepancy_and_owners(self) -> None:
        reducer = HierarchicalReducer()

        fragment1 = {
            "folio": "350-108418",
            "owners": [{"name": "ROSA ELENA RONCANCIO", "document_type": "CC", "document_number": "28586080"}],
            "boundaries": "NORTE con Río Frío...",
            "source_document": "doc1.docx",
            "location_label": "Pág 1",
        }
        fragment2 = {
            "folio": "350-999999",  # Conflicting folio!
            "owners": [{"name": "ALEJO MORENO CASTELLANOS", "document_type": "CC", "document_number": "5811254"}],
            "boundaries": "NORTE con Río Frío en 252 m; SUR con Antonio Mira... y ENCIERRA.",  # Longer
            "source_document": "doc2.docx",
            "location_label": "Pág 2",
        }

        reduced = reducer.reduce_titles([fragment1, fragment2])

        # Owners combined
        self.assertEqual(len(reduced.collections["owners"]), 2)
        # Boundaries longest retained
        self.assertIn("ENCIERRA", reduced.canonical_payload["boundaries"])
        # Discrepancy logged for folio
        self.assertGreaterEqual(len(reduced.discrepancies), 1)
        self.assertEqual(reduced.discrepancies[0].field_name, "folio")

    def test_structural_validation_engine(self) -> None:
        validator = StructuralValidationEngine()

        payload = TitleStudyPayload(
            folio=" 350-108418 ",  # Needs whitespace trim
            cadastral_id="73.043.0002.0002.0024.000",  # Dots to be cleaned
            property_name="LA PLAYA",
            boundaries="NORTE con Río Frío en 252 m y ENCIERRA.",
            owners=[
                PropertyOwner(name="ROSA ELENA", document_type="CC", document_number="28.586.080")
            ],
        )

        validated, report = validator.validate_titles(payload)

        self.assertTrue(report.is_valid)
        self.assertEqual(validated.folio, "350-108418")
        self.assertEqual(validated.cadastral_id, "73043000200020024000")
        self.assertEqual(validated.owners[0].document_number, "28586080")
        # Ensure repairs were audited
        self.assertGreaterEqual(len(report.audit_repairs), 3)


if __name__ == "__main__":
    unittest.main()
