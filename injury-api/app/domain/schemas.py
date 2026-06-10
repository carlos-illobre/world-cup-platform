"""Esquemas Pydantic para contratos REST de entrada y salida."""

from pydantic import BaseModel, ConfigDict, Field

from app.domain.openapi_examples import (
    HEALTH_CHECK_RESPONSE_EXAMPLE,
    INJURY_PREDICTION_REQUEST_EXAMPLE,
    INJURY_PREDICTION_RESPONSE_EXAMPLE,
    STARTUP_LOG_RESPONSE_EXAMPLE,
)


class InjuryPredictionRequest(BaseModel):
    """Cuerpo de la solicitud para pronosticar riesgo de lesión en un partido."""

    model_config = ConfigDict(
        json_schema_extra={"examples": [INJURY_PREDICTION_REQUEST_EXAMPLE]},
    )

    player_name: str = Field(
        ...,
        min_length=1,
        description="Nombre corto del jugador según el dataset FIFA.",
    )
    match_number: int = Field(
        ...,
        ge=1,
        description="Número de partido en el fixture del Mundial 2026.",
    )


class MatchContextResponse(BaseModel):
    """Contexto del encuentro analizado."""

    match_number: int
    stage_name: str
    city_name: str
    venue_name: str
    kickoff_date: str


class WeatherContextResponse(BaseModel):
    """Condiciones geoclimáticas estimadas para la sede y fecha del partido."""

    ambient_temperature_celsius: float
    humidity_percent: float


class InjuryRiskResponse(BaseModel):
    """Resultado de la inferencia del modelo de riesgo de lesión."""

    risk_level: int = Field(..., ge=0, le=2)
    risk_label: str
    description: str


class InjuryPredictionResponse(BaseModel):
    """Respuesta completa del pronóstico de riesgo de lesión."""

    model_config = ConfigDict(
        json_schema_extra={"examples": [INJURY_PREDICTION_RESPONSE_EXAMPLE]},
    )

    player_name: str
    match: MatchContextResponse
    weather: WeatherContextResponse
    injury_risk: InjuryRiskResponse


class HealthCheckResponse(BaseModel):
    """Estado operativo del servicio."""

    model_config = ConfigDict(
        json_schema_extra={"examples": [HEALTH_CHECK_RESPONSE_EXAMPLE]},
    )

    status: str
    tournament: str
    model_ready: bool


class StartupLogEntryResponse(BaseModel):
    """Entrada individual del log de arranque del pipeline."""

    timestamp: str
    level: str
    logger_name: str
    message: str


class StartupLogResponse(BaseModel):
    """Registro completo del proceso de carga y entrenamiento al iniciar el servidor."""

    model_config = ConfigDict(
        json_schema_extra={"examples": [STARTUP_LOG_RESPONSE_EXAMPLE]},
    )

    total_entries: int
    entries: list[StartupLogEntryResponse]
