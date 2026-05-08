"""Conversation CRUD tests."""
import pytest


@pytest.mark.asyncio
async def test_create_conversation(authed_client):
    c, user = authed_client
    resp = await c.post("/api/conversations", json={"title": "Test Chat"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Test Chat"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_conversations(authed_client):
    c, user = authed_client
    await c.post("/api/conversations", json={"title": "Chat 1"})
    await c.post("/api/conversations", json={"title": "Chat 2"})
    resp = await c.get("/api/conversations")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 2


@pytest.mark.asyncio
async def test_delete_conversation(authed_client):
    c, user = authed_client
    create_resp = await c.post("/api/conversations", json={"title": "To Delete"})
    conv_id = create_resp.json()["id"]
    del_resp = await c.delete(f"/api/conversations/{conv_id}")
    assert del_resp.status_code == 204
    get_resp = await c.get(f"/api/conversations/{conv_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_list_messages_empty(authed_client):
    c, user = authed_client
    create_resp = await c.post("/api/conversations", json={"title": "Empty"})
    conv_id = create_resp.json()["id"]
    resp = await c.get(f"/api/conversations/{conv_id}/messages")
    assert resp.status_code == 200
    assert resp.json()["total"] == 0
