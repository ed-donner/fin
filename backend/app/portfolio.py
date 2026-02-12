"""Portfolio API routes: positions, trading, snapshots."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import get_db
from app.market.cache import price_cache

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


class TradeRequest(BaseModel):
    ticker: str
    quantity: float
    side: str  # "buy" or "sell"


class Position(BaseModel):
    ticker: str
    quantity: float
    avg_cost: float
    current_price: float
    unrealized_pnl: float
    pnl_percent: float


class PortfolioResponse(BaseModel):
    cash_balance: float
    total_value: float
    positions: list[Position]


class TradeResponse(BaseModel):
    id: str
    ticker: str
    side: str
    quantity: float
    price: float
    executed_at: str


class SnapshotResponse(BaseModel):
    total_value: float
    recorded_at: str


async def take_snapshot(db):
    """Calculate portfolio value and insert a snapshot row."""
    cursor = await db.execute(
        "SELECT cash_balance FROM users_profile WHERE id = 'default'"
    )
    user = await cursor.fetchone()
    cash = user["cash_balance"]

    cursor = await db.execute(
        "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id = 'default'"
    )
    positions = await cursor.fetchall()

    total = cash
    for pos in positions:
        update = price_cache.get(pos["ticker"])
        price = update.price if update else pos["avg_cost"]
        total += pos["quantity"] * price

    now = datetime.now(timezone.utc).isoformat()
    await db.execute(
        "INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at) VALUES (?, 'default', ?, ?)",
        (str(uuid.uuid4()), round(total, 2), now),
    )


@router.get("", response_model=PortfolioResponse)
async def get_portfolio():
    """Return current positions, cash, total value, unrealized P&L."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT cash_balance FROM users_profile WHERE id = 'default'"
        )
        user = await cursor.fetchone()
        cash = user["cash_balance"]

        cursor = await db.execute(
            "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id = 'default'"
        )
        rows = await cursor.fetchall()

        positions = []
        total_value = cash
        for row in rows:
            ticker = row["ticker"]
            qty = row["quantity"]
            avg_cost = row["avg_cost"]
            update = price_cache.get(ticker)
            current_price = update.price if update else avg_cost
            unrealized_pnl = (current_price - avg_cost) * qty
            pnl_percent = ((current_price - avg_cost) / avg_cost * 100) if avg_cost else 0
            total_value += current_price * qty
            positions.append(Position(
                ticker=ticker,
                quantity=qty,
                avg_cost=round(avg_cost, 2),
                current_price=round(current_price, 2),
                unrealized_pnl=round(unrealized_pnl, 2),
                pnl_percent=round(pnl_percent, 2),
            ))

        return PortfolioResponse(
            cash_balance=round(cash, 2),
            total_value=round(total_value, 2),
            positions=positions,
        )
    finally:
        await db.close()


@router.post("/trade", response_model=TradeResponse)
async def execute_trade(body: TradeRequest):
    """Execute a market order at current cached price."""
    ticker = body.ticker.upper().strip()
    quantity = body.quantity
    side = body.side.lower()

    if side not in ("buy", "sell"):
        raise HTTPException(status_code=400, detail="side must be 'buy' or 'sell'")
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be positive")

    update = price_cache.get(ticker)
    if update is None:
        raise HTTPException(status_code=400, detail=f"No price available for {ticker}")
    current_price = update.price

    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT cash_balance FROM users_profile WHERE id = 'default'"
        )
        user = await cursor.fetchone()
        cash = user["cash_balance"]

        now = datetime.now(timezone.utc).isoformat()
        trade_id = str(uuid.uuid4())

        if side == "buy":
            total_cost = quantity * current_price
            if cash < total_cost:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient cash: need ${total_cost:.2f}, have ${cash:.2f}",
                )

            # Update or create position
            cursor = await db.execute(
                "SELECT quantity, avg_cost FROM positions WHERE user_id = 'default' AND ticker = ?",
                (ticker,),
            )
            existing = await cursor.fetchone()
            if existing:
                old_qty = existing["quantity"]
                old_avg = existing["avg_cost"]
                new_qty = old_qty + quantity
                new_avg = ((old_qty * old_avg) + (quantity * current_price)) / new_qty
                await db.execute(
                    "UPDATE positions SET quantity = ?, avg_cost = ?, updated_at = ? WHERE user_id = 'default' AND ticker = ?",
                    (new_qty, new_avg, now, ticker),
                )
            else:
                await db.execute(
                    "INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at) VALUES (?, 'default', ?, ?, ?, ?)",
                    (str(uuid.uuid4()), ticker, quantity, current_price, now),
                )

            # Deduct cash
            await db.execute(
                "UPDATE users_profile SET cash_balance = cash_balance - ? WHERE id = 'default'",
                (total_cost,),
            )

        else:  # sell
            cursor = await db.execute(
                "SELECT quantity FROM positions WHERE user_id = 'default' AND ticker = ?",
                (ticker,),
            )
            existing = await cursor.fetchone()
            if not existing or existing["quantity"] < quantity:
                held = existing["quantity"] if existing else 0
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient shares: want to sell {quantity}, hold {held}",
                )

            new_qty = existing["quantity"] - quantity
            if new_qty == 0:
                await db.execute(
                    "DELETE FROM positions WHERE user_id = 'default' AND ticker = ?",
                    (ticker,),
                )
            else:
                await db.execute(
                    "UPDATE positions SET quantity = ?, updated_at = ? WHERE user_id = 'default' AND ticker = ?",
                    (new_qty, now, ticker),
                )

            # Add proceeds to cash
            proceeds = quantity * current_price
            await db.execute(
                "UPDATE users_profile SET cash_balance = cash_balance + ? WHERE id = 'default'",
                (proceeds,),
            )

        # Log the trade
        await db.execute(
            "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) VALUES (?, 'default', ?, ?, ?, ?, ?)",
            (trade_id, ticker, side, quantity, current_price, now),
        )

        # Take post-trade snapshot
        await take_snapshot(db)

        await db.commit()
        return TradeResponse(
            id=trade_id,
            ticker=ticker,
            side=side,
            quantity=quantity,
            price=current_price,
            executed_at=now,
        )
    finally:
        await db.close()


@router.get("/history", response_model=list[SnapshotResponse])
async def get_portfolio_history():
    """Return portfolio snapshots for P&L chart."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT total_value, recorded_at FROM portfolio_snapshots WHERE user_id = 'default' ORDER BY recorded_at"
        )
        rows = await cursor.fetchall()
        return [
            SnapshotResponse(total_value=row["total_value"], recorded_at=row["recorded_at"])
            for row in rows
        ]
    finally:
        await db.close()
