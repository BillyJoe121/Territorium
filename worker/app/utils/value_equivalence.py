"""Equivalencias deterministas entre valores escritos de forma distinta en dos documentos.

Cubre lo que una comparación de texto no ve: la misma área en otra unidad o en letras
("22991 m2" = "DOS HECTÁREAS Y DOS MIL NOVECIENTOS NOVENTA Y UN METROS CUADRADOS"), la misma
cifra en letras y en números, y la cédula catastral de 20 dígitos frente al número predial
nacional de 30. Solo decide cuando puede demostrarlo; si no, devuelve None.
"""

import re
import unicodedata
from itertools import product

from .spanish_currency import _WORD_VALUES, spanish_words_to_amount

# Factor a m². Fanegada y vara cuadrada según el uso colombiano (6.400 m² y 0,64 m²).
_UNIT_ONE = {
    'ha': 10_000, 'has': 10_000, 'hectarea': 10_000, 'hectareas': 10_000,
    'm2': 1, 'mt2': 1, 'mts2': 1, 'mtr2': 1, 'mtrs2': 1,
    'fanegada': 6_400, 'fanegadas': 6_400,
}
_UNIT_TWO = {
    ('metro', 'cuadrado'): 1, ('metros', 'cuadrados'): 1, ('mts', 'cuadrados'): 1,
    ('vara', 'cuadrada'): 0.64, ('varas', 'cuadradas'): 0.64,
}
_NUMBER_WORDS = set(_WORD_VALUES) | {'mil', 'millon', 'millones', 'y', 'de'}
_CONNECTORS = {'y', 'con', 'mas', 'de'}
_AREA_TOLERANCE = 0.01   # m²
_AREA_NEAR_RATIO = 0.01  # hasta 1 % de diferencia queda "a revisar"


def _ascii(text: str) -> str:
    return unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode().lower()


def _segments(text: str) -> list[str]:
    """Texto principal y cada paréntesis por separado: "DOS HECTÁREAS (2 Ha.)" se lee dos veces."""
    inner = re.findall(r'\(([^)]*)\)', text)
    main = re.sub(r'\([^)]*\)', ' ', text)
    return [segment for segment in (main, *inner) if segment.strip()]


def _decimal_candidates(token: str) -> set[float]:
    """Lecturas posibles de una cifra: "2.991" puede ser 2991 o 2,991; "995,43" es decimal."""
    if ',' in token and '.' in token:
        decimal = ',' if token.rfind(',') > token.rfind('.') else '.'
        thousands = '.' if decimal == ',' else ','
        return {float(token.replace(thousands, '').replace(decimal, '.'))}
    separator = ',' if ',' in token else '.' if '.' in token else None
    if separator is None:
        return {float(token)}
    parts = token.split(separator)
    if len(parts) > 2:
        return {float(''.join(parts))} if all(len(part) == 3 for part in parts[1:]) else set()
    whole, fraction = parts
    readings = {float(f'{whole}.{fraction}')}
    if len(fraction) == 3:
        readings.add(float(whole + fraction))
    return readings


def _segment_area(segment: str) -> set[float] | None:
    tokens = re.findall(r'\d+(?:[.,]\d+)*|[a-z]+2?', _ascii(segment))
    totals: set[float] = {0.0}
    digits: set[float] | None = None
    words: list[str] = []
    saw_unit = False
    index = 0
    while index < len(tokens):
        token = tokens[index]
        pair = tuple(tokens[index:index + 2])
        factor = _UNIT_TWO.get(pair) if len(pair) == 2 else None
        width = 2 if factor is not None else 1
        if factor is None:
            factor = _UNIT_ONE.get(token)
        if factor is not None:
            amount = spanish_words_to_amount(' '.join(words)) if words else None
            quantity = digits if digits is not None else ({float(amount)} if amount is not None else None)
            if not quantity:
                return None
            totals = {total + value * factor for total, value in product(totals, quantity)}
            if len(totals) > 16:
                return None
            digits, words, saw_unit = None, [], True
        elif token[0].isdigit():
            if digits is not None or words:
                return None  # dos cifras seguidas sin unidad: lectura ambigua
            digits = _decimal_candidates(token)
        elif token in _NUMBER_WORDS and digits is None and (words or token not in _CONNECTORS):
            words.append(token)
        elif token in _CONNECTORS and digits is None and not words:
            pass
        elif digits is not None or words:
            return None  # una cifra sin unidad seguida de otra palabra
        index += width
    if digits is not None or words or not saw_unit:
        return None
    return {round(total, 4) for total in totals}


def parse_area_m2(text: str) -> tuple[set[float], bool] | None:
    """Áreas posibles en m² y si el valor es coherente consigo mismo (letras = cifras)."""
    readings = [_segment_area(segment) for segment in _segments(text)]
    readings = [reading for reading in readings if reading]
    if not readings:
        return None
    common = set.intersection(*readings)
    return (common, True) if common else (set.union(*readings), False)


