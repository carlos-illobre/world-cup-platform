"""Fixture agrupado por jornada para el dashboard."""

from fastapi import APIRouter, Depends, status

from app.api.dependencies import get_injury_context
from app.datascience.model_context import TrainedModelContext
from app.domain.dashboard_schemas import MatchDayCatalogResponseSchema
from app.services.dashboard_catalog_service import DashboardCatalogService

router = APIRouter(prefix="/match-days", tags=["match-days"])


@router.get(
    "",
    response_model=MatchDayCatalogResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Listar jornadas y partidos del Mundial 2026",
)
def list_match_days(
    context: TrainedModelContext = Depends(get_injury_context),
) -> MatchDayCatalogResponseSchema:
    """Devuelve el fixture precargado agrupado por fecha de kickoff."""
    catalog = DashboardCatalogService(
        fixture_dataframe=context.fixture_dataframe,
        combined_dataframe=context.combined_player_sensor_matrix,
        players_dataframe=context.players_dataframe,
        nationality_to_fifa=context.nationality_to_fifa_code,
    )
    return MatchDayCatalogResponseSchema(match_days=catalog.build_match_days())
