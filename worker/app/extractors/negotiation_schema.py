from typing import Any
from pydantic import BaseModel, Field


class NegotiationExtractionPayload(BaseModel):
    property_code: str = Field(default="no identificado", description="Código o identificación de la carpeta/predio")
    first_offer_numbers: str = Field(default="—", description="Primera oferta formateada en moneda (ej. $ 218.450.000)")
    first_offer_numeric_value: float | None = Field(default=None, description="Valor numérico de la primera oferta")
    first_offer_letters: str = Field(default="—", description="Primera oferta expresada en letras")
    first_offer_matches: bool = Field(default=True, description="Indica si la primera oferta en números coincide con sus letras")

    second_offer_numbers: str = Field(default="—", description="Segunda oferta formateada en moneda (ej. $ 232.800.000)")
    second_offer_numeric_value: float | None = Field(default=None, description="Valor numérico de la segunda oferta")
    second_offer_letters: str = Field(default="—", description="Segunda oferta expresada en letras")
    second_offer_matches: bool = Field(default=True, description="Indica si la segunda oferta en números coincide con sus letras")

    third_offer_numbers: str = Field(default="—", description="Tercera oferta formateada en moneda si existe")
    third_offer_numeric_value: float | None = Field(default=None, description="Valor numérico de la tercera oferta")
    third_offer_letters: str = Field(default="—", description="Tercera oferta expresada en letras")
    third_offer_matches: bool = Field(default=True, description="Indica si la tercera oferta coincide")

    appraisal_value: float | None = Field(default=None, description="Valor del avalúo comercial")
    values_match: str = Field(default="Sí, coinciden", description="'Sí, coinciden' o descripción de discrepancia")
    discrepancies: list[str] = Field(default_factory=list, description="Lista detallada de discrepancias detectadas")
    cell_references: dict[str, str] = Field(default_factory=dict, description="Coordenadas de celda para auditoría (ej. Sheet1!C4)")
