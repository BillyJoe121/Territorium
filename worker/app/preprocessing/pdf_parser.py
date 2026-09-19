import hashlib
import io
import uuid
import pypdf
from pypdf.errors import EmptyFileError, PdfReadError

from ..models.canonical import (
    CanonicalDocument,
    DocumentFragment,
    FragmentLocator,
    PageScanInfo,
    ScanClassification,
    UnitType,
)


def parse_pdf(
    file_bytes: bytes,
    original_name: str,
    document_id: str | None = None,
) -> CanonicalDocument:
    """
    Parses a PDF document, inspecting encryption, text layer presence,
    image counts, character density per page, and creating traceable fragments.
    Original file remains immutable and SHA256 is tracked.
    """
    doc_id = document_id or str(uuid.uuid4())
    sha256 = hashlib.sha256(file_bytes).hexdigest()
    size_bytes = len(file_bytes)

    if not file_bytes:
        raise ValueError("El archivo PDF está vacío (0 bytes).")

    stream = io.BytesIO(file_bytes)
    try:
        reader = pypdf.PdfReader(stream)
    except (PdfReadError, EmptyFileError) as e:
        return CanonicalDocument(
            document_id=doc_id,
            original_name=original_name,
            mime_type="application/pdf",
            sha256=sha256,
            size_bytes=size_bytes,
            page_count=0,
            overall_scan_status=ScanClassification.CORRUPT,
            metadata={"error": str(e), "is_corrupt": True},
        )

    if reader.is_encrypted:
        try:
            # Try empty password default
            unlocked = reader.decrypt("")
            if not unlocked:
                return CanonicalDocument(
                    document_id=doc_id,
                    original_name=original_name,
                    mime_type="application/pdf",
                    sha256=sha256,
                    size_bytes=size_bytes,
                    page_count=len(reader.pages),
                    overall_scan_status=ScanClassification.PROTECTED,
                    metadata={"is_encrypted": True, "error": "PDF protegido con contraseña."},
                )
        except Exception:
            return CanonicalDocument(
                document_id=doc_id,
                original_name=original_name,
                mime_type="application/pdf",
                sha256=sha256,
                size_bytes=size_bytes,
                page_count=len(reader.pages),
                overall_scan_status=ScanClassification.PROTECTED,
                metadata={"is_encrypted": True, "error": "PDF protegido con contraseña no desbloqueable."},
            )

    pages_info: list[PageScanInfo] = []
    fragments: list[DocumentFragment] = []
    char_offset = 0

    page_count = len(reader.pages)
    scanned_count = 0
    mixed_count = 0

    for idx, page in enumerate(reader.pages):
        page_num = idx + 1
        page_text = (page.extract_text() or "").strip()

        # Count images in the page
        try:
            image_count = len(page.images)
        except Exception:
            image_count = 0

        char_count = len(page_text)
        word_count = len(page_text.split()) if page_text else 0

        # Classification rule:
        # A page with very few chars (< 40) but with images is SCANNED
        # A page with substantial text and images is MIXED
        # A page with text and no or minimal images is TEXTUAL
        warnings: list[str] = []
        if char_count < 40 and image_count > 0:
            classification = ScanClassification.SCANNED
            scanned_count += 1
            has_text_layer = False
            quality_score = 0.4
            warnings.append("Página predominantemente gráfica/escaneada; requiere OCR o visión.")
        elif char_count < 20 and image_count == 0:
            classification = ScanClassification.SCANNED
            scanned_count += 1
            has_text_layer = False
            quality_score = 0.2
            warnings.append("Página vacía o sin texto extraíble reconocible.")
        elif image_count > 0 and char_count >= 40:
            classification = ScanClassification.MIXED
            mixed_count += 1
            has_text_layer = True
            quality_score = 0.8
            warnings.append("Página mixta (capa de texto con imágenes o diagramas adjuntos).")
        else:
            classification = ScanClassification.TEXTUAL
            has_text_layer = True
            quality_score = 1.0

        p_info = PageScanInfo(
            page_number=page_num,
            classification=classification,
            char_count=char_count,
            word_count=word_count,
            image_count=image_count,
            has_text_layer=has_text_layer,
            quality_score=quality_score,
            warnings=warnings,
        )
        pages_info.append(p_info)

        if page_text:
            start = char_offset
            end = start + len(page_text)
            char_offset = end + 2

            locator = FragmentLocator(
                document_id=doc_id,
                original_name=original_name,
                page_number=page_num,
                unit_type=UnitType.PAGE,
                unit_index=page_num,
                char_start=start,
                char_end=end,
                location_label=f"Página {page_num}",
            )

            fragments.append(
                DocumentFragment(
                    fragment_id=f"{doc_id}-p{page_num}",
                    locator=locator,
                    text=page_text,
                    is_ocr=False,
                    confidence=quality_score,
                    warnings=warnings,
                )
            )

    # Determine overall scan status
    if scanned_count == page_count and page_count > 0:
        overall_status = ScanClassification.SCANNED
    elif scanned_count > 0 or mixed_count > 0:
        overall_status = ScanClassification.MIXED
    else:
        overall_status = ScanClassification.TEXTUAL

    return CanonicalDocument(
        document_id=doc_id,
        original_name=original_name,
        mime_type="application/pdf",
        sha256=sha256,
        size_bytes=size_bytes,
        page_count=page_count,
        overall_scan_status=overall_status,
        pages_info=pages_info,
        fragments=fragments,
        metadata={
            "scanned_pages_count": scanned_count,
            "mixed_pages_count": mixed_count,
            "textual_pages_count": page_count - scanned_count - mixed_count,
        },
    )
