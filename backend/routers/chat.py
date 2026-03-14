"""
─── DAWWIN ML Platform — Agentic RAG Chat Router ───

Chat-to-Data assistant: users ask natural-language questions
about their dataset and receive analytical insights.

Uses LangChain DataFrame agent for structured data analysis.
Supports SSE streaming for real-time typing effect.
"""

import io
import json
import time
from typing import AsyncGenerator

import pandas as pd
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/chat-data", tags=["Data Copilot"])


# ─── Response Models ───


class ChatMessage(BaseModel):
    role: str       # "user" | "assistant" | "system"
    content: str
    timestamp_ms: int = 0
    metadata: dict | None = None  # e.g. {"chart_data": [...], "sql": "..."}


class ChatResponse(BaseModel):
    message: ChatMessage
    tokens_used: int = 0
    duration_ms: int = 0


# ─── In-Memory Dataset Store (per-session) ───
# In production, use Redis or Supabase storage.
_datasets: dict[str, pd.DataFrame] = {}


def _get_llm(provider: str = "gemini", model: str = "gemini-2.0-flash", temperature: float = 0.1):
    """Instantiate LLM based on provider config."""
    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(model=model, temperature=temperature)
    elif provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model=model, temperature=temperature)
    else:
        # Fallback: Gemini
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(model=model, temperature=temperature)


def _build_data_context(df: pd.DataFrame) -> str:
    """Build a concise data context string for the LLM."""
    info_buf = io.StringIO()
    df.info(buf=info_buf)
    info_str = info_buf.getvalue()

    stats = df.describe(include="all").to_string()
    sample = df.head(5).to_string()
    missing = df.isnull().sum()
    missing_str = missing[missing > 0].to_string() if missing.any() else "No missing values"

    return (
        f"## Dataset Overview\n"
        f"Shape: {df.shape[0]} rows × {df.shape[1]} columns\n\n"
        f"## Column Info\n{info_str}\n\n"
        f"## Statistical Summary\n{stats}\n\n"
        f"## Sample Data (first 5 rows)\n{sample}\n\n"
        f"## Missing Values\n{missing_str}"
    )


SYSTEM_PROMPT = """You are DAWWIN Data Copilot — an expert data analyst embedded in an
enterprise audit intelligence platform. You analyze datasets and provide
clear, actionable insights.

RULES:
1. Always ground your answers in the actual data provided.
2. Provide specific numbers, percentages, and statistical measures.
3. When relevant, suggest which columns to investigate further.
4. Format responses with clear structure (headers, bullet points).
5. If asked for a visualization, describe the chart type and data mapping.
6. Flag any data quality issues (missing values, outliers, skew).
7. Relate findings to audit/compliance context when appropriate.
8. Never fabricate data that isn't in the dataset.
"""


# ─── Upload Dataset Endpoint ───


@router.post("/upload-dataset")
async def upload_dataset(
    file: UploadFile = File(...),
    session_id: str = Form(default="default"),
):
    """Upload a CSV dataset for chat analysis."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    _datasets[session_id] = df

    return {
        "success": True,
        "session_id": session_id,
        "shape": list(df.shape),
        "columns": df.columns.tolist(),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "preview": df.head(5).to_dict(orient="records"),
    }


# ─── Chat Endpoint (non-streaming) ───


@router.post("/query", response_model=ChatResponse)
async def chat_query(
    query: str = Form(...),
    session_id: str = Form(default="default"),
    provider: str = Form(default="gemini"),
    model: str = Form(default="gemini-2.0-flash"),
):
    """
    Send a natural-language query about the uploaded dataset.
    Returns an analytical response from the LLM.
    """
    if session_id not in _datasets:
        raise HTTPException(
            status_code=404,
            detail="No dataset found. Upload a CSV first via /upload-dataset",
        )

    df = _datasets[session_id]
    start_time = time.time()

    try:
        llm = _get_llm(provider=provider, model=model)
        data_context = _build_data_context(df)

        # Build prompt with data context
        full_prompt = (
            f"{SYSTEM_PROMPT}\n\n"
            f"## Current Dataset\n{data_context}\n\n"
            f"## User Question\n{query}\n\n"
            f"Provide a thorough analytical response. "
            f"Include specific numbers from the data."
        )

        response = llm.invoke(full_prompt)
        content = response.content if hasattr(response, "content") else str(response)

        duration_ms = int((time.time() - start_time) * 1000)

        return ChatResponse(
            message=ChatMessage(
                role="assistant",
                content=content,
                timestamp_ms=int(time.time() * 1000),
            ),
            duration_ms=duration_ms,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM query failed: {str(e)}")


# ─── SSE Streaming Endpoint ───


@router.post("/stream")
async def chat_stream(
    query: str = Form(...),
    session_id: str = Form(default="default"),
    provider: str = Form(default="gemini"),
    model: str = Form(default="gemini-2.0-flash"),
):
    """
    Stream a chat response via Server-Sent Events (SSE).
    Each chunk is sent as a 'data:' event for real-time typing effect.
    """
    from sse_starlette.sse import EventSourceResponse

    if session_id not in _datasets:
        raise HTTPException(
            status_code=404,
            detail="No dataset found. Upload a CSV first via /upload-dataset",
        )

    df = _datasets[session_id]

    async def event_generator() -> AsyncGenerator[dict, None]:
        try:
            llm = _get_llm(provider=provider, model=model)
            data_context = _build_data_context(df)

            full_prompt = (
                f"{SYSTEM_PROMPT}\n\n"
                f"## Current Dataset\n{data_context}\n\n"
                f"## User Question\n{query}\n\n"
                f"Provide a thorough analytical response."
            )

            # Stream the response
            full_content = ""
            async for chunk in llm.astream(full_prompt):
                token = chunk.content if hasattr(chunk, "content") else str(chunk)
                if token:
                    full_content += token
                    yield {"event": "token", "data": json.dumps({"token": token})}

            # Final event with complete message
            yield {
                "event": "done",
                "data": json.dumps({
                    "content": full_content,
                    "timestamp_ms": int(time.time() * 1000),
                }),
            }

        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)}),
            }

    return EventSourceResponse(event_generator())
