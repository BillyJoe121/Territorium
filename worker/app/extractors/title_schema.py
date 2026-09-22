from typing import Any
from pydantic import BaseModel, Field, model_validator


class PropertyOwner(BaseModel):
    name: str = Field(default="", description="Nombre completo del propietario actual")
    document_type: str = Field(default="Cédula de ciudadanía", description="Tipo de documento (CC, NIT, CE, Pasaporte)")
    document_number: str = Field(default="", description="Número de identificación del propietario")
    participation_percentage: float | None = Field(default=None, description="Porcentaje de participación si consta en el título")

    @model_validator(mode="before")
    @classmethod
    def _normalize_owner(cls, data: Any) -> Any:
        if isinstance(data, dict):
            name = data.get("nombre_completo") or data.get("nombre") or data.get("name") or ""
            doc_type = data.get("tipo_documento") or data.get("tipo_doc") or data.get("document_type") or "Cédula de ciudadanía"
            doc_num = data.get("numero_documento") or data.get("identificacion") or data.get("document_number") or ""
            pct = data.get("porcentaje_derecho") or data.get("participation_percentage")
            try:
                pct_float = float(str(pct).replace("%", "").strip()) if pct is not None else None
            except (ValueError, TypeError):
                pct_float = None
            return {
                "name": str(name).strip(),
                "document_type": str(doc_type).strip(),
                "document_number": str(doc_num).strip(),
                "participation_percentage": pct_float,
            }
        return data


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

    @model_validator(mode="before")
    @classmethod
    def _normalize_title_data(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        normalized = dict(data)

        # Folio
        if "folio_matricula" in data and "folio" not in data:
            normalized["folio"] = data["folio_matricula"]
        elif "matricula" in data and "folio" not in data:
            normalized["folio"] = data["matricula"]

        # Cédula catastral
        if "cedula_catastral" in data and "cadastral_id" not in data:
            normalized["cadastral_id"] = data["cedula_catastral"]

        # Propietarios
        owners_raw = (
            data.get("propietarios_actuales")
            or data.get("propietarios")
            or data.get("owners")
            or []
        )
        if isinstance(owners_raw, list):
            normalized["owners"] = owners_raw

        # Textos descriptivos
        if "modo_adquisicion" in data and "acquisition_mode" not in data:
            normalized["acquisition_mode"] = data["modo_adquisicion"]
        if "linderos" in data and "boundaries" not in data:
            normalized["boundaries"] = data["linderos"]
        if "documento_que_contiene_los_linderos" in data and "boundaries_document" not in data:
            normalized["boundaries_document"] = data["documento_que_contiene_los_linderos"]
        if "condiciones_juridicas_vigentes" in data and "legal_conditions" not in data:
            normalized["legal_conditions"] = data["condiciones_juridicas_vigentes"]
        if "nombre_del_predio" in data and "property_name" not in data:
            normalized["property_name"] = data["nombre_del_predio"]
        if "municipio" in data and "municipality" not in data:
            normalized["municipality"] = data["municipio"]
        if "departamento" in data and "department" not in data:
            normalized["department"] = data["departamento"]
        if "vereda" in data and "village" not in data:
            normalized["village"] = data["vereda"]
        if "area_numeros" in data and "area_numbers" not in data:
            normalized["area_numbers"] = data["area_numeros"]
        if "area_letras" in data and "area_letters" not in data:
            normalized["area_letters"] = data["area_letras"]
        if "oficina_registro" in data and "registry_office" not in data:
            normalized["registry_office"] = data["oficina_registro"]

        # Radicados
        rads = data.get("radicados")
        if isinstance(rads, dict):
            if "unidad_restitucion_tierras_respuesta" in rads and "urt_case" not in normalized:
                normalized["urt_case"] = rads["unidad_restitucion_tierras_respuesta"]
            elif "unidad_restitucion_tierras_solicitud" in rads and "urt_case" not in normalized:
                normalized["urt_case"] = rads["unidad_restitucion_tierras_solicitud"]
            if "direccion_territorial_urt" in rads and "urt_territorial_direction" not in normalized:
                normalized["urt_territorial_direction"] = rads["direccion_territorial_urt"]
            if "ministerio_de_justicia" in rads and "justice_ministry_case" not in normalized:
                normalized["justice_ministry_case"] = rads["ministerio_de_justicia"]

        return normalized
