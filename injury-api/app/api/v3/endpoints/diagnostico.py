"""
Endpoints REST v3: diagnóstico de riesgo de lesión por jugador y partido.

Incluye:
  - Predicción individual de riesgo (POST clásico)
  - Readiness report enriquecido para el dashboard
  - Plantilla de jugadores por partido
  - Plantilla con inferencia IA pre-calculada
"""

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.api.dependencies import (
    get_dashboard_catalog_service,
    get_dashboard_prediction_service,
    get_injury_risk_predictor,
)
from app.api.error_handlers import raise_http_from_domain_error
from app.core.exceptions import MatchNotFoundError, PlayerNotFoundError
from app.core.flag_url_builder import build_flag_url
from app.core.risk_level import INJURY_RISK_LABELS, INJURY_RISK_DESCRIPTIONS, InjuryRiskLevel
from app.datascience.inference.injury_risk_predictor import InjuryRiskPredictor
from app.datascience.schema.columns import FixtureColumns
from app.domain.dashboard_schemas import (
    AiInferenceSchema,
    DashboardPredictionResponseSchema,
    MatchPlayersWithInferencesDataSchema,
    MatchPlayersWithInferencesResponseSchema,
    MatchTeamSchema,
    PlayerListMetaSchema,
    PlayerListResponseSchema,
    PlayerWithInferenceSchema,
    TeamPlayersSchema,
)
from app.domain.schemas import InjuryPredictionRequest, InjuryPredictionResponse
from app.domain.schemas import (
    InjuryRiskResponse,
    MatchContextResponse,
    WeatherContextResponse,
)
from app.services.dashboard_catalog_service import DashboardCatalogService
from app.services.dashboard_prediction_service import DashboardPredictionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/partidos", tags=["diagnostico-v3"])


# ── Predicción individual clásica ──


class DiagnosticoRequestSchema(BaseModel):
    """Solicitud de diagnóstico de riesgo de lesión."""

    nombre_jugador: str
    numero_partido: int


@router.post(
    "/prediccion-lesion",
    response_model=InjuryPredictionResponse,
    status_code=status.HTTP_200_OK,
    summary="Diagnosticar riesgo de lesión para un jugador en un partido",
)
def diagnosticar_riesgo_lesion(
    payload: DiagnosticoRequestSchema,
    predictor: InjuryRiskPredictor = Depends(get_injury_risk_predictor),
) -> InjuryPredictionResponse:
    """Evalúa el riesgo de lesión por fatiga extrema para un jugador."""
    try:
        result = predictor.predict_single(
            player_name=payload.nombre_jugador,
            match_number=payload.numero_partido,
        )
    except (MatchNotFoundError, PlayerNotFoundError) as exc:
        raise_http_from_domain_error(exc)
        raise  # unreachable but satisfies type checker

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


# ── Plantilla de jugadores por partido ──


@router.get(
    "/{numero_partido}/plantilla",
    response_model=PlayerListResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Listar jugadores elegibles para un partido",
)
def listar_plantilla_partido(
    numero_partido: int,
    q: str | None = Query(
        default=None,
        min_length=1,
        description="Filtro opcional por nombre de jugador o selección.",
    ),
    catalog_service: DashboardCatalogService = Depends(
        get_dashboard_catalog_service
    ),
) -> PlayerListResponseSchema:
    """Devuelve jugadores con perfil biomédico de las selecciones del partido."""
    try:
        players, home_code, away_code = (
            catalog_service.build_player_options_for_match(
                match_number=numero_partido,
                query=q,
            )
        )
    except MatchNotFoundError as exc:
        raise_http_from_domain_error(exc)
        raise

    return PlayerListResponseSchema(
        data=players,
        meta=PlayerListMetaSchema(
            match_number=numero_partido,
            home_team_code=home_code,
            away_team_code=away_code,
            total=len(players),
        ),
    )


# ── Readiness report (diagnóstico individual enriquecido) ──


