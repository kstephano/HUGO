"""Returns the current UTC time — simplest possible tool, useful for smoke-testing the loop."""
from __future__ import annotations
from datetime import datetime, timezone
from app.tools.base import Tool


class TimeTool(Tool):
    name = "get_current_time"
    description = "Returns the current UTC date and time."
    input_schema = {"type": "object", "properties": {}, "required": []}

    async def run(self, tool_input: dict, **ctx) -> str:
        return datetime.now(timezone.utc).isoformat()
