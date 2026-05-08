"""Auth endpoint tests."""
import pytest
from unittest.mock import AsyncMock


@pytest.mark.asyncio
async def test_dev_login_creates_user(client, mock_redis):
    mock_redis.setex = AsyncMock(return_value=True)
    resp = await client.post("/api/auth/dev-login", json={"email": "alice@test.com", "display_name": "Alice"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "alice@test.com"
    assert "user_id" in data
    assert "session_token" in resp.cookies


@pytest.mark.asyncio
async def test_dev_login_idempotent(client, mock_redis):
    mock_redis.setex = AsyncMock(return_value=True)
    r1 = await client.post("/api/auth/dev-login", json={"email": "bob@test.com", "display_name": "Bob"})
    r2 = await client.post("/api/auth/dev-login", json={"email": "bob@test.com", "display_name": "Bob"})
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["user_id"] == r2.json()["user_id"]


@pytest.mark.asyncio
async def test_me_requires_auth(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_user(authed_client):
    c, user = authed_client
    resp = await c.get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.json()["email"] == user.email
