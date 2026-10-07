import { describe, expect, it } from 'vitest'
import {
  amountToSpanishWords,
  checkNegotiatedValue,
  formatPesos,
  NEGOTIATED_LETTERS_EXAMPLE,
  NEGOTIATED_NUMBERS_EXAMPLE,
  parseNegotiatedAmount,
  spanishWordsToAmount,
} from './negotiatedValue'

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

describe('parseNegotiatedAmount', () => {
  it.each(['93468040', '93.468.040', '$93.468.040', '$ 93.468.040', NEGOTIATED_NUMBERS_EXAMPLE])('accepts %s', (input) => {
    expect(parseNegotiatedAmount(input)).toEqual({ ok: true, amount: 93_468_040 })
  })

  it.each(['93,468,040', '93.468.040,00', '93-468-040', '93.46.8040', '$ 93 468 040', 'COP 93.468.040', '', '0'])('rejects %s', (input) => {
    expect(parseNegotiatedAmount(input).ok).toBe(false)
  })
})

describe('checkNegotiatedValue', () => {
  it('approves the documented example ignoring case', () => {
    expect(checkNegotiatedValue(NEGOTIATED_NUMBERS_EXAMPLE, NEGOTIATED_LETTERS_EXAMPLE).ok).toBe(true)
    expect(checkNegotiatedValue('93468040', NEGOTIATED_LETTERS_EXAMPLE.toUpperCase()).ok).toBe(true)
  })

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
