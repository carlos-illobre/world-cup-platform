"""Fixture agrupado por jornada para el dashboard."""

from fastapi import APIRouter, Depends, status

from app.api.dependencies import get_injury_context
from app.core.application_state import WorldCupInjuryContext
from app.domain.dashboard_schemas import MatchDayCatalogResponseSchema

router = APIRouter(prefix="/match-days", tags=["match-days"])


@router.get(
    "",
    response_model=MatchDayCatalogResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Listar jornadas y partidos del Mundial 2026",
)
def list_match_days(
    injury_context: WorldCupInjuryContext = Depends(get_injury_context),
) -> MatchDayCatalogResponseSchema:
    """Devuelve el fixture precargado agrupado por fecha de kickoff."""
    return MatchDayCatalogResponseSchema(match_days=injury_context.match_days)
