"""Router principal de la versión 1 de la API."""

from fastapi import APIRouter

from app.api.v1.endpoints import match_days, players, predictions, startup_log

api_v1_router = APIRouter()
api_v1_router.include_router(predictions.router)
api_v1_router.include_router(players.router)
api_v1_router.include_router(match_days.router)
api_v1_router.include_router(startup_log.router)
