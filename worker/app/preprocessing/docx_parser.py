import hashlib
import io
import uuid
from typing import BinaryIO

import docx
from docx.oxml.text.paragraph import CT_P
from docx.oxml.table import CT_Tbl
from docx.table import Table
from docx.text.paragraph import Paragraph

from ..models.canonical import (
    CanonicalDocument,
    DocumentFragment,
    FragmentLocator,
    PageScanInfo,
    ScanClassification,
    UnitType,
)


def parse_docx(
    file_bytes: bytes,
    original_name: str,
    document_id: str | None = None,
) -> CanonicalDocument:
    """
    Parses a DOCX document in memory, maintaining the original file immutable,
    extracting paragraphs and tables in exact document order with structural locators.
    """
    doc_id = document_id or str(uuid.uuid4())
    sha256 = hashlib.sha256(file_bytes).hexdigest()
    size_bytes = len(file_bytes)

    stream = io.BytesIO(file_bytes)
    doc = docx.Document(stream)

    fragments: list[DocumentFragment] = []
    char_offset = 0
    unit_counter = 0

    # Iterate through body elements in document order
    for child in doc.element.body:
        if isinstance(child, CT_P):
            p = Paragraph(child, doc)
            text = p.text.strip()
            if not text:
                continue

            start = char_offset
            end = start + len(text)
            char_offset = end + 2  # newline buffer
            unit_counter += 1

            locator = FragmentLocator(
                document_id=doc_id,
                original_name=original_name,
                page_number=1,
                unit_type=UnitType.PARAGRAPH,
                unit_index=unit_counter,
                char_start=start,
                char_end=end,
                location_label=f"Párrafo {unit_counter}",
            )

            fragments.append(
                DocumentFragment(
                    fragment_id=f"{doc_id}-p{unit_counter}",
                    locator=locator,
                    text=text,
                    is_ocr=False,
                    confidence=1.0,
                )
            )

        elif isinstance(child, CT_Tbl):
            tbl = Table(child, doc)
            table_rows: list[list[str]] = []
            text_lines: list[str] = []

            for row in tbl.rows:
                row_cells = [cell.text.strip() for cell in row.cells]
                table_rows.append(row_cells)
                text_lines.append(" | ".join(row_cells))

            table_text = "\n".join(text_lines).strip()
            if not table_text:
                continue

            start = char_offset
            end = start + len(table_text)
            char_offset = end + 2
            unit_counter += 1

            locator = FragmentLocator(
                document_id=doc_id,
                original_name=original_name,
                page_number=1,
                unit_type=UnitType.TABLE,
                unit_index=unit_counter,
                char_start=start,
                char_end=end,
                location_label=f"Tabla {unit_counter}",
            )

            fragments.append(
                DocumentFragment(
                    fragment_id=f"{doc_id}-t{unit_counter}",
                    locator=locator,
                    text=table_text,
                    table_data=table_rows,
                    is_ocr=False,
                    confidence=1.0,
                )
            )

    page_info = PageScanInfo(
        page_number=1,
        classification=ScanClassification.TEXTUAL,
        char_count=sum(len(f.text) for f in fragments),
        word_count=sum(len(f.text.split()) for f in fragments),
        image_count=0,
        image_area_ratio=0.0,
        has_text_layer=True,
        quality_score=1.0,
    )

    return CanonicalDocument(
        document_id=doc_id,
        original_name=original_name,
        mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sha256=sha256,
        size_bytes=size_bytes,
        page_count=max(1, len(doc.sections)),
        overall_scan_status=ScanClassification.TEXTUAL,
        pages_info=[page_info],
        fragments=fragments,
        metadata={"sections_count": len(doc.sections)},
    )
