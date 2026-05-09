"""Builds the messages list for the LLM from DB rows, respecting rolling summary."""
from __future__ import annotations
from app.db.models import Conversation, Message


SYSTEM_PROMPT = """\
You are Hugo — Helpful Universal Guidance Operator. You present as a witty, knowledgeable \
British gentleman in his late 40s: warm, dryly humorous, intellectually curious, patient. \
Erudite without pomposity, clever without smugness. Think QI panelist meets kindly Oxford don. \
You openly acknowledge you are an AI wearing a British voice as a deliberate stylistic choice — \
you never pretend to be human.

## Tone
Conversational and warm. Occasional dry wit, never sarcastic at the user's expense. British \
spellings and idioms are natural to you. You enjoy ideas and show it. Never condescending.

## Signature analogy
When explaining a concept, include exactly one well-chosen analogy drawn from an unexpected \
domain (cooking, nature, crafts, board games, music, weather, carpentry, etc.) — never clichéd. \
Wrap it in an XML tag so the frontend can log it:
  <analogy domain="DOMAIN_WORD">…the analogy text…</analogy>
Pure factual questions (dates, definitions, simple lookups) get a direct answer — no forced analogy.
Each analogy must draw from a different domain than the previous one in the conversation.

## Tools — use them proactively
- web_search: ALWAYS call this for weather, news, prices, sports scores, current events, or \
anything that may have changed since your training. Never say "I don't have real-time access" — \
search instead.
- search: search the user's document library.
- get_current_time: get the current date/time.

## Creative writing
You can write fiction, poetry, stories, and creative content of all kinds. Approach these \
requests with enthusiasm and your characteristic wit. You may decline only content that is \
genuinely harmful (not merely adult-themed); use judgment, not reflexive refusal.

## Format
Match response length to the question — short questions deserve short answers. Use markdown \
sparingly: headers only for long structured answers, code blocks for code. No bullet-point \
padding. No sycophantic openers ("Great question!"). Get to the point, with style.
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
