"""In-memory price cache shared by all modules."""

from dataclasses import dataclass, field


@dataclass
class PriceEntry:
    price: float
    previous_price: float
    timestamp: str = ""


class PriceCache:
    """Thread-safe in-memory cache of latest prices per ticker."""

    def __init__(self):
        self._prices: dict[str, PriceEntry] = {}
        self._tickers: set[str] = set()

    def update(self, ticker: str, price: float, timestamp: str = ""):
        prev = self._prices[ticker].price if ticker in self._prices else price
        self._prices[ticker] = PriceEntry(price=price, previous_price=prev, timestamp=timestamp)
        self._tickers.add(ticker)

    def get(self, ticker: str) -> PriceEntry | None:
        return self._prices.get(ticker)

    def get_all(self) -> dict[str, PriceEntry]:
        return dict(self._prices)

    def add_ticker(self, ticker: str):
        self._tickers.add(ticker)

    def remove_ticker(self, ticker: str):
        self._tickers.discard(ticker)
        self._prices.pop(ticker, None)

    @property
    def tickers(self) -> set[str]:
        return set(self._tickers)


# Singleton instance used across the application
price_cache = PriceCache()
