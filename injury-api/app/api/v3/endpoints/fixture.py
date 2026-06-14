"""
Endpoints REST v3: fixture del Mundial 2026 (jornadas y partidos).
"""

from fastapi import APIRouter, Depends, status

from app.api.dependencies import get_dashboard_catalog_service
from app.api.error_handlers import raise_http_from_domain_error
from app.core.exceptions import MatchDateNotFoundError
from app.domain.dashboard_schemas import (
    MatchDateListResponseSchema,
    MatchDayCatalogResponseSchema,
    MatchListResponseSchema,
)
from app.services.dashboard_catalog_service import DashboardCatalogService

router = APIRouter(prefix="/fixture", tags=["fixture-v3"])


@router.get(
    "",
    response_model=MatchDayCatalogResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Fixture completo del Mundial 2026 agrupado por jornada",
)
def listar_fixture_completo(
    catalog_service: DashboardCatalogService = Depends(get_dashboard_catalog_service),
) -> MatchDayCatalogResponseSchema:
    """Devuelve todas las jornadas con sus partidos anidados."""
    return MatchDayCatalogResponseSchema(
        match_days=catalog_service.build_match_days()
    )


@router.get(
    "/jornadas",
    response_model=MatchDateListResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Listar fechas de jornada del Mundial 2026",
)
def listar_jornadas(
    catalog_service: DashboardCatalogService = Depends(get_dashboard_catalog_service),
) -> MatchDateListResponseSchema:
    """Devuelve las fechas disponibles sin partidos anidados (para carrusel)."""
    return MatchDateListResponseSchema(data=catalog_service.build_match_dates())


@router.get(
    "/jornadas/{fecha_kickoff}/partidos",
    response_model=MatchListResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Listar partidos de una jornada específica",
)
def listar_partidos_por_jornada(
    fecha_kickoff: str,
    catalog_service: DashboardCatalogService = Depends(get_dashboard_catalog_service),
) -> MatchListResponseSchema:
    """Devuelve los partidos que se juegan en la fecha indicada (YYYY-MM-DD)."""
    try:
        matches = catalog_service.build_matches_for_date(fecha_kickoff)
    except MatchDateNotFoundError as exc:
        raise_http_from_domain_error(exc)

    return MatchListResponseSchema(data=matches)
