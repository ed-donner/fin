"""Tests for database initialization and schema."""

import pytest
import aiosqlite

from app.database import DB_PATH, DEFAULT_TICKERS, get_db, init_db


@pytest.mark.asyncio
async def test_schema_creates_all_tables(db):
    conn = await get_db()
    try:
        cursor = await conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        tables = [row[0] for row in await cursor.fetchall()]
        expected = [
            "chat_messages",
            "portfolio_snapshots",
            "positions",
            "trades",
            "users_profile",
            "watchlist",
        ]
        assert tables == expected
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_seed_creates_default_user(db):
    conn = await get_db()
    try:
        cursor = await conn.execute("SELECT id, cash_balance FROM users_profile")
        row = await cursor.fetchone()
        assert row is not None
        assert row[0] == "default"
        assert row[1] == 10000.0
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_seed_creates_default_watchlist(db):
    conn = await get_db()
    try:
        cursor = await conn.execute(
            "SELECT ticker FROM watchlist WHERE user_id='default' ORDER BY ticker"
        )
        tickers = [row[0] for row in await cursor.fetchall()]
        assert tickers == sorted(DEFAULT_TICKERS)
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_init_db_is_idempotent(db):
    """Running init_db twice should not duplicate seed data."""
    await init_db()
    conn = await get_db()
    try:
        cursor = await conn.execute("SELECT COUNT(*) FROM users_profile")
        row = await cursor.fetchone()
        assert row[0] == 1

        cursor = await conn.execute("SELECT COUNT(*) FROM watchlist")
        row = await cursor.fetchone()
        assert row[0] == len(DEFAULT_TICKERS)
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_wal_mode_enabled(db):
    conn = await get_db()
    try:
        cursor = await conn.execute("PRAGMA journal_mode")
        row = await cursor.fetchone()
        assert row[0] == "wal"
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_positions_table_unique_constraint(db):
    conn = await get_db()
    try:
        await conn.execute(
            "INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at) "
            "VALUES ('p1', 'default', 'AAPL', 10, 150.0, '2026-01-01T00:00:00Z')"
        )
        await conn.commit()
        with pytest.raises(aiosqlite.IntegrityError):
            await conn.execute(
                "INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at) "
                "VALUES ('p2', 'default', 'AAPL', 5, 155.0, '2026-01-01T00:00:00Z')"
            )
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_trades_table_accepts_buy_and_sell(db):
    conn = await get_db()
    try:
        await conn.execute(
            "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) "
            "VALUES ('t1', 'default', 'AAPL', 'buy', 10, 150.0, '2026-01-01T00:00:00Z')"
        )
        await conn.execute(
            "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) "
            "VALUES ('t2', 'default', 'AAPL', 'sell', 5, 160.0, '2026-01-01T00:00:00Z')"
        )
        await conn.commit()

        cursor = await conn.execute("SELECT COUNT(*) FROM trades")
        row = await cursor.fetchone()
        assert row[0] == 2
    finally:
        await conn.close()
