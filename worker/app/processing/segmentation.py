import uuid
from typing import Any
from pydantic import BaseModel, Field

from ..models.canonical import CanonicalDocument, DocumentFragment, FragmentLocator


class DocumentSegment(BaseModel):
    segment_id: str
    document_id: str
    original_name: str
    segment_index: int
    text: str
    token_count: int
    locators: list[FragmentLocator] = Field(default_factory=list)
    tables: list[list[list[str]]] = Field(default_factory=list)
    is_omitted: bool = False
    omission_reason: str | None = None

    def location_summary(self) -> str:
        labels = [loc.location_label for loc in self.locators if loc.location_label]
        return ", ".join(labels[:3]) + (f" (+{len(labels) - 3} más)" if len(labels) > 3 else "")


def segment_canonical_document(
    document: CanonicalDocument,
    max_tokens_per_segment: int = 2500,
    overlap_tokens: int = 100,
) -> list[DocumentSegment]:
    """
    Partitions a CanonicalDocument into semantically bounded segments
    respecting section/table/page boundaries and token budgets (HU-V2-037).
    Explicitly tracks omitted or empty fragments.
    """
    segments: list[DocumentSegment] = []
    current_fragments: list[DocumentFragment] = []
    current_tokens = 0
    segment_idx = 0

    def create_segment(frags: list[DocumentFragment], omitted: bool = False, reason: str | None = None) -> DocumentSegment:
        nonlocal segment_idx
        segment_idx += 1
        text_content = "\n\n".join(f.text for f in frags if f.text.strip())
        tokens = sum(f.token_estimate for f in frags)
        locators = [f.locator for f in frags]
        tables = [f.table_data for f in frags if f.table_data]

        return DocumentSegment(
            segment_id=f"{document.document_id}-seg-{segment_idx}",
            document_id=document.document_id,
            original_name=document.original_name,
            segment_index=segment_idx,
            text=text_content,
            token_count=tokens,
            locators=locators,
            tables=tables,
            is_omitted=omitted,
            omission_reason=reason,
        )

    for frag in document.fragments:
        frag_text = frag.text.strip()
        if not frag_text:
            # Explicitly log omission of empty chunk
            segments.append(
                create_segment([frag], omitted=True, reason="Fragmento vacío o sin texto interpretable")
            )
            continue

        frag_tokens = frag.token_estimate

        # If adding this fragment exceeds the token budget and we already have content
        if current_tokens + frag_tokens > max_tokens_per_segment and current_fragments:
            segments.append(create_segment(current_fragments))
            # Keep overlap fragment if available
            if overlap_tokens > 0 and len(current_fragments) > 1:
                current_fragments = [current_fragments[-1], frag]
                current_tokens = current_fragments[0].token_estimate + frag_tokens
            else:
                current_fragments = [frag]
                current_tokens = frag_tokens
        else:
            current_fragments.append(frag)
            current_tokens += frag_tokens

    if current_fragments:
        segments.append(create_segment(current_fragments))

    # If document had no fragments at all (e.g. empty or protected)
    if not segments:
        segments.append(
            DocumentSegment(
                segment_id=f"{document.document_id}-seg-1",
                document_id=document.document_id,
                original_name=document.original_name,
                segment_index=1,
                text="",
                token_count=0,
                is_omitted=True,
                omission_reason=f"Documento no generó fragmentos de texto (estado: {document.overall_scan_status.value})",
            )
        )

    return segments
