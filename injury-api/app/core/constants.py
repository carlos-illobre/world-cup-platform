"""Constantes de dominio: nombres de columnas, archivos y features del modelo."""

from enum import IntEnum


class DataFiles:
    """Rutas relativas de los archivos CSV (respecto a DATA_DIR)."""

    MATCHES = "matches.csv"
    HOST_CITIES = "host_cities.csv"
    TEAMS = "teams.csv"
    TOURNAMENT_STAGES = "tournament_stages.csv"
    CITY_GEO_DATA = "city_geo_data.csv"
    MEDICAL_DATASET = "multimodal_sports_injury_dataset.csv"
    PLAYERS = "players_22.csv"


class FixtureColumns:
    """Columnas del fixture relacional unificado."""

    MATCH_NUMBER = "match_number"
    KICKOFF_AT = "kickoff_at"
    LATITUDE = "latitude"
    LONGITUDE = "longitude"
    STAGE_NAME = "stage_name"
    CITY_NAME = "city_name"
    VENUE_NAME = "venue_name"
    CITY_ID = "city_id"
    STAGE_ID = "stage_id"
    HOME_TEAM_ID = "home_team_id"
    AWAY_TEAM_ID = "away_team_id"
    TEAM_ID = "team_id"
    HOME_TEAM_NAME = "home_team_name"
    AWAY_TEAM_NAME = "away_team_name"
    HOME_FIFA_CODE = "home_fifa_code"
    AWAY_FIFA_CODE = "away_fifa_code"
    MATCH_LABEL = "match_label"
    ALTITUDE = "altitude"


class TeamColumns:
    """Columnas del dataset de selecciones."""

    TEAM_NAME = "team_name"
    FIFA_CODE = "fifa_code"


class MedicalColumns:
    """Columnas del dataset médico multimodal."""

    SPORT_TYPE = "sport_type"
    INJURY_OCCURRED = "injury_occurred"
    AGE = "age"
    BMI = "bmi"
    JOIN_AGE = "join_age"
    JOIN_BMI = "join_bmi"


class PlayerColumns:
    """Columnas del dataset de jugadores FIFA."""

    SHORT_NAME = "short_name"
    WEIGHT_KG = "weight_kg"
    HEIGHT_CM = "height_cm"
    AGE = "age"
    BMI = "bmi"
    JOIN_AGE = "join_age"
    JOIN_BMI = "join_bmi"
    NATIONALITY_NAME = "nationality_name"
    NATION_JERSEY_NUMBER = "nation_jersey_number"
    PLAYER_FACE_URL = "player_face_url"
    NATION_FLAG_URL = "nation_flag_url"


class JoinKeys:
    """Llaves sintéticas para el cruce fisiológico jugador ↔ sensores."""

    JOIN_AGE = "join_age"
    JOIN_BMI = "join_bmi"


class SoccerFilter:
    """Filtro de dominio para aislar registros de fútbol."""

    SPORT_TYPE_VALUE = "Soccer"


class ModelFeatures:
    """Vector de características utilizado por el clasificador de riesgo."""

    FEATURES: tuple[str, ...] = (
        "heart_rate",
        "body_temperature",
        "hydration_level",
        "sleep_quality",
        "recovery_score",
        "stress_level",
        "training_intensity",
        "training_duration",
        "training_load",
        "fatigue_index",
        "ambient_temperature",
        "humidity",
        "altitude",
    )

    AMBIENT_TEMPERATURE = "ambient_temperature"
    HUMIDITY = "humidity"


class InjuryRiskLevel(IntEnum):
    """Niveles de riesgo de lesión inferidos por el modelo."""

    HEALTHY = 0
    LOW_RISK = 1
    CRITICAL_RISK = 2


INJURY_RISK_LABELS: dict[InjuryRiskLevel, str] = {
    InjuryRiskLevel.HEALTHY: "healthy",
    InjuryRiskLevel.LOW_RISK: "low_risk",
    InjuryRiskLevel.CRITICAL_RISK: "critical_risk",
}

DASHBOARD_AI_STATUS_LABELS: dict[InjuryRiskLevel, str] = {
    InjuryRiskLevel.HEALTHY: "STATUS SAFE",
    InjuryRiskLevel.LOW_RISK: "STATUS CAUTION",
    InjuryRiskLevel.CRITICAL_RISK: "STATUS AT RISK",
}

DASHBOARD_AI_VERDICTS: dict[InjuryRiskLevel, str] = {
    InjuryRiskLevel.HEALTHY: "FIT TO PLAY",
    InjuryRiskLevel.LOW_RISK: "MONITOR CLOSELY",
    InjuryRiskLevel.CRITICAL_RISK: "RESTRICT MINUTES",
}

INJURY_RISK_DESCRIPTIONS: dict[InjuryRiskLevel, str] = {
    InjuryRiskLevel.HEALTHY: (
        "Sin indicadores de fatiga de riesgo. Apto para el encuentro."
    ),
    InjuryRiskLevel.LOW_RISK: (
        "Fatiga moderada acumulada. Monitorear cargas de entrenamiento."
    ),
    InjuryRiskLevel.CRITICAL_RISK: (
        "Fatiga extrema o riesgo inminente de lesión. Alerta de rotación."
    ),
}
