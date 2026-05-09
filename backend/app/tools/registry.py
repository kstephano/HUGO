"""ToolRegistry: maps tool names to Tool instances and returns Anthropic-compatible schemas."""
from __future__ import annotations
from app.tools.base import Tool


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def schemas(self) -> list[dict]:
        return [t.anthropic_schema() for t in self._tools.values()]

    def __contains__(self, name: str) -> bool:
        return name in self._tools


def build_default_registry() -> ToolRegistry:
    from app.tools.time_tool import TimeTool
    from app.tools.search_tool import SearchTool
    from app.tools.web_search_tool import WebSearchTool
    registry = ToolRegistry()
    registry.register(TimeTool())
    registry.register(SearchTool())
    registry.register(WebSearchTool())
    return registry
