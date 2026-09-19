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


if __name__ == "__main__":
    unittest.main()
