"""
Predictor de riesgo de lesión — capa de inferencia.

Este módulo orquesta la predicción de riesgo de lesión para un jugador
en un partido específico, cruzando datos del fixture, clima histórico
y el modelo entrenado.

NOTA: Este módulo NO depende de FastAPI ni de Pydantic.
Los esquemas de respuesta HTTP se construyen en la capa API.
"""

import logging
from dataclasses import dataclass

import pandas as pd
from cachetools import TTLCache, cached
from cachetools.keys import hashkey

from app.datascience.model_context import TrainedModelContext
from app.datascience.schema.columns import FixtureColumns, PlayerColumns
from app.datascience.schema.feature_vector import FeatureVector
from app.infrastructure.weather_client import HistoricalWeatherClient

logger = logging.getLogger(__name__)

# Caché de clima por partido (1 hora TTL)
_weather_cache: TTLCache = TTLCache(maxsize=100, ttl=3600)


@dataclass(frozen=True)
class InjuryPredictionResult:
    """
    Resultado de la predicción de riesgo de lesión (puro, sin esquema HTTP).

    Este dataclass es el contrato entre la capa de ciencia de datos
    y la capa de servicios/API.
    """

    player_name: str
    match_number: int
    stage_name: str
    city_name: str
    venue_name: str
    kickoff_date: str
    ambient_temperature_celsius: float
    humidity_percent: float
    risk_level: int


@dataclass(frozen=True)
class InjuryRiskPredictor:
    """
    Ejecuta predicciones de riesgo cruzando fixture, clima y el modelo.

    No conoce nada de HTTP, FastAPI ni esquemas Pydantic.
    Solo trabaja con DataFrames y el algoritmo entrenado.
    """

    context: TrainedModelContext
    weather_client: HistoricalWeatherClient

    @cached(
        cache=_weather_cache,
        key=lambda self, match_number, match_row: hashkey(match_number),
    )
    def _fetch_weather_for_match(
        self, match_number: int, match_row: pd.Series
    ) -> tuple[float, float]:
        """Obtiene el clima para un partido con caché y TTL."""
        kickoff_date = match_row[FixtureColumns.KICKOFF_AT].split()[0]
        logger.info(
            "🌍 Consultando clima en API externa para partido %d "
            "(coordenadas [%s, %s])",
            match_number,
            match_row[FixtureColumns.LATITUDE],
            match_row[FixtureColumns.LONGITUDE],
        )
        return self.weather_client.fetch_venue_climate_averages(
            latitude=float(match_row[FixtureColumns.LATITUDE]),
            longitude=float(match_row[FixtureColumns.LONGITUDE]),
            kickoff_date=kickoff_date,
        )

    def predict_single(
        self,
        player_name: str,
        match_number: int,
    ) -> InjuryPredictionResult:
        """Pronostica el riesgo de lesión de un jugador para un partido."""
        batch = self.predict_batch([player_name], match_number)
        if player_name not in batch:
            from app.core.exceptions import PlayerNotFoundError

            raise PlayerNotFoundError(
                f"No se pudo generar el pronóstico para {player_name}"
            )
        return batch[player_name]

    def predict_batch(
        self,
        player_names: list[str],
        match_number: int,
    ) -> dict[str, InjuryPredictionResult]:
        """
        Predice el riesgo de lesión para múltiples jugadores en un mismo partido.

        Optimizaciones:
          - El partido se busca una sola vez
          - El clima se consulta una sola vez (con caché automático)
          - La inferencia del modelo se ejecuta vectorizada en un solo batch
        """
        from app.core.exceptions import PlayerNotFoundError

        # 1. Localizar el partido en el fixture
        match_row = self._find_match(match_number)
        kickoff_date = match_row[FixtureColumns.KICKOFF_AT].split()[0]

        # 2. Obtener clima (cacheado automáticamente por match_number)
        ambient_temperature, humidity = self._fetch_weather_for_match(
            match_number, match_row
        )

        # 3. Construir batch de vectores de features
        all_feature_vectors: list[list[float]] = []
        valid_player_names: list[str] = []

        for player_name in player_names:
            try:
                player_profile = self._find_player_profile(player_name).iloc[0]

                # Construimos el vector de features inyectando las variables
                # ambientales (clima) que no están en el perfil del jugador
                feature_vector = []
                for feature_name in FeatureVector.ALL_FEATURES:
                    if feature_name == FeatureVector.AMBIENT_TEMPERATURE:
                        feature_vector.append(ambient_temperature)
                    elif feature_name == FeatureVector.HUMIDITY:
                        feature_vector.append(humidity)
                    else:
                        feature_vector.append(player_profile[feature_name])

                all_feature_vectors.append(feature_vector)
                valid_player_names.append(player_name)
            except PlayerNotFoundError:
                logger.warning("Jugador no encontrado: %s", player_name)
                continue

        if not all_feature_vectors:
            return {}

        # 4. Inferencia vectorizada delegada al algoritmo activo
        predictions = self.context.active_algorithm.predict(all_feature_vectors)

        # 5. Construir resultados
        results: dict[str, InjuryPredictionResult] = {}
        for name, risk_level in zip(valid_player_names, predictions):
            results[name] = InjuryPredictionResult(
                player_name=name.strip(),
                match_number=match_number,
                stage_name=str(match_row[FixtureColumns.STAGE_NAME]),
                city_name=str(match_row[FixtureColumns.CITY_NAME]),
                venue_name=str(match_row[FixtureColumns.VENUE_NAME]),
                kickoff_date=kickoff_date,
                ambient_temperature_celsius=ambient_temperature,
                humidity_percent=humidity,
                risk_level=int(risk_level),
            )

        logger.info(
            "Batch prediction completado: %d jugadores en partido %d",
            len(results),
            match_number,
        )
        return results

    def find_match(self, match_number: int) -> pd.Series:
        """Localiza un partido en el fixture (público para servicios)."""
        return self._find_match(match_number)

    def _find_match(self, match_number: int) -> pd.Series:
        """Localiza un partido en el fixture precargado."""
        from app.core.exceptions import MatchNotFoundError

        matches = self.context.fixture_dataframe[
            self.context.fixture_dataframe[FixtureColumns.MATCH_NUMBER]
            == match_number
        ]
        if matches.empty:
            raise MatchNotFoundError(
                f"El partido con número {match_number} no existe en el fixture.",
            )
        return matches.iloc[0]

    def _find_player_profile(self, player_name: str) -> pd.DataFrame:
        """Localiza el perfil biomédico del jugador en la matriz consolidada."""
        from app.core.exceptions import PlayerNotFoundError

        normalized_name = player_name.strip().lower()
        profiles = self.context.combined_player_sensor_matrix[
            self.context.combined_player_sensor_matrix[PlayerColumns.SHORT_NAME]
            .str.strip()
            .str.lower()
            == normalized_name
        ]
        if profiles.empty:
            raise PlayerNotFoundError(
                f"El futbolista '{player_name}' no pudo enlazarse "
                f"con los patrones biomédicos.",
            )
        return profiles

    def clear_weather_cache(self) -> None:
        """Limpia el caché de clima."""
        _weather_cache.clear()
        logger.info("🧹 Caché de clima limpiado")
