"""Servicio que arma la respuesta completa del dashboard a partir del modelo y los CSV."""

import math
import logging
from dataclasses import dataclass
import pandas as pd
from cachetools import TTLCache, cached
from cachetools.keys import hashkey

from app.core.flag_url_builder import build_flag_url
from app.core.risk_level import (
    DASHBOARD_AI_STATUS_LABELS,
    DASHBOARD_AI_VERDICTS,
    InjuryRiskLevel,
)
from app.datascience.inference.injury_risk_predictor import (
    InjuryPredictionResult,
    InjuryRiskPredictor,
)
from app.datascience.schema.columns import FixtureColumns, PlayerColumns, SensorColumns
from app.datascience.schema.feature_vector import FeatureVector
from app.domain.dashboard_schemas import (
    AiInferenceSchema,
    DashboardPredictionDataSchema,
    DashboardPredictionResponseSchema,
    MatchContextSchema,
    MatchTeamSchema,
    MatchWeatherSchema,
    PlayerDataSchema,
    PlayerStatsSchema,
    RadarMetricsSchema,
    TrainingSeriesSchema,
)

logger = logging.getLogger(__name__)

# Caché global para predicciones: 5 minutos (300 segundos), máximo 500 predicciones
_dashboard_prediction_cache: TTLCache = TTLCache(maxsize=500, ttl=300)


def _to_percent(value: float) -> int:
    """Normaliza métricas del sensor a porcentaje 0-100."""
    numeric = float(value)
    if numeric <= 1.0:
        numeric *= 100
    return int(max(0, min(100, round(numeric))))


def _classify_stress_level(stress_value: float) -> str:
    percent = _to_percent(stress_value)
    if percent < 40:
        return "LOW"
    if percent < 65:
        return "MODERATE"
    return "HIGH"


def _classify_sleep_rating(sleep_quality_percent: int) -> str:
    if sleep_quality_percent >= 85:
        return "EXCELLENT"
    if sleep_quality_percent >= 70:
        return "GOOD"
    return "FAIR"


def _generate_time_series(base: float, count: int, spread: float) -> list[int]:
    return [
        int(max(0, round(base + math.sin(index / 2.2) * spread)))
        for index in range(count)
    ]


def _build_justification(
    risk_level: InjuryRiskLevel,
    altitude: float,
    fatigue_percent: int,
) -> str:
    fatigue_word = (
        "Moderate"
        if fatigue_percent < 40
        else "Elevated"
        if fatigue_percent < 60
        else "High"
    )
    altitude_text = f"{int(altitude):,}m"

    if risk_level == InjuryRiskLevel.HEALTHY:
        return (
            f"Outstanding sleep quality score and high hydration parameters successfully "
            f"offset the {altitude_text} altitude respiratory stress. Cumulative Fatigue "
            f"Index is strictly under control at {fatigue_percent}% ({fatigue_word})."
        )
    if risk_level == InjuryRiskLevel.LOW_RISK:
        return (
            f"Recovery markers are acceptable but altitude respiratory load at {altitude_text} "
            f"is pushing the Cumulative Fatigue Index to {fatigue_percent}% ({fatigue_word}). "
            f"Recommend reduced training volume and active monitoring."
        )
    return (
        f"Sleep deficit combined with {altitude_text} altitude stress has driven the "
        f"Cumulative Fatigue Index to {fatigue_percent}% ({fatigue_word}). Injury risk is "
        f"significant — limit exposure and prioritize recovery."
    )


