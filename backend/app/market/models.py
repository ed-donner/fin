"""Market data models."""

from pydantic import BaseModel


class PriceUpdate(BaseModel):
    """A single price update for a ticker."""

    ticker: str
    price: float
    previous_price: float
    timestamp: str
    direction: str  # "up", "down", or "flat"
