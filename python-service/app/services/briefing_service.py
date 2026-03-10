import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.briefing import Briefing, BriefingMetric, BriefingPoint
from app.schemas.briefing import BriefingCreate


def create_briefing(db: Session, payload: BriefingCreate) -> Briefing:
    briefing = Briefing(
        company_name=payload.company_name.strip(),
        ticker=payload.ticker,
        sector=payload.sector.strip() if payload.sector else None,
        analyst_name=payload.analyst_name.strip() if payload.analyst_name else None,
        summary=payload.summary.strip(),
        recommendation=payload.recommendation.strip(),
    )
    db.add(briefing)
    db.flush()  # obtain briefing.id without committing

    for order, text in enumerate(payload.key_points):
        db.add(
            BriefingPoint(
                briefing_id=briefing.id,
                type="key_point",
                content=text,
                display_order=order,
            )
        )

    for order, text in enumerate(payload.risks):
        db.add(
            BriefingPoint(
                briefing_id=briefing.id, type="risk", content=text, display_order=order
            )
        )

    for metric in payload.metrics:
        db.add(
            BriefingMetric(
                briefing_id=briefing.id, name=metric.name, value=metric.value
            )
        )

    db.commit()
    db.refresh(briefing)
    return briefing


def get_briefing(db: Session, briefing_id: uuid.UUID) -> Briefing | None:
    query = (
        select(Briefing)
        .where(Briefing.id == briefing_id)
        .options(selectinload(Briefing.points), selectinload(Briefing.metrics))
    )
    return db.scalars(query).first()


def list_briefings(db: Session) -> list[Briefing]:
    query = (
        select(Briefing)
        .options(selectinload(Briefing.points), selectinload(Briefing.metrics))
        .order_by(Briefing.created_at.desc())
    )
    return list(db.scalars(query).all())


def mark_generated(db: Session, briefing: Briefing) -> Briefing:
    briefing.is_generated = True
    briefing.generated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(briefing)
    return briefing
