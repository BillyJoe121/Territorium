import unittest
from app.observability import (
    calculate_llm_cost,
    sanitize_telemetry_payload,
    evaluate_worker_alerts,
)


class TestPhase7Hardening(unittest.TestCase):
    def test_calculate_llm_cost(self):
        # 10,000 prompt tokens * 0.0025 / 1k = 0.025
        # 2,000 completion tokens * 0.01 / 1k = 0.020
        # Total = 0.045
        cost = calculate_llm_cost(10_000, 2_000)
        self.assertEqual(cost, 0.045)

        zero_cost = calculate_llm_cost(0, 0)
        self.assertEqual(zero_cost, 0.0)

    def test_sanitize_telemetry_payload(self):
        raw_telemetry = {
            "stage": "titles",
            "duration_ms": 2500,
            "folio_matricula": "050N-123456",
            "cedula_propietario": "71234567",
            "owner_full_name": "Ana Maria Restrepo",
            "valor_oferta": 350000000,
            "lindero_norte": "Con predio El Porvenir en 45 metros",
            "narrative_findings": "Se reviso la tradicion inmobiliaria",
        }

        sanitized = sanitize_telemetry_payload(raw_telemetry)

        self.assertEqual(sanitized["stage"], "titles")
        self.assertEqual(sanitized["duration_ms"], 2500)
        self.assertTrue(str(sanitized["folio_matricula"]).startswith("[REDACTED_SECURE_TOKEN_"))
        self.assertTrue(str(sanitized["cedula_propietario"]).startswith("[REDACTED_SECURE_TOKEN_"))
        self.assertTrue(str(sanitized["owner_full_name"]).startswith("[REDACTED_SECURE_TOKEN_"))
        self.assertEqual(sanitized["valor_oferta"], "[REDACTED]")
        self.assertTrue(str(sanitized["lindero_norte"]).startswith("[REDACTED_SECURE_TOKEN_"))
        self.assertTrue(str(sanitized["narrative_findings"]).startswith("[REDACTED_SECURE_TOKEN_"))

    def test_nested_sanitization(self):
        nested_data = {
            "task_id": "task-001",
            "metadata": {
                "propietario": "Juan Perez",
                "non_sensitive_field": 42,
            },
        }

        sanitized = sanitize_telemetry_payload(nested_data)
        self.assertEqual(sanitized["task_id"], "task-001")
        self.assertEqual(sanitized["metadata"]["non_sensitive_field"], 42)
        self.assertTrue(str(sanitized["metadata"]["propietario"]).startswith("[REDACTED_SECURE_TOKEN_"))

    def test_evaluate_worker_alerts(self):
        # Normal execution: no alerts
        normal_alerts = evaluate_worker_alerts(45_000, 0, 3_000)
        self.assertEqual(len(normal_alerts), 0)

        # Stuck execution (>10 minutes)
        stuck_alerts = evaluate_worker_alerts(650_000, 1)
        self.assertTrue(any(a["metric"] == "STAGE_DURATION_EXCEEDED" for a in stuck_alerts))

        # Repeated retries (>=3)
        retry_alerts = evaluate_worker_alerts(10_000, 3)
        self.assertTrue(any(a["metric"] == "HIGH_RETRY_COUNT" for a in retry_alerts))

        # Excessive token consumption (>50k)
        token_alerts = evaluate_worker_alerts(15_000, 0, 55_000)
        self.assertTrue(any(a["metric"] == "HIGH_TOKEN_CONSUMPTION" for a in token_alerts))


if __name__ == "__main__":
    unittest.main()