@router.get(
    "/{numero_partido}/jugadores/{nombre_jugador}/diagnostico",
    response_model=DashboardPredictionResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Informe de preparación del jugador para el partido",
)
def obtener_diagnostico_jugador(
    numero_partido: int,
    nombre_jugador: str,
    catalog_service: DashboardCatalogService = Depends(
        get_dashboard_catalog_service
    ),
    dashboard_service: DashboardPredictionService = Depends(
        get_dashboard_prediction_service
    ),
) -> DashboardPredictionResponseSchema:
    """Devuelve el payload enriquecido del dashboard para jugador y partido."""
    try:
        if not catalog_service.is_player_eligible_for_match(
            nombre_jugador, numero_partido
        ):
            raise PlayerNotFoundError(
                f"El futbolista '{nombre_jugador}' no pertenece a las "
                f"selecciones del partido {numero_partido}.",
            )
        return dashboard_service.build_dashboard_prediction(
            player_name=nombre_jugador,
            match_number=numero_partido,
        )
    except (MatchNotFoundError, PlayerNotFoundError) as exc:
        raise_http_from_domain_error(exc)
        raise


# ── Plantilla con inferencia IA pre-calculada ──


@router.get(
    "/{numero_partido}/plantilla-con-diagnostico",
    response_model=MatchPlayersWithInferencesResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Listar jugadores con inferencia IA optimizada",
)
async def listar_plantilla_con_diagnostico(
    numero_partido: int,
    catalog_service: DashboardCatalogService = Depends(
        get_dashboard_catalog_service
    ),
    dashboard_service: DashboardPredictionService = Depends(
        get_dashboard_prediction_service
    ),
) -> MatchPlayersWithInferencesResponseSchema:
    """Lista todos los jugadores del partido con su diagnóstico IA."""
    try:
        players, home_code, away_code = (
            catalog_service.build_player_options_for_match(
                match_number=numero_partido, query=None
            )
        )
    except MatchNotFoundError as exc:
        raise_http_from_domain_error(exc)
        raise

    # Inferencia batch en hilo separado (CPU bound)
    player_names = [player.name for player in players]
    logger.info(
        "🚀 Procesando batch de %d jugadores para partido %d",
        len(player_names),
        numero_partido,
    )
    predictions = await asyncio.to_thread(
        dashboard_service.build_batch_dashboard_predictions,
        player_names,
        numero_partido,
    )

    # Obtener datos del partido para la respuesta
    fixture_df = catalog_service._fixture
    match_row = fixture_df[
        fixture_df[FixtureColumns.MATCH_NUMBER] == numero_partido
    ]
    if match_row.empty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "match_not_found",
                "message": f"Match {numero_partido} not found",
            },
        )
    match_row = match_row.iloc[0]

    home_team = MatchTeamSchema(
        name=str(match_row.get(FixtureColumns.HOME_TEAM_NAME, home_code)),
        code=home_code,
        flag_url=build_flag_url(home_code),
    )
    away_team = MatchTeamSchema(
        name=str(match_row.get(FixtureColumns.AWAY_TEAM_NAME, away_code)),
        code=away_code,
        flag_url=build_flag_url(away_code),
    )

    # Clasificar jugadores por equipo
    home_players: list[PlayerWithInferenceSchema] = []
    away_players: list[PlayerWithInferenceSchema] = []

    for player in players:
        is_home = player.team_code == home_code
        prediction = predictions.get(player.name)

        if prediction:
            ai_inference = prediction.data.ai_inference
        else:
            ai_inference = AiInferenceSchema(
                class_=0,
                label="STATUS SAFE / FIT TO PLAY",
                justification="Player data not available for this match.",
            )

        player_with_inference = PlayerWithInferenceSchema(
            id=player.id,
            name=player.name,
            national_team=player.national_team,
            team_code=player.team_code,
            flag_url=player.flag_url,
            face_url=player.face_url,
            ai_inference=ai_inference,
        )

        if is_home:
            home_players.append(player_with_inference)
        else:
            away_players.append(player_with_inference)

    # Ordenar por nivel de riesgo (2,1,0) y luego nombre
    home_players.sort(key=lambda p: (-p.ai_inference.class_, p.name))
    away_players.sort(key=lambda p: (-p.ai_inference.class_, p.name))

    return MatchPlayersWithInferencesResponseSchema(
        data=MatchPlayersWithInferencesDataSchema(
            match_number=numero_partido,
            home=TeamPlayersSchema(team=home_team, players=home_players),
            away=TeamPlayersSchema(team=away_team, players=away_players),
        )
    )
