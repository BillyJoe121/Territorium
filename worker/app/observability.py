import re
from typing import Any, Dict, List, Optional

COST_PER_1K_PROMPT_USD = 0.0025
COST_PER_1K_COMPLETION_USD = 0.0100

SENSITIVE_PATTERNS = [
    re.compile(r"folio", re.IGNORECASE),
    re.compile(r"cedula|cédula", re.IGNORECASE),
    re.compile(r"owner|propietario", re.IGNORECASE),
    re.compile(r"lindero", re.IGNORECASE),
    re.compile(r"oferta", re.IGNORECASE),
    re.compile(r"valor|precio", re.IGNORECASE),
    re.compile(r"narrative|narrativa", re.IGNORECASE),
    re.compile(r"text|texto", re.IGNORECASE),
    re.compile(r"name|nombre", re.IGNORECASE),
    re.compile(r"documento", re.IGNORECASE),
]


def calculate_llm_cost(prompt_tokens: int, completion_tokens: int) -> float:
    """Calculates deterministic LLM cost based on standard token pricing (HU-V2-056)."""
    prompt_cost = (prompt_tokens / 1000.0) * COST_PER_1K_PROMPT_USD
    completion_cost = (completion_tokens / 1000.0) * COST_PER_1K_COMPLETION_USD
    return round(prompt_cost + completion_cost, 6)


def sanitize_telemetry_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitizes log and telemetry payloads in worker, masking PII and confidential legal data (HU-V2-056).
    """
    sanitized: Dict[str, Any] = {}
    for key, value in data.items():
        is_sensitive = any(pattern.search(key) for pattern in SENSITIVE_PATTERNS)
        if is_sensitive:
            if isinstance(value, str) and len(value) > 0:
                sanitized[key] = f"[REDACTED_SECURE_TOKEN_{len(value)}_CHARS]"
            else:
                sanitized[key] = "[REDACTED]"
            continue

        if isinstance(value, dict):
            sanitized[key] = sanitize_telemetry_payload(value)
        else:
            sanitized[key] = value

    return sanitized


def evaluate_worker_alerts(
    duration_ms: float,
    retry_count: int,
    total_tokens: Optional[int] = None,
) -> List[Dict[str, str]]:
    """Evaluates operational alert thresholds in worker (HU-V2-056)."""
    alerts: List[Dict[str, str]] = []

    if duration_ms > 600_000:
        alerts.append({
            "severity": "critical",
            "metric": "STAGE_DURATION_EXCEEDED",
            "message": f"Worker execution duration {round(duration_ms/1000)}s exceeds 10m threshold.",
        })

    if retry_count >= 3:
        alerts.append({
            "severity": "warning",
            "metric": "HIGH_RETRY_COUNT",
            "message": f"Worker task accumulated {retry_count} retries.",
        })

    if total_tokens and total_tokens > 50_000:
        alerts.append({
            "severity": "warning",
            "metric": "HIGH_TOKEN_CONSUMPTION",
            "message": f"High token consumption detected: {total_tokens} tokens.",
        })

    return alerts
