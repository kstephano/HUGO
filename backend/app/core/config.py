"""Single source of truth for all environment-backed settings."""
from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://hugo:hugo@localhost:5432/hugo"
    db_echo: bool = False

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Anthropic
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-5"
    anthropic_max_tokens: int = 4096
    anthropic_thinking_budget: int = 0  # 0 = disabled; set >0 to enable extended thinking

    # Brave Search
    brave_search_api_key: str = ""

    # Voyage AI
    voyage_api_key: str = ""
    voyage_model: str = "voyage-3"
    embedding_dim: int = 1024

    # Session / auth
    session_secret: str = "change-me-in-production"
    session_ttl_seconds: int = 86400

    # Rate limiting
    rate_limit_messages_per_minute: int = 60

    # Agent loop
    max_tool_iterations: int = 5
    tool_timeout_seconds: int = 30
    rolling_summary_token_threshold: int = 60000

    # CORS
    allowed_origins: str = "http://localhost:3000"

    # Mock providers
    mock_providers: bool = False

    # Production flag — enables secure cookies, tightens defaults
    production: bool = False

    # Logging
    log_level: str = "INFO"
    log_json: bool = True

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def async_database_url(self) -> str:
        # Railway (and most providers) give postgres:// or postgresql:// — neither
        # works with asyncpg. Normalise to postgresql+asyncpg:// unconditionally.
        url = self.database_url
        for scheme in ("postgres://", "postgresql://"):
            if url.startswith(scheme):
                return url.replace(scheme, "postgresql+asyncpg://", 1)
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
