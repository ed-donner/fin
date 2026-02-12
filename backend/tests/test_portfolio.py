"""Tests for portfolio endpoints: trade execution, positions, P&L."""

import pytest

from app.market.cache import price_cache


@pytest.fixture(autouse=True)
def seed_prices():
    """Seed price cache with test prices."""
    price_cache.update("AAPL", 150.0)
    price_cache.update("GOOGL", 175.0)
    price_cache.update("TSLA", 250.0)
    yield
    # Clean up
    price_cache._prices.clear()


@pytest.mark.asyncio
async def test_get_portfolio_initial(client):
    resp = await client.get("/api/portfolio")
    assert resp.status_code == 200
    data = resp.json()
    assert data["cash_balance"] == 10000.0
    assert data["total_value"] == 10000.0
    assert data["positions"] == []


@pytest.mark.asyncio
async def test_buy_reduces_cash(client):
    resp = await client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 10, "side": "buy"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ticker"] == "AAPL"
    assert data["side"] == "buy"
    assert data["quantity"] == 10
    assert data["price"] == 150.0

    # Check portfolio
    resp = await client.get("/api/portfolio")
    data = resp.json()
    assert data["cash_balance"] == 10000.0 - (10 * 150.0)
    assert len(data["positions"]) == 1
    assert data["positions"][0]["ticker"] == "AAPL"
    assert data["positions"][0]["quantity"] == 10


@pytest.mark.asyncio
async def test_sell_increases_cash(client):
    # First buy
    await client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 10, "side": "buy"},
    )
    # Then sell
    resp = await client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 5, "side": "sell"},
    )
    assert resp.status_code == 200

    resp = await client.get("/api/portfolio")
    data = resp.json()
    # Bought 10 @ 150 = -1500, sold 5 @ 150 = +750, net cash = 10000 - 1500 + 750 = 9250
    assert data["cash_balance"] == 9250.0
    assert data["positions"][0]["quantity"] == 5


@pytest.mark.asyncio
async def test_sell_entire_position_removes_it(client):
    await client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 10, "side": "buy"},
    )
    await client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 10, "side": "sell"},
    )
    resp = await client.get("/api/portfolio")
    data = resp.json()
    assert data["positions"] == []


@pytest.mark.asyncio
async def test_buy_insufficient_cash(client):
    resp = await client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 10000, "side": "buy"},
    )
    assert resp.status_code == 400
    assert "insufficient cash" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_sell_insufficient_shares(client):
    resp = await client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 10, "side": "sell"},
    )
    assert resp.status_code == 400
    assert "insufficient shares" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_invalid_side(client):
    resp = await client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 1, "side": "short"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_zero_quantity(client):
    resp = await client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 0, "side": "buy"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_no_price_available(client):
    resp = await client.post(
        "/api/portfolio/trade",
        json={"ticker": "ZZZZ", "quantity": 1, "side": "buy"},
    )
    assert resp.status_code == 400
    assert "no price" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_trade_creates_snapshot(client):
    await client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 1, "side": "buy"},
    )
    resp = await client.get("/api/portfolio/history")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_pnl_calculation(client):
    # Buy at 150
    await client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 10, "side": "buy"},
    )

    resp = await client.get("/api/portfolio")
    data = resp.json()
    pos = data["positions"][0]
    # Current price == avg_cost == 150, so PnL should be 0
    assert pos["unrealized_pnl"] == 0.0
    assert pos["pnl_percent"] == 0.0
