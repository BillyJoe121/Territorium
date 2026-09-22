from typing import Any
from pydantic import BaseModel, Field, model_validator


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

    @model_validator(mode="before")
    @classmethod
    def _normalize_plan_data(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        normalized = dict(data)

        def _find_val(*keys: str) -> Any:
            for k in keys:
                for src_k, val in normalized.items():
                    clean_src = src_k.lower().replace(" ", "_").replace("²", "2").replace("(", "").replace(")", "").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
                    clean_target = k.lower().replace(" ", "_").replace("²", "2").replace("(", "").replace(")", "").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
                    if clean_src == clean_target or clean_target in clean_src:
                        if val is not None and str(val).strip() != "":
                            return val
            return None

        name = _find_val("nombre_del_plano", "nombre_plano", "plan_name", "codigo_plano")
        if name: normalized["plan_name"] = str(name).strip()

        area_num = _find_val("area_servidumbre_m2_numeros", "area_servidumbre_numeros", "easement_area_numbers", "area_numeros")
        if area_num: normalized["easement_area_numbers"] = str(area_num).strip()

        area_let = _find_val("area_servidumbre_m2_letras", "area_servidumbre_letras", "easement_area_letters", "area_letras")
        if area_let: normalized["easement_area_letters"] = str(area_let).strip()

        len_num = _find_val("longitud_servidumbre_m_numeros", "longitud_servidumbre_numeros", "easement_length_numbers", "longitud_numeros")
        if len_num: normalized["easement_length_numbers"] = str(len_num).strip()

        len_let = _find_val("longitud_servidumbre_m_letras", "longitud_servidumbre_letras", "easement_length_letters", "longitud_letras")
        if len_let: normalized["easement_length_letters"] = str(len_let).strip()

        w_num = _find_val("ancho_servidumbre_m_numeros", "ancho_servidumbre_numeros", "easement_width_numbers", "ancho_numeros")
        if w_num: normalized["easement_width_numbers"] = str(w_num).strip()

        w_let = _find_val("ancho_servidumbre_m_letras", "ancho_servidumbre_letras", "easement_width_letters", "ancho_letras")
        if w_let: normalized["easement_width_letters"] = str(w_let).strip()

        inf_num = _find_val("cantidad_postes_o_infraestructuras_numeros", "cantidad_postes_numeros", "infrastructure_count_numbers", "postes_numeros")
        if inf_num is not None: normalized["infrastructure_count_numbers"] = str(inf_num).strip()

        inf_let = _find_val("cantidad_postes_o_infraestructuras_letras", "cantidad_postes_letras", "infrastructure_count_letters", "postes_letras")
        if inf_let: normalized["infrastructure_count_letters"] = str(inf_let).strip()

        scale = _find_val("escala_del_plano", "escala_plano", "plan_scale", "escala")
        if scale: normalized["plan_scale"] = str(scale).strip()

        return normalized

