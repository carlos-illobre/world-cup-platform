"""Servicio de inferencia: pronóstico de riesgo de lesión en partidos del Mundial."""

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd

from app.core.application_state import WorldCupInjuryContext
from app.core.constants import (
    FixtureColumns,
    INJURY_RISK_DESCRIPTIONS,
    INJURY_RISK_LABELS,
    InjuryRiskLevel,
    ModelFeatures,
    PlayerColumns,
)
from app.core.exceptions import MatchNotFoundError, PlayerNotFoundError
from app.domain.schemas import (
    InjuryPredictionResponse,
    InjuryRiskResponse,
    MatchContextResponse,
    WeatherContextResponse,
)
from app.infrastructure.weather_client import HistoricalWeatherClient

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class InjuryPredictionService:
    """
    Orquesta la inferencia: cruza fixture, inyecta clima y ejecuta el modelo.
    Equivalente refactorizado de simular_pronostico_partido_real.
    """

    context: WorldCupInjuryContext
    weather_client: HistoricalWeatherClient

    def predict_match_injury_risk(
        self,
        player_name: str,
        match_number: int,
    ) -> InjuryPredictionResponse:
        """
        Pronostica el riesgo de lesión de un jugador para un partido específico.

        Args:
            player_name: Nombre corto del futbolista.
            match_number: Número de partido en el fixture.

        Raises:
            MatchNotFoundError: Si el partido no existe.
            PlayerNotFoundError: Si el jugador no tiene perfil biomédico.
        """
        match_row = self._find_match(match_number)
        kickoff_date = match_row[FixtureColumns.KICKOFF_AT].split()[0]

        ambient_temperature, humidity = self.weather_client.fetch_venue_climate_averages(
            latitude=float(match_row[FixtureColumns.LATITUDE]),
            longitude=float(match_row[FixtureColumns.LONGITUDE]),
            kickoff_date=kickoff_date,
        )

        player_profile = self._find_player_profile(player_name)
        sensor_record = player_profile.iloc[0].copy()
        sensor_record[ModelFeatures.AMBIENT_TEMPERATURE] = ambient_temperature
        sensor_record[ModelFeatures.HUMIDITY] = humidity

        risk_level = self._run_classifier(sensor_record)
        injury_risk_enum = InjuryRiskLevel(risk_level)

        logger.info(
            "Predicción completada — jugador=%s, partido=%d, riesgo=%s",
            player_name,
            match_number,
            injury_risk_enum.name,
        )

        return InjuryPredictionResponse(
            player_name=player_name.strip(),
            match=MatchContextResponse(
                match_number=match_number,
                stage_name=str(match_row[FixtureColumns.STAGE_NAME]),
                city_name=str(match_row[FixtureColumns.CITY_NAME]),
                venue_name=str(match_row[FixtureColumns.VENUE_NAME]),
                kickoff_date=kickoff_date,
            ),
            weather=WeatherContextResponse(
                ambient_temperature_celsius=ambient_temperature,
                humidity_percent=humidity,
            ),
            injury_risk=InjuryRiskResponse(
                risk_level=risk_level,
                risk_label=INJURY_RISK_LABELS[injury_risk_enum],
                description=INJURY_RISK_DESCRIPTIONS[injury_risk_enum],
            ),
        )

    def _find_match(self, match_number: int) -> pd.Series:
        """Localiza un partido en el fixture precargado."""
        matches = self.context.fixture_dataframe[
            self.context.fixture_dataframe[FixtureColumns.MATCH_NUMBER] == match_number
        ]

        if matches.empty:
            raise MatchNotFoundError(
                f"El partido con número {match_number} no existe en el fixture.",
            )

        return matches.iloc[0]

    def _find_player_profile(self, player_name: str) -> pd.DataFrame:
        """Localiza el perfil biomédico del jugador (búsqueda case-insensitive)."""
        normalized_name = player_name.strip().lower()
        profiles = self.context.combined_dataframe[
            self.context.combined_dataframe[PlayerColumns.SHORT_NAME]
            .str.strip()
            .str.lower()
            == normalized_name
        ]

        if profiles.empty:
            raise PlayerNotFoundError(
                f"El futbolista '{player_name}' no pudo enlazarse con los patrones biomédicos.",
            )

        return profiles

    def _run_classifier(self, sensor_record: pd.Series) -> int:
        """Estructura el vector de features, escala y ejecuta la predicción."""
        input_vector = np.array(
            [sensor_record[feature] for feature in ModelFeatures.FEATURES]
        ).reshape(1, -1)
        scaled_input = self.context.feature_scaler.transform(input_vector)
        return int(self.context.injury_classifier.predict(scaled_input)[0])
