"""Router principal de la versión 3 de la API REST — Mundial 2026."""

from fastapi import APIRouter

from app.api.v3.endpoints import algoritmos, diagnostico, fixture, jugadores

api_v3_router = APIRouter(prefix="/mundial")
api_v3_router.include_router(algoritmos.router)
api_v3_router.include_router(jugadores.router)
api_v3_router.include_router(fixture.router)
api_v3_router.include_router(diagnostico.router)
