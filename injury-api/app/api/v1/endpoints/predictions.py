"""Endpoints REST para pronóstico de riesgo de lesión en el Mundial 2026."""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import (
    get_dashboard_prediction_service,
    get_injury_prediction_service,
)
from app.core.exceptions import MatchNotFoundError, PlayerNotFoundError
from app.domain.dashboard_schemas import DashboardPredictionResponseSchema
from app.domain.openapi_examples import NOT_FOUND_ERROR_EXAMPLE
from app.domain.schemas import InjuryPredictionRequest, InjuryPredictionResponse
from app.services.dashboard_prediction_service import DashboardPredictionService
from app.services.injury_prediction_service import InjuryPredictionService

router = APIRouter(prefix="/injury-predictions", tags=["injury-predictions"])


def _handle_prediction_errors(exc: Exception) -> None:
    if isinstance(exc, MatchNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "match_not_found", "message": exc.message},
        ) from exc
    if isinstance(exc, PlayerNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "player_not_found", "message": exc.message},
        ) from exc
    raise exc


@router.get(
    "",
    response_model=DashboardPredictionResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Pronóstico completo para el dashboard",
    responses={
        status.HTTP_404_NOT_FOUND: {
            "description": "Partido o jugador no encontrado en los datos precargados.",
            "content": {"application/json": {"example": NOT_FOUND_ERROR_EXAMPLE}},
        },
    },
)
def get_dashboard_injury_prediction(
    player_name: str = Query(..., min_length=1, description="Nombre corto del jugador."),
    match_number: int = Query(..., ge=1, description="Número de partido del fixture."),
    dashboard_service: DashboardPredictionService = Depends(get_dashboard_prediction_service),
) -> DashboardPredictionResponseSchema:
    """
    Devuelve el payload enriquecido consumido por el dashboard React
    (stats, radar, clima, inferencia IA).
    """
    try:
        return dashboard_service.build_dashboard_prediction(
            player_name=player_name,
            match_number=match_number,
        )
    except (MatchNotFoundError, PlayerNotFoundError) as exc:
        _handle_prediction_errors(exc)
        raise


@router.post(
    "",
    response_model=InjuryPredictionResponse,
    status_code=status.HTTP_200_OK,
    summary="Pronosticar riesgo de lesión en un partido",
    responses={
        status.HTTP_404_NOT_FOUND: {
            "description": "Partido o jugador no encontrado en los datos precargados.",
            "content": {"application/json": {"example": NOT_FOUND_ERROR_EXAMPLE}},
        },
    },
)
def predict_match_injury_risk(
    payload: InjuryPredictionRequest,
    prediction_service: InjuryPredictionService = Depends(get_injury_prediction_service),
) -> InjuryPredictionResponse:
    """
    Evalúa el riesgo de lesión por fatiga extrema para un jugador en un partido.

    El fixture, la matriz biomédica y el modelo ML se cargan al iniciar el servidor;
    este endpoint solo ejecuta la inferencia sobre esos artefactos en memoria.
    """
    try:
        return prediction_service.predict_match_injury_risk(
            player_name=payload.player_name,
            match_number=payload.match_number,
        )
    except (MatchNotFoundError, PlayerNotFoundError) as exc:
        _handle_prediction_errors(exc)
        raise
