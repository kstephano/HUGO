"""
Hybrid RAG retriever: parallel vector (pgvector cosine) + BM25 (tsvector GIN) search.
Results are min-max normalised per channel then merged with alpha weighting.
alpha=1.0 → pure vector; alpha=0.0 → pure BM25.
"""
from __future__ import annotations
import asyncio
from dataclasses import dataclass
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logging import get_logger
from app.embeddings.provider import EmbeddingProvider

log = get_logger(__name__)

DEFAULT_ALPHA = 0.7
DEFAULT_TOP_K = 6


@dataclass
class RetrievedChunk:
    chunk_id: str
    document_id: str
    content: str
    score: float


async def retrieve(
    db: AsyncSession,
    embed: EmbeddingProvider,
    query: str,
    *,
    top_k: int = DEFAULT_TOP_K,
    alpha: float = DEFAULT_ALPHA,
) -> list[RetrievedChunk]:
    vec_task = asyncio.create_task(_vector_search(db, embed, query, top_k * 2))
    bm25_task = asyncio.create_task(_bm25_search(db, query, top_k * 2))
    vec_results, bm25_results = await asyncio.gather(vec_task, bm25_task)

    scores: dict[str, dict] = {}
    for row in vec_results:
        scores[row["chunk_id"]] = {"content": row["content"], "doc_id": row["doc_id"], "vec": row["score"], "bm25": 0.0}
    for row in bm25_results:
        cid = row["chunk_id"]
        if cid in scores:
            scores[cid]["bm25"] = row["score"]
        else:
            scores[cid] = {"content": row["content"], "doc_id": row["doc_id"], "vec": 0.0, "bm25": row["score"]}

    def norm(vals: list[float]) -> list[float]:
        lo, hi = min(vals, default=0.0), max(vals, default=1.0)
        if hi == lo:
            return [1.0] * len(vals)
        return [(v - lo) / (hi - lo) for v in vals]

    ids = list(scores.keys())
    vec_scores = norm([scores[i]["vec"] for i in ids])
    bm25_scores = norm([scores[i]["bm25"] for i in ids])

    results = []
    for i, cid in enumerate(ids):
        combined = alpha * vec_scores[i] + (1 - alpha) * bm25_scores[i]
        results.append(RetrievedChunk(
            chunk_id=cid,
            document_id=scores[cid]["doc_id"],
            content=scores[cid]["content"],
            score=combined,
        ))

    results.sort(key=lambda r: r.score, reverse=True)
    return results[:top_k]


async def _vector_search(db: AsyncSession, embed: EmbeddingProvider, query: str, k: int) -> list[dict]:
    q_vec = await embed.embed_query(query)
    q_str = "[" + ",".join(str(v) for v in q_vec) + "]"
    sql = text("""
        SELECT c.id AS chunk_id, c.document_id AS doc_id, c.content,
               1 - (c.embedding <=> :vec::vector) AS score
        FROM chunks c
        WHERE c.embedding IS NOT NULL
        ORDER BY c.embedding <=> :vec::vector
        LIMIT :k
    """)
    result = await db.execute(sql, {"vec": q_str, "k": k})
    return [{"chunk_id": r.chunk_id, "doc_id": r.doc_id, "content": r.content, "score": float(r.score)} for r in result]


async def _bm25_search(db: AsyncSession, query: str, k: int) -> list[dict]:
    sql = text("""
        SELECT c.id AS chunk_id, c.document_id AS doc_id, c.content,
               ts_rank_cd(to_tsvector('english', c.content), plainto_tsquery('english', :q)) AS score
        FROM chunks c
        WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', :q)
        ORDER BY score DESC
        LIMIT :k
    """)
    result = await db.execute(sql, {"q": query, "k": k})
    return [{"chunk_id": r.chunk_id, "doc_id": r.doc_id, "content": r.content, "score": float(r.score)} for r in result]


async def ingest(
    db: AsyncSession,
    embed: EmbeddingProvider,
    document_id: str,
    chunks: list[str],
) -> None:
    """TODO: Implement document ingestion — chunk, embed, and upsert into the chunks table."""
    raise NotImplementedError("RAG ingestion not yet implemented")
