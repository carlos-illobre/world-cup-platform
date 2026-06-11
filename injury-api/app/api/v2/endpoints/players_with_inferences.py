"""Endpoint REST v2: jugadores de ambas selecciones con inferencia IA pre-calculada."""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel  
from functools import lru_cache
from datetime import timedelta
from typing import Optional  

from app.api.dependencies import get_dashboard_catalog_service, get_dashboard_prediction_service
from app.core.exceptions import MatchNotFoundError, PlayerNotFoundError
from app.domain.dashboard_schemas import (
    MatchTeamSchema,
    PlayerWithInferenceSchema,
    PlayerOptionSchema,
    AiInferenceSchema,
)
from app.services.dashboard_catalog_service import DashboardCatalogService
from app.services.dashboard_prediction_service import DashboardPredictionService
from app.core.team_flags import build_flag_url

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/matches", tags=["matches-v2"])


# Definir los schemas aquí mismo para evitar duplicación con dashboard_schemas.py
class PlayerWithInferenceSchema(PlayerOptionSchema):
    """Extiende PlayerOptionSchema para incluir la inferencia IA."""
    ai_inference: AiInferenceSchema


class TeamPlayersSchema(BaseModel):
    """Equipo con su lista de jugadores e inferencias."""
    team: MatchTeamSchema
    players: list[PlayerWithInferenceSchema]


class MatchPlayersWithInferencesDataSchema(BaseModel):
    """Respuesta completa del endpoint."""
    match_number: int
    home: TeamPlayersSchema
    away: TeamPlayersSchema


class MatchPlayersWithInferencesResponseSchema(BaseModel):
    """Wrapper de respuesta."""
    data: MatchPlayersWithInferencesDataSchema


# Cache simple en memoria
_cache: dict[int, tuple] = {}  # match_number -> (timestamp, response)


def _is_cache_valid(match_number: int, ttl_seconds: int = 300) -> bool:
    """Verifica si el cache para match_number sigue vigente (TTL por defecto 5 minutos)."""
    if match_number not in _cache:
        return False
    timestamp, _ = _cache[match_number]
    from time import time
    return (time() - timestamp) < ttl_seconds


def _get_cached_response(match_number: int):
    if _is_cache_valid(match_number):
        return _cache[match_number][1]
    return None


def _set_cached_response(match_number: int, response):
    from time import time
    _cache[match_number] = (time(), response)

@router.get(
    "/{match_number}/players-with-inferences",
    response_model=MatchPlayersWithInferencesResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Listar jugadores de ambas selecciones con inferencia IA pre-calculada",
)
def get_players_with_inferences(
    match_number: int,
    catalog_service: DashboardCatalogService = Depends(get_dashboard_catalog_service),
    dashboard_service: DashboardPredictionService = Depends(get_dashboard_prediction_service),
) -> MatchPlayersWithInferencesResponseSchema:
    # Verificar cache a nivel de partido completo
    cached = _get_cached_response(match_number)
    if cached is not None:
        logger.info(f"📦 Respuesta completa cacheada para partido {match_number}")
        return cached

    # Obtener todos los jugadores del partido
    try:
        players, home_code, away_code = catalog_service.build_player_options_for_match(
            match_number=match_number,
            query=None,
        )
    except MatchNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "match_not_found", "message": exc.message},
        ) from exc

    # Extraer solo los nombres de los jugadores
    player_names = [player.name for player in players]
    
    # PROCESAMIENTO BATCH: una sola llamada para todos los jugadores
    logger.info(f"🚀 Procesando batch de {len(player_names)} jugadores para partido {match_number}")
    predictions = dashboard_service.build_batch_dashboard_predictions(
        player_names=player_names,
        match_number=match_number,
    )
    
    # Obtener fila del partido
    fixture_df = catalog_service._fixture
    match_row = fixture_df[fixture_df["match_number"] == match_number]
    if match_row.empty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "match_not_found", "message": f"Match {match_number} not found"},
        )
    match_row = match_row.iloc[0]
    
    home_team = MatchTeamSchema(
        name=str(match_row.get("home_team_name", home_code)),
        code=home_code,
        flag_url=build_flag_url(home_code),
    )
    away_team = MatchTeamSchema(
        name=str(match_row.get("away_team_name", away_code)),
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

    response = MatchPlayersWithInferencesResponseSchema(
        data=MatchPlayersWithInferencesDataSchema(
            match_number=match_number,
            home=TeamPlayersSchema(team=home_team, players=home_players),
            away=TeamPlayersSchema(team=away_team, players=away_players),
        )
    )
    
    # Cachear respuesta completa
    _set_cached_response(match_number, response)
    
    return response