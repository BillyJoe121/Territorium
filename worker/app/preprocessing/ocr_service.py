import base64
import logging
from typing import Any
import pypdf

from ..models.canonical import DocumentFragment, FragmentLocator, UnitType

logger = logging.getLogger("territorium.ocr")


class OCRService:
    def __init__(self, openai_client: Any | None = None, vision_model: str = "gpt-4o") -> None:
        self.client = openai_client
        self.vision_model = vision_model

    async def ocr_page_image_base64(
        self,
        image_base64: str,
        page_number: int,
        document_id: str,
        original_name: str,
        prompt: str = "Transcribe de forma fiel, exacta y completa todo el texto contenido en esta imagen jurídica o técnica. No resumas, no omitas nombres, números, sellos o anotaciones. Si una parte es ilegible, escribe [ILEGIBLE].",
    ) -> DocumentFragment:
        """
        Transcribes a scanned page image via Vision API.
        """
        if not self.client:
            logger.warning(f"OCR requested for {original_name} p.{page_number} but no OpenAI client available.")
            return DocumentFragment(
                fragment_id=f"{document_id}-ocr-p{page_number}",
                locator=FragmentLocator(
                    document_id=document_id,
                    original_name=original_name,
                    page_number=page_number,
                    unit_type=UnitType.PAGE,
                    location_label=f"Página {page_number} (OCR no disponible)",
                ),
                text="[PÁGINA ESCANEADA PENDIENTE DE OCR]",
                is_ocr=True,
                confidence=0.0,
                warnings=["Cliente OpenAI no configurado para ejecutar OCR."],
            )

        try:
            response = await self.client.chat.completions.create(
                model=self.vision_model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{image_base64}",
                                    "detail": "high",
                                },
                            },
                        ],
                    }
                ],
                temperature=0.0,
                max_tokens=4000,
            )
            extracted_text = response.choices[0].message.content or ""
            return DocumentFragment(
                fragment_id=f"{document_id}-ocr-p{page_number}",
                locator=FragmentLocator(
                    document_id=document_id,
                    original_name=original_name,
                    page_number=page_number,
                    unit_type=UnitType.PAGE,
                    location_label=f"Página {page_number} (OCR)",
                ),
                text=extracted_text.strip(),
                is_ocr=True,
                confidence=0.9,
                warnings=[],
            )
        except Exception as e:
            logger.error(f"OCR Vision error on {original_name} page {page_number}: {e}")
            return DocumentFragment(
                fragment_id=f"{document_id}-ocr-p{page_number}",
                locator=FragmentLocator(
                    document_id=document_id,
                    original_name=original_name,
                    page_number=page_number,
                    unit_type=UnitType.PAGE,
                    location_label=f"Página {page_number} (Error OCR)",
                ),
                text=f"[ERROR AL PROCESAR OCR: {str(e)}]",
                is_ocr=True,
                confidence=0.0,
                warnings=[f"Error en servicio OCR: {str(e)}"],
            )
