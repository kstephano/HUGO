"""Builds the messages list for the LLM from DB rows, respecting rolling summary."""
from __future__ import annotations
from app.db.models import Conversation, Message


SYSTEM_PROMPT = """\
You are Hugo, a helpful and thoughtful AI assistant.
You have access to tools to search documents and retrieve information.
Think carefully before responding. Be concise, accurate, and honest.
If you don't know something, say so — do not fabricate information.
"""


def build_messages(conversation: Conversation) -> list[dict]:
    """Converts DB message rows to the Anthropic messages format."""
    messages = []

    if conversation.rolling_summary:
        messages.append({
            "role": "user",
            "content": f"[Conversation summary up to this point]\n{conversation.rolling_summary}",
        })
        messages.append({"role": "assistant", "content": "Understood. I'll continue from where we left off."})

    for msg in conversation.messages:
        if msg.status not in ("completed", "cancelled"):
            continue
        role = msg.role
        content = msg.content

        if role == "tool":
            # Tool results are injected inline as part of the assistant/user turn pattern
            continue

        if content is None:
            continue

        if isinstance(content, str):
            messages.append({"role": role, "content": content})
        elif isinstance(content, list):
            messages.append({"role": role, "content": content})
        elif isinstance(content, dict):
            messages.append({"role": role, "content": content})

    return messages


def estimate_tokens(messages: list[dict]) -> int:
    """Rough token estimate: 4 chars per token."""
    total = sum(len(str(m.get("content", ""))) for m in messages)
    return total // 4
