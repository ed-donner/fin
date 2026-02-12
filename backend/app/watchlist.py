"""Watchlist API routes."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import get_db
from app.market.cache import price_cache

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


class AddTickerRequest(BaseModel):
    ticker: str


class WatchlistItem(BaseModel):
    ticker: str
    price: float | None = None
    previous_price: float | None = None
    change_percent: float | None = None


@router.get("", response_model=list[WatchlistItem])
async def get_watchlist():
    """Return watchlist tickers with latest prices from price cache."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT ticker FROM watchlist WHERE user_id = 'default' ORDER BY added_at"
        )
        rows = await cursor.fetchall()
        items = []
        for row in rows:
            ticker = row["ticker"]
            update = price_cache.get(ticker)
            if update:
                prev = update.previous_price
                change_pct = ((update.price - prev) / prev * 100) if prev else None
                items.append(WatchlistItem(
                    ticker=ticker,
                    price=update.price,
                    previous_price=prev,
                    change_percent=round(change_pct, 2) if change_pct is not None else None,
                ))
            else:
                items.append(WatchlistItem(ticker=ticker))
        return items
    finally:
        await db.close()


@router.post("", response_model=WatchlistItem)
async def add_ticker(body: AddTickerRequest):
    """Add a ticker to the watchlist."""
    ticker = body.ticker.upper().strip()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required")

    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id FROM watchlist WHERE user_id = 'default' AND ticker = ?",
            (ticker,),
        )
        if await cursor.fetchone():
            raise HTTPException(status_code=409, detail=f"{ticker} already in watchlist")

        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, 'default', ?, ?)",
            (str(uuid.uuid4()), ticker, now),
        )
        await db.commit()
        update = price_cache.get(ticker)
        return WatchlistItem(ticker=ticker, price=update.price if update else None)
    finally:
        await db.close()


@router.delete("/{ticker}")
async def remove_ticker(ticker: str):
    """Remove a ticker from the watchlist."""
    ticker = ticker.upper().strip()
    db = await get_db()
    try:
        cursor = await db.execute(
            "DELETE FROM watchlist WHERE user_id = 'default' AND ticker = ?",
            (ticker,),
        )
        await db.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"{ticker} not in watchlist")
        return {"ok": True}
    finally:
        await db.close()
