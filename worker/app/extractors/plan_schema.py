from typing import Any
from pydantic import BaseModel, Field, model_validator


class PlanExtractionPayload(BaseModel):
    # Identificación del predio: el FMI es la llave para vincular el plano con su estudio de títulos.
    folio: str = Field(default="no identificado", description="Folio de matrícula inmobiliaria (FMI) del predio, ej. 350-108418")
    cadastral_id: str = Field(default="no identificado", description="Cédula o número predial catastral que aparece en el plano")
    property_name: str = Field(default="no identificado", description="Nombre del predio según el plano")
    owners: str = Field(default="no identificado", description="Propietario(s) del predio según el plano")
    municipality: str = Field(default="no identificado", description="Municipio del predio según el plano")
    village: str = Field(default="no identificado", description="Vereda o corregimiento según el plano")
    property_area: str = Field(default="no identificado", description="Área total del predio según el plano, con su unidad")
    source_document: str = Field(default="", description="Nombre del archivo del plano")
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

        fmi = _find_val("folio_de_matricula", "folio_matricula", "matricula_inmobiliaria", "fmi", "folio")
        if fmi: normalized["folio"] = str(fmi).strip()

        cad = _find_val("cedula_catastral", "numero_predial", "cadastral_id")
        if cad: normalized["cadastral_id"] = str(cad).strip()

        prop = _find_val("nombre_del_predio", "nombre_predio", "property_name")
        if prop: normalized["property_name"] = str(prop).strip()

        owners = _find_val("propietarios", "propietario", "owners")
        if owners:
            if isinstance(owners, list):
                owners = "; ".join(str(o.get("nombre") or o.get("name") or o) if isinstance(o, dict) else str(o) for o in owners)
            normalized["owners"] = str(owners).strip()

        muni = _find_val("municipio", "municipality")
        if muni: normalized["municipality"] = str(muni).strip()

        village = _find_val("vereda", "corregimiento", "village")
        if village: normalized["village"] = str(village).strip()

        parea = _find_val("area_del_predio", "area_total_del_predio", "area_total_predio", "area_predio", "property_area")
        if parea: normalized["property_area"] = str(parea).strip()

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

