"""Tests for the in-memory price cache."""

from app.market.cache import PriceCache


def test_update_and_get():
    cache = PriceCache()
    cache.update("AAPL", 150.0)
    entry = cache.get("AAPL")
    assert entry is not None
    assert entry.price == 150.0


def test_first_update_sets_previous_price_to_current():
    cache = PriceCache()
    cache.update("AAPL", 150.0)
    entry = cache.get("AAPL")
    assert entry.previous_price == 150.0


def test_subsequent_update_tracks_previous_price():
    cache = PriceCache()
    cache.update("AAPL", 150.0)
    cache.update("AAPL", 155.0)
    entry = cache.get("AAPL")
    assert entry.price == 155.0
    assert entry.previous_price == 150.0


def test_get_nonexistent_returns_none():
    cache = PriceCache()
    assert cache.get("ZZZZZ") is None


def test_get_all_returns_list():
    cache = PriceCache()
    cache.update("AAPL", 150.0)
    all_prices = cache.get_all()
    assert len(all_prices) == 1
    assert all_prices[0].ticker == "AAPL"


def test_update_stores_timestamp():
    cache = PriceCache()
    cache.update("AAPL", 150.0)
    entry = cache.get("AAPL")
    assert entry.timestamp is not None
    assert len(entry.timestamp) > 0
