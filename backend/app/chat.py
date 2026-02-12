"""POST /api/chat — LLM chat with auto-execution of trades and watchlist changes."""

import json
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from litellm import acompletion

from app.database import get_db

router = APIRouter()

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class ChatRequest(BaseModel):
    message: str


class TradeAction(BaseModel):
    ticker: str
    side: str
    quantity: float


class WatchlistChange(BaseModel):
    ticker: str
    action: str  # "add" | "remove"


class ChatResponse(BaseModel):
    message: str
    trades: list[TradeAction] | None = None
    watchlist_changes: list[WatchlistChange] | None = None


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are FinAlly, an AI trading assistant inside a simulated trading workstation.

Your capabilities:
- Analyze the user's portfolio composition, risk concentration, and P&L
- Suggest trades with clear reasoning
- Execute trades when the user asks or agrees (by including them in your response)
- Manage the watchlist (add/remove tickers)
- Be concise and data-driven

You MUST respond with valid JSON matching this schema:
{
  "message": "Your conversational response to the user",
  "trades": [{"ticker": "AAPL", "side": "buy", "quantity": 10}],
  "watchlist_changes": [{"ticker": "PYPL", "action": "add"}]
}

Rules:
- "message" is always required.
- "trades" is optional — include only when executing trades.
- "watchlist_changes" is optional — include only when modifying the watchlist.
- side must be "buy" or "sell". action must be "add" or "remove".
- Only execute trades when the user explicitly asks or agrees.
- Keep responses concise."""


# ---------------------------------------------------------------------------
# Portfolio context
# ---------------------------------------------------------------------------


async def _load_portfolio_context(db) -> str:
    """Build a text summary of the user's portfolio for the LLM."""
    # Cash balance
    cur = await db.execute(
        "SELECT cash_balance FROM users_profile WHERE id = 'default'"
    )
    row = await cur.fetchone()
    cash = row["cash_balance"] if row else 10000.0

    # Positions
    cur = await db.execute(
        "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id = 'default'"
    )
    positions = await cur.fetchall()

    # Watchlist
    cur = await db.execute(
        "SELECT ticker FROM watchlist WHERE user_id = 'default'"
    )
    watchlist = [r["ticker"] for r in await cur.fetchall()]

    lines = [f"Cash: ${cash:,.2f}"]

    if positions:
        lines.append("Positions:")
        total_cost = 0.0
        for p in positions:
            value = p["quantity"] * p["avg_cost"]
            total_cost += value
            lines.append(
                f"  {p['ticker']}: {p['quantity']} shares @ avg ${p['avg_cost']:.2f}"
            )
        lines.append(f"Total invested (at cost): ${total_cost:,.2f}")
    else:
        lines.append("Positions: none")

    lines.append(f"Watchlist: {', '.join(watchlist) if watchlist else 'empty'}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Conversation history
# ---------------------------------------------------------------------------


async def _load_history(db, limit: int = 20) -> list[dict]:
    """Load recent chat messages for context."""
    cur = await db.execute(
        "SELECT role, content FROM chat_messages "
        "WHERE user_id = 'default' ORDER BY created_at DESC LIMIT ?",
        (limit,),
    )
    rows = await cur.fetchall()
    # Reverse so oldest first
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


# ---------------------------------------------------------------------------
# Mock mode
# ---------------------------------------------------------------------------


def _mock_response(message: str) -> ChatResponse:
    """Return deterministic mock responses for testing."""
    lower = message.lower()

    if any(w in lower for w in ["hi", "hello", "hey"]):
        return ChatResponse(
            message="Hello! I'm FinAlly, your AI trading assistant. "
            "I can analyze your portfolio, suggest trades, and manage your watchlist. "
            "How can I help you today?"
        )

    if "portfolio" in lower or "positions" in lower or "holdings" in lower:
        return ChatResponse(
            message="Your portfolio currently has $10,000.00 in cash with no open positions. "
            "You're watching AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX. "
            "Would you like to make a trade?"
        )

    if "buy" in lower:
        # Extract ticker if mentioned
        ticker = "AAPL"
        for t in ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]:
            if t.lower() in lower:
                ticker = t
                break
        return ChatResponse(
            message=f"Buying 10 shares of {ticker} for you.",
            trades=[TradeAction(ticker=ticker, side="buy", quantity=10)],
        )

    if "sell" in lower:
        ticker = "AAPL"
        for t in ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]:
            if t.lower() in lower:
                ticker = t
                break
        return ChatResponse(
            message=f"Selling 10 shares of {ticker} for you.",
            trades=[TradeAction(ticker=ticker, side="sell", quantity=10)],
        )

    if "watch" in lower or "add" in lower:
        return ChatResponse(
            message="Adding PYPL to your watchlist.",
            watchlist_changes=[WatchlistChange(ticker="PYPL", action="add")],
        )

    if "remove" in lower:
        return ChatResponse(
            message="Removing NFLX from your watchlist.",
            watchlist_changes=[WatchlistChange(ticker="NFLX", action="remove")],
        )

    return ChatResponse(
        message="I can help you trade, analyze your portfolio, or manage your watchlist. "
        "What would you like to do?"
    )


