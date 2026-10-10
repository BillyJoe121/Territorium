import re
import unicodedata

UNIDADES = (
    "", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
    "diez", "once", "doce", "trece", "catorce", "quince", "dieciseis", "diecisiete",
    "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidos", "veintitres",
    "veinticuatro", "veinticinco", "veintiseis", "veintisiete", "veintiocho", "veintinueve"
)

DECENAS = (
    "", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"
)

CENTENAS = (
    "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
    "seiscientos", "setecientos", "ochocientos", "novecientos"
)


def _normalize_spanish_text(text: str) -> str:
    """Removes accents, uppercase, standardizes spaces and currency suffixes."""
    text = unicodedata.normalize("NFKD", text).encode("ASCII", "ignore").decode("utf-8")
    text = text.lower()
    text = re.sub(r"\b(pesos|m/cte|mcte|moneda legal|moneda corriente|colombianos|de pesos|peso)\b", "", text)
    text = re.sub(r"[,\.;\-_/]", " ", text)
    # common variants e.g. "veinte y cinco" -> "veinticinco", "diez y seis" -> "dieciseis"
    text = re.sub(r"\bveinte y un[oa]?\b", "veintiuno", text)
    text = re.sub(r"\bveinte y dos\b", "veintidos", text)
    text = re.sub(r"\bveinte y tres\b", "veintitres", text)
    text = re.sub(r"\bveinte y cuatro\b", "veinticuatro", text)
    text = re.sub(r"\bveinte y cinco\b", "veinticinco", text)
    text = re.sub(r"\bveinte y seis\b", "veintiseis", text)
    text = re.sub(r"\bveinte y siete\b", "veintisiete", text)
    text = re.sub(r"\bveinte y ocho\b", "veintiocho", text)
    text = re.sub(r"\bveinte y nueve\b", "veintinueve", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _convert_group(n: int) -> str:
    """Converts a 3-digit number (0-999) to Spanish words."""
    if n == 0:
        return ""
    if n == 100:
        return "cien"
    
    parts = []
    c = n // 100
    r = n % 100

    if c > 0:
        parts.append(CENTENAS[c])

    if r > 0:
        if r < 30:
            parts.append(UNIDADES[r])
        else:
            d = r // 10
            u = r % 10
            if u == 0:
                parts.append(DECENAS[d])
            else:
                parts.append(f"{DECENAS[d]} y {UNIDADES[u]}")

    return " ".join(parts)


def number_to_spanish_words(amount: int | float, currency_suffix: str = "PESOS") -> str:
    """
    Converts a numeric amount (e.g. Colombian Pesos) into uppercase Spanish words.
    Example: 218450000 -> DOSCIENTOS DIECIOCHO MILLONES CUATROCIENTOS CINCUENTA MIL PESOS
    """
    amount_int = int(round(amount))
    if amount_int == 0:
        return f"CERO {currency_suffix}".strip()

    def thousands(n: int) -> str:
        """1..999.999 ("MIL", no "UN MIL")."""
        miles, unidades = divmod(n, 1_000)
        parts = []
        if miles == 1:
            parts.append("MIL")
        elif miles:
            parts.append(f"{_convert_group(miles).upper()} MIL")
        if unidades:
            parts.append(_convert_group(unidades).upper())
        return " ".join(parts)

    billones, resto = divmod(amount_int, 1_000_000_000_000)
    millones, resto = divmod(resto, 1_000_000)

    words = []
    if billones:
        words.append("UN BILLON" if billones == 1 else f"{thousands(billones)} BILLONES")
    if millones:
        words.append("UN MILLON" if millones == 1 else f"{thousands(millones)} MILLONES")
    if resto:
        words.append(thousands(resto))

    if currency_suffix:
        words.append(currency_suffix.upper())

    return " ".join(words)


def compare_number_and_letters(
    number: float | int | None,
    letters: str | None,
) -> tuple[bool, str]:
    """
    Compares a numeric offer against its written expression in words.
    Returns (is_matching, explanation).
    """
    if number is None and (not letters or not letters.strip()):
        return True, "No se registraron valores de oferta."
    if number is None and letters:
        return False, "Existe valor en letras pero no en números."
    if number is not None and (not letters or not letters.strip()):
        return False, "Existe valor en números pero no en letras."

    expected_words = number_to_spanish_words(number, currency_suffix="")
    norm_expected = _normalize_spanish_text(expected_words)
    norm_actual = _normalize_spanish_text(letters or "")

    # Compare normalized forms
    if norm_expected == norm_actual:
        return True, "Coinciden números y letras"

    # Variantes de redacción ("un millón de", "veintiún", "veinte y siete"): se interpreta
    # el texto como cifra respetando el orden de las palabras y se comparan los valores.
    if spanish_words_to_amount(norm_actual) == int(round(number)):
        return True, "Coinciden números y letras"

    formatted = f"{number:,.0f}".replace(",", ".")
    return False, (
        f"Discrepancia detectada: el número $ {formatted} equivale a "
        f"'{expected_words.strip()}', pero el texto indica '{letters.strip()}'."
    )


_WORD_VALUES = {
    "un": 1, "uno": 1, "una": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5,
    "seis": 6, "siete": 7, "ocho": 8, "nueve": 9, "diez": 10, "once": 11, "doce": 12,
    "trece": 13, "catorce": 14, "quince": 15, "dieciseis": 16, "diecisiete": 17,
    "dieciocho": 18, "diecinueve": 19, "veinte": 20, "veintiun": 21, "veintiuno": 21,
    "veintiuna": 21, "veintidos": 22, "veintitres": 23, "veinticuatro": 24, "veinticinco": 25,
    "veintiseis": 26, "veintisiete": 27, "veintiocho": 28, "veintinueve": 29,
    "treinta": 30, "cuarenta": 40, "cincuenta": 50, "sesenta": 60, "setenta": 70,
    "ochenta": 80, "noventa": 90, "cien": 100, "ciento": 100, "doscientos": 200,
    "trescientos": 300, "cuatrocientos": 400, "quinientos": 500, "seiscientos": 600,
    "setecientos": 700, "ochocientos": 800, "novecientos": 900,
}
_SCALES = {"millon": 10**6, "millones": 10**6, "billon": 10**12, "billones": 10**12}


def spanish_words_to_amount(text: str) -> int | None:
    """Interpreta una cifra escrita en español respetando el orden de las palabras.

    "ciento diez mil" -> 110000, pero "diez mil ciento" -> 10100 y "diez ciento" -> None.
    Dentro de cada grupo de tres cifras exige centenas, luego decenas y luego unidades;
    las escalas (mil, millones, billones) deben ir de mayor a menor. Devuelve None si el
    texto contiene palabras ajenas a una cifra o un orden imposible.
    """
    tokens = _normalize_spanish_text(text).split()
    total = 0          # suma de segmentos ya cerrados por millones/billones
    thousands = 0      # parte "N mil" del segmento en curso
    group = 0          # grupo de tres cifras en curso
    place = 4          # 3 = centenas, 2 = decenas, 1 = unidades; 4 = grupo vacío
    last_scale = None  # última escala de millones/billones usada
    saw_mil = False
    saw_number = False
    for token in tokens:
        if token in ("de", "y"):
            continue
        if token in _WORD_VALUES:
            value = _WORD_VALUES[token]
            token_place = 3 if value >= 100 else 2 if value >= 30 and value % 10 == 0 else 1
            # "cien" solo, "treinta y cinco" sí; "diez ciento", "treinta quince" no.
            if token_place >= place or (place == 2 and value >= 10) or (token == "cien" and place != 4):
                return None
            group += value
            place = token_place
            saw_number = True
        elif token == "mil":
            if saw_mil:
                return None
            thousands = (group or 1) * 1000
            group, place, saw_mil, saw_number = 0, 4, True, True
        elif token in _SCALES:
            scale = _SCALES[token]
            if last_scale is not None and scale >= last_scale:
                return None
            total += (thousands + group or 1) * scale
            thousands, group, place, saw_mil, last_scale, saw_number = 0, 0, 4, False, scale, True
        else:
            return None
    return total + thousands + group if saw_number else None


_UNITS_AP = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"]
_TEENS = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"]
_TWENTIES = ["VEINTE", "VEINTIÚN", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"]
_TENS = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"]
_HUNDREDS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"]


def _group_words(n: int) -> str:
    """1..999 con apócope (UN, VEINTIÚN): siempre precede a MIL/MILLONES/PESOS."""
    if n == 100:
        return "CIEN"
    hundreds, rest = divmod(n, 100)
    parts = [_HUNDREDS[hundreds]] if hundreds else []
    if 10 <= rest < 20:
        parts.append(_TEENS[rest - 10])
    elif 20 <= rest < 30:
        parts.append(_TWENTIES[rest - 20])
    elif rest >= 30:
        tens, units = divmod(rest, 10)
        parts.append(f"{_TENS[tens]} Y {_UNITS_AP[units]}" if units else _TENS[tens])
    elif rest:
        parts.append(_UNITS_AP[rest])
    return " ".join(parts)


def _thousands_words(n: int) -> str:
    thousands, rest = divmod(n, 1000)
    parts = []
    if thousands == 1:
        parts.append("MIL")
    elif thousands:
        parts.append(f"{_group_words(thousands)} MIL")
    if rest:
        parts.append(_group_words(rest))
    return " ".join(parts)


def amount_in_words(amount: int | float) -> str:
    """Redacción canónica en mayúsculas con tildes: 2000000 -> 'DOS MILLONES DE PESOS'.

    Usa las mismas reglas que la validación del valor negociado en la aplicación.
    """
    value = int(round(amount))
    if value <= 0:
        return "CERO PESOS"
    millions, rest = divmod(value, 1_000_000)
    parts = []
    if millions:
        parts.append("UN MILLÓN" if millions == 1 else f"{_thousands_words(millions)} MILLONES")
    if rest:
        parts.append(_thousands_words(rest))
    currency = "PESO" if value == 1 else "PESOS"
    connector = "DE " if rest == 0 else ""
    return f"{' '.join(parts)} {connector}{currency}"
