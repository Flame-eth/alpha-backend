import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.briefing import (
    BriefingCreate,
    BriefingGenerateResponse,
    BriefingListResponse,
    BriefingRead,
)
from app.services.briefing_service import (
    create_briefing,
    get_briefing,
    list_briefings,
    mark_generated,
)
from app.services.report_formatter import ReportFormatter

router = APIRouter(prefix="/briefings", tags=["briefings"])

_formatter = ReportFormatter()


@router.post(
    "",
    response_model=BriefingRead,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def create_briefing_endpoint(
    payload: BriefingCreate,
    db: Annotated[Session, Depends(get_db)],
) -> BriefingRead:
    briefing = create_briefing(db, payload)
    # Reload with relationships for the response
    briefing = get_briefing(db, briefing.id)
    if briefing is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Briefing was created but could not be retrieved.",
        )
    return BriefingRead.from_orm_briefing(briefing)


@router.get(
    "",
    response_model=BriefingListResponse,
    response_model_by_alias=True,
)
def list_briefings_endpoint(
    db: Annotated[Session, Depends(get_db)],
) -> BriefingListResponse:
    briefings = list_briefings(db)
    items = [BriefingRead.from_orm_briefing(b) for b in briefings]
    return BriefingListResponse(total=len(items), items=items)


@router.get(
    "/{briefing_id}",
    response_model=BriefingRead,
    response_model_by_alias=True,
)
def get_briefing_endpoint(
    briefing_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
) -> BriefingRead:
    briefing = get_briefing(db, briefing_id)
    if briefing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Briefing not found."
        )
    return BriefingRead.from_orm_briefing(briefing)


@router.post(
    "/{briefing_id}/generate",
    response_model=BriefingGenerateResponse,
    response_model_by_alias=True,
)
def generate_briefing_endpoint(
    briefing_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
) -> BriefingGenerateResponse:
    briefing = get_briefing(db, briefing_id)
    if briefing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Briefing not found."
        )
    briefing = mark_generated(db, briefing)
    return BriefingGenerateResponse(
        id=briefing.id,
        generated=briefing.is_generated,
        generated_at=briefing.generated_at.isoformat() if briefing.generated_at else "",
    )


@router.get("/{briefing_id}/html", response_class=HTMLResponse)
def get_briefing_html_endpoint(
    briefing_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
) -> HTMLResponse:
    briefing = get_briefing(db, briefing_id)
    if briefing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Briefing not found."
        )
    if not briefing.is_generated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report has not been generated yet. POST to /briefings/{id}/generate first.",
        )
    html = _formatter.render_report(briefing)
    return HTMLResponse(content=html, status_code=status.HTTP_200_OK)
