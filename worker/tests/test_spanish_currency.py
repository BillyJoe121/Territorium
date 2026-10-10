import unittest

from app.utils.spanish_currency import compare_number_and_letters, number_to_spanish_words


class SpanishCurrencyTests(unittest.TestCase):
    def test_number_to_spanish_words(self) -> None:
        self.assertEqual(
            number_to_spanish_words(1_000_000),
            "UN MILLON PESOS",
        )
        self.assertEqual(
            number_to_spanish_words(218_450_000),
            "DOSCIENTOS DIECIOCHO MILLONES CUATROCIENTOS CINCUENTA MIL PESOS",
        )
        self.assertEqual(
            number_to_spanish_words(232_800_000),
            "DOSCIENTOS TREINTA Y DOS MILLONES OCHOCIENTOS MIL PESOS",
        )
        self.assertEqual(
            number_to_spanish_words(1_485_142),
            "UN MILLON CUATROCIENTOS OCHENTA Y CINCO MIL CIENTO CUARENTA Y DOS PESOS",
        )

    def test_compare_number_and_letters_exact(self) -> None:
        num = 218_450_000
        letters = "Doscientos dieciocho millones cuatrocientos cincuenta mil pesos m/cte"
        matches, explanation = compare_number_and_letters(num, letters)
        self.assertTrue(matches, f"Expected match, got: {explanation}")

    def test_compare_number_and_letters_discrepancy(self) -> None:
        num = 218_450_000
        letters = "Doscientos treinta millones de pesos"
        matches, explanation = compare_number_and_letters(num, letters)
        self.assertFalse(matches)
        self.assertIn("Discrepancia detectada", explanation)

    def test_compare_number_and_letters_variant_connectors(self) -> None:
        # e.g. "veinte y siete" vs "veintisiete"
        num = 27_000_000
        letters = "Veinte y siete millones de pesos"
        matches, _ = compare_number_and_letters(num, letters)
        self.assertTrue(matches)

    def test_compare_rejects_reordered_words(self) -> None:
        # Las mismas palabras en otro orden expresan otro valor (10.100), no 110.000.
        matches, explanation = compare_number_and_letters(110_000, "DIEZ MIL CIENTO PESOS")
        self.assertFalse(matches)
        self.assertIn("Discrepancia detectada", explanation)
        self.assertFalse(compare_number_and_letters(2_002_000, "DOS MIL DOS MILLONES")[0])
        self.assertFalse(compare_number_and_letters(110, "DIEZ CIENTO PESOS")[0])

    def test_compare_accepts_canonical_and_common_variants(self) -> None:
        cases = [
            (110_000, "CIENTO DIEZ MIL PESOS"),
            (1_000_000, "UN MILLÓN DE PESOS"),
            (1_000_000, "un millon de pesos m/cte"),
            (21_000, "Veintiún mil pesos"),
            (21_000, "veintiuno mil pesos"),
            (35_000_000, "treinta y cinco millones de pesos moneda corriente"),
            (1_485_142, "UN MILLÓN CUATROCIENTOS OCHENTA Y CINCO MIL CIENTO CUARENTA Y DOS PESOS"),
            (100_000, "CIEN MIL PESOS"),
        ]
        for number, letters in cases:
            with self.subTest(letters=letters):
                matches, explanation = compare_number_and_letters(number, letters)
                self.assertTrue(matches, explanation)

    def test_large_amounts_do_not_fail(self) -> None:
        self.assertEqual(
            number_to_spanish_words(1_000_000_000),
            "MIL MILLONES PESOS",
        )
        self.assertEqual(
            number_to_spanish_words(2_500_300_000),
            "DOS MIL QUINIENTOS MILLONES TRESCIENTOS MIL PESOS",
        )
        self.assertTrue(compare_number_and_letters(1_000_000_000, "MIL MILLONES DE PESOS")[0])
        self.assertTrue(compare_number_and_letters(2_500_300_000, "dos mil quinientos millones trescientos mil pesos")[0])
        self.assertFalse(compare_number_and_letters(1_000_000_000, "CIEN MILLONES DE PESOS")[0])
        self.assertTrue(compare_number_and_letters(1_000_000_000_000, "UN BILLÓN DE PESOS")[0])

    def test_unparseable_letters_do_not_match(self) -> None:
        matches, explanation = compare_number_and_letters(500_000, "QUINIENTOS MIL PESOS APROX")
        self.assertFalse(matches)
        self.assertIn("$ 500.000", explanation)


if __name__ == "__main__":
    unittest.main()
