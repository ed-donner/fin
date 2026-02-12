"""Tests for the GBM market data simulator."""

import math

import numpy as np
import pytest

from app.market.simulator import (
    TICKER_CONFIG,
    TECH_TICKERS,
    FINANCE_TICKERS,
    _build_correlation_matrix,
    Simulator,
)


def test_ticker_config_has_required_fields():
    for ticker, cfg in TICKER_CONFIG.items():
        assert "seed" in cfg, f"{ticker} missing seed"
        assert "drift" in cfg, f"{ticker} missing drift"
        assert "vol" in cfg, f"{ticker} missing vol"
        assert cfg["seed"] > 0, f"{ticker} seed must be positive"
        assert cfg["vol"] > 0, f"{ticker} volatility must be positive"


def test_correlation_matrix_is_symmetric():
    tickers = list(TICKER_CONFIG.keys())
    corr = _build_correlation_matrix(tickers)
    np.testing.assert_array_almost_equal(corr, corr.T)


def test_correlation_matrix_has_ones_on_diagonal():
    tickers = list(TICKER_CONFIG.keys())
    corr = _build_correlation_matrix(tickers)
    np.testing.assert_array_almost_equal(np.diag(corr), np.ones(len(tickers)))


def test_correlation_matrix_tech_cluster():
    tickers = list(TICKER_CONFIG.keys())
    corr = _build_correlation_matrix(tickers)
    # Find two tech tickers
    i = tickers.index("AAPL")
    j = tickers.index("GOOGL")
    assert corr[i, j] == 0.6


def test_correlation_matrix_finance_cluster():
    tickers = list(TICKER_CONFIG.keys())
    corr = _build_correlation_matrix(tickers)
    i = tickers.index("JPM")
    j = tickers.index("V")
    assert corr[i, j] == 0.5


def test_correlation_matrix_cross_sector():
    tickers = list(TICKER_CONFIG.keys())
    corr = _build_correlation_matrix(tickers)
    i = tickers.index("AAPL")
    j = tickers.index("JPM")
    assert corr[i, j] == 0.2


def test_correlation_matrix_is_positive_definite():
    """A valid correlation matrix must be positive definite for Cholesky."""
    tickers = list(TICKER_CONFIG.keys())
    corr = _build_correlation_matrix(tickers)
    # Cholesky will raise if not positive definite
    np.linalg.cholesky(corr)


def test_simulator_initializes_with_seed_prices():
    sim = Simulator()
    for ticker, cfg in TICKER_CONFIG.items():
        assert sim._prices[ticker] == cfg["seed"]


def test_simulator_step_produces_valid_prices():
    sim = Simulator()
    sim._step()
    for ticker in TICKER_CONFIG:
        assert sim._prices[ticker] >= 0.01, f"{ticker} price below floor"


def test_simulator_step_changes_prices():
    """After stepping, at least some prices should have changed."""
    sim = Simulator()
    before = dict(sim._prices)
    sim._step()
    changed = sum(1 for t in TICKER_CONFIG if sim._prices[t] != before[t])
    assert changed > 0, "No prices changed after step"


def test_simulator_price_floor():
    """Prices should never go below 0.01."""
    sim = Simulator()
    # Force very low prices
    for ticker in sim._prices:
        sim._prices[ticker] = 0.02
    sim._step()
    for ticker in sim._prices:
        assert sim._prices[ticker] >= 0.01
