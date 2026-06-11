"""Punto de entrada de la API REST — Mundial 2026 Injury Risk."""

import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
import os
from pathlib import Path

from app.api.v1.router import api_v1_router
from app.api.v2.router import api_v2_router
from app.config import (
    API_DESCRIPTION,
    API_TITLE,
    API_V1_PREFIX,
    API_V2_PREFIX,
    API_VERSION,
    CORS_ORIGINS,
    OPENAPI_DOCS_URL,
    OPENAPI_REDOC_URL,
    OPENAPI_URL,
)
from app.core.exceptions import DataPipelineError
from app.core.startup_log import StartupLogStore, capture_startup_logs
from app.domain.schemas import HealthCheckResponse
from app.services.data_pipeline import WorldCupDataPipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    """
    Ciclo de vida de la aplicación.
    El pipeline de datos y el entrenamiento del modelo se ejecutan una sola vez aquí.
    """
    application.state.startup_log = StartupLogStore()

    try:
        with capture_startup_logs(application.state.startup_log):
            logger.info("Arrancando servidor — ejecutando pipeline de datos (una sola vez)...")
            application.state.injury_context = WorldCupDataPipeline().run()
            logger.info("Pipeline completado. Servidor listo para recibir solicitudes.")
    except DataPipelineError as exc:
        logger.error("Fallo en el pipeline de arranque: %s", exc.detail or exc.message)
        raise
    yield
    logger.info("Apagando servidor.")


OPENAPI_TAGS = [
    {
        "name": "health",
        "description": "Estado operativo del servicio y disponibilidad del modelo.",
    },
    {
        "name": "injury-predictions",
        "description": "Pronóstico de riesgo de lesión por jugador y partido del Mundial 2026.",
    },
    {
        "name": "startup-log",
        "description": "Log en memoria del pipeline de datos ejecutado al arrancar el servidor.",
    },
    {
        "name": "players",
        "description": "Catálogo de jugadores con perfil biomédico para el dashboard.",
    },
    {
        "name": "match-days",
        "description": "Fixture del Mundial agrupado por jornada para el dashboard.",
    },
    {
        "name": "match-dates-v2",
        "description": "Fechas y partidos del fixture (API v2 REST progresiva).",
    },
    {
        "name": "matches-v2",
        "description": "Jugadores por partido e informe de preparación (API v2).",
    },
]

app = FastAPI(
    title=API_TITLE,
    description=API_DESCRIPTION,
    version=API_VERSION,
    lifespan=lifespan,
    openapi_url=OPENAPI_URL,
    docs_url=OPENAPI_DOCS_URL,
    redoc_url=OPENAPI_REDOC_URL,
    openapi_tags=OPENAPI_TAGS,
)

app.add_middleware(
    CORSMiddleware,
    #allow_origins=CORS_ORIGINS,
    #allow_credentials=True,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

static_dir = Path(__file__).parent.parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
    logger.info(f"📁 Sirviendo archivos estáticos desde: {static_dir}")
else:
    logger.warning(f"⚠️ Directorio estático no encontrado: {static_dir}")


app.include_router(api_v1_router, prefix=API_V1_PREFIX)
app.include_router(api_v2_router, prefix=API_V2_PREFIX)


@app.get("/", include_in_schema=False)
def redirect_to_openapi_docs() -> RedirectResponse:
    """Redirige la raíz hacia Swagger UI para facilitar las pruebas manuales."""
    return RedirectResponse(url=OPENAPI_DOCS_URL)


@app.get(
    "/health",
    response_model=HealthCheckResponse,
    tags=["health"],
    summary="Verificar estado del servicio",
)
def health_check(request: Request) -> HealthCheckResponse:
    """Indica si el modelo y los datos están listos para inferencia."""
    model_ready = hasattr(request.app.state, "injury_context")
    return HealthCheckResponse(
        status="ok" if model_ready else "initializing",
        tournament="FIFA World Cup 2026",
        model_ready=model_ready,
    )


@app.exception_handler(DataPipelineError)
async def data_pipeline_exception_handler(
    _request: Request,
    exc: DataPipelineError,
) -> JSONResponse:
    """Maneja errores críticos del pipeline durante el arranque."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "data_pipeline_error",
            "message": exc.message,
            "detail": exc.detail,
        },
    )
