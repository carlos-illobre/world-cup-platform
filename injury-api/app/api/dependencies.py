"""Inyección de dependencias para los endpoints REST."""

from fastapi import Request

from app.config import settings
from app.core.startup_log import StartupLogStore
from app.datascience.inference.injury_risk_predictor import InjuryRiskPredictor
from app.datascience.model_context import TrainedModelContext
from app.infrastructure.weather_client import HistoricalWeatherClient
from app.services.dashboard_catalog_service import DashboardCatalogService
from app.services.dashboard_prediction_service import DashboardPredictionService


def get_settings():
    return settings


def get_startup_log_store(request: Request) -> StartupLogStore:
    """Obtiene el registro de arranque precargado durante el lifespan."""
    return request.app.state.startup_log


def get_injury_context(request: Request) -> TrainedModelContext:
    """Obtiene el contexto precargado durante el arranque del servidor."""
    return request.app.state.injury_context


def get_injury_risk_predictor(request: Request) -> InjuryRiskPredictor:
    """Construye el predictor de riesgo con el contexto en memoria."""
    return InjuryRiskPredictor(
        context=get_injury_context(request),
        weather_client=HistoricalWeatherClient(),
    )


def get_dashboard_catalog_service(request: Request) -> DashboardCatalogService:
    """Construye el servicio de catálogo a partir del contexto precargado."""
    context = get_injury_context(request)
    return DashboardCatalogService(
        fixture_dataframe=context.fixture_dataframe,
        combined_dataframe=context.combined_player_sensor_matrix,
        players_dataframe=context.players_dataframe,
        nationality_to_fifa=context.nationality_to_fifa_code,
    )


def get_dashboard_prediction_service(
    request: Request,
) -> DashboardPredictionService:
    """Construye el adaptador de predicción para el dashboard React."""
    context = get_injury_context(request)
    return DashboardPredictionService(
        injury_risk_predictor=InjuryRiskPredictor(
            context=context,
            weather_client=HistoricalWeatherClient(),
        ),
        players_dataframe=context.players_dataframe,
        nationality_to_fifa=context.nationality_to_fifa_code,
    )
