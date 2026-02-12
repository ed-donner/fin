"""Massive (Polygon.io) REST API client for real market data."""

import asyncio
import logging
import os

import httpx

from app.market.cache import price_cache
from app.market.interface import MarketDataProvider

logger = logging.getLogger(__name__)

POLYGON_BASE_URL = "https://api.polygon.io"
DEFAULT_POLL_INTERVAL = 15  # seconds (free tier: 5 calls/min)


class MassiveClient(MarketDataProvider):
    """Polls Polygon.io REST API for live market data."""

    def __init__(self, tickers: list[str]):
        self._api_key = os.environ["MASSIVE_API_KEY"]
        self._tickers = tickers
        self._poll_interval = float(os.environ.get("MASSIVE_POLL_INTERVAL", DEFAULT_POLL_INTERVAL))
        self._task: asyncio.Task | None = None
        self._client: httpx.AsyncClient | None = None

    async def start(self) -> None:
        self._client = httpx.AsyncClient(timeout=10.0)
        self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._client:
            await self._client.aclose()

    async def _run(self) -> None:
        """Poll loop."""
        while True:
            await self._poll()
            await asyncio.sleep(self._poll_interval)

    async def _poll(self) -> None:
        """Fetch latest prices for all tickers from Polygon.io snapshot endpoint."""
        tickers_csv = ",".join(self._tickers)
        url = f"{POLYGON_BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers"
        params = {"tickers": tickers_csv, "apiKey": self._api_key}

        try:
            resp = await self._client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

            for item in data.get("tickers", []):
                ticker = item.get("ticker")
                last_trade = item.get("lastTrade", {})
                price = last_trade.get("p")
                if ticker and price is not None:
                    price_cache.update(ticker, float(price))

        except httpx.HTTPError as e:
            logger.error("Massive API poll failed: %s", e)
