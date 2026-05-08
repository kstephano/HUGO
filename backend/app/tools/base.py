"""
Tool base class: 10KB output cap, requires_lock support, CancelledError-aware.
Subclass Tool and implement run(). Register via ToolRegistry.
"""
from __future__ import annotations
import asyncio
from abc import ABC, abstractmethod
from typing import Any

MAX_OUTPUT_BYTES = 10 * 1024  # 10KB


class Tool(ABC):
    name: str
    description: str
    input_schema: dict  # JSON Schema for the input parameters
    requires_lock: bool = False

    def lock_key(self, tool_input: dict) -> str:
        """Override to return a unique key for distributed locking; default is tool name."""
        return self.name

    @abstractmethod
    async def run(self, tool_input: dict, **ctx) -> str:
        """Execute the tool and return a string result."""

    async def __call__(self, tool_input: dict, **ctx) -> str:
        try:
            result = await self.run(tool_input, **ctx)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            result = f"ERROR: {type(exc).__name__}: {exc}"

        # Truncate to 10KB
        encoded = result.encode("utf-8")
        if len(encoded) > MAX_OUTPUT_BYTES:
            result = encoded[:MAX_OUTPUT_BYTES].decode("utf-8", errors="replace") + "\n[truncated]"
        return result

    def anthropic_schema(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema,
        }
