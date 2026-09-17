import os
import socket
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_secret_key: str
    openai_api_key: str
    ai_model: str
    poll_seconds: float
    lease_seconds: int
    worker_name: str
    enabled: bool

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            supabase_url=os.getenv("SUPABASE_URL", "").rstrip("/"),
            supabase_secret_key=os.getenv("SUPABASE_SECRET_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")),
            openai_api_key=os.getenv("OPENAI_API_KEY", ""),
            ai_model=os.getenv("AI_MODEL", "gpt-5.5"),
            poll_seconds=max(2.0, float(os.getenv("POLL_SECONDS", "5"))),
            lease_seconds=max(60, int(os.getenv("LEASE_SECONDS", "300"))),
            worker_name=os.getenv("WORKER_NAME", socket.gethostname()),
            enabled=os.getenv("WORKER_ENABLED", "true").lower() in {"1", "true", "yes"},
        )

    @property
    def ready(self) -> bool:
        return bool(self.supabase_url and self.supabase_secret_key and self.openai_api_key and self.ai_model)

