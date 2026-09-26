import unittest
from dataclasses import replace
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.settings import Settings


def worker_settings() -> Settings:
    return Settings(
        supabase_url="https://example.supabase.co",
        supabase_secret_key="service-role-key",
        openai_api_key="",
        ai_base_url=None,
        ai_model="gemini-3.8-flash",
        poll_seconds=5,
        lease_seconds=300,
        worker_name="test-worker",
        enabled=False,
        expediente_v2_enabled=True,
        expediente_v2_poll_seconds=2,
        worker_wake_token="wake-token-for-tests",
    )


class InternalWakeEndpointTests(unittest.TestCase):
    def test_accepts_a_wake_signal_with_the_configured_machine_token(self) -> None:
        async def idle_worker(stop):
            await stop.wait()

        with patch("app.main.settings", worker_settings()), patch("app.main.expediente_v2_worker_loop", idle_worker):
            with TestClient(app) as client:
                response = client.post("/internal/wake", headers={"x-territorium-wake-token": "wake-token-for-tests"})

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json(), {"status": "accepted"})

    def test_hides_the_wake_endpoint_when_the_token_is_missing_or_wrong(self) -> None:
        async def idle_worker(stop):
            await stop.wait()

        with patch("app.main.settings", worker_settings()), patch("app.main.expediente_v2_worker_loop", idle_worker):
            with TestClient(app) as client:
                missing = client.post("/internal/wake")
                wrong = client.post("/internal/wake", headers={"x-territorium-wake-token": "wrong-token"})

        self.assertEqual(missing.status_code, 404)
        self.assertEqual(wrong.status_code, 404)

    def test_rejects_a_wake_signal_when_the_execution_loop_is_disabled(self) -> None:
        disabled_settings = replace(worker_settings(), expediente_v2_enabled=False)
        with patch("app.main.settings", disabled_settings):
            with TestClient(app) as client:
                response = client.post("/internal/wake", headers={"x-territorium-wake-token": "wake-token-for-tests"})

        self.assertEqual(response.status_code, 503)

    def test_hides_the_wake_endpoint_when_the_worker_token_is_not_configured(self) -> None:
        without_token = replace(worker_settings(), worker_wake_token="")
        with patch("app.main.settings", without_token):
            with TestClient(app) as client:
                response = client.post("/internal/wake", headers={"x-territorium-wake-token": "wake-token-for-tests"})

        self.assertEqual(response.status_code, 404)
