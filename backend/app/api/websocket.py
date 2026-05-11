"""
WebSocket endpoint — handles the per-connection agent loop lifecycle.

Protocol:
  1. Client connects and sends {"type":"handshake","conversation_id":"..."}
  2. Auth is validated via HTTP-only session cookie on upgrade
  3. Client sends {"type":"message","content":"...","client_message_id":"..."}
  4. Server streams delta/thinking/tool_start/tool_result/done frames
  5. Client may send {"type":"cancel"} at any point to abort
"""
from __future__ import annotations
import json
import anthropic
from fastapi import APIRouter, Cookie, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.cancel_bus import publish_cancel
from app.core.config import get_settings
from app.core.dependencies import get_db, get_redis_dep
from app.core.idempotency import is_duplicate
from app.core.logging import get_logger
from app.core.rate_limit import check_rate_limit
from app.orchestrator.loop import run_loop
from app.schemas.websocket import WsError, WsRateLimited

log = get_logger(__name__)
router = APIRouter(tags=["websocket"])

_PROVIDERS: dict = {}


def _get_providers():
    if _PROVIDERS:
        return _PROVIDERS
    settings = get_settings()
    if settings.mock_providers:
        from app.llm.mock_provider import MockLLMProvider
        from app.embeddings.mock_provider import MockEmbeddingProvider
        _PROVIDERS["llm"] = MockLLMProvider()
        _PROVIDERS["embed"] = MockEmbeddingProvider()
    else:
        from app.llm.anthropic_provider import AnthropicProvider
        from app.embeddings.voyage_provider import VoyageProvider
        _PROVIDERS["llm"] = AnthropicProvider()
        _PROVIDERS["embed"] = VoyageProvider()
    from app.tools.registry import build_default_registry
    _PROVIDERS["registry"] = build_default_registry()
    return _PROVIDERS


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    session_token: str | None = Cookie(default=None),
    ticket: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis_dep),
):
    # Auth: try session cookie first, then one-time WS ticket
    user_id = None
    try:
        if session_token:
            user_id = await redis.get(f"session:{session_token}")
        if not user_id and ticket:
            user_id = await redis.get(f"ws_ticket:{ticket}")
            if user_id:
                await redis.delete(f"ws_ticket:{ticket}")
    except Exception:
        await websocket.close(code=4503, reason="Session store unavailable")
        return

    if not user_id:
        await websocket.close(code=4001, reason="Not authenticated")
        return

    await websocket.accept()
    log.info("ws_connected", user_id=user_id)

    providers = _get_providers()

    async def send(data: str) -> None:
        try:
            await websocket.send_text(data)
        except Exception:
            pass

    conversation_id: str | None = None

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                frame = json.loads(raw)
            except json.JSONDecodeError:
                await send(WsError(code="invalid_json", message="Invalid JSON").model_dump_json())
                continue

            ftype = frame.get("type")

            if ftype == "handshake":
                conversation_id = frame.get("conversation_id")
                if not conversation_id:
                    await send(WsError(code="missing_field", message="conversation_id required").model_dump_json())
                log.info("ws_handshake", conversation_id=conversation_id, user_id=user_id)

            elif ftype == "cancel":
                if conversation_id:
                    await publish_cancel(redis, conversation_id)

            elif ftype == "message":
                if not conversation_id:
                    await send(WsError(code="no_handshake", message="Send handshake first").model_dump_json())
                    continue

                content = frame.get("content", "").strip()
                client_message_id = frame.get("client_message_id", "")

                if not content:
                    await send(WsError(code="empty_message", message="Message content required").model_dump_json())
                    continue

                # Idempotency check
                if client_message_id and await is_duplicate(redis, client_message_id):
                    log.info("ws_duplicate_message", client_message_id=client_message_id)
                    continue

                # Rate limiting
                allowed = await check_rate_limit(redis, user_id)
                if not allowed:
                    await send(WsRateLimited().model_dump_json())
                    continue

                try:
                    await run_loop(
                        conversation_id=conversation_id,
                        user_id=user_id,
                        user_content=content,
                        client_message_id=client_message_id,
                        db=db,
                        redis_client=redis,
                        llm=providers["llm"],
                        embed_provider=providers["embed"],
                        registry=providers["registry"],
                        send=send,
                    )
                except anthropic.APIStatusError as exc:
                    log.error("ws_loop_error", error=str(exc), conversation_id=conversation_id)
                    error_type = (exc.body or {}).get("error", {}).get("type", "")
                    if error_type == "overloaded_error":
                        msg = "Claude is currently overloaded. Please try again in a moment."
                    else:
                        msg = "The AI service returned an error. Please try again."
                    await send(WsError(code="api_error", message=msg).model_dump_json())
                except Exception as exc:
                    log.error("ws_loop_error", error=str(exc), conversation_id=conversation_id)
                    await send(WsError(code="loop_error", message="Something went wrong. Please try again.").model_dump_json())

            else:
                await send(WsError(code="unknown_type", message=f"Unknown frame type: {ftype}").model_dump_json())

    except WebSocketDisconnect:
        log.info("ws_disconnected", user_id=user_id, conversation_id=conversation_id)
    except Exception as exc:
        log.error("ws_error", error=str(exc))
