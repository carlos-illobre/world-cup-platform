"""Esquemas Pydantic alineados con el contrato del dashboard React."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class MatchTeamSchema(BaseModel):
    name: str
    code: str
    flag_url: str


class PlayerOptionSchema(BaseModel):
    id: str
    name: str
    national_team: str
    team_code: str
    flag_url: str
    face_url: str


class MatchOptionSchema(BaseModel):
    id: str
    home: MatchTeamSchema
    away: MatchTeamSchema
    venue: str


class MatchDaySchema(BaseModel):
    id: str
    label: str
    date: str
    matches: list[MatchOptionSchema]


class RadarMetricsSchema(BaseModel):
    cardio: int
    endurance: int
    engagement: int
    respiratory: int
    recovery: int


class TrainingSeriesSchema(BaseModel):
    duration: list[int]
    load: list[int]
    intensity: list[int]


class PlayerStatsSchema(BaseModel):
    sleep_quality: int
    hydration: int
    body_temp: float
    stress: Literal["LOW", "MODERATE", "HIGH"]
    fatigue_index: int
    heart_rate_bpm: int
    heart_rate_series: list[int]
    training: TrainingSeriesSchema


class PlayerDataSchema(BaseModel):
    id: str
    name: str
    number: int
    national_team: str
    team_code: str
    flag_url: str
    face_url: str
    rating_label: str
    stats: PlayerStatsSchema
    radar: RadarMetricsSchema


class MatchWeatherSchema(BaseModel):
    temp_c: float
    humidity: float
    altitude: float


class MatchContextSchema(BaseModel):
    id: str
    label: str
    opponent: str
    venue: str
    stadium_url: str | None = None
    home: MatchTeamSchema
    away: MatchTeamSchema
    weather: MatchWeatherSchema


class AiInferenceSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    class_: int = Field(..., alias="class", ge=0, le=2)
    label: str
    justification: str


class DashboardPredictionDataSchema(BaseModel):
    player: PlayerDataSchema
    match_context: MatchContextSchema
    ai_inference: AiInferenceSchema


class DashboardPredictionResponseSchema(BaseModel):
    data: DashboardPredictionDataSchema


class PlayerCatalogResponseSchema(BaseModel):
    players: list[PlayerOptionSchema]


class MatchDayCatalogResponseSchema(BaseModel):
    match_days: list[MatchDaySchema]


# ---- Esquemas API v2 (recursos REST progresivos para el dashboard) ----


class MatchDateSchema(BaseModel):
    """Fecha de jornada sin partidos anidados."""

    id: str
    label: str
    date: str
    match_count: int


class MatchDateListResponseSchema(BaseModel):
    data: list[MatchDateSchema]


class MatchListItemSchema(BaseModel):
    """Partido resumido para el carrusel de selección."""

    id: str
    match_number: int
    home: MatchTeamSchema
    away: MatchTeamSchema
    venue: str
    kickoff_at: str


class MatchListResponseSchema(BaseModel):
    data: list[MatchListItemSchema]


class PlayerListMetaSchema(BaseModel):
    match_number: int
    home_team_code: str
    away_team_code: str
    total: int


class PlayerListResponseSchema(BaseModel):
    data: list[PlayerOptionSchema]
    meta: PlayerListMetaSchema

class PlayerWithInferenceSchema(PlayerOptionSchema):
    """Jugador con inferencia IA incluida."""
    ai_inference: AiInferenceSchema


class TeamPlayersSchema(BaseModel):
    """Equipo con su lista de jugadores e inferencias."""
    team: MatchTeamSchema
    players: list[PlayerWithInferenceSchema]


class MatchPlayersWithInferencesDataSchema(BaseModel):
    """Datos completos del endpoint players-with-inferences."""
    match_number: int
    home: TeamPlayersSchema
    away: TeamPlayersSchema


class MatchPlayersWithInferencesResponseSchema(BaseModel):
    """Respuesta del endpoint players-with-inferences."""
    data: MatchPlayersWithInferencesDataSchema