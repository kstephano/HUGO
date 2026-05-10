"""Shared Pydantic base config and common response types."""
from pydantic import BaseModel, ConfigDict, alias_generators


class CamelModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        alias_generator=alias_generators.to_camel,
    )


class HealthResponse(CamelModel):
    status: str
    version: str
