"""
Brave Search web search tool.
Calls the Brave Search API and returns the top results as formatted text.
Requires BRAVE_SEARCH_API_KEY in the environment.
"""
from __future__ import annotations
import httpx
from app.core.config import get_settings
from app.tools.base import Tool

_BRAVE_URL = "https://api.search.brave.com/res/v1/web/search"
_TIMEOUT = 10.0


class WebSearchTool(Tool):
    name = "web_search"
    description = (
        "Search the web for current information. Use this for real-time data such as "
        "news, weather, prices, events, or anything that requires up-to-date facts."
    )
    input_schema = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query",
            },
            "count": {
                "type": "integer",
                "description": "Number of results to return (1–10, default 5)",
                "default": 5,
            },
        },
        "required": ["query"],
    }

    async def run(self, tool_input: dict, **ctx) -> str:
        settings = get_settings()
        api_key = settings.brave_search_api_key
        if not api_key:
            return "Web search unavailable: BRAVE_SEARCH_API_KEY is not configured."

        query = tool_input["query"]
        count = min(int(tool_input.get("count", 5)), 10)

        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                _BRAVE_URL,
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip",
                    "X-Subscription-Token": api_key,
                },
                params={"q": query, "count": count},
            )
            resp.raise_for_status()
            data = resp.json()

        results = data.get("web", {}).get("results", [])
        if not results:
            return f"No results found for: {query}"

        lines = []
        for i, r in enumerate(results, 1):
            title = r.get("title", "")
            url = r.get("url", "")
            description = r.get("description", "")
            lines.append(f"[{i}] {title}\n    {url}\n    {description}")

        return f"Search results for '{query}':\n\n" + "\n\n".join(lines)
