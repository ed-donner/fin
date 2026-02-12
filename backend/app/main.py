"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.database import init_db
from app.market.provider import create_provider
from app.market.stream import router as stream_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and start market data provider."""
    await init_db()
    provider = create_provider()
    await provider.start()
    yield
    await provider.stop()


app = FastAPI(title="FinAlly", lifespan=lifespan)

app.include_router(stream_router)


@app.get("/api/health")
async def health():
    return JSONResponse({"status": "ok"})


# Serve static files (Next.js export) at root, if the directory exists
static_dir = Path(__file__).parent.parent.parent / "static"
if static_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
