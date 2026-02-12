"""Background task: periodic portfolio snapshot recording."""

import asyncio

from app.portfolio import take_snapshot

SNAPSHOT_INTERVAL = 30  # seconds


async def snapshot_loop():
    """Record portfolio value every SNAPSHOT_INTERVAL seconds."""
    while True:
        await asyncio.sleep(SNAPSHOT_INTERVAL)
        try:
            await take_snapshot()
        except Exception:
            pass  # Don't crash the loop on transient DB errors
