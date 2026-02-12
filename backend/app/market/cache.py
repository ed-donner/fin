"""Shared in-memory price cache."""

import asyncio
from datetime import datetime, timezone

from app.market.models import PriceUpdate


class PriceCache:
    """Thread-safe in-memory cache of latest prices per ticker."""

    def __init__(self):
        self._prices: dict[str, PriceUpdate] = {}
        self._event = asyncio.Event()

    def update(self, ticker: str, price: float) -> PriceUpdate:
        """Update price for a ticker and return the PriceUpdate."""
        prev = self._prices.get(ticker)
        previous_price = prev.price if prev else price

        if price > previous_price:
            direction = "up"
        elif price < previous_price:
            direction = "down"
        else:
            direction = "flat"

        update = PriceUpdate(
            ticker=ticker,
            price=round(price, 2),
            previous_price=round(previous_price, 2),
            timestamp=datetime.now(timezone.utc).isoformat(),
            direction=direction,
        )
        self._prices[ticker] = update
        self._event.set()
        self._event.clear()
        return update

    def get_all(self) -> list[PriceUpdate]:
        """Return latest prices for all tickers."""
        return list(self._prices.values())

    def get(self, ticker: str) -> PriceUpdate | None:
        """Return latest price for a single ticker."""
        return self._prices.get(ticker)

    async def wait_for_update(self, timeout: float = 1.0) -> bool:
        """Wait for any price update. Returns True if update received."""
        try:
            await asyncio.wait_for(self._event.wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            return False


# Singleton cache instance
price_cache = PriceCache()