# ---------------------------------------------------------------------------
# Trade execution
# ---------------------------------------------------------------------------


async def _execute_trade(
    db, ticker: str, side: str, quantity: float
) -> str | None:
    """Execute a trade. Returns error string on failure, None on success."""
    # We need a price. Use avg_cost for sells, or a default for buys.
    # In a full system this comes from the price cache. For now, use a
    # placeholder price of 100.0 if no market data is available.
    # TODO: integrate with market data price cache when available
    price = 150.0  # default placeholder

    now = datetime.now(timezone.utc).isoformat()

    if side == "buy":
        cost = price * quantity
        cur = await db.execute(
            "SELECT cash_balance FROM users_profile WHERE id = 'default'"
        )
        row = await cur.fetchone()
        cash = row["cash_balance"]
        if cost > cash:
            return f"Insufficient cash: need ${cost:,.2f} but only have ${cash:,.2f}"

        # Deduct cash
        await db.execute(
            "UPDATE users_profile SET cash_balance = cash_balance - ? WHERE id = 'default'",
            (cost,),
        )

        # Upsert position
        cur = await db.execute(
            "SELECT quantity, avg_cost FROM positions WHERE user_id = 'default' AND ticker = ?",
            (ticker,),
        )
        existing = await cur.fetchone()
        if existing:
            old_qty = existing["quantity"]
            old_cost = existing["avg_cost"]
            new_qty = old_qty + quantity
            new_avg = ((old_qty * old_cost) + (quantity * price)) / new_qty
            await db.execute(
                "UPDATE positions SET quantity = ?, avg_cost = ?, updated_at = ? "
                "WHERE user_id = 'default' AND ticker = ?",
                (new_qty, new_avg, now, ticker),
            )
        else:
            await db.execute(
                "INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at) "
                "VALUES (?, 'default', ?, ?, ?, ?)",
                (str(uuid.uuid4()), ticker, quantity, price, now),
            )

    elif side == "sell":
        cur = await db.execute(
            "SELECT quantity, avg_cost FROM positions WHERE user_id = 'default' AND ticker = ?",
            (ticker,),
        )
        existing = await cur.fetchone()
        if not existing or existing["quantity"] < quantity:
            held = existing["quantity"] if existing else 0
            return f"Insufficient shares: want to sell {quantity} {ticker} but hold {held}"

        price = existing["avg_cost"]  # sell at avg cost for now
        proceeds = price * quantity
        new_qty = existing["quantity"] - quantity

        await db.execute(
            "UPDATE users_profile SET cash_balance = cash_balance + ? WHERE id = 'default'",
            (proceeds,),
        )

        if new_qty <= 0:
            await db.execute(
                "DELETE FROM positions WHERE user_id = 'default' AND ticker = ?",
                (ticker,),
            )
        else:
            await db.execute(
                "UPDATE positions SET quantity = ?, updated_at = ? "
                "WHERE user_id = 'default' AND ticker = ?",
                (new_qty, now, ticker),
            )
    else:
        return f"Invalid side: {side}"

    # Record trade
    await db.execute(
        "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) "
        "VALUES (?, 'default', ?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), ticker, side, quantity, price, now),
    )
    await db.commit()
    return None


