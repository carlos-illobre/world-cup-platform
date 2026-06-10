"""Fixtures compartidas para las pruebas de integración."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.infrastructure.weather_client import HistoricalWeatherClient
from app.services.data_pipeline import WorldCupDataPipeline
from app.services.injury_prediction_service import InjuryPredictionService


@pytest.fixture(scope="module")
def injury_context():
    """Ejecuta el pipeline una vez por módulo de pruebas."""
    return WorldCupDataPipeline().run()


@pytest.fixture(scope="module")
def prediction_service(injury_context):
    """Servicio de predicción con datos reales precargados."""
    return InjuryPredictionService(
        context=injury_context,
        weather_client=HistoricalWeatherClient(),
    )


@pytest.fixture(scope="module")
def api_client():
    """Cliente HTTP contra la app FastAPI (dispara el lifespan)."""
    with TestClient(app) as client:
        yield client
