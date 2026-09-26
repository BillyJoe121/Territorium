import os
import socket
from dataclasses import dataclass


def _load_env_file_if_present() -> None:
    candidates = [
        os.path.join(os.getcwd(), ".env"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
    ]
    for env_path in candidates:
        if os.path.isfile(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("'\"")
                    if key and key not in os.environ:
                        os.environ[key] = val
            break


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_secret_key: str
    openai_api_key: str
    ai_base_url: str | None
    ai_model: str
    poll_seconds: float
    lease_seconds: int
    worker_name: str
    worker_wake_token: str
    enabled: bool
    expediente_v2_enabled: bool
    expediente_v2_poll_seconds: float

    @classmethod
    def from_env(cls) -> "Settings":
        _load_env_file_if_present()
        api_key = os.getenv("GEMINI_API_KEY", os.getenv("OPENAI_API_KEY", "")).strip()
        base_url = os.getenv("AI_BASE_URL", os.getenv("OPENAI_BASE_URL", "")).strip() or None

        # Si se provee GEMINI_API_KEY y no se especificó AI_BASE_URL, default a la API oficial OpenAI de Google
        if os.getenv("GEMINI_API_KEY") and not base_url:
            base_url = "https://generativelanguage.googleapis.com/v1beta/openai/"

        default_model = "gemini-3.8-flash" if (os.getenv("GEMINI_API_KEY") or (base_url and "googleapis.com" in base_url)) else "gpt-5.5"
        ai_model = os.getenv("AI_MODEL", default_model)
        if ai_model in ("gemini-2.5-flash", "gemini-2.0-flash"):
            ai_model = "gemini-3.8-flash"

        return cls(
            supabase_url=os.getenv("SUPABASE_URL", "").rstrip("/"),
            supabase_secret_key=os.getenv("SUPABASE_SECRET_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")),
            openai_api_key=api_key,
            ai_base_url=base_url,
            ai_model=ai_model,
            poll_seconds=max(2.0, float(os.getenv("POLL_SECONDS", "5"))),
            lease_seconds=max(60, int(os.getenv("LEASE_SECONDS", "300"))),
            worker_name=os.getenv("WORKER_NAME", socket.gethostname()),
            worker_wake_token=os.getenv("WORKER_WAKE_TOKEN", "").strip(),
            enabled=os.getenv("WORKER_ENABLED", "true").lower() in {"1", "true", "yes"},
            expediente_v2_enabled=os.getenv("EXPEDIENTE_V2_WORKER_ENABLED", "true").lower() in {"1", "true", "yes"},
            expediente_v2_poll_seconds=max(1.0, float(os.getenv("EXPEDIENTE_V2_POLL_SECONDS", "2"))),
        )

    @property
    def ready(self) -> bool:
        return bool(self.supabase_url and self.supabase_secret_key and self.openai_api_key and self.ai_model)

    @property
    def expediente_v2_ready(self) -> bool:
        """Fase 3 valida y prepara archivos sin requerir un proveedor de IA."""
        return bool(self.supabase_url and self.supabase_secret_key)
