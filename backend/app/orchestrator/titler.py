"""Generate a short conversation title using Claude Haiku."""
from __future__ import annotations
import anthropic
from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)

_HAIKU_MODEL = "claude-haiku-4-5-20251001"
_TITLE_PROMPT = """\
Generate a concise 2-4 word title for a conversation that starts with this message.
Return ONLY the title — no punctuation, no quotes, no explanation.

Message: {content}"""


async def generate_title(user_content: str) -> str:
    settings = get_settings()
    if settings.mock_providers:
        words = user_content.split()
        return " ".join(words[:4]) + ("…" if len(words) > 4 else "")

    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await client.messages.create(
            model=_HAIKU_MODEL,
            max_tokens=20,
            messages=[{"role": "user", "content": _TITLE_PROMPT.format(content=user_content[:500])}],
        )
        title = response.content[0].text.strip().strip('"').strip("'")
        log.info("title_generated", title=title)
        return title or "New conversation"
    except Exception as exc:
        log.error("title_generation_failed", error=str(exc))
        words = user_content.split()
        return " ".join(words[:4]) + ("…" if len(words) > 4 else "")
