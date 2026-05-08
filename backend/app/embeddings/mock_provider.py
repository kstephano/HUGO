"""Deterministic mock embeddings: hash-derived floats, no external calls."""
from __future__ import annotations
import hashlib
import struct
from app.core.config import get_settings


class MockEmbeddingProvider:
    def __init__(self) -> None:
        self._dim = get_settings().embedding_dim

    def _hash_embed(self, text: str) -> list[float]:
        seed = text.encode("utf-8")
        result = []
        i = 0
        while len(result) < self._dim:
            block = hashlib.sha256(seed + i.to_bytes(4, "little")).digest()
            for j in range(0, len(block) - 3, 4):
                val = struct.unpack_from("<f", block, j)[0]
                if not (val != val):  # filter NaN
                    result.append(float(val))
        # Normalise to unit sphere
        mag = sum(v * v for v in result[:self._dim]) ** 0.5 or 1.0
        return [v / mag for v in result[:self._dim]]

    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._hash_embed(t) for t in texts]

    async def embed_query(self, text: str) -> list[float]:
        return self._hash_embed(text)
