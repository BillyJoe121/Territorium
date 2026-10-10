import unittest

from app.utils.value_equivalence import compare_equivalent


class ValueEquivalenceTests(unittest.TestCase):
    def test_area_in_square_meters_equals_hectares_written_in_words(self):
        status, reason, kind = compare_equivalent(
            '22991 m2',
            'DOS HECTÁREAS Y DOS MIL NOVECIENTOS NOVENTA Y UN METROS CUADRADOS (2 Ha. 2991 M2).',
        )
        self.assertEqual((status, kind), ('exact', 'area'))
        self.assertIn('22.991 m²', reason)

    def test_area_unit_variants(self):
        for a, b in [('2 ha 2.991 m²', '22.991 m2'), ('2,2991 ha', '22991 m2'), ('1 fanegada', '6400 m2'),
                     ('995,43 m2', '995.43 m2'), ('un millón de metros cuadrados', '100 ha')]:
            with self.subTest(a=a, b=b):
                self.assertEqual(compare_equivalent(a, b)[0], 'exact')

    def test_unclosed_parenthesis_is_not_added_twice(self):
        self.assertEqual(compare_equivalent('22991 m2', 'DOS HECTÁREAS Y DOS MIL NOVECIENTOS NOVENTA Y UN METROS CUADRADOS (2 Ha. 2991 M2')[0], 'exact')

    def test_close_and_distinct_areas(self):
        self.assertEqual(compare_equivalent('22991 m2', '22950 m2')[0], 'near')
        self.assertEqual(compare_equivalent('22991 m2', '68643 m2')[0], 'different')

    def test_area_whose_words_and_digits_disagree_needs_review(self):
        self.assertEqual(compare_equivalent('DOS HECTÁREAS (3 Ha.)', '20000 m2')[0], 'near')

    def test_amount_in_words_equals_digits(self):
        self.assertEqual(compare_equivalent('$ 218.450.000', 'DOSCIENTOS DIECIOCHO MILLONES CUATROCIENTOS CINCUENTA MIL PESOS')[0], 'exact')
        self.assertEqual(compare_equivalent('3', 'tres (3).')[0], 'exact')
        self.assertEqual(compare_equivalent('3', 'cuatro')[0], 'different')

    def test_old_cadastral_code_inside_national_number_needs_review(self):
        status, _, kind = compare_equivalent('730430002000000006000700000000', '73043000200060007000 (englobado en mayor extensión)')
        self.assertEqual((status, kind), ('near', 'cadastral'))
        self.assertEqual(compare_equivalent('730430002000000060007000000000', '73043000200060007000')[0], 'near')

    def test_cadastral_codes_of_other_land_are_not_related(self):
        self.assertIsNone(compare_equivalent('730430002000000006000800000000', '73043000200060007000'))
        self.assertIsNone(compare_equivalent('730430002000000006007000000000', '73043000200060007000'))
        self.assertEqual(compare_equivalent('73-043-00-02-0006-0007-000', '73043000200060007000')[0], 'exact')

    def test_free_text_is_left_to_other_rules(self):
        self.assertIsNone(compare_equivalent('Lote 5', 'Lote 6'))
        self.assertIsNone(compare_equivalent('350-309621', '350-309612'))


if __name__ == '__main__':
    unittest.main()
