"""Configuración centralizada de la aplicación (single source of truth para rutas y parámetros)."""

import os
from pathlib import Path

# Raíz del proyecto: directorio que contiene app/, data/ y archivos de configuración
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Directorio de datasets CSV (configurable vía variable de entorno para Docker)
DATA_DIR = Path(os.getenv("DATA_DIR", str(PROJECT_ROOT / "data")))

# Parámetros del modelo de machine learning
ML_TEST_SIZE = 0.3
ML_RANDOM_STATE = 42
ML_N_ESTIMATORS = 100

# API de clima histórico (Open-Meteo)
WEATHER_ARCHIVE_BASE_URL = "https://archive-api.open-meteo.com/v1/archive"
WEATHER_HISTORICAL_YEARS = (2023, 2024, 2025)
WEATHER_FALLBACK_TEMPERATURE = 28.5
WEATHER_FALLBACK_HUMIDITY = 60.0

# Metadatos de la API REST
API_TITLE = "World Cup 2026 Injury Risk API"
API_DESCRIPTION = (
    "API para pronosticar el riesgo de lesión por fatiga extrema "
    "de jugadores en partidos del Mundial de Fútbol 2026."
)
API_VERSION = "1.0.0"
API_V1_PREFIX = "/api/v1"
API_V2_PREFIX = "/api/v2"

# Documentación OpenAPI / Swagger UI
OPENAPI_URL = "/openapi.json"
OPENAPI_DOCS_URL = "/docs"
OPENAPI_REDOC_URL = "/redoc"

# Servidor (usado por `python -m app`, Docker y el script `start`)
SERVER_HOST = os.getenv("SERVER_HOST", "127.0.0.1")
SERVER_PORT = int(os.getenv("SERVER_PORT", "8000"))
SERVER_RELOAD = os.getenv("SERVER_RELOAD", "true").lower() in ("1", "true", "yes")

# CORS para el dashboard React (orígenes separados por coma)
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
