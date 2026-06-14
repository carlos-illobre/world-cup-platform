"""Catálogo de jugadores para el dashboard."""

from fastapi import APIRouter, Depends, status

from app.api.dependencies import get_injury_context
from app.datascience.model_context import TrainedModelContext
from app.domain.dashboard_schemas import PlayerCatalogResponseSchema
from app.services.dashboard_catalog_service import DashboardCatalogService

router = APIRouter(prefix="/players", tags=["players"])


@router.get(
    "",
    response_model=PlayerCatalogResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Listar jugadores disponibles para análisis",
)
def list_players(
    context: TrainedModelContext = Depends(get_injury_context),
) -> PlayerCatalogResponseSchema:
    """Devuelve jugadores FIFA con perfil biomédico mapeado en el pipeline."""
    catalog = DashboardCatalogService(
        fixture_dataframe=context.fixture_dataframe,
        combined_dataframe=context.combined_player_sensor_matrix,
        players_dataframe=context.players_dataframe,
        nationality_to_fifa=context.nationality_to_fifa_code,
    )
    return PlayerCatalogResponseSchema(players=catalog.build_player_options())
