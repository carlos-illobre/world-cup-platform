"""Endpoint REST v2: jugadores de ambas selecciones con inferencia IA pre-calculada."""

import logging
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_dashboard_catalog_service, get_dashboard_prediction_service
from app.api.error_handlers import raise_http_from_domain_error
from app.core.exceptions import MatchNotFoundError
from app.core.flag_url_builder import build_flag_url
from app.datascience.schema.columns import FixtureColumns
from app.domain.dashboard_schemas import (
    MatchTeamSchema,
    PlayerWithInferenceSchema,
    AiInferenceSchema,
    MatchPlayersWithInferencesResponseSchema,
    MatchPlayersWithInferencesDataSchema,
    TeamPlayersSchema,
)
from app.services.dashboard_catalog_service import DashboardCatalogService
from app.services.dashboard_prediction_service import DashboardPredictionService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/matches", tags=["matches-v2"])

@router.get(
    "/{match_number}/players-with-inferences",
    response_model=MatchPlayersWithInferencesResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Listar jugadores con inferencia IA optimizada"
)
async def get_players_with_inferences(
    match_number: int,
    catalog_service: DashboardCatalogService = Depends(get_dashboard_catalog_service),
    dashboard_service: DashboardPredictionService = Depends(get_dashboard_prediction_service),
) -> MatchPlayersWithInferencesResponseSchema:
    # Obtener todos los jugadores del partido
    try:
        players, home_code, away_code = catalog_service.build_player_options_for_match(
            match_number=match_number, query=None,
        )
    except MatchNotFoundError as exc:
        raise_http_from_domain_error(exc)
        raise

    # 2. Inferencia y Mapeo en hilo separado (CPU Bound)
    # Gracias al caché implementado en el servicio, esto será instantáneo si ya fue calculado.
    player_names = [player.name for player in players]
    logger.info(
        "🚀 Procesando batch de %d jugadores para partido %d",
        len(player_names),
        match_number,
    )
    predictions = await asyncio.to_thread(
        dashboard_service.build_batch_dashboard_predictions,
        player_names,
        match_number
    )

    # 3. Construcción del response (Transformación final)
    # Obtener fila del partido
    fixture_df = catalog_service._fixture
    match_row = fixture_df[fixture_df[FixtureColumns.MATCH_NUMBER] == match_number]
    if match_row.empty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "match_not_found", "message": f"Match {match_number} not found"},
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

    # Clasificar jugadores por equipo usando las predicciones batch
    home_players: list[PlayerWithInferenceSchema] = []
    away_players: list[PlayerWithInferenceSchema] = []

    for player in players:
        is_home = player.team_code == home_code
        prediction = predictions.get(player.name)

        if prediction:
            ai_inference = prediction.data.ai_inference
        else:
            # Fallback si no hay predicción
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
            match_number=match_number,
            home=TeamPlayersSchema(team=home_team, players=home_players),
            away=TeamPlayersSchema(team=away_team, players=away_players),
        )
    )