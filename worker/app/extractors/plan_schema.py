from typing import Any
from pydantic import BaseModel, Field


class PlanExtractionPayload(BaseModel):
    plan_name: str = Field(default="no identificado", description="Nombre o código del plano (ej. PLANO_SAN-CIM-001)")
    easement_area_numbers: str = Field(default="—", description="Área de servidumbre en números (m²)")
    easement_area_letters: str = Field(default="—", description="Área de servidumbre expresada en letras")
    easement_length_numbers: str = Field(default="—", description="Longitud de servidumbre en números (m)")
    easement_length_letters: str = Field(default="—", description="Longitud de servidumbre expresada en letras")
    easement_width_numbers: str = Field(default="—", description="Ancho de servidumbre en números (m)")
    easement_width_letters: str = Field(default="—", description="Ancho de servidumbre expresado en letras")
    infrastructure_count_numbers: str = Field(default="0", description="Cantidad de postes, apoyos o infraestructuras en números")
    infrastructure_count_letters: str = Field(default="cero", description="Cantidad de postes, apoyos o infraestructuras en letras")
    plan_scale: str = Field(default="no identificada", description="Escala del plano (ej. 1:1.000, 1:750)")
    plan_date: str = Field(default="no identificada", description="Fecha de elaboración del plano")
    project_name: str = Field(default="no identificado", description="Nombre del proyecto de infraestructura")
    voltage_level: str = Field(default="no identificado", description="Nivel de tensión eléctrica si consta en el plano")
    warnings: list[str] = Field(default_factory=list, description="Advertencias de legibilidad o incoherencia")
