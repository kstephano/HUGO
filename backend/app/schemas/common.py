"""Shared Pydantic base config and common response types."""
from pydantic import BaseModel, ConfigDict


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class HealthResponse(CamelModel):
    status: str
    version: str
