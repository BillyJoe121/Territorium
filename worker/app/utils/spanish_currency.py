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
    text = re.sub(r"\b(pesos|m/cte|mcte|moneda legal|colombianos|de pesos|peso)\b", "", text)
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

    millones = amount_int // 1_000_000
    resto_millones = amount_int % 1_000_000
    miles = resto_millones // 1_000
    unidades = resto_millones % 1_000

    words = []

    if millones > 0:
        if millones == 1:
            words.append("UN MILLON")
        else:
            words.append(f"{_convert_group(millones).upper()} MILLONES")

    if miles > 0:
        if miles == 1:
            words.append("MIL")
        else:
            words.append(f"{_convert_group(miles).upper()} MIL")

    if unidades > 0:
        words.append(_convert_group(unidades).upper())

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

    # Also handle minor variants: e.g. "un millon" vs "un millon de", or "veinte y siete" vs "veintisiete"
    tokens_expected = set(norm_expected.split())
    tokens_actual = set(norm_actual.split())

    # If the set of number tokens is identical (order and conjunction differences ignored)
    diff = tokens_expected.symmetric_difference(tokens_actual)
    # Ignore negligible connector words like "con", "de", "y"
    meaningful_diff = {t for t in diff if t not in ("con", "de", "y", "del", "pesos", "un", "uno")}

    if not meaningful_diff:
        return True, "Coinciden números y letras (con variaciones menores de conectores)"

    return False, (
        f"Discrepancia detectada: el número ${number:,.0f} equivale a "
        f"'{expected_words.strip()}', pero el texto indica '{letters.strip()}'."
    )