@dataclass(frozen=True)
class DashboardPredictionService:
    """Adapta la inferencia del microservicio al contrato del dashboard React."""

    injury_risk_predictor: InjuryRiskPredictor
    players_dataframe: pd.DataFrame
    nationality_to_fifa: dict[str, str]

    def _find_player_row(self, player_name: str) -> pd.Series:
        players = self.players_dataframe[
            self.players_dataframe[PlayerColumns.SHORT_NAME].str.strip().str.lower()
            == player_name.strip().lower()
        ]
        return players.iloc[0]

    def _find_sensor_row(self, player_name: str) -> pd.Series:
        combined = self.injury_risk_predictor.context.combined_player_sensor_matrix
        profiles = combined[
            combined[PlayerColumns.SHORT_NAME].str.strip().str.lower()
            == player_name.strip().lower()
        ]
        return profiles.iloc[0]

    def _map_to_dashboard_schema(
        self,
        player_name: str,
        match_number: int,
        prediction: InjuryPredictionResult,
    ) -> DashboardPredictionResponseSchema:
        """Centraliza la transformación de datos hacia el frontend (Single Source of Truth)."""
        player_row = self._find_player_row(player_name)
        sensor_row = self._find_sensor_row(player_name)
        risk_level = InjuryRiskLevel(prediction.risk_level)

        sleep_quality = _to_percent(sensor_row[SensorColumns.SLEEP_QUALITY])
        hydration = _to_percent(sensor_row[SensorColumns.HYDRATION_LEVEL])
        fatigue_index = _to_percent(sensor_row[SensorColumns.FATIGUE_INDEX])
        heart_rate = int(round(float(sensor_row[SensorColumns.HEART_RATE])))

        nationality = str(player_row[PlayerColumns.NATIONALITY_NAME])
        team_code = self.nationality_to_fifa.get(nationality, "UNK")
        jersey_number = player_row.get(PlayerColumns.NATION_JERSEY_NUMBER)
        if pd.isna(jersey_number):
            jersey_number = player_row.get(PlayerColumns.CLUB_JERSEY_NUMBER, 0)

        match_row = self.injury_risk_predictor.find_match(match_number)

        home = MatchTeamSchema(
            name=str(match_row[FixtureColumns.HOME_TEAM_NAME]),
            code=str(match_row[FixtureColumns.HOME_FIFA_CODE]),
            flag_url=build_flag_url(str(match_row[FixtureColumns.HOME_FIFA_CODE])),
        )
        away = MatchTeamSchema(
            name=str(match_row[FixtureColumns.AWAY_TEAM_NAME]),
            code=str(match_row[FixtureColumns.AWAY_FIFA_CODE]),
            flag_url=build_flag_url(str(match_row[FixtureColumns.AWAY_FIFA_CODE])),
        )
        opponent = (
            away.name
            if team_code == str(match_row[FixtureColumns.HOME_FIFA_CODE])
            else home.name
        )
        altitude_m = float(
            match_row.get(
                FixtureColumns.ALTITUDE,
                sensor_row.get(SensorColumns.ALTITUDE, 0),
            )
        )

        player_data = PlayerDataSchema(
            id=player_name,
            name=player_name,
            number=int(jersey_number),
            national_team=nationality,
            team_code=team_code,
            flag_url=build_flag_url(
                team_code, player_row.get(PlayerColumns.NATION_FLAG_URL)
            ),
            face_url=str(player_row.get(PlayerColumns.PLAYER_FACE_URL, "")),
            rating_label=_classify_sleep_rating(sleep_quality),
            stats=PlayerStatsSchema(
                sleep_quality=sleep_quality,
                hydration=hydration,
                body_temp=round(float(sensor_row[SensorColumns.BODY_TEMPERATURE]), 1),
                stress=_classify_stress_level(float(sensor_row[SensorColumns.STRESS_LEVEL])),
                fatigue_index=fatigue_index,
                heart_rate_bpm=heart_rate,
                heart_rate_series=[
                    int(round(heart_rate + math.sin(index / 2.2) * 7))
                    for index in range(48)
                ],
                training=TrainingSeriesSchema(
                    duration=_generate_time_series(
                        float(sensor_row[SensorColumns.TRAINING_DURATION]), 8, 30
                    ),
                    load=_generate_time_series(
                        float(sensor_row[SensorColumns.TRAINING_LOAD]), 7, 40
                    ),
                    intensity=_generate_time_series(
                        float(sensor_row[SensorColumns.TRAINING_INTENSITY]), 7, 35
                    ),
                ),
            ),
            radar=RadarMetricsSchema(
                cardio=_to_percent(sensor_row[SensorColumns.HEART_RATE] / 2),
                endurance=_to_percent(sensor_row[SensorColumns.RECOVERY_SCORE]),
                engagement=_to_percent(sensor_row[SensorColumns.TRAINING_INTENSITY]),
                respiratory=_to_percent(sensor_row[SensorColumns.ALTITUDE]),
                recovery=_to_percent(sensor_row[SensorColumns.RECOVERY_SCORE]),
            ),
        )

        venue = f"{prediction.venue_name}, {prediction.city_name}"
        stadium_url = str(match_row.get(FixtureColumns.STADIUM_URL, "")) or None

        match_context = MatchContextSchema(
            id=str(match_number),
            label=f"{home.code} vs {away.code}",
            opponent=opponent,
            venue=venue,
            stadium_url=stadium_url,
            home=home,
            away=away,
            weather=MatchWeatherSchema(
                temp_c=prediction.ambient_temperature_celsius,
                humidity=prediction.humidity_percent,
                altitude=altitude_m,
            ),
        )

        ai_inference = AiInferenceSchema(
            class_=int(risk_level),
            label=f"{DASHBOARD_AI_STATUS_LABELS[risk_level]} / {DASHBOARD_AI_VERDICTS[risk_level]}",
            justification=_build_justification(risk_level, altitude_m, fatigue_index),
        )

        return DashboardPredictionResponseSchema(
            data=DashboardPredictionDataSchema(
                player=player_data,
                match_context=match_context,
                ai_inference=ai_inference,
            )
        )

    @cached(
        cache=_dashboard_prediction_cache,
        key=lambda self, player_name, match_number, *a, **kw: hashkey(
            player_name, match_number
        ),
    )
    def build_dashboard_prediction(
        self,
        player_name: str,
        match_number: int,
    ) -> DashboardPredictionResponseSchema:
        """Ejecuta inferencia individual y la mapea (con caché automático)."""
        logger.info(
            "🔮 Calculando predicción individual para %s - partido %d",
            player_name,
            match_number,
        )
        prediction = self.injury_risk_predictor.predict_single(
            player_name=player_name,
            match_number=match_number,
        )
        return self._map_to_dashboard_schema(player_name, match_number, prediction)

    def build_batch_dashboard_predictions(
        self,
        player_names: list[str],
        match_number: int,
    ) -> dict[str, DashboardPredictionResponseSchema]:
        """Inferencia masiva combinando hit de caché y predicción ML optimizada en bloque."""
        results = {}
        players_to_process = []

        # 1. Separar Hits de Misses en el caché
        for player_name in player_names:
            key = hashkey(player_name, match_number)
            if key in _dashboard_prediction_cache:
                results[player_name] = _dashboard_prediction_cache[key]
            else:
                players_to_process.append(player_name)

        if not players_to_process:
            return results

        logger.info(
            "🚀 Procesando batch ML para %d jugadores faltantes en caché (partido %d)",
            len(players_to_process),
            match_number,
        )

        # 2. Inferencia en bloque (sólo para los que no estaban en caché)
        predictions = self.injury_risk_predictor.predict_batch(
            player_names=players_to_process,
            match_number=match_number,
        )

        # 3. Mapear resultados y popular el caché manualmente
        for player_name, prediction in predictions.items():
            mapped_result = self._map_to_dashboard_schema(
                player_name, match_number, prediction
            )
            key = hashkey(player_name, match_number)
            _dashboard_prediction_cache[key] = mapped_result
            results[player_name] = mapped_result

        return results

    def clear_prediction_cache(self) -> None:
        """Limpia el caché de predicciones."""
        _dashboard_prediction_cache.clear()
        logger.info("🧹 Caché de predicciones limpiado")
