"""Catálogo de jugadores para el dashboard."""

from fastapi import APIRouter, Depends, status

from app.api.dependencies import get_injury_context
from app.core.application_state import WorldCupInjuryContext
from app.domain.dashboard_schemas import PlayerCatalogResponseSchema

router = APIRouter(prefix="/players", tags=["players"])


@router.get(
    "",
    response_model=PlayerCatalogResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Listar jugadores disponibles para análisis",
)
def list_players(
    injury_context: WorldCupInjuryContext = Depends(get_injury_context),
) -> PlayerCatalogResponseSchema:
    """Devuelve jugadores FIFA con perfil biomédico mapeado en el pipeline."""
    return PlayerCatalogResponseSchema(players=injury_context.player_options)