# ---------------------------------------------------------------------------
# Watchlist changes
# ---------------------------------------------------------------------------


async def _execute_watchlist_change(db, ticker: str, action: str) -> str | None:
    """Add/remove a ticker from watchlist. Returns error string on failure."""
    now = datetime.now(timezone.utc).isoformat()

    if action == "add":
        try:
            await db.execute(
                "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, 'default', ?, ?)",
                (str(uuid.uuid4()), ticker.upper(), now),
            )
            await db.commit()
        except Exception:
            return f"{ticker} is already on the watchlist"

    elif action == "remove":
        cur = await db.execute(
            "DELETE FROM watchlist WHERE user_id = 'default' AND ticker = ?",
            (ticker.upper(),),
        )
        await db.commit()
        if cur.rowcount == 0:
            return f"{ticker} is not on the watchlist"

    return None


# ---------------------------------------------------------------------------
# LLM call
# ---------------------------------------------------------------------------


async def _call_llm(messages: list[dict]) -> ChatResponse:
    """Call LLM via LiteLLM -> OpenRouter and parse structured response."""
    response = await acompletion(
        model="openrouter/openai/gpt-oss-120b",
        messages=messages,
        extra_body={
            "response_format": {"type": "json_object"},
        },
    )

    content = response.choices[0].message.content
    parsed = json.loads(content)
    return ChatResponse(**parsed)


# ---------------------------------------------------------------------------
# Chat endpoint
# ---------------------------------------------------------------------------


@router.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Send a message and receive a structured response with auto-executed actions."""
    db = await get_db()
    try:
        # Check mock mode
        if os.environ.get("LLM_MOCK", "").lower() == "true":
            result = _mock_response(req.message)
        else:
            # Build LLM messages
            portfolio_ctx = await _load_portfolio_context(db)
            history = await _load_history(db)

            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "system",
                    "content": f"Current portfolio state:\n{portfolio_ctx}",
                },
                *history,
                {"role": "user", "content": req.message},
            ]

            result = await _call_llm(messages)

        # Auto-execute trades
        errors = []
        if result.trades:
            for trade in result.trades:
                err = await _execute_trade(
                    db, trade.ticker, trade.side, trade.quantity
                )
                if err:
                    errors.append(err)

        # Auto-execute watchlist changes
        if result.watchlist_changes:
            for change in result.watchlist_changes:
                err = await _execute_watchlist_change(
                    db, change.ticker, change.action
                )
                if err:
                    errors.append(err)

        # Append errors to message if any
        if errors:
            result.message += "\n\n(Errors: " + "; ".join(errors) + ")"

        # Store messages
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "INSERT INTO chat_messages (id, user_id, role, content, actions, created_at) "
            "VALUES (?, 'default', 'user', ?, NULL, ?)",
            (str(uuid.uuid4()), req.message, now),
        )

        actions_json = None
        if result.trades or result.watchlist_changes:
            actions_json = json.dumps(result.model_dump(exclude={"message"}, exclude_none=True))

        await db.execute(
            "INSERT INTO chat_messages (id, user_id, role, content, actions, created_at) "
            "VALUES (?, 'default', 'assistant', ?, ?, ?)",
            (str(uuid.uuid4()), result.message, actions_json, now),
        )
        await db.commit()

        return result
    finally:
        await db.close()
