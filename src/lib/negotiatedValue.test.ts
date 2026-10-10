import { describe, expect, it } from 'vitest'
import { amountToSpanishWords, checkNegotiatedValue, formatPesos, formatPesosWhileTyping, negotiatedValueLetters, parseNegotiatedAmount, spanishWordsToAmount } from './negotiatedValue'

describe('amountToSpanishWords', () => {
  it.each([
    [93_468_040, 'noventa y tres millones cuatrocientos sesenta y ocho mil cuarenta pesos'],
    [9_628_712, 'nueve millones seiscientos veintiocho mil setecientos doce pesos'],
    [1_000_000, 'un millón de pesos'],
    [2_000_000, 'dos millones de pesos'],
    [1_500_000, 'un millón quinientos mil pesos'],
    [21_000, 'veintiún mil pesos'],
    [21_000_021, 'veintiún millones veintiún pesos'],
    [100_000, 'cien mil pesos'],
    [101_000, 'ciento un mil pesos'],
    [1_000, 'mil pesos'],
    [16_316, 'dieciséis mil trescientos dieciséis pesos'],
    [2_500_000_000, 'dos mil quinientos millones de pesos'],
    [1_000_000_000_000, 'un billón de pesos'],
    [31_000_000, 'treinta y un millones de pesos'],
  ])('%i → %s', (amount, expected) => {
    expect(amountToSpanishWords(amount)).toBe(expected)
  })

  it('round-trips through the lenient parser', () => {
    for (const amount of [1, 15, 99, 100, 999, 1_001, 45_678, 999_999, 7_654_321, 123_456_789_012]) {
      expect(spanishWordsToAmount(amountToSpanishWords(amount))).toBe(amount)
    }
  })
})

describe('checkNegotiatedValue', () => {

  it('requires the word "pesos" at the end', () => {
    const result = checkNegotiatedValue('1.000.000', 'un millón')
    expect(result.ok).toBe(false)
    expect(result.lettersError).toMatch(/pesos/)
    expect(checkNegotiatedValue('1.000.000', 'un millón de pesos m cte').ok).toBe(false)
  })

  it('rejects hyphens, digits and double spaces', () => {
    expect(checkNegotiatedValue('21.000', 'veinti-un mil pesos').lettersError).toMatch(/guiones/)
    expect(checkNegotiatedValue('21.000', '21 mil pesos').lettersError).toMatch(/números/)
    expect(checkNegotiatedValue('21.000', 'veintiún  mil pesos').lettersError).toMatch(/un solo espacio/)
  })

  it('accepts accented words written in uppercase', () => {
    expect(checkNegotiatedValue('16.000', 'DIECISÉIS MIL PESOS').ok).toBe(true)
    expect(checkNegotiatedValue('1.000.000', 'UN MILLÓN DE PESOS').ok).toBe(true)
  })

  it('accents matter even though case does not', () => {
    const result = checkNegotiatedValue('16.000', 'dieciseis mil pesos')
    expect(result.ok).toBe(false)
    expect(result.lettersError).toContain('Dieciséis mil pesos')
  })

  it('explains when the words describe a different amount', () => {
    const result = checkNegotiatedValue('2.000.000', 'tres millones de pesos')
    expect(result.ok).toBe(false)
    expect(result.lettersError).toContain(formatPesos(3_000_000))
  })

  it('surfaces number format errors separately', () => {
    const result = checkNegotiatedValue('2,000,000', 'dos millones de pesos')
    expect(result.numbersError).toMatch(/comas/)
    expect(result.ok).toBe(false)
  })
})

describe('negotiatedValueLetters', () => {
  it.each(['93468040', '93.468.040', '$ 93.468.040'])('writes %s in words, capitalized and passing the check', (input) => {
    const letters = negotiatedValueLetters(input)
    expect(letters).toBe('Noventa y tres millones cuatrocientos sesenta y ocho mil cuarenta pesos')
    expect(checkNegotiatedValue(input, letters).ok).toBe(true)
  })

  it('follows each keystroke while digits are typed', () => {
    expect(negotiatedValueLetters('9')).toBe('Nueve pesos')
    expect(negotiatedValueLetters('93')).toBe('Noventa y tres pesos')
    expect(negotiatedValueLetters('93468')).toBe('Noventa y tres mil cuatrocientos sesenta y ocho pesos')
    expect(negotiatedValueLetters('1000000')).toBe('Un millón de pesos')
    expect(negotiatedValueLetters('1')).toBe('Un peso')
  })

  it.each(['', '   ', '0', '93,468,040', '93.46', 'abc'])('stays empty for %j', (input) => {
    expect(negotiatedValueLetters(input)).toBe('')
  })
})

describe('formatPesosWhileTyping', () => {
  it('agrega el signo de pesos y los puntos de miles y millones', () => {
    expect(formatPesosWhileTyping('9').text).toBe('$ 9')
    expect(formatPesosWhileTyping('9346').text).toBe('$ 9.346')
    expect(formatPesosWhileTyping('93468040').text).toBe('$ 93.468.040')
    expect(formatPesosWhileTyping('$ 93.468.0405').text).toBe('$ 934.680.405')
    expect(formatPesosWhileTyping('1000000000').text).toBe('$ 1.000.000.000')
  })

  it('el resultado sigue siendo un valor negociado válido', () => {
    const { text } = formatPesosWhileTyping('93468040')
    expect(parseNegotiatedAmount(text)).toEqual({ ok: true, amount: 93_468_040 })
  })

  it('al borrar todo queda vacío y quita ceros a la izquierda', () => {
    expect(formatPesosWhileTyping('').text).toBe('')
    expect(formatPesosWhileTyping('$ ').text).toBe('')
    expect(formatPesosWhileTyping('0045').text).toBe('$ 45')
  })

  it('no toca lo que no es una cifra para que la validación lo explique', () => {
    expect(formatPesosWhileTyping('93,5').text).toBe('93,5')
    expect(formatPesosWhileTyping('noventa').text).toBe('noventa')
  })

  it('conserva el cursor después del mismo dígito', () => {
    // Se escribe un 7 entre "93" y "468": "$ 937.468" con el cursor tras el 7.
    const typed = '$ 937.468'
    const result = formatPesosWhileTyping(typed, 5)
    expect(result.text).toBe('$ 937.468')
    expect(result.caret).toBe(5)
    // "93468" + "0" al final: el cursor queda al final del texto formateado.
    const end = formatPesosWhileTyping('$ 93.4680', 9)
    expect(end).toEqual({ text: '$ 934.680', caret: 9 })
    // Borrar el punto no deja el cursor desfasado: "$ 9346" con el cursor tras el 9.
    expect(formatPesosWhileTyping('$ 9346', 3)).toEqual({ text: '$ 9.346', caret: 3 })
  })
})
