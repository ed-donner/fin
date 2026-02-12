"""Background portfolio snapshot recorder (every 30 seconds)."""

import asyncio
import logging

from app.database import get_db
from app.portfolio import take_snapshot

log = logging.getLogger(__name__)

_task: asyncio.Task | None = None


async def _snapshot_loop():
    """Periodically snapshot portfolio value."""
    while True:
        await asyncio.sleep(30)
        try:
            db = await get_db()
            try:
                await take_snapshot(db)
                await db.commit()
            finally:
                await db.close()
        except Exception:
            log.exception("Snapshot failed")


def start_snapshot_recorder():
    """Start the background snapshot task."""
    global _task
    _task = asyncio.create_task(_snapshot_loop())


def stop_snapshot_recorder():
    """Cancel the background snapshot task."""
    global _task
    if _task:
        _task.cancel()
        _task = None
