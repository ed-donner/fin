"""Watchlist endpoints: list, add, remove tickers."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import get_db
from app.prices import price_cache

router = APIRouter(prefix="/api/watchlist")

USER_ID = "default"


class AddTickerRequest(BaseModel):
    ticker: str


class WatchlistItemOut(BaseModel):
    ticker: str
    price: float | None = None
    previous_price: float | None = None
    change_percent: float | None = None


@router.get("")
async def get_watchlist() -> list[WatchlistItemOut]:
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT ticker FROM watchlist WHERE user_id = ? ORDER BY added_at",
            (USER_ID,),
        )
        rows = await cursor.fetchall()

        items = []
        for r in rows:
            ticker = r["ticker"]
            entry = price_cache.get(ticker)
            if entry:
                prev = entry.previous_price
                change_pct = ((entry.price - prev) / prev * 100) if prev else None
                items.append(WatchlistItemOut(
                    ticker=ticker,
                    price=entry.price,
                    previous_price=prev,
                    change_percent=round(change_pct, 4) if change_pct is not None else None,
                ))
            else:
                items.append(WatchlistItemOut(ticker=ticker))

        return items
    finally:
        await db.close()


@router.post("")
async def add_ticker(req: AddTickerRequest) -> WatchlistItemOut:
    ticker = req.ticker.upper().strip()
    if not ticker:
        raise HTTPException(400, "ticker is required")

    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id FROM watchlist WHERE user_id = ? AND ticker = ?",
            (USER_ID, ticker),
        )
        if await cursor.fetchone():
            raise HTTPException(409, f"{ticker} already in watchlist")

        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), USER_ID, ticker, now),
        )
        await db.commit()

        # Register with price cache so market data system picks it up
        price_cache.add_ticker(ticker)

        entry = price_cache.get(ticker)
        if entry:
            prev = entry.previous_price
            change_pct = ((entry.price - prev) / prev * 100) if prev else None
            return WatchlistItemOut(
                ticker=ticker,
                price=entry.price,
                previous_price=prev,
                change_percent=round(change_pct, 4) if change_pct is not None else None,
            )
        return WatchlistItemOut(ticker=ticker)
    finally:
        await db.close()


@router.delete("/{ticker}")
async def remove_ticker(ticker: str):
    ticker = ticker.upper().strip()
    db = await get_db()
    try:
        cursor = await db.execute(
            "DELETE FROM watchlist WHERE user_id = ? AND ticker = ?",
            (USER_ID, ticker),
        )
        await db.commit()
        if cursor.rowcount == 0:
            raise HTTPException(404, f"{ticker} not in watchlist")

        price_cache.remove_ticker(ticker)
        return {"ok": True}
    finally:
        await db.close()
