"""Settings management for BUPA Sync backend."""

import json
import os
from pathlib import Path

from pydantic import BaseModel

DATA_DIR = Path(__file__).parent / "data"
SETTINGS_FILE = DATA_DIR / "settings.json"


class LLMConfig(BaseModel):
    provider: str = "local_proxy"  # "local_proxy" or "sap_ai_core"
    base_url: str = "http://localhost:6655/litellm/v1"
    model: str = "anthropic--claude-4.6-sonnet"
    api_key: str = ""
    # AI Core credentials come from BTP destination; this field is kept for
    # local-proxy API key only. AICORE_DESTINATION_NAME env var controls destination name.


class N8nConfig(BaseModel):
    url: str = "http://localhost:5678"
    api_key: str = ""
    workflow_id: str = ""
    retry_workflow_id: str = ""
    agent_fix_workflow_id: str = ""
    monitored_workflow_ids: list[str] = []
    webhook_url: str = ""


class MockS4Config(BaseModel):
    url: str = "http://localhost:8090"


class S4SourceConfig(BaseModel):
    """Controls whether to use Mock or real S/4HANA via BTP destination."""
    source: str = "mock"  # "mock" or "real"
    destination_name: str = "S4_SIA_I577956"  # BTP destination name for real S/4
    sap_client: str = "500"  # SAP client number


class SmtpConfig(BaseModel):
    host: str = "localhost"
    port: int = 1025
    username: str = ""
    password: str = ""
    from_email: str = ""
    notification_emails: list[str] = []


class AgentConfig(BaseModel):
    url: str = "http://localhost:5000"


class NgrokConfig(BaseModel):
    enabled: bool = False
    authtoken: str = ""
    domain: str = ""


class QdrantConfig(BaseModel):
    url: str = "http://localhost:6333"


class Settings(BaseModel):
    deployment_mode: str = "local"
    llm: LLMConfig = LLMConfig()
    n8n: N8nConfig = N8nConfig()
    mock_s4: MockS4Config = MockS4Config()
    s4_source: S4SourceConfig = S4SourceConfig()
    smtp: SmtpConfig = SmtpConfig()
    agent: AgentConfig = AgentConfig()
    ngrok: NgrokConfig = NgrokConfig()
    qdrant: QdrantConfig = QdrantConfig()


def _sync_settings_file(settings: Settings) -> None:
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        SETTINGS_FILE.write_text(settings.model_dump_json(indent=2), encoding="utf-8")
    except Exception:
        pass


def load_settings() -> Settings:
    from database import get_setting

    raw = get_setting("app_settings", "")
    if raw:
        try:
            settings = Settings(**json.loads(raw))
            _sync_settings_file(settings)
            return settings
        except Exception:
            pass

    if SETTINGS_FILE.exists():
        try:
            data = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
            # Drop removed fields gracefully
            data.pop("auth", None)
            data.pop("authorization", None)
            if "llm" in data:
                data["llm"].pop("aicore_service_key", None)
            settings = Settings(**data)
            save_settings(settings)
            return settings
        except Exception:
            pass

    # No DB record yet — bootstrap from env vars as initial defaults
    settings = Settings(
        deployment_mode=os.environ.get("DEPLOYMENT_MODE", "cf"),
        llm=LLMConfig(
            provider=os.environ.get("LLM_PROVIDER", "sap_ai_core"),
            base_url=os.environ.get("LLM_BASE_URL", ""),
            model=os.environ.get("LLM_MODEL", ""),
            api_key=os.environ.get("LLM_API_KEY", ""),
        ),
        n8n=N8nConfig(
            url=os.environ.get("N8N_URL", "http://localhost:5678"),
            api_key=os.environ.get("N8N_API_KEY", ""),
        ),
        mock_s4=MockS4Config(
            url=os.environ.get("MOCK_S4_URL", "http://localhost:8090"),
        ),
        smtp=SmtpConfig(
            host=os.environ.get("SMTP_HOST", "localhost"),
            port=int(os.environ.get("SMTP_PORT", "1025")),
            username=os.environ.get("SMTP_USERNAME", ""),
            password=os.environ.get("SMTP_PASSWORD", ""),
        ),
        agent=AgentConfig(
            url=os.environ.get("AGENT_URL", "http://localhost:5000"),
        ),
    )
    save_settings(settings)
    return settings


def save_settings(settings: Settings, user: str = "system") -> None:
    from database import set_setting

    set_setting("app_settings", settings.model_dump_json(), user=user)
    _sync_settings_file(settings)


def get_settings() -> Settings:
    return load_settings()


def mask_api_key(key: str) -> str:
    if not key or len(key) <= 4:
        return "****" if key else ""
    return "*" * (len(key) - 4) + key[-4:]


def mask_settings(settings: Settings) -> dict:
    data = settings.model_dump()
    if data["llm"]["api_key"]:
        data["llm"]["api_key"] = mask_api_key(data["llm"]["api_key"])
    if data["n8n"]["api_key"]:
        data["n8n"]["api_key"] = mask_api_key(data["n8n"]["api_key"])
    if data["smtp"]["password"]:
        data["smtp"]["password"] = mask_api_key(data["smtp"]["password"])
    if data["ngrok"]["authtoken"]:
        data["ngrok"]["authtoken"] = mask_api_key(data["ngrok"]["authtoken"])
    return data
