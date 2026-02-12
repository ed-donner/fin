"""SSE streaming endpoint for live price updates."""

import asyncio
import json

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from app.market.cache import price_cache

router = APIRouter()


async def _price_event_generator():
    """Yield SSE events with all ticker prices at ~500ms cadence."""
    while True:
        prices = price_cache.get_all()
        if prices:
            for p in prices:
                yield {"event": "price", "data": p.model_dump_json()}
        await asyncio.sleep(0.5)


@router.get("/api/stream/prices")
async def stream_prices():
    """SSE endpoint for live price updates."""
    return EventSourceResponse(_price_event_generator())
