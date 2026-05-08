"""
Rolling summary: when history exceeds the token threshold, compress old messages
into a summary using Claude Haiku to preserve the context window.
"""
from __future__ import annotations
import anthropic
from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)

_HAIKU_MODEL = "claude-haiku-4-5-20251001"
_SUMMARIZE_PROMPT = """\
You are summarizing a conversation to preserve context for an AI assistant.
Write a concise but complete summary of the conversation history below.
Preserve key facts, decisions, and any tool results that may be relevant going forward.
Output only the summary — no preamble.

Conversation history:
{history}
"""


async def maybe_summarize(
    conversation,
    messages: list[dict],
    existing_summary: str | None,
) -> str | None:
    """
    Returns a new rolling summary if the message history exceeds the token threshold,
    otherwise returns None (no update needed).
    """
    settings = get_settings()
    if settings.mock_providers:
        return None

    from app.orchestrator.history import estimate_tokens
    token_count = estimate_tokens(messages)
    if token_count < settings.rolling_summary_token_threshold:
        return None

    log.info("summarizing_history", estimated_tokens=token_count)

    history_text = "\n".join(
        f"{m['role'].upper()}: {m['content']}"
        for m in messages
        if isinstance(m.get("content"), str)
    )
    if existing_summary:
        history_text = f"[Previous summary]\n{existing_summary}\n\n[New messages]\n{history_text}"

    prompt = _SUMMARIZE_PROMPT.format(history=history_text)

    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await client.messages.create(
            model=_HAIKU_MODEL,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        summary = response.content[0].text
        log.info("summary_created", length=len(summary))
        return summary
    except Exception as exc:
        log.error("summarization_failed", error=str(exc))
        return None
