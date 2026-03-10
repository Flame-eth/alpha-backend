import uuid
from datetime import datetime
from typing import Annotated

from annotated_types import Len, MaxLen, MinLen
from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from pydantic.alias_generators import to_camel

from app.models.briefing import Briefing


class MetricInput(BaseModel):
    name: Annotated[str, MinLen(1), MaxLen(255)]
    value: Annotated[str, MinLen(1), MaxLen(255)]


class BriefingCreate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    company_name: Annotated[str, MinLen(1), MaxLen(255)]
    ticker: Annotated[str, MinLen(1), MaxLen(20)]
    sector: Annotated[str | None, MaxLen(255)] = None
    analyst_name: Annotated[str | None, MaxLen(255)] = None
    summary: Annotated[str, MinLen(1)]
    recommendation: Annotated[str, MinLen(1)]
    key_points: Annotated[list[str], Len(2, None)]
    risks: Annotated[list[str], MinLen(1)]
    metrics: list[MetricInput] = []

    @field_validator("ticker", mode="before")
    @classmethod
    def normalize_ticker(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("key_points", "risks", mode="before")
    @classmethod
    def strip_items(cls, v: list[str]) -> list[str]:
        return [item.strip() for item in v]

    @model_validator(mode="after")
    def validate_unique_metric_names(self) -> "BriefingCreate":
        names = [m.name.lower() for m in self.metrics]
        if len(names) != len(set(names)):
            raise ValueError("Metric names must be unique within the same briefing.")
        return self


class MetricRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    value: str


class BriefingRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True, alias_generator=to_camel, populate_by_name=True
    )

    id: uuid.UUID
    company_name: str
    ticker: str
    sector: str | None
    analyst_name: str | None
    summary: str
    recommendation: str
    is_generated: bool
    generated_at: datetime | None
    created_at: datetime
    key_points: list[str] = []
    risks: list[str] = []
    metrics: list[MetricRead] = []

    @classmethod
    def from_orm_briefing(cls, briefing: Briefing) -> "BriefingRead":
        """Build a BriefingRead from a Briefing ORM instance, de-normalising points."""

        key_points = [
            p.content
            for p in sorted(briefing.points, key=lambda x: x.display_order)
            if p.type == "key_point"
        ]
        risks = [
            p.content
            for p in sorted(briefing.points, key=lambda x: x.display_order)
            if p.type == "risk"
        ]
        return cls.model_validate(
            {
                "id": briefing.id,
                "company_name": briefing.company_name,
                "ticker": briefing.ticker,
                "sector": briefing.sector,
                "analyst_name": briefing.analyst_name,
                "summary": briefing.summary,
                "recommendation": briefing.recommendation,
                "is_generated": briefing.is_generated,
                "generated_at": briefing.generated_at,
                "created_at": briefing.created_at,
                "key_points": key_points,
                "risks": risks,
                "metrics": briefing.metrics,
            }
        )


class BriefingGenerateResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: uuid.UUID
    generated: bool
    generated_at: str


class BriefingListResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    total: int
    items: list[BriefingRead]
