"""
Configuration module for Agoralia API
"""
import os
from typing import List, Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Lista origini "fisse"
    FRONTEND_ALLOWED_ORIGINS: str = (
        "https://app.agoralia.app,"
        "https://www.agoralia.app,"
        "https://agoralia.vercel.app"
    )

    # Regex che copre i tuoi preview Vercel (agoralia-git-<branch>-<hash>-<team>.vercel.app)
    FRONTEND_ALLOWED_ORIGIN_REGEX: str = (
        r"^https://agoralia(?:-git-[a-z0-9\-]+-[a-z0-9\-]+(?:-[a-z0-9\-]+)?)?\.vercel\.app$"
    )

    COOKIE_DOMAIN: str = ".agoralia.app"
    SESSION_COOKIE_NAME: str = "ag_sess"
    SESSION_TTL_SECONDS: int = 60 * 60 * 24 * 30

    APP_BASE_URL: str = "https://api.agoralia.app"
    FRONTEND_APP_URL: str = "https://app.agoralia.app"

    CORS_DEBUG: bool = True

    # Demo mode configuration
    DEMO_ADMIN_EMAILE: str = "giacomo.cavalcabo14@gmail.com"

    # Gamma Analytics Feature Flag
    ANALYTICS_GAMMA: bool = False

    # OAuth Google
    OAUTH_GOOGLE_CLIENT_ID: str = ""
    OAUTH_GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "https://api.agoralia.app/auth/oauth/google/callback"

    # OAuth Microsoft
    OAUTH_MS_CLIENT_ID: str = ""
    OAUTH_MS_CLIENT_SECRET: str = ""
    OAUTH_MS_TENANT: str = "common"
    MICROSOFT_REDIRECT_URI: str = "https://api.agoralia.app/auth/oauth/microsoft/callback"

    @property
    def cors_allow_origins(self) -> List[str]:
        parts = [p.strip() for p in self.FRONTEND_ALLOWED_ORIGINS.split(",")]
        return [p.rstrip("/") for p in parts if p]  # niente slash finali

    @property
    def cors_allow_origin_regex(self) -> Optional[str]:
        s = (self.FRONTEND_ALLOWED_ORIGIN_REGEX or "").strip()
        return s or None

    @property
    def demo_admin_emails_list(self) -> List[str]:
        """Returns list of admin emails allowed to see demo data"""
        emails = [email.strip().lower() for email in self.DEMO_ADMIN_EMAILS.split(",")]
        return [email for email in emails if email]

    # AI/OpenAI Configuration (low-cost defaults)
    OPENAI_API_KEY: str = ""
    OPENAI_EMBED_MODEL: str = "text-embedding-3-small"  # Low-cost embeddings
    OPENAI_EXTRACT_MODEL: str = "gpt-4o-mini"  # Low-cost extraction
    OPENAI_BUDGET_MAX_USD: float = 10.0  # Daily budget cap
    OPENAI_MAX_TOKENS: int = 4000
    OPENAI_TEMPERATURE: float = 0.7

    # Twilio Configuration
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")


settings = Settings()

__all__ = ["settings", "Settings"]
