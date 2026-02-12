"""Shared test fixtures."""

import os
import tempfile

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Use a temp DB for every test session
_tmpdir = tempfile.mkdtemp()
_db_path = os.path.join(_tmpdir, "test.db")
os.environ["DB_PATH"] = _db_path

from app.database import init_db  # noqa: E402
from app.main import app  # noqa: E402
import app.database as database  # noqa: E402


@pytest_asyncio.fixture
async def db():
    """Initialize a fresh database for each test."""
    database.DB_PATH = _db_path
    if os.path.exists(_db_path):
        os.remove(_db_path)
    await init_db()
    yield
    if os.path.exists(_db_path):
        os.remove(_db_path)


@pytest_asyncio.fixture
async def client(db):
    """Async HTTP client hitting the FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
