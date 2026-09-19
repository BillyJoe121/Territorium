from enum import StrEnum
from typing import Any
from pydantic import BaseModel, Field


class UnitType(StrEnum):
    PARAGRAPH = "paragraph"
    TABLE_CELL = "table_cell"
    TABLE_ROW = "table_row"
    TABLE = "table"
    PAGE = "page"
    TEXT_BLOCK = "text_block"
    EXCEL_CELL = "excel_cell"
    SECTION = "section"


class ScanClassification(StrEnum):
    TEXTUAL = "textual"
    SCANNED = "scanned"
    MIXED = "mixed"
    PROTECTED = "protected"
    CORRUPT = "corrupt"


class FragmentLocator(BaseModel):
    document_id: str
    original_name: str
    page_number: int | None = None
    section_index: int | None = None
    unit_type: UnitType = UnitType.PARAGRAPH
    unit_index: int | None = None
    char_start: int | None = None
    char_end: int | None = None
    cell_coordinate: str | None = None
    location_label: str = Field(default="")

    def to_dict(self) -> dict[str, Any]:
        return self.model_dump(exclude_none=True)


class DocumentFragment(BaseModel):
    fragment_id: str
    locator: FragmentLocator
    text: str
    table_data: list[list[str]] | None = None
    is_ocr: bool = False
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    warnings: list[str] = Field(default_factory=list)

    @property
    def token_estimate(self) -> int:
        return max(1, len(self.text.split()))


class PageScanInfo(BaseModel):
    page_number: int
    classification: ScanClassification
    char_count: int = 0
    word_count: int = 0
    image_count: int = 0
    image_area_ratio: float = Field(default=0.0, ge=0.0, le=1.0)
    has_text_layer: bool = True
    quality_score: float = Field(default=1.0, ge=0.0, le=1.0)
    warnings: list[str] = Field(default_factory=list)


class CanonicalDocument(BaseModel):
    document_id: str
    original_name: str
    mime_type: str
    sha256: str
    size_bytes: int
    page_count: int = 1
    overall_scan_status: ScanClassification = ScanClassification.TEXTUAL
    pages_info: list[PageScanInfo] = Field(default_factory=list)
    fragments: list[DocumentFragment] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    def full_text(self) -> str:
        return "\n\n".join(f.text for f in self.fragments if f.text.strip())
