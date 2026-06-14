"""Endpoints REST para pronóstico de riesgo de lesión en el Mundial 2026."""

from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import (
    get_dashboard_prediction_service,
    get_injury_risk_predictor,
)
from app.api.error_handlers import raise_http_from_domain_error
from app.core.exceptions import MatchNotFoundError, PlayerNotFoundError
from app.core.risk_level import INJURY_RISK_LABELS, INJURY_RISK_DESCRIPTIONS, InjuryRiskLevel
from app.datascience.inference.injury_risk_predictor import InjuryRiskPredictor
from app.domain.dashboard_schemas import DashboardPredictionResponseSchema
from app.domain.openapi_examples import NOT_FOUND_ERROR_EXAMPLE
from app.domain.schemas import (
    InjuryPredictionRequest,
    InjuryPredictionResponse,
    InjuryRiskResponse,
    MatchContextResponse,
    WeatherContextResponse,
)
from app.services.dashboard_prediction_service import DashboardPredictionService

router = APIRouter(prefix="/injury-predictions", tags=["injury-predictions"])


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
        raise_http_from_domain_error(exc)
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
    predictor: InjuryRiskPredictor = Depends(get_injury_risk_predictor),
) -> InjuryPredictionResponse:
    """
    Evalúa el riesgo de lesión por fatiga extrema para un jugador en un partido.

    El fixture, la matriz biomédica y el modelo ML se cargan al iniciar el servidor;
    este endpoint solo ejecuta la inferencia sobre esos artefactos en memoria.
    """
    try:
        result = predictor.predict_single(
            player_name=payload.player_name,
            match_number=payload.match_number,
        )
    except (MatchNotFoundError, PlayerNotFoundError) as exc:
        raise_http_from_domain_error(exc)
        raise

    risk_level = InjuryRiskLevel(result.risk_level)
    return InjuryPredictionResponse(
        player_name=result.player_name,
        match=MatchContextResponse(
            match_number=result.match_number,
            stage_name=result.stage_name,
            city_name=result.city_name,
            venue_name=result.venue_name,
            kickoff_date=result.kickoff_date,
        ),
        weather=WeatherContextResponse(
            ambient_temperature_celsius=result.ambient_temperature_celsius,
            humidity_percent=result.humidity_percent,
        ),
        injury_risk=InjuryRiskResponse(
            risk_level=result.risk_level,
            risk_label=INJURY_RISK_LABELS[risk_level],
            description=INJURY_RISK_DESCRIPTIONS[risk_level],
        ),
    )
