from typing import Any
from ..models.canonical import CanonicalDocument, PageScanInfo, ScanClassification


class ScanAnalysisResult:
    def __init__(
        self,
        document_id: str,
        overall_status: ScanClassification,
        pages_requiring_ocr: list[int],
        pages_requiring_vision: list[int],
        can_proceed_textual: bool,
        quality_score: float,
        warnings: list[str],
    ) -> None:
        self.document_id = document_id
        self.overall_status = overall_status
        self.pages_requiring_ocr = pages_requiring_ocr
        self.pages_requiring_vision = pages_requiring_vision
        self.can_proceed_textual = can_proceed_textual
        self.quality_score = quality_score
        self.warnings = warnings

    def to_dict(self) -> dict[str, Any]:
        return {
            "document_id": self.document_id,
            "overall_status": self.overall_status.value,
            "pages_requiring_ocr": self.pages_requiring_ocr,
            "pages_requiring_vision": self.pages_requiring_vision,
            "can_proceed_textual": self.can_proceed_textual,
            "quality_score": round(self.quality_score, 2),
            "warnings": self.warnings,
        }


def detect_scan_and_ocr_needs(
    document: CanonicalDocument,
    is_plan: bool = False,
    min_textual_chars_per_page: int = 60,
) -> ScanAnalysisResult:
    """
    Evaluates scan condition per page according to HU-V2-035.
    Identifies pages that need OCR or vision, without hallucinating content.
    """
    if document.overall_scan_status == ScanClassification.PROTECTED:
        return ScanAnalysisResult(
            document_id=document.document_id,
            overall_status=ScanClassification.PROTECTED,
            pages_requiring_ocr=[],
            pages_requiring_vision=[],
            can_proceed_textual=False,
            quality_score=0.0,
            warnings=["Documento protegido con contraseña. No es posible su lectura automática."],
        )

    if document.overall_scan_status == ScanClassification.CORRUPT:
        return ScanAnalysisResult(
            document_id=document.document_id,
            overall_status=ScanClassification.CORRUPT,
            pages_requiring_ocr=[],
            pages_requiring_vision=[],
            can_proceed_textual=False,
            quality_score=0.0,
            warnings=["Documento dañado o corrupto. Imposible leer la estructura interna."],
        )

    ocr_pages: list[int] = []
    vision_pages: list[int] = []
    warnings: list[str] = []
    quality_scores: list[float] = []

    for page_info in document.pages_info:
        quality_scores.append(page_info.quality_score)
        if page_info.classification == ScanClassification.SCANNED:
            ocr_pages.append(page_info.page_number)
            warnings.append(f"Página {page_info.page_number} es escaneada (sin capa de texto nativa).")
        elif page_info.classification == ScanClassification.MIXED:
            if page_info.char_count < min_textual_chars_per_page:
                ocr_pages.append(page_info.page_number)
                warnings.append(f"Página {page_info.page_number} tiene texto insuficiente ({page_info.char_count} caracteres) con elementos gráficos.")

        if is_plan:
            # Plan documents benefit from vision when graphical layout contains dimensions or scale
            vision_pages.append(page_info.page_number)

    avg_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 1.0
    can_proceed_textual = len(ocr_pages) == 0 and document.page_count > 0

    return ScanAnalysisResult(
        document_id=document.document_id,
        overall_status=document.overall_scan_status,
        pages_requiring_ocr=ocr_pages,
        pages_requiring_vision=vision_pages,
        can_proceed_textual=can_proceed_textual,
        quality_score=avg_quality,
        warnings=warnings,
    )
