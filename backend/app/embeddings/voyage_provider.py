"""Voyage AI embedding provider — fails open on errors (returns zeros)."""
from __future__ import annotations
import voyageai
from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)


class VoyageProvider:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = voyageai.AsyncClient(api_key=settings.voyage_api_key)
        self._model = settings.voyage_model
        self._dim = settings.embedding_dim

    def _zeros(self, n: int) -> list[list[float]]:
        return [[0.0] * self._dim for _ in range(n)]

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        try:
            result = await self._client.embed(texts, model=self._model)
            return result.embeddings
        except Exception as exc:
            log.error("voyage_embed_error", error=str(exc))
            return self._zeros(len(texts))

    async def embed_query(self, text: str) -> list[float]:
        result = await self.embed([text])
        return result[0]
