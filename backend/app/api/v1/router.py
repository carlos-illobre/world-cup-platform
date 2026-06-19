from fastapi import APIRouter

from app.api.v1.endpoints import players, squads, matches, injuries, teams, tournament

api_v1_router = APIRouter()
api_v1_router.include_router(players.router, prefix="/players", tags=["Players"])
api_v1_router.include_router(squads.router, prefix="/squads", tags=["Squads"])
api_v1_router.include_router(matches.router, prefix="/matches", tags=["Matches"])
api_v1_router.include_router(injuries.router, prefix="/injuries", tags=["Injuries"])
api_v1_router.include_router(teams.router, prefix="/teams", tags=["Teams"])
api_v1_router.include_router(tournament.router, prefix="/tournament", tags=["Tournament"])
