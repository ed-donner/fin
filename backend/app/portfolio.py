"""Portfolio endpoints: positions, trade execution, history."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import get_db
from app.prices import price_cache

router = APIRouter(prefix="/api/portfolio")

USER_ID = "default"


class TradeRequest(BaseModel):
    ticker: str
    quantity: float
    side: str  # "buy" or "sell"


class PositionOut(BaseModel):
    ticker: str
    quantity: float
    avg_cost: float
    current_price: float
    unrealized_pnl: float
    pnl_percent: float


class PortfolioOut(BaseModel):
    cash_balance: float
    total_value: float
    positions: list[PositionOut]


class TradeOut(BaseModel):
    id: str
    ticker: str
    side: str
    quantity: float
    price: float
    executed_at: str


class SnapshotOut(BaseModel):
    total_value: float
    recorded_at: str


def _current_price(ticker: str) -> float | None:
    entry = price_cache.get(ticker)
    return entry.price if entry else None


async def _get_portfolio_value(db) -> float:
    """Calculate total portfolio value = cash + sum(position qty * current price)."""
    cursor = await db.execute(
        "SELECT cash_balance FROM users_profile WHERE id = ?", (USER_ID,)
    )
    row = await cursor.fetchone()
    cash = row["cash_balance"] if row else 0.0

    cursor = await db.execute(
        "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id = ?", (USER_ID,)
    )
    positions = await cursor.fetchall()

    total = cash
    for pos in positions:
        price = _current_price(pos["ticker"])
        cp = price if price is not None else pos["avg_cost"]
        total += pos["quantity"] * cp

    return total


async def take_snapshot(db=None):
    """Record current portfolio value as a snapshot."""
    close_db = False
    if db is None:
        db = await get_db()
        close_db = True
    try:
        total_value = await _get_portfolio_value(db)
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), USER_ID, total_value, now),
        )
        await db.commit()
    finally:
        if close_db:
            await db.close()


@router.get("")
async def get_portfolio() -> PortfolioOut:
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT cash_balance FROM users_profile WHERE id = ?", (USER_ID,)
        )
        row = await cursor.fetchone()
        cash = row["cash_balance"] if row else 0.0

        cursor = await db.execute(
            "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id = ?",
            (USER_ID,),
        )
        rows = await cursor.fetchall()

        positions = []
        total = cash
        for r in rows:
            price = _current_price(r["ticker"])
            cp = price if price is not None else r["avg_cost"]
            market_value = r["quantity"] * cp
            cost_basis = r["quantity"] * r["avg_cost"]
            pnl = market_value - cost_basis
            pnl_pct = (pnl / cost_basis * 100) if cost_basis != 0 else 0.0
            total += market_value
            positions.append(PositionOut(
                ticker=r["ticker"],
                quantity=r["quantity"],
                avg_cost=r["avg_cost"],
                current_price=cp,
                unrealized_pnl=round(pnl, 2),
                pnl_percent=round(pnl_pct, 2),
            ))

        return PortfolioOut(
            cash_balance=round(cash, 2),
            total_value=round(total, 2),
            positions=positions,
        )
    finally:
        await db.close()


@router.post("/trade")
async def execute_trade(req: TradeRequest) -> TradeOut:
    if req.side not in ("buy", "sell"):
        raise HTTPException(400, "side must be 'buy' or 'sell'")
    if req.quantity <= 0:
        raise HTTPException(400, "quantity must be positive")

    price = _current_price(req.ticker)
    if price is None:
        raise HTTPException(400, f"no price available for {req.ticker}")

    db = await get_db()
    try:
        now = datetime.now(timezone.utc).isoformat()
        trade_id = str(uuid.uuid4())

        if req.side == "buy":
            total_cost = req.quantity * price

            cursor = await db.execute(
                "SELECT cash_balance FROM users_profile WHERE id = ?", (USER_ID,)
            )
            row = await cursor.fetchone()
            cash = row["cash_balance"]
            if cash < total_cost:
                raise HTTPException(400, f"insufficient cash: need ${total_cost:.2f}, have ${cash:.2f}")

            # Deduct cash
            await db.execute(
                "UPDATE users_profile SET cash_balance = cash_balance - ? WHERE id = ?",
                (total_cost, USER_ID),
            )

            # Update or create position
            cursor = await db.execute(
                "SELECT id, quantity, avg_cost FROM positions WHERE user_id = ? AND ticker = ?",
                (USER_ID, req.ticker),
            )
            existing = await cursor.fetchone()
            if existing:
                old_qty = existing["quantity"]
                old_avg = existing["avg_cost"]
                new_qty = old_qty + req.quantity
                new_avg = ((old_qty * old_avg) + (req.quantity * price)) / new_qty
                await db.execute(
                    "UPDATE positions SET quantity = ?, avg_cost = ?, updated_at = ? WHERE id = ?",
                    (new_qty, new_avg, now, existing["id"]),
                )
            else:
                await db.execute(
                    "INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (str(uuid.uuid4()), USER_ID, req.ticker, req.quantity, price, now),
                )

        else:  # sell
            cursor = await db.execute(
                "SELECT id, quantity FROM positions WHERE user_id = ? AND ticker = ?",
                (USER_ID, req.ticker),
            )
            existing = await cursor.fetchone()
            if not existing or existing["quantity"] < req.quantity:
                held = existing["quantity"] if existing else 0
                raise HTTPException(400, f"insufficient shares: need {req.quantity}, have {held}")

            proceeds = req.quantity * price
            await db.execute(
                "UPDATE users_profile SET cash_balance = cash_balance + ? WHERE id = ?",
                (proceeds, USER_ID),
            )

            new_qty = existing["quantity"] - req.quantity
            if new_qty == 0:
                await db.execute("DELETE FROM positions WHERE id = ?", (existing["id"],))
            else:
                await db.execute(
                    "UPDATE positions SET quantity = ?, updated_at = ? WHERE id = ?",
                    (new_qty, now, existing["id"]),
                )

        # Log trade
        await db.execute(
            "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (trade_id, USER_ID, req.ticker, req.side, req.quantity, price, now),
        )

        await db.commit()

        # Snapshot after trade
        await take_snapshot(db)

        return TradeOut(
            id=trade_id,
            ticker=req.ticker,
            side=req.side,
            quantity=req.quantity,
            price=price,
            executed_at=now,
        )
    finally:
        await db.close()


@router.get("/history")
async def get_portfolio_history() -> list[SnapshotOut]:
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT total_value, recorded_at FROM portfolio_snapshots WHERE user_id = ? ORDER BY recorded_at",
            (USER_ID,),
        )
        rows = await cursor.fetchall()
        return [SnapshotOut(total_value=r["total_value"], recorded_at=r["recorded_at"]) for r in rows]
    finally:
        await db.close()
