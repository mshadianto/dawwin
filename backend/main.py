"""
─── DAWWIN ML Platform — FastAPI Backend ───

Enterprise-grade ML platform backend providing:
  • Auto Feature Engineering with audit trail
  • Agentic RAG chat-to-data assistant
  • Dataset management and transformation

Run: uvicorn backend.main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.config import get_settings
from backend.routers import autofe, chat

settings = get_settings()

app = FastAPI(
    title="DAWWIN ML Platform API",
    description="Enterprise AI-powered audit intelligence backend",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──
app.include_router(autofe.router)
app.include_router(chat.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "dawwin-ml-backend"}
