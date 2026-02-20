"""Configuration for Session Monitor Service."""

import os
import logging

logger = logging.getLogger(__name__)

# =============================================================================
# Secret Management
# =============================================================================

def _get_secret(secret_id: str, env_var: str = None) -> str:
    """Get a secret from environment variable or Secret Manager."""
    if env_var:
        value = os.environ.get(env_var, "")
        if value:
            return value

    # Try Secret Manager API
    project_id = os.environ.get("GCP_PROJECT_ID") or os.environ.get("GOOGLE_CLOUD_PROJECT")
    if project_id:
        try:
            from google.cloud import secretmanager
            client = secretmanager.SecretManagerServiceClient()
            name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
            response = client.access_secret_version(request={"name": name})
            return response.payload.data.decode("UTF-8")
        except Exception as e:
            logger.warning(f"Failed to access Secret Manager for {secret_id}: {e}")

    return ""


# =============================================================================
# Napster Spaces API Configuration
# =============================================================================

NAPSTER_API_BASE_URL = "https://spaces-api.napsterai.dev/v1/experiences"

# Experience ID for AI Personal Interviewer
EXPERIENCE_ID = os.environ.get(
    "EXPERIENCE_ID",
    "YWIzZGI5ZWItMWIxOC00MzVlLTkxN2UtYTgzZjJiNDVmM2I1OjFiY2FiMGFkLTA4NDktNDdlMS04MjM0LTFhNDFhYTZmYzQ1Zg=="
)


# =============================================================================
# Sensitive Credentials
# =============================================================================

def get_napster_api_key() -> str:
    """Get Napster API key from secure storage."""
    return _get_secret("napster-api-key", "NAPSTER_API_KEY")


def get_gemini_api_key() -> str:
    """Get Gemini API key from secure storage."""
    return _get_secret("gemini-api-key", "GEMINI_API_KEY")


class Secrets:
    """Lazy-loaded secrets."""
    _napster_api_key = None
    _gemini_api_key = None

    @property
    def NAPSTER_API_KEY(self) -> str:
        if self._napster_api_key is None:
            self._napster_api_key = get_napster_api_key()
        return self._napster_api_key

    @property
    def GEMINI_API_KEY(self) -> str:
        if self._gemini_api_key is None:
            self._gemini_api_key = get_gemini_api_key()
        return self._gemini_api_key


secrets = Secrets()


# =============================================================================
# Service Configuration
# =============================================================================

CHECK_INTERVAL_SECONDS = int(os.environ.get("CHECK_INTERVAL_SECONDS", "300"))  # 5 minutes
PROCESSED_SESSIONS_FILE = os.environ.get("PROCESSED_SESSIONS_FILE", "/tmp/processed_sessions.json")

# GCS Configuration
GCS_BUCKET = os.environ.get("GCS_BUCKET", "ai-interviewer-sessions")
GCS_STATE_BLOB = "session_monitor/processed_sessions.json"

# GCP Configuration for Vertex AI
GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID") or os.environ.get("GOOGLE_CLOUD_PROJECT")
GCP_REGION = os.environ.get("GCP_REGION", "us-east5")  # Claude models available in us-east5

