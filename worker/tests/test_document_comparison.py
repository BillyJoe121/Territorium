import io
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import docx

from app.document_comparison import compare_documents, parse_original, process_comparison_job, validate_comparison


def make_document(name: str, text: str):
    document = docx.Document()
    document.add_paragraph(text)
    stream = io.BytesIO()
    document.save(stream)
    return parse_original(stream.getvalue(), name, name)


def side(document, value):
    fragment = document.fragments[0]
    return {'fragment_id': fragment.fragment_id, 'quote': fragment.text, 'value': value}


class DocumentComparisonTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.left = make_document('a.docx', 'Titular: María Elena Rojas')
        self.right = make_document('b.docx', 'Titular: María Elena Rojas')

    def test_exact_match_requires_identical_literal_values_and_verified_quotes(self):
        result = validate_comparison({'fields': [{
            'key': 'titular', 'label': 'Titular',
            'left': side(self.left, 'María Elena Rojas'),
            'right': side(self.right, 'María Elena Rojas'),
        }]}, self.left, self.right)
        self.assertEqual(result['fields'][0]['status'], 'exact')
        self.assertEqual(result['fields'][0]['left']['location'], 'Párrafo 1')
        self.assertEqual(result['counts']['exact'], 1)

    def test_small_character_difference_is_not_exact(self):
        different = make_document('b.docx', 'Titular: Maria Elena Rojas')
        result = validate_comparison({'fields': [{
            'key': 'titular', 'label': 'Titular',
            'left': side(self.left, 'María Elena Rojas'),
            'right': side(different, 'Maria Elena Rojas'),
        }]}, self.left, different)
        self.assertEqual(result['fields'][0]['status'], 'near')

    def test_missing_evidence_is_red_and_never_gains_a_fake_location(self):
        result = validate_comparison({'fields': [{
            'key': 'titular', 'label': 'Titular',
            'left': side(self.left, 'María Elena Rojas'), 'right': None,
        }]}, self.left, self.right)
        self.assertEqual(result['fields'][0]['status'], 'different')
        self.assertIsNone(result['fields'][0]['right'])

    def test_significantly_different_values_are_red(self):
        different = make_document('b.docx', 'Titular: Asociación Río Claro')
        result = validate_comparison({'fields': [{
            'key': 'titular', 'label': 'Titular',
            'left': side(self.left, 'María Elena Rojas'),
            'right': side(different, 'Asociación Río Claro'),
        }]}, self.left, different)
        self.assertEqual(result['fields'][0]['status'], 'different')

    def test_hallucinated_quote_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'NO_VERIFIABLE_FIELDS'):
            validate_comparison({'fields': [{
                'key': 'titular', 'label': 'Titular',
                'left': {'fragment_id': self.left.fragments[0].fragment_id, 'quote': 'Otro nombre', 'value': 'Otro'},
                'right': None,
            }]}, self.left, self.right)

    async def test_ai_response_uses_existing_provider_contract(self):
        payload = {'fields': [{
            'key': 'titular', 'label': 'Titular',
            'left': side(self.left, 'María Elena Rojas'),
            'right': side(self.right, 'María Elena Rojas'),
        }]}
        import json
        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(
            return_value=SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(payload)))])
        ))))
        result = await compare_documents(client, 'test-model', self.left, self.right)
        self.assertEqual(result['counts']['exact'], 1)
        self.assertEqual(client.chat.completions.create.await_args.kwargs['response_format'], {'type': 'json_object'})

    async def test_transient_provider_failure_is_retried_and_classified(self):
        class ProviderError(Exception):
            status_code = 503

        create = AsyncMock(side_effect=ProviderError())
        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
        with patch('app.document_comparison.asyncio.sleep', new_callable=AsyncMock) as sleep:
            with self.assertRaisesRegex(ValueError, '^AI_PROVIDER_UNAVAILABLE$'):
                await compare_documents(client, 'test-model', self.left, self.right)
        self.assertEqual(create.await_count, 3)
        self.assertEqual(sleep.await_count, 2)

    async def test_auth_failure_is_classified_without_retry(self):
        class ProviderError(Exception):
            status_code = 401

        create = AsyncMock(side_effect=ProviderError())
        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
        with self.assertRaisesRegex(ValueError, '^AI_AUTH_FAILED$'):
            await compare_documents(client, 'test-model', self.left, self.right)
        self.assertEqual(create.await_count, 1)

    async def test_gemini_invalid_key_400_is_an_auth_failure(self):
        class ProviderError(Exception):
            status_code = 400
            body = [{'error': {'code': 400, 'message': 'API key not valid. Please pass a valid API key.', 'status': 'INVALID_ARGUMENT',
                               'details': [{'reason': 'API_KEY_INVALID'}]}}]

        create = AsyncMock(side_effect=ProviderError('Error code: 400 - API key not valid'))
        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
        with self.assertRaisesRegex(ValueError, '^AI_AUTH_FAILED$'):
            await compare_documents(client, 'test-model', self.left, self.right)
        self.assertEqual(create.await_count, 1)

    async def test_other_rejections_log_status_without_provider_message(self):
        class ProviderError(Exception):
            status_code = 400
            body = {'error': {'code': 400, 'message': 'secret details', 'status': 'FAILED_PRECONDITION'}}

        create = AsyncMock(side_effect=ProviderError('secret details'))
        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
        with self.assertLogs('app.document_comparison', level='WARNING') as logs:
            with self.assertRaisesRegex(ValueError, '^AI_REQUEST_REJECTED$'):
                await compare_documents(client, 'test-model', self.left, self.right)
        self.assertIn('status=400 provider_status=FAILED_PRECONDITION', logs.output[0])
        self.assertNotIn('secret', logs.output[0])

    async def test_rate_limit_is_retried_and_classified(self):
        class ProviderError(Exception):
            status_code = 429

        create = AsyncMock(side_effect=ProviderError())
        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
        with patch('app.document_comparison.asyncio.sleep', new_callable=AsyncMock):
            with self.assertRaisesRegex(ValueError, '^AI_RATE_LIMITED$'):
                await compare_documents(client, 'test-model', self.left, self.right)
        self.assertEqual(create.await_count, 3)

    async def test_transient_provider_failure_can_recover(self):
        import json

        class ProviderError(Exception):
            status_code = 503

        payload = {'fields': [{
            'key': 'titular', 'label': 'Titular',
            'left': side(self.left, 'María Elena Rojas'),
            'right': side(self.right, 'María Elena Rojas'),
        }]}
        response = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(payload)))])
        create = AsyncMock(side_effect=[ProviderError(), response])
        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
        with patch('app.document_comparison.asyncio.sleep', new_callable=AsyncMock):
            result = await compare_documents(client, 'test-model', self.left, self.right)
        self.assertEqual(result['counts']['exact'], 1)
        self.assertEqual(create.await_count, 2)

    async def test_download_failure_has_a_safe_specific_error(self):
        gateway = SimpleNamespace(
            get_comparison_document=AsyncMock(return_value={'storage_path': 'private-source'}),
            download=AsyncMock(side_effect=ConnectionError('private provider details')),
            finish_comparison_job=AsyncMock(return_value=True),
        )
        await process_comparison_job(gateway, {
            'id': 'job', 'project_id': 'project', 'left_document_id': 'left',
            'right_document_id': 'right', 'lease_token': 'lease',
        }, None, 'test-model')
        gateway.finish_comparison_job.assert_awaited_once_with(
            'job', 'lease', None, 'SOURCE_DOWNLOAD_FAILED',
        )

    async def test_worker_persists_only_a_verified_result(self):
        import json
        payload = {'fields': [{
            'key': 'titular', 'label': 'Titular',
            'left': side(self.left, 'María Elena Rojas'),
            'right': side(self.right, 'María Elena Rojas'),
        }]}
        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(
            return_value=SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(payload)))])
        ))))
        source = docx.Document()
        source.add_paragraph('Titular: María Elena Rojas')
        stream = io.BytesIO()
        source.save(stream)
        gateway = SimpleNamespace(
            get_comparison_document=AsyncMock(side_effect=[
                {'id': 'a.docx', 'original_name': 'a.docx', 'storage_path': 'left'},
                {'id': 'b.docx', 'original_name': 'b.docx', 'storage_path': 'right'},
            ]),
            download=AsyncMock(return_value=stream.getvalue()),
            finish_comparison_job=AsyncMock(return_value=True),
        )
        await process_comparison_job(gateway, {
            'id': 'job', 'project_id': 'project', 'left_document_id': 'a.docx',
            'right_document_id': 'b.docx', 'lease_token': 'lease',
        }, client, 'test-model')
        saved = gateway.finish_comparison_job.await_args.args
        self.assertEqual(saved[2]['counts']['exact'], 1)
        self.assertIsNone(saved[3])

    def test_uppercase_held_name_is_exact_match(self):
        doc_a = make_document('a.docx', 'Vendedor: CARLOS EDUARDO RINCÓN MEJÍA')
        doc_b = make_document('b.docx', 'Vendedor: Carlos Eduardo Rincón Mejía')
        result = validate_comparison({'fields': [{
            'key': 'vendedor', 'label': 'Nombre del vendedor',
            'left': side(doc_a, 'CARLOS EDUARDO RINCÓN MEJÍA'),
            'right': side(doc_b, 'Carlos Eduardo Rincón Mejía'),
        }]}, doc_a, doc_b)
        self.assertEqual(result['fields'][0]['status'], 'exact')

    def test_spanish_dates_different_formats_are_exact_match(self):
        doc_a = make_document('a.docx', 'Fecha: 15 de marzo de 2024')
        doc_b = make_document('b.docx', 'Fecha: 15/03/2024')
        result = validate_comparison({'fields': [{
            'key': 'fecha', 'label': 'Fecha de adquisición',
            'left': side(doc_a, '15 de marzo de 2024'),
            'right': side(doc_b, '15/03/2024'),
        }]}, doc_a, doc_b)
        self.assertEqual(result['fields'][0]['status'], 'exact')

    def test_different_dates_are_marked_different(self):
        doc_a = make_document('a.docx', 'Fecha: 15 de marzo de 2024')
        doc_b = make_document('b.docx', 'Fecha: 16/03/2024')
        result = validate_comparison({'fields': [{
            'key': 'fecha', 'label': 'Fecha de adquisición',
            'left': side(doc_a, '15 de marzo de 2024'),
            'right': side(doc_b, '16/03/2024'),
        }]}, doc_a, doc_b)
        self.assertEqual(result['fields'][0]['status'], 'different')

    def test_missing_letter_in_name_is_not_exact(self):
        doc_a = make_document('a.docx', 'Vendedor: Carlos Mejía')
        doc_b = make_document('b.docx', 'Vendedor: Carlo Mejía')
        result = validate_comparison({'fields': [{
            'key': 'vendedor', 'label': 'Nombre del vendedor',
            'left': side(doc_a, 'Carlos Mejía'),
            'right': side(doc_b, 'Carlo Mejía'),
        }]}, doc_a, doc_b)
        self.assertEqual(result['fields'][0]['status'], 'near')

    def test_area_in_other_unit_is_exact_with_reason(self):
        doc_a = make_document('a.docx', 'ÁREA TÍTULOS 22991 m2')
        doc_b = make_document('b.docx', 'Área (Títulos) DOS HECTÁREAS Y DOS MIL NOVECIENTOS NOVENTA Y UN METROS CUADRADOS (2 Ha. 2991 M2).')
        result = validate_comparison({'fields': [{
            'key': 'area', 'label': 'Área según títulos',
            'left': side(doc_a, '22991 m2'),
            'right': side(doc_b, 'DOS HECTÁREAS Y DOS MIL NOVECIENTOS NOVENTA Y UN METROS CUADRADOS (2 Ha. 2991 M2)'),
        }]}, doc_a, doc_b)
        self.assertEqual(result['version'], 2)
        self.assertEqual(result['fields'][0]['status'], 'exact')
        self.assertIn('22.991 m²', result['fields'][0]['reason'])

    def test_relabeled_cadastral_fields_are_paired_for_review(self):
        doc_a = make_document('a.docx', 'NÚMERO PREDIAL 730430002000000006000700000000')
        doc_b = make_document('b.docx', 'Cédula catastral 73043000200060007000 (englobado en mayor extensión)')
        result = validate_comparison({'fields': [
            {'key': 'npn', 'label': 'Número predial nacional', 'left': side(doc_a, '730430002000000006000700000000'), 'right': None},
            {'key': 'cedula', 'label': 'Cédula catastral', 'left': None, 'right': side(doc_b, '73043000200060007000')},
        ]}, doc_a, doc_b)
        self.assertEqual(len(result['fields']), 1)
        field = result['fields'][0]
        self.assertEqual((field['label'], field['status']), ('Número predial nacional / Cédula catastral', 'near'))
        self.assertEqual(field['right']['value'], '73043000200060007000')

    def test_ai_equivalence_alone_is_only_a_review_with_its_reason(self):
        doc_a = make_document('a.docx', 'Vereda: Santa Bárbara')
        doc_b = make_document('b.docx', 'Vereda: Sta. Bbra.')
        field = {'key': 'vereda', 'label': 'Vereda', 'left': side(doc_a, 'Santa Bárbara'), 'right': side(doc_b, 'Sta. Bbra.')}
        plain = validate_comparison({'fields': [field]}, doc_a, doc_b)['fields'][0]
        self.assertEqual((plain['status'], plain['reason']), ('different', None))
        judged = validate_comparison({'fields': [{**field, 'equivalence': 'equivalent', 'reason': 'Abreviatura de Santa Bárbara.'}]}, doc_a, doc_b)['fields'][0]
        self.assertEqual(judged['status'], 'near')
        self.assertIn('Abreviatura de Santa Bárbara.', judged['reason'])

    def test_ai_cannot_override_a_proven_difference(self):
        doc_a = make_document('a.docx', 'Área 22991 m2')
        doc_b = make_document('b.docx', 'Área 68643 m2')
        result = validate_comparison({'fields': [{
            'key': 'area', 'label': 'Área', 'left': side(doc_a, '22991 m2'), 'right': side(doc_b, '68643 m2'),
            'equivalence': 'equivalent', 'reason': 'Son iguales.',
        }]}, doc_a, doc_b)
        self.assertEqual(result['fields'][0]['status'], 'different')


if __name__ == '__main__':
    unittest.main()
