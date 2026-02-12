"""Environment-driven market data provider selection."""

import os

from app.market.interface import MarketDataProvider


def create_provider() -> MarketDataProvider:
    """Create the appropriate provider based on environment."""
    api_key = os.environ.get("MASSIVE_API_KEY", "").strip()

    if api_key:
        from app.market.massive import MassiveClient
        from app.database import DEFAULT_TICKERS

        return MassiveClient(tickers=DEFAULT_TICKERS)

    from app.market.simulator import Simulator

    return Simulator()
