"""
Endpoints REST v3: catálogo de jugadores del Mundial 2026.
"""

from fastapi import APIRouter, Depends, status

from app.api.dependencies import get_injury_context
from app.datascience.model_context import TrainedModelContext
from app.domain.dashboard_schemas import PlayerCatalogResponseSchema
from app.services.dashboard_catalog_service import DashboardCatalogService

router = APIRouter(prefix="/jugadores", tags=["jugadores-v3"])


def _build_catalog_service(context: TrainedModelContext) -> DashboardCatalogService:
    return DashboardCatalogService(
        fixture_dataframe=context.fixture_dataframe,
        combined_dataframe=context.combined_player_sensor_matrix,
        players_dataframe=context.players_dataframe,
        nationality_to_fifa=context.nationality_to_fifa_code,
    )


@router.get(
    "",
    response_model=PlayerCatalogResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Listar jugadores disponibles para análisis de riesgo",
)
def listar_jugadores(
    context: TrainedModelContext = Depends(get_injury_context),
) -> PlayerCatalogResponseSchema:
    """
    Devuelve todos los jugadores FIFA que tienen perfil biomédico
    mapeado en el pipeline de ciencia de datos.
    """
    catalog = _build_catalog_service(context)
    return PlayerCatalogResponseSchema(players=catalog.build_player_options())
