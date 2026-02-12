"""FastAPI application entry point."""

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.chat import router as chat_router
from app.database import init_db
from app.market.provider import create_provider
from app.market.stream import router as stream_router
from app.portfolio import router as portfolio_router
from app.watchlist import router as watchlist_router
from app.snapshots import snapshot_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database, start market data provider and background tasks."""
    await init_db()
    provider = create_provider()
    await provider.start()
    task = asyncio.create_task(snapshot_loop())
    yield
    task.cancel()
    await provider.stop()


app = FastAPI(title="FinAlly", lifespan=lifespan)
app.include_router(chat_router)

app.include_router(stream_router)
app.include_router(portfolio_router)
app.include_router(watchlist_router)


@app.get("/api/health")
async def health():
    return JSONResponse({"status": "ok"})


# Serve static files (Next.js export) at root, if the directory exists
static_dir = Path(__file__).parent.parent.parent / "static"
if static_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
