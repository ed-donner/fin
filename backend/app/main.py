"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    await init_db()
    yield


app = FastAPI(title="FinAlly", lifespan=lifespan)


@app.get("/api/health")
async def health():
    return JSONResponse({"status": "ok"})


# Serve static files (Next.js export) at root, if the directory exists
static_dir = Path(__file__).parent.parent.parent / "static"
if static_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
