"""Servicio de inferencia: pronóstico de riesgo de lesión en partidos del Mundial."""

import logging
from dataclasses import dataclass, field
from typing import Tuple
import pandas as pd
from cachetools import TTLCache, cached
from cachetools.keys import hashkey

# Caché global para el clima: 1 hora (3600 segundos), máximo 100 partidos
weather_cache = TTLCache(maxsize=100, ttl=3600)

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
    """

    context: WorldCupInjuryContext
    weather_client: HistoricalWeatherClient
    
    @cached(cache=weather_cache, key=lambda self, match_number, match_row: hashkey(match_number)) 
    def _get_weather_for_match(self, match_number: int, match_row: pd.Series) -> tuple[float, float]:
        """
        Obtiene el clima para un partido con caché y TTL.
        """
        kickoff_date = match_row[FixtureColumns.KICKOFF_AT].split()[0]
        
        logger.info(
            f"🌍 Consultando clima en API externa para partido {match_number} "
            f"(coordenadas [{match_row[FixtureColumns.LATITUDE]}, {match_row[FixtureColumns.LONGITUDE]}])"
        )
        
        return self.weather_client.fetch_venue_climate_averages(
            latitude=float(match_row[FixtureColumns.LATITUDE]),
            longitude=float(match_row[FixtureColumns.LONGITUDE]),
            kickoff_date=kickoff_date,
        )


    def predict_match_injury_risk(
        self,
        player_name: str,
        match_number: int,
    ) -> InjuryPredictionResponse:
        """Pronostica el riesgo de lesión de un jugador para un partido específico."""
        match_row = self._find_match(match_number)
        
        # Usar el método cacheado con TTL
        ambient_temperature, humidity = self._get_weather_for_match(match_number, match_row)

        player_profile = self._find_player_profile(player_name)
        sensor_record = player_profile.iloc[0].copy()
        sensor_record[ModelFeatures.AMBIENT_TEMPERATURE] = ambient_temperature
        sensor_record[ModelFeatures.HUMIDITY] = humidity

        risk_level = self._run_classifier(sensor_record)
        injury_risk_enum = InjuryRiskLevel(risk_level)
        
        kickoff_date = match_row[FixtureColumns.KICKOFF_AT].split()[0]

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
        """Localiza el perfil biomédico del jugador."""
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
        import pandas as pd
        
        input_dict = {feature: [sensor_record[feature]] for feature in ModelFeatures.FEATURES}
        input_df = pd.DataFrame(input_dict)
        scaled_input = self.context.feature_scaler.transform(input_df)
        return int(self.context.injury_classifier.predict(scaled_input)[0])
    
    # Método opcional para limpiar caché manualmente
    def clear_weather_cache(self) -> None:
        """Limpia el caché de clima (útil para testing o recarga forzada)."""
        self._weather_cache.clear()
        logger.info("🧹 Caché de clima limpiado")

    def predict_batch_injury_risk(
        self,
        player_names: list[str],
        match_number: int,
    ) -> dict[str, InjuryPredictionResponse]:
        """
        Predice el riesgo de lesión para múltiples jugadores en el mismo partido.
        Optimizado: clima se consulta una sola vez, features se procesan en batch.
        """
        # 1. Obtener el partido una sola vez
        match_row = self._find_match(match_number)
        kickoff_date = match_row[FixtureColumns.KICKOFF_AT].split()[0]
        
        # 2. Obtener clima una sola vez (ya cacheado automáticamente)
        ambient_temperature, humidity = self._get_weather_for_match(match_number, match_row)
        
        # 3. Preparar batch de features para todos los jugadores
        all_features = []
        valid_players = []
        
        for player_name in player_names:
            try:
                player_profile = self._find_player_profile(player_name)
                sensor_record = player_profile.iloc[0].copy()
                sensor_record[ModelFeatures.AMBIENT_TEMPERATURE] = ambient_temperature
                sensor_record[ModelFeatures.HUMIDITY] = humidity
                
                # Extraer features como lista
                features = [sensor_record[feature] for feature in ModelFeatures.FEATURES]
                all_features.append(features)
                valid_players.append(player_name)
            except PlayerNotFoundError:
                logger.warning(f"Jugador no encontrado: {player_name}")
                continue
        
        if not all_features:
            return {}
        
        # 4. Escalar TODOS los features en UNA sola operación
        scaled_features = self.context.feature_scaler.transform(all_features)
        
        # 5. Predecir TODOS los jugadores en UNA sola operación
        predictions = self.context.injury_classifier.predict(scaled_features)
        
        # 6. Construir resultados
        results = {}
        for player_name, risk_level in zip(valid_players, predictions):
            injury_risk_enum = InjuryRiskLevel(int(risk_level))
            
            results[player_name] = InjuryPredictionResponse(
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
                    risk_level=int(risk_level),
                    risk_label=INJURY_RISK_LABELS[injury_risk_enum],
                    description=INJURY_RISK_DESCRIPTIONS[injury_risk_enum],
                ),
            )
        
        logger.info(f"Batch prediction completado: {len(results)} jugadores en partido {match_number}")
        return results
    
    def clear_weather_cache(self) -> None:
        """Limpia el caché de clima."""
        weather_cache.clear()
        logger.info("🧹 Caché de clima limpiado")