"""
Single Source of Truth — Nombres de columnas de todos los datasets CSV.

Cada clase agrupa las columnas de un dataset específico.
Si se renombra una columna en un CSV, se actualiza ÚNICAMENTE aquí
y todo el código Python se adapta automáticamente.

Convención:
  - Los nombres de los atributos de clase coinciden con los nombres de columna
    del CSV siempre que sea posible (autodocumentado).
  - Las columnas calculadas (no presentes en el CSV original) llevan un
    comentario "# Calculado" indicando su origen.
"""


class PlayerColumns:
    """Columnas del dataset de jugadores FIFA (players_22.csv)."""

    SHORT_NAME = "short_name"
    LONG_NAME = "long_name"
    AGE = "age"
    HEIGHT_CM = "height_cm"
    WEIGHT_KG = "weight_kg"
    NATIONALITY_NAME = "nationality_name"
    NATION_TEAM_ID = "nation_team_id"
    NATION_JERSEY_NUMBER = "nation_jersey_number"
    CLUB_JERSEY_NUMBER = "club_jersey_number"
    PLAYER_FACE_URL = "player_face_url"
    NATION_FLAG_URL = "nation_flag_url"
    BMI = "bmi"  # Calculado: weight_kg / (height_cm / 100)²


class SensorColumns:
    """Columnas del dataset médico multimodal (multimodal_sports_injury_dataset.csv)."""

    # --- Identificación ---
    ATHLETE_ID = "athlete_id"
    SESSION_ID = "session_id"
    SPORT_TYPE = "sport_type"
    GENDER = "gender"
    AGE = "age"
    BMI = "bmi"

    # --- Signos vitales ---
    HEART_RATE = "heart_rate"
    BODY_TEMPERATURE = "body_temperature"

    # --- Bienestar y recuperación ---
    HYDRATION_LEVEL = "hydration_level"
    SLEEP_QUALITY = "sleep_quality"
    RECOVERY_SCORE = "recovery_score"
    STRESS_LEVEL = "stress_level"

    # --- Biomecánica ---
    MUSCLE_ACTIVITY = "muscle_activity"
    JOINT_ANGLES = "joint_angles"
    GAIT_SPEED = "gait_speed"
    CADENCE = "cadence"
    STEP_COUNT = "step_count"
    JUMP_HEIGHT = "jump_height"
    GROUND_REACTION_FORCE = "ground_reaction_force"
    RANGE_OF_MOTION = "range_of_motion"

    # --- Entorno y entrenamiento ---
    AMBIENT_TEMPERATURE = "ambient_temperature"
    HUMIDITY = "humidity"
    ALTITUDE = "altitude"
    PLAYING_SURFACE = "playing_surface"
    TRAINING_INTENSITY = "training_intensity"
    TRAINING_DURATION = "training_duration"
    TRAINING_LOAD = "training_load"

    # --- Target del modelo (variable objetivo) ---
    FATIGUE_INDEX = "fatigue_index"
    INJURY_OCCURRED = "injury_occurred"


class FixtureColumns:
    """Columnas del fixture relacional unificado (resultado del join de múltiples CSV)."""

    # --- Identificadores ---
    MATCH_NUMBER = "match_number"
    CITY_ID = "city_id"
    STAGE_ID = "stage_id"
    HOME_TEAM_ID = "home_team_id"
    AWAY_TEAM_ID = "away_team_id"
    TEAM_ID = "team_id"

    # --- Datos del partido ---
    KICKOFF_AT = "kickoff_at"
    MATCH_LABEL = "match_label"
    STAGE_NAME = "stage_name"

    # --- Sede ---
    CITY_NAME = "city_name"
    VENUE_NAME = "venue_name"
    LATITUDE = "latitude"
    LONGITUDE = "longitude"
    ALTITUDE = "altitude"

    # --- Equipos (resultado del join) ---
    HOME_TEAM_NAME = "home_team_name"
    AWAY_TEAM_NAME = "away_team_name"
    HOME_FIFA_CODE = "home_fifa_code"
    AWAY_FIFA_CODE = "away_fifa_code"

    # --- Estadio (resultado del join con stadium_mapping.csv) ---
    STADIUM_URL = "stadium_url"


class TeamColumns:
    """Columnas del dataset de selecciones (teams.csv)."""

    TEAM_NAME = "team_name"
    FIFA_CODE = "fifa_code"


class StadiumMappingColumns:
    """Columnas del mapeo de estadios (stadium_mapping.csv)."""

    STADIUM_NAME = "stadium_name"
    FILENAME = "filename"


class GeoDataColumns:
    """Columnas de geolocalización de ciudades (city_geo_data.csv)."""

    CITY_ID = "city_id"
    LATITUDE = "latitude"
    LONGITUDE = "longitude"
    ALTITUDE_METERS = "altitude_meters"


class JoinKeys:
    """
    Llaves sintéticas para el cruce fisiológico jugador ↔ sensores.

    Dado que no existe una relación directa entre jugadores FIFA y el dataset
    médico, usamos edad (discretizada) y BMI (redondeado) como proxy
    para vincular a cada jugador con registros de sensores de atletas
    con perfil físico similar.
    """

    JOIN_AGE = "join_age"
    JOIN_BMI = "join_bmi"


class FifaToIso2Columns:
    """Columnas del mapeo FIFA→ISO2 (fifa_to_iso2_mapping.csv)."""

    FIFA_CODE = "fifa_code"
    ISO2_CODE = "iso2_code"


# --- Valores de filtro de dominio ---

SOCCER_SPORT_TYPE_VALUE = "Soccer"
"""Valor de sport_type que identifica registros de fútbol en el dataset médico."""
