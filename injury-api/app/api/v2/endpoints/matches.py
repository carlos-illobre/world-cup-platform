"""Endpoints REST v2: jugadores por partido e informe de preparación."""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import (
    get_dashboard_catalog_service,
    get_dashboard_prediction_service,
)
from app.core.exceptions import MatchNotFoundError, PlayerNotFoundError
from app.domain.dashboard_schemas import (
    DashboardPredictionResponseSchema,
    PlayerListMetaSchema,
    PlayerListResponseSchema,
)
from app.domain.openapi_examples import NOT_FOUND_ERROR_EXAMPLE
from app.services.dashboard_catalog_service import DashboardCatalogService
from app.services.dashboard_prediction_service import DashboardPredictionService

router = APIRouter(prefix="/matches", tags=["matches-v2"])


@router.get(
    "/{match_number}/players",
    response_model=PlayerListResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Listar jugadores elegibles para un partido",
)
def list_players_for_match(
    match_number: int,
    q: str | None = Query(
        default=None,
        min_length=1,
        description="Filtro opcional por nombre de jugador o selección.",
    ),
    catalog_service: DashboardCatalogService = Depends(get_dashboard_catalog_service),
) -> PlayerListResponseSchema:
    """Devuelve jugadores con perfil biomédico de las selecciones que juegan el partido."""
    try:
        players, home_code, away_code = catalog_service.build_player_options_for_match(
            match_number=match_number,
            query=q,
        )
    except MatchNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "match_not_found", "message": exc.message},
        ) from exc

    return PlayerListResponseSchema(
        data=players,
        meta=PlayerListMetaSchema(
            match_number=match_number,
            home_team_code=home_code,
            away_team_code=away_code,
            total=len(players),
        ),
    )


@router.get(
    "/{match_number}/players/{player_id}/readiness-report",
    response_model=DashboardPredictionResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Informe de preparación del jugador para el partido",
    responses={
        status.HTTP_404_NOT_FOUND: {
            "description": "Partido o jugador no encontrado.",
            "content": {"application/json": {"example": NOT_FOUND_ERROR_EXAMPLE}},
        },
    },
)
def get_player_readiness_report(
    match_number: int,
    player_id: str,
    catalog_service: DashboardCatalogService = Depends(get_dashboard_catalog_service),
    dashboard_service: DashboardPredictionService = Depends(get_dashboard_prediction_service),
) -> DashboardPredictionResponseSchema:
    """Devuelve el payload enriquecido del dashboard para jugador y partido."""
    try:
        if not catalog_service.is_player_eligible_for_match(player_id, match_number):
            raise PlayerNotFoundError(
                f"El futbolista '{player_id}' no pertenece a las selecciones del partido {match_number}.",
            )

        return dashboard_service.build_dashboard_prediction(
            player_name=player_id,
            match_number=match_number,
        )
    except MatchNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "match_not_found", "message": exc.message},
        ) from exc
    except PlayerNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "player_not_found", "message": exc.message},
        ) from exc
