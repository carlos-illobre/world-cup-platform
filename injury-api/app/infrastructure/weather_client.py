"""Cliente HTTP para consultar clima histórico de sedes del Mundial."""

import logging

import numpy as np
import requests

from app.config import (
    WEATHER_ARCHIVE_BASE_URL,
    WEATHER_FALLBACK_HUMIDITY,
    WEATHER_FALLBACK_TEMPERATURE,
    WEATHER_HISTORICAL_YEARS,
)

logger = logging.getLogger(__name__)


class HistoricalWeatherClient:
    """
    Consulta la Historical Weather API de Open-Meteo.
    Promedia las métricas horarias de los últimos años para la misma fecha del fixture.
    """

    def fetch_venue_climate_averages(
        self,
        latitude: float,
        longitude: float,
        kickoff_date: str,
    ) -> tuple[float, float]:
        """
        Obtiene temperatura y humedad promedio históricas para una sede y fecha.

        Args:
            latitude: Latitud del estadio.
            longitude: Longitud del estadio.
            kickoff_date: Fecha del partido en formato YYYY-MM-DD.

        Returns:
            Tupla (temperatura °C, humedad %).
        """
        month_day = kickoff_date.split("-", 1)[1]
        temperatures: list[float] = []
        humidities: list[float] = []

        logger.info(
            "Consultando clima histórico para coordenadas [%.4f, %.4f] en %s",
            latitude,
            longitude,
            month_day,
        )

        for year in WEATHER_HISTORICAL_YEARS:
            historical_date = f"{year}-{month_day}"
            url = (
                f"{WEATHER_ARCHIVE_BASE_URL}"
                f"?latitude={latitude}&longitude={longitude}"
                f"&start_date={historical_date}&end_date={historical_date}"
                f"&hourly=temperature_2m,relative_humidity_2m"
            )

            try:
                response = requests.get(url, timeout=30)
                response.raise_for_status()
                payload = response.json()

                if "hourly" not in payload:
                    continue

                temperatures.append(float(np.mean(payload["hourly"]["temperature_2m"])))
                humidities.append(float(np.mean(payload["hourly"]["relative_humidity_2m"])))
            except (requests.RequestException, KeyError, TypeError, ValueError):
                logger.warning(
                    "No se pudo obtener clima histórico para %s", historical_date
                )
                continue

        if temperatures and humidities:
            return round(float(np.mean(temperatures)), 1), round(float(np.mean(humidities)), 1)

        logger.warning(
            "Usando valores de contingencia climática por falla en la API histórica."
        )
        return WEATHER_FALLBACK_TEMPERATURE, WEATHER_FALLBACK_HUMIDITY
