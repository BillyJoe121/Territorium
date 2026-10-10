/**
 * Valor negociado de la Plantilla de negociación.
 *
 * El profesional ingresa el valor en números (pesos); el valor en letras se redacta
 * solo con `negotiatedValueLetters`. La verificación es determinística: se genera la
 * redacción canónica en español del número y se compara con el texto guardado sin
 * distinguir mayúsculas/minúsculas. Tildes, espacios y ortografía sí cuentan.
 */

export const NEGOTIATED_NUMBERS_EXAMPLE = '$ 93.468.040'

const MAX_AMOUNT = 999_999_999_999_999

const UNITS = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
const TEENS = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve']
const TWENTIES = ['veinte', 'veintiún', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve']
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

/** 1..999 con apócope ("un", "veintiún"), porque siempre precede a mil/millones/pesos. */
function groupToWords(n: number): string {
  if (n === 100) return 'cien'
  const parts: string[] = []
  const h = Math.floor(n / 100)
  const rest = n % 100
  if (h) parts.push(HUNDREDS[h])
  if (rest >= 10 && rest < 20) parts.push(TEENS[rest - 10])
  else if (rest >= 20 && rest < 30) parts.push(TWENTIES[rest - 20])
  else if (rest >= 30) {
    const t = Math.floor(rest / 10)
    const u = rest % 10
    parts.push(u ? `${TENS[t]} y ${UNITS[u]}` : TENS[t])
  } else if (rest > 0) parts.push(UNITS[rest])
  return parts.join(' ')
}

/** 1..999.999 ("mil", no "un mil"). */
function thousandsToWords(n: number): string {
  const thousands = Math.floor(n / 1000)
  const rest = n % 1000
  const parts: string[] = []
  if (thousands === 1) parts.push('mil')
  else if (thousands > 1) parts.push(`${groupToWords(thousands)} mil`)
  if (rest) parts.push(groupToWords(rest))
  return parts.join(' ')
}

/** Redacción canónica en minúsculas, p. ej. 2_000_000 → "dos millones de pesos". */
export function amountToSpanishWords(amount: number): string {
  if (!Number.isInteger(amount) || amount < 0 || amount > MAX_AMOUNT) {
    throw new RangeError('El valor debe ser un entero positivo en pesos.')
  }
  if (amount === 0) return 'cero pesos'

  const billions = Math.floor(amount / 1e12)
  const millions = Math.floor((amount % 1e12) / 1e6)
  const rest = amount % 1e6
  const parts: string[] = []
  if (billions) parts.push(billions === 1 ? 'un billón' : `${thousandsToWords(billions)} billones`)
  if (millions) parts.push(millions === 1 ? 'un millón' : `${thousandsToWords(millions)} millones`)
  if (rest) parts.push(thousandsToWords(rest))

  // "un millón de pesos", pero "un millón quinientos mil pesos".
  const currency = amount === 1 ? 'peso' : 'pesos'
  const connector = rest === 0 ? 'de ' : ''
  return `${parts.join(' ')} ${connector}${currency}`
}

export function formatPesos(amount: number): string {
  return `$ ${amount.toLocaleString('es-CO', { maximumFractionDigits: 0 }).replace(/,/g, '.')}`
}

/**
 * Formato mientras se escribe el valor en números: "93468040" → "$ 93.468.040".
 * Devuelve también dónde dejar el cursor (después del mismo dígito que tenía antes).
 * Si el texto trae algo distinto de dígitos, puntos, espacios o "$" (comas, letras) se
 * deja igual, para que la validación explique el error en vez de alterar la cifra.
 */
export function formatPesosWhileTyping(raw: string, caret = raw.length): { text: string; caret: number } {
  if (/[^\d.$\s]/.test(raw)) return { text: raw, caret }
  const allDigits = raw.replace(/\D/g, '')
  const digits = allDigits.replace(/^0+(?=\d)/, '').slice(0, String(MAX_AMOUNT).length)
  if (!digits) return { text: '', caret: 0 }
  const leadingZeros = allDigits.length - allDigits.replace(/^0+(?=\d)/, '').length
  const digitsBefore = Math.min(digits.length, Math.max(0, raw.slice(0, caret).replace(/\D/g, '').length - leadingZeros))
  const text = `$ ${digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
  let position = 2
  for (let seen = 0; seen < digitsBefore; position++) if (/\d/.test(text[position])) seen++
  return { text, caret: position }
}

export type AmountParseResult = { ok: true; amount: number } | { ok: false; error: string }

/**
 * Acepta "93468040", "93.468.040", "$93.468.040" o "$ 93.468.040".
 * Rechaza comas, decimales, guiones, letras y agrupaciones irregulares.
 */
export function parseNegotiatedAmount(raw: string): AmountParseResult {
  const value = raw.trim()
  if (!value) return { ok: false, error: 'Ingresa el valor negociado en números.' }
  if (/,/.test(value)) return { ok: false, error: 'Usa puntos para separar los miles; no se aceptan comas ni decimales.' }
  if (/[^\d.$\s]/.test(value)) return { ok: false, error: `Solo se aceptan dígitos, puntos de miles y el signo $. Ejemplo: ${NEGOTIATED_NUMBERS_EXAMPLE}` }
  const match = /^(?:\$\s?)?(\d{1,3}(?:\.\d{3})+|\d+)$/.exec(value)
  if (!match) return { ok: false, error: `Formato no válido. Ejemplo: ${NEGOTIATED_NUMBERS_EXAMPLE} o 93468040` }
  const amount = Number(match[1].replace(/\./g, ''))
  if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, error: 'El valor negociado debe ser mayor que cero.' }
  if (amount > MAX_AMOUNT) return { ok: false, error: 'El valor negociado excede el máximo admitido.' }
  return { ok: true, amount }
}

const stripAccents = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '')

const LENIENT_VALUES: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500,
  seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900,
}

/** Interpretación tolerante (sin tildes) solo para explicar diferencias al usuario. */
export function spanishWordsToAmount(text: string): number | null {
  const tokens = stripAccents(text.toLowerCase()).split(/\s+/).filter(Boolean)
  let total = 0
  let thousandsPart = 0
  let small = 0
  let sawNumber = false
  for (const token of tokens) {
    if (token === 'y' || token === 'de' || token === 'pesos' || token === 'peso') continue
    if (token in LENIENT_VALUES) {
      small += LENIENT_VALUES[token]
      sawNumber = true
    } else if (token === 'mil') {
      thousandsPart += (small || 1) * 1000
      small = 0
      sawNumber = true
    } else if (token === 'millon' || token === 'millones') {
      total += (thousandsPart + small || 1) * 1e6
      thousandsPart = 0
      small = 0
      sawNumber = true
    } else if (token === 'billon' || token === 'billones') {
      total += (thousandsPart + small || 1) * 1e12
      thousandsPart = 0
      small = 0
      sawNumber = true
    } else {
      return null
    }
  }
  return sawNumber ? total + thousandsPart + small : null
}

export interface NegotiatedValueCheck {
  ok: boolean
  amount: number | null
  expectedLetters: string | null
  numbersError: string | null
  lettersError: string | null
}

const capitalize = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text)

/** Redacción en letras del valor en números, o vacío mientras la cifra no sea válida. */
export function negotiatedValueLetters(numbersInput: string): string {
  const parsed = parseNegotiatedAmount(numbersInput)
  return parsed.ok ? capitalize(amountToSpanishWords(parsed.amount)) : ''
}

export function checkNegotiatedValue(numbersInput: string, lettersInput: string): NegotiatedValueCheck {
  const parsed = parseNegotiatedAmount(numbersInput)
  const amount = parsed.ok ? parsed.amount : null
  const expected = amount !== null ? amountToSpanishWords(amount) : null
  const numbersError = parsed.ok ? null : parsed.error

  const letters = lettersInput.trim()
  let lettersError: string | null = null
  if (!letters) {
    lettersError = 'Ingresa el valor negociado en letras.'
  } else if (/\d/.test(letters)) {
    lettersError = 'El valor en letras no puede contener números.'
  } else if (/[^a-záéíóúüñ\s]/i.test(letters)) {
    lettersError = 'Escribe solo palabras separadas por espacios, sin guiones, puntos, comas ni símbolos.'
  } else if (/\s{2,}/.test(letters)) {
    lettersError = 'Usa un solo espacio entre palabras.'
  } else if (!/\bpesos?$/i.test(letters)) {
    lettersError = 'El texto debe terminar con la palabra "pesos", sin agregar "M/CTE" ni "moneda corriente".'
  } else if (expected) {
    if (letters.toLowerCase() !== expected) {
      const interpreted = spanishWordsToAmount(letters)
      lettersError = interpreted !== null && interpreted !== amount
        ? `El texto equivale a ${formatPesos(interpreted)}, pero el valor en números es ${formatPesos(amount!)}.`
        : `La redacción no coincide con ${formatPesos(amount!)}. Revisa ortografía, tildes y conectores; se espera: "${capitalize(expected)}".`
    }
  }

  return {
    ok: numbersError === null && lettersError === null,
    amount,
    expectedLetters: expected ? capitalize(expected) : null,
    numbersError,
    lettersError,
  }
}

/**
 * Entero en palabras, sin moneda. Con apócope ("un", "veintiún") cuando precede a un
 * sustantivo (metros, postes); sin ella para conteos sueltos ("uno", "veintiuno").
 */
export function spanishIntegerWords(n: number, apocope = true): string {
  if (!Number.isInteger(n) || n < 0 || n > MAX_AMOUNT) throw new RangeError('Se esperaba un entero positivo.')
  if (n === 0) return 'cero'
  const billions = Math.floor(n / 1e12)
  const millions = Math.floor((n % 1e12) / 1e6)
  const rest = n % 1e6
  const parts: string[] = []
  if (billions) parts.push(billions === 1 ? 'un billón' : `${thousandsToWords(billions)} billones`)
  if (millions) parts.push(millions === 1 ? 'un millón' : `${thousandsToWords(millions)} millones`)
  if (rest) parts.push(thousandsToWords(rest))
  const text = parts.join(' ')
  if (apocope) return text
  return text.replace(/veintiún$/, 'veintiuno').replace(/\bun$/, 'uno')
}
