"""Endpoints REST v2: fechas y partidos del fixture."""

from fastapi import APIRouter, Depends, status

from app.api.dependencies import get_dashboard_catalog_service
from app.api.error_handlers import raise_http_from_domain_error
from app.core.exceptions import MatchDateNotFoundError
from app.domain.dashboard_schemas import MatchDateListResponseSchema, MatchListResponseSchema
from app.services.dashboard_catalog_service import DashboardCatalogService

router = APIRouter(prefix="/match-dates", tags=["match-dates-v2"])


@router.get(
    "",
    response_model=MatchDateListResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Listar fechas de jornada del Mundial 2026",
)
def list_match_dates(
    catalog_service: DashboardCatalogService = Depends(get_dashboard_catalog_service),
) -> MatchDateListResponseSchema:
    """Devuelve las fechas disponibles para el carrusel superior del dashboard."""
    return MatchDateListResponseSchema(data=catalog_service.build_match_dates())


@router.get(
    "/{kickoff_date}/matches",
    response_model=MatchListResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Listar partidos de una fecha",
)
def list_matches_by_date(
    kickoff_date: str,
    catalog_service: DashboardCatalogService = Depends(get_dashboard_catalog_service),
) -> MatchListResponseSchema:
    """Devuelve los partidos que se juegan en la fecha indicada (YYYY-MM-DD)."""
    try:
        matches = catalog_service.build_matches_for_date(kickoff_date)
    except MatchDateNotFoundError as exc:
        raise_http_from_domain_error(exc)

    return MatchListResponseSchema(data=matches)
