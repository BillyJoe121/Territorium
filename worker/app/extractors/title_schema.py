from typing import Any
from pydantic import BaseModel, Field


class PropertyOwner(BaseModel):
    name: str = Field(description="Nombre completo del propietario actual")
    document_type: str = Field(default="Cédula de ciudadanía", description="Tipo de documento (CC, NIT, CE, Pasaporte)")
    document_number: str = Field(description="Número de identificación del propietario")
    participation_percentage: float | None = Field(default=None, description="Porcentaje de participación si consta en el título")


class TitleStudyPayload(BaseModel):
    folio: str = Field(default="no identificado", description="Folio de matrícula inmobiliaria")
    cadastral_id: str = Field(default="no identificado", description="Cédula catastral nacional o municipal")
    owners: list[PropertyOwner] = Field(default_factory=list, description="Lista de propietarios actuales del predio")
    antecedents_consultation_date: str = Field(default="no identificado", description="Fecha de consulta de antecedentes Tusdatos.co")
    property_name: str = Field(default="no identificado", description="Nombre del predio")
    municipality: str = Field(default="no identificado", description="Municipio de ubicación del predio")
    department: str = Field(default="no identificado", description="Departamento de ubicación del predio")
    village: str = Field(default="no identificado", description="Vereda o corregimiento del predio")
    area_numbers: str = Field(default="no identificado", description="Área del predio en números con su unidad de medida")
    area_letters: str = Field(default="no identificado", description="Área del predio expresada en letras")
    registry_office: str = Field(default="no identificado", description="Oficina de Registro de Instrumentos Públicos (ORIP)")
    acquisition_mode: str = Field(default="no identificado", description="Modo de adquisición: acto jurídico + otorgante + título + anotación registral")
    boundaries: str = Field(default="no identificado", description="Transcripción exacta y literal de los linderos del predio sin resumir")
    boundaries_document: str = Field(default="no identificado", description="Documento fuente del cual se transcribieron los linderos")
    legal_conditions: str = Field(default="sin condiciones jurídicas vigentes", description="Gravámenes, limitaciones, servidumbres o medidas cautelares vigentes")
    justice_ministry_case: str = Field(default="no identificado", description="Radicado de consulta ante el Ministerio de Justicia")
    urt_case: str = Field(default="no identificado", description="Radicado de consulta ante la Unidad de Restitución de Tierras")
    urt_territorial_direction: str = Field(default="no identificado", description="Dirección territorial de la URT")
    boundaries_exactness: str = Field(default="LINDEROS EXACTOS", description="'LINDEROS EXACTOS' o 'LINDEROS RESUMIDOS'")