def _segment_number(segment: str) -> set[float] | None:
    clean = re.sub(r'\$|\bcop\b|\bm/?cte\b', ' ', _ascii(segment)).strip(' .:;')
    if re.fullmatch(r'\d+(?:[.,]\d+)*', clean):
        return _decimal_candidates(clean) or None
    amount = spanish_words_to_amount(clean)
    return {float(amount)} if amount is not None else None


def parse_number(text: str) -> set[float] | None:
    """Cifra pura escrita en números, en letras o de ambas formas ("DOS MIL (2.000)")."""
    readings = [_segment_number(segment) for segment in _segments(text)]
    if not readings or any(reading is None for reading in readings):
        return None
    common = set.intersection(*readings)
    return common or None


def _cadastral_digits(text: str) -> str | None:
    main = re.sub(r'\([^)]*\)', ' ', text).strip()
    if not re.fullmatch(r'[\d\s.\-]+', main):
        return None
    digits = re.sub(r'\D', '', main)
    return digits if len(digits) in (20, 30) else None


def _old_matches_npn(old: str, npn: str) -> bool:
    """Cédula de 20 dígitos dentro del número predial nacional de 30 (IGAC).

    Antigua: depto(2) municipio(3) zona(2) sector(2) vereda/manzana(4) terreno(4) mejora(3).
    Nueva:   depto(2) municipio(3) zona(2) sector(2) comuna(2) barrio(2) vereda/manzana(4)
             terreno(4) condición(1) edificio(2) piso(2) unidad(4).
    En la práctica los planos rellenan con un número variable de ceros antes de la vereda,
    así que se acepta el bloque vereda+terreno completo tras cualquier relleno de ceros.
    """
    if old[:9] != npn[:9]:
        return False
    return any(set(npn[9:9 + pad]) <= {'0'} and npn[9 + pad:17 + pad] == old[9:17] for pad in range(9))


def _m2(value: float) -> str:
    text = f'{value:,.2f}'.replace(',', '#').replace('.', ',').replace('#', '.')
    return f"{text.removesuffix(',00')} m²"


def _plain(value: float) -> str:
    return f'{value:,.0f}'.replace(',', '.') if value == int(value) else f'{value:,.2f}'.replace(',', '#').replace('.', ',').replace('#', '.')


def compare_equivalent(a: str, b: str) -> tuple[str, str, str] | None:
    """(estado, motivo, tipo) cuando una regla demuestra la relación; None si no puede decidir.

    tipo: 'area', 'cadastral' o 'number'. Las dos primeras sirven además para emparejar
    atributos que la IA dejó separados por tener rótulos distintos.
    """
    left_code, right_code = _cadastral_digits(a), _cadastral_digits(b)
    if left_code and right_code:
        if left_code == right_code:
            return 'exact', 'Mismo código; solo cambia la forma de escribirlo.', 'cadastral'
        if {len(left_code), len(right_code)} == {20, 30}:
            old, npn = sorted((left_code, right_code), key=len)
            if _old_matches_npn(old, npn):
                return 'near', (
                    'La cédula catastral de 20 dígitos coincide con el número predial nacional de 30 '
                    '(departamento, municipio, zona, sector, vereda o manzana y terreno). Es un cambio '
                    'de formato: confirme que se trata del mismo predio.'
                ), 'cadastral'
        return None

    left_area, right_area = parse_area_m2(a), parse_area_m2(b)
    if left_area and right_area:
        (left_values, left_ok), (right_values, right_ok) = left_area, right_area
        if not (left_ok and right_ok):
            return 'near', 'En uno de los documentos el área en letras no coincide con la escrita en cifras; revise el original.', 'area'
        pairs = sorted(product(left_values, right_values), key=lambda pair: abs(pair[0] - pair[1]))
        x, y = pairs[0]
        gap = abs(x - y)
        if gap <= _AREA_TOLERANCE:
            return 'exact', f'Misma área en otra unidad o escritura: {_m2(x)} en ambos documentos.', 'area'
        if gap <= _AREA_NEAR_RATIO * max(x, y):
            percent = f'{gap / max(x, y) * 100:.2f}'.replace('.', ',')
            return 'near', f'Áreas cercanas: {_m2(x)} frente a {_m2(y)} (diferencia de {_m2(gap)}, {percent} %).', 'area'
        return 'different', f'Áreas distintas: {_m2(x)} frente a {_m2(y)}.', 'area'

    left_number, right_number = parse_number(a), parse_number(b)
    if left_number and right_number:
        common = left_number & right_number
        if common:
            return 'exact', f'Mismo valor escrito de otra forma: {_plain(min(common))}.', 'number'
        return 'different', f'Valores distintos: {_plain(min(left_number))} frente a {_plain(min(right_number))}.', 'number'
    return None
