import unittest

from app.contracts import SourceDocument
from app.pipeline import resolve_extractor, retry_delay


class PipelineTests(unittest.TestCase):
    def document(self, name: str, kind: str = "unclassified") -> SourceDocument:
        return SourceDocument(id="1", project_id="2", batch_id="3", storage_path="2/3/file", original_name=name, mime_type="application/pdf", kind=kind)

    def test_resolves_explicit_kind(self) -> None:
        self.assertEqual(resolve_extractor(self.document("x.pdf", "plan")).value, "plan")

    def test_classifies_title_from_filename(self) -> None:
        self.assertEqual(resolve_extractor(self.document("Estudio de títulos 01.pdf")).value, "title_study")

    def test_retry_is_bounded(self) -> None:
        self.assertEqual(retry_delay(1), 15)
        self.assertEqual(retry_delay(10), 300)


if __name__ == "__main__":
    unittest.main()
