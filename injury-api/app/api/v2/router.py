"""Router principal de la versión 2 de la API REST."""

from fastapi import APIRouter

from app.api.v2.endpoints import match_dates, matches
from app.api.v2.endpoints import players_with_inferences

api_v2_router = APIRouter()
api_v2_router.include_router(match_dates.router)
api_v2_router.include_router(matches.router)
api_v2_router.include_router(players_with_inferences.router)