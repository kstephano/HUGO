"""
Document search tool: runs hybrid RAG retrieval and returns formatted context snippets.
Requires db and embed_provider to be passed in ctx by the orchestrator.
"""
from __future__ import annotations
from app.tools.base import Tool


class SearchTool(Tool):
    name = "search_documents"
    description = (
        "Search the knowledge base for relevant context. "
        "Use this when the user asks about specific topics or when factual grounding is needed."
    )
    input_schema = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Natural language search query"},
            "top_k": {"type": "integer", "description": "Number of results to return (default 6)", "default": 6},
        },
        "required": ["query"],
    }

    async def run(self, tool_input: dict, **ctx) -> str:
        from app.rag.retriever import retrieve
        db = ctx.get("db")
        embed = ctx.get("embed_provider")
        if db is None or embed is None:
            return "Search unavailable: missing context"

        query = tool_input["query"]
        top_k = int(tool_input.get("top_k", 6))
        chunks = await retrieve(db, embed, query, top_k=top_k)

        if not chunks:
            return "No relevant documents found."

        lines = []
        for i, chunk in enumerate(chunks, 1):
            lines.append(f"[{i}] (score={chunk.score:.3f}) {chunk.content[:500]}")
        return "\n\n".join(lines)
