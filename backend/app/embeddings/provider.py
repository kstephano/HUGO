"""EmbeddingProvider protocol — swap Voyage for OpenAI/Cohere without touching callers."""
from __future__ import annotations
from typing import Protocol, runtime_checkable


@runtime_checkable
class EmbeddingProvider(Protocol):
    async def embed(self, texts: list[str]) -> list[list[float]]: ...
    async def embed_query(self, text: str) -> list[float]: ...
