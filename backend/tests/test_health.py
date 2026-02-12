"""Tests for /api/health endpoint."""

import pytest


@pytest.mark.asyncio
async def test_health_returns_ok(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_health_method_not_allowed(client):
    resp = await client.post("/api/health")
    assert resp.status_code == 405
