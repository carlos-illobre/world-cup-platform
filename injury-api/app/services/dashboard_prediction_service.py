"""Servicio que arma la respuesta completa del dashboard a partir del modelo y los CSV."""

import math
from dataclasses import dataclass

import pandas as pd

from app.core.constants import (
    DASHBOARD_AI_STATUS_LABELS,
    DASHBOARD_AI_VERDICTS,
    FixtureColumns,
    InjuryRiskLevel,
    ModelFeatures,
    PlayerColumns,
    TeamColumns,
)
from app.core.team_flags import build_flag_url
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
from app.services.injury_prediction_service import InjuryPredictionService


def _to_percent(value: float) -> int:
    """Normaliza métricas del sensor a porcentaje 0-100."""
    numeric = float(value)
    if numeric <= 1.0:
        numeric *= 100
    return int(max(0, min(100, round(numeric))))


def _stress_label(stress_value: float) -> str:
    percent = _to_percent(stress_value)
    if percent < 40:
        return "LOW"
    if percent < 65:
        return "MODERATE"
    return "HIGH"


def _rating_label(sleep_quality_percent: int) -> str:
    if sleep_quality_percent >= 85:
        return "EXCELLENT"
    if sleep_quality_percent >= 70:
        return "GOOD"
    return "FAIR"


def _series_around(base: float, count: int, spread: float) -> list[int]:
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
        "Moderate" if fatigue_percent < 40 else "Elevated" if fatigue_percent < 60 else "High"
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

    injury_prediction_service: InjuryPredictionService
    players_dataframe: pd.DataFrame
    nationality_to_fifa: dict[str, str]

    def build_dashboard_prediction(
        self,
        player_name: str,
        match_number: int,
    ) -> DashboardPredictionResponseSchema:
        """Ejecuta inferencia y mapea el resultado al payload del dashboard."""
        core_prediction = self.injury_prediction_service.predict_match_injury_risk(
            player_name=player_name,
            match_number=match_number,
        )
        player_row = self._find_player_row(player_name)
        sensor_row = self._find_sensor_row(player_name)
        risk_level = InjuryRiskLevel(core_prediction.injury_risk.risk_level)

        sleep_quality = _to_percent(sensor_row["sleep_quality"])
        hydration = _to_percent(sensor_row["hydration_level"])
        fatigue_index = _to_percent(sensor_row["fatigue_index"])
        heart_rate = int(round(float(sensor_row["heart_rate"])))

        nationality = str(player_row[PlayerColumns.NATIONALITY_NAME])
        team_code = self.nationality_to_fifa.get(nationality, "UNK")
        jersey_number = player_row.get(PlayerColumns.NATION_JERSEY_NUMBER)
        if pd.isna(jersey_number):
            jersey_number = player_row.get("club_jersey_number", 0)

        match_row = self.injury_prediction_service._find_match(match_number)
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
            away.name if team_code == str(match_row[FixtureColumns.HOME_FIFA_CODE]) else home.name
        )

        altitude_m = float(match_row.get(FixtureColumns.ALTITUDE, sensor_row.get("altitude", 0)))

        player_data = PlayerDataSchema(
            id=player_name,
            name=player_name,
            number=int(jersey_number),
            national_team=nationality,
            team_code=team_code,
            flag_url=build_flag_url(
                team_code,
                player_row.get(PlayerColumns.NATION_FLAG_URL),
            ),
            face_url=str(player_row.get(PlayerColumns.PLAYER_FACE_URL, "")),
            rating_label=_rating_label(sleep_quality),
            stats=PlayerStatsSchema(
                sleep_quality=sleep_quality,
                hydration=hydration,
                body_temp=round(float(sensor_row["body_temperature"]), 1),
                stress=_stress_label(float(sensor_row["stress_level"])),
                fatigue_index=fatigue_index,
                heart_rate_bpm=heart_rate,
                heart_rate_series=[
                    int(round(heart_rate + math.sin(index / 2.2) * 7))
                    for index in range(48)
                ],
                training=TrainingSeriesSchema(
                    duration=_series_around(float(sensor_row["training_duration"]), 8, 30),
                    load=_series_around(float(sensor_row["training_load"]), 7, 40),
                    intensity=_series_around(float(sensor_row["training_intensity"]), 7, 35),
                ),
            ),
            radar=RadarMetricsSchema(
                cardio=_to_percent(sensor_row["heart_rate"] / 2),
                endurance=_to_percent(sensor_row["recovery_score"]),
                engagement=_to_percent(sensor_row["training_intensity"]),
                respiratory=_to_percent(sensor_row["altitude"]),
                recovery=_to_percent(sensor_row["recovery_score"]),
            ),
        )

        venue = f"{core_prediction.match.venue_name}, {core_prediction.match.city_name}"
        match_context = MatchContextSchema(
            id=str(match_number),
            label=f"{home.code} vs {away.code}",
            opponent=opponent,
            venue=venue,
            stadium_url=f"https://picsum.photos/seed/worldcup-{match_number}/900/500",
            home=home,
            away=away,
            weather=MatchWeatherSchema(
                temp_c=core_prediction.weather.ambient_temperature_celsius,
                humidity=core_prediction.weather.humidity_percent,
                altitude=altitude_m,
            ),
        )

        ai_inference = AiInferenceSchema(
            class_=int(risk_level),
            label=(
                f"{DASHBOARD_AI_STATUS_LABELS[risk_level]} / "
                f"{DASHBOARD_AI_VERDICTS[risk_level]}"
            ),
            justification=_build_justification(
                risk_level,
                altitude_m,
                fatigue_index,
            ),
        )

        return DashboardPredictionResponseSchema(
            data=DashboardPredictionDataSchema(
                player=player_data,
                match_context=match_context,
                ai_inference=ai_inference,
            )
        )

    def _find_player_row(self, player_name: str) -> pd.Series:
        players = self.players_dataframe[
            self.players_dataframe[PlayerColumns.SHORT_NAME].str.strip().str.lower()
            == player_name.strip().lower()
        ]
        return players.iloc[0]

    def _find_sensor_row(self, player_name: str) -> pd.Series:
        combined = self.injury_prediction_service.context.combined_dataframe
        profiles = combined[
            combined[PlayerColumns.SHORT_NAME].str.strip().str.lower()
            == player_name.strip().lower()
        ]
        return profiles.iloc[0]
