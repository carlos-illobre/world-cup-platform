"""Fixtures compartidas para las pruebas de integración."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.datascience.inference.injury_risk_predictor import InjuryRiskPredictor
from app.datascience.pipeline.data_pipeline import WorldCupDataPipeline
from app.infrastructure.weather_client import HistoricalWeatherClient


@pytest.fixture(scope="module")
def injury_context():
    """Ejecuta el pipeline una vez por módulo de pruebas."""
    return WorldCupDataPipeline().run()


@pytest.fixture(scope="module")
def prediction_service(injury_context):
    """Predictor de riesgo con datos reales precargados."""
    return InjuryRiskPredictor(
        context=injury_context,
        weather_client=HistoricalWeatherClient(),
    )


@pytest.fixture(scope="module")
def api_client():
    """Cliente HTTP contra la app FastAPI (dispara el lifespan)."""
    with TestClient(app) as client:
        yield client
