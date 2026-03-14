"""
─── DAWWIN ML Platform — Configuration ───

Centralised settings loaded from environment variables.
All secrets come from .env; never hardcoded.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── Supabase ──
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""

    # ── LLM Providers (for Agentic RAG) ──
    GOOGLE_API_KEY: str = ""        # Gemini
    OPENAI_API_KEY: str = ""        # OpenAI (optional)
    GROQ_API_KEY: str = ""          # Groq (optional)

    # ── LLM Config ──
    LLM_PROVIDER: str = "gemini"    # "gemini" | "openai" | "groq"
    LLM_MODEL: str = "gemini-2.0-flash"
    LLM_TEMPERATURE: float = 0.1

    # ── CORS ──
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "https://mshadianto.github.io",
    ]

    # ── Upload limits ──
    MAX_UPLOAD_MB: int = 50

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
