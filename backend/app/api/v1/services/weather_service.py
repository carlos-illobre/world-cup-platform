"""
Weather Service
================
Fetches weather forecast/historical data from Open-Meteo API for match venues.
Uses the Historical Weather API for past dates and Forecast API for future dates.
Results are cached in-memory to avoid repeated API calls.

API Docs: https://open-meteo.com/en/docs/historical-weather-api
"""

import httpx
import logging
from datetime import datetime, date
from typing import Optional

logger = logging.getLogger(__name__)

# In-memory cache: key = (lat, lon, date_str) → weather dict
_weather_cache: dict[tuple, dict] = {}

OPEN_METEO_HISTORICAL_URL = "https://archive-api.open-meteo.com/v1/archive"
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


def _parse_date(date_str: str) -> Optional[date]:
    """Parse date from various formats."""
    if not date_str:
        return None
    try:
        # Handle ISO format with timezone: 2026-06-11 15:00:00-06
        clean = date_str.split(" ")[0] if " " in date_str else date_str[:10]
        return datetime.strptime(clean, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def get_weather_for_venue(
    latitude: float,
    longitude: float,
    match_date_str: str,
) -> Optional[dict]:
    """
    Fetches weather data for a specific venue and date.

    Returns dict with:
        temp_max: float (°C)
        temp_min: float (°C)
        precipitation: float (mm)
        wind_speed_max: float (km/h)
        humidity: int (%)

    Returns None if the API call fails or data is unavailable.
    """
    if latitude is None or longitude is None:
        return None

    match_date = _parse_date(match_date_str)
    if match_date is None:
        return None

    # Check cache
    cache_key = (round(latitude, 3), round(longitude, 3), match_date.isoformat())
    if cache_key in _weather_cache:
        return _weather_cache[cache_key]

    today = date.today()
    date_str = match_date.isoformat()

    try:
        if match_date <= today:
            # Historical data
            url = OPEN_METEO_HISTORICAL_URL
            params = {
                "latitude": latitude,
                "longitude": longitude,
                "start_date": date_str,
                "end_date": date_str,
                "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
                "timezone": "auto",
            }
        else:
            # Future date — use forecast API (works for up to 16 days ahead)
            # or climate averages for dates further out
            url = OPEN_METEO_FORECAST_URL
            params = {
                "latitude": latitude,
                "longitude": longitude,
                "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
                "timezone": "auto",
                "start_date": date_str,
                "end_date": date_str,
            }

        with httpx.Client(timeout=5.0) as client:
            response = client.get(url, params=params)

        if response.status_code != 200:
            logger.warning(
                f"Open-Meteo returned {response.status_code} for ({latitude}, {longitude}, {date_str})"
            )
            return None

        data = response.json()
        daily = data.get("daily", {})

        if not daily or not daily.get("temperature_2m_max"):
            return None

        weather = {
            "temp_max": daily["temperature_2m_max"][0],
            "temp_min": daily["temperature_2m_min"][0] if daily.get("temperature_2m_min") else None,
            "precipitation": daily["precipitation_sum"][0] if daily.get("precipitation_sum") else 0.0,
            "wind_speed_max": daily["wind_speed_10m_max"][0] if daily.get("wind_speed_10m_max") else None,
            "humidity": None,  # Not available in daily endpoint without hourly
        }

        # Cache the result
        _weather_cache[cache_key] = weather
        return weather

    except Exception as e:
        logger.warning(f"Weather fetch failed for ({latitude}, {longitude}, {date_str}): {e}")
        return None


def get_venue_geoclimatic_info(
    stadium_df,
    city_id,
    match_date_str: str,
) -> Optional[dict]:
    """
    Combines venue geographic data (from world_cup_stadiums.csv) with
    real-time weather data from Open-Meteo.

    Returns a dict with full geoclimatic context:
        city, country, capacity, roof_type, surface,
        latitude, longitude, elevation_m,
        weather: { temp_max, precipitation, wind_speed_max, ... }
    """
    import pandas as pd

    if stadium_df is None or stadium_df.empty:
        return None
    if pd.isna(city_id):
        return None

    # stadium_df is indexed by 'ID' (stadium_id)
    if city_id not in stadium_df.index:
        return None

    venue = stadium_df.loc[city_id]

    lat = venue.get("Latitude")
    lon = venue.get("Longitude")

    geo_info = {
        "city": str(venue.get("City", "")) if pd.notna(venue.get("City")) else None,
        "country": str(venue.get("Country", "")) if pd.notna(venue.get("Country")) else None,
        "capacity": int(venue.get("Capacity", 0)) if pd.notna(venue.get("Capacity")) else None,
        "roof_type": str(venue.get("Roof_Type", "")) if pd.notna(venue.get("Roof_Type")) else None,
        "surface": str(venue.get("Surface", "")) if pd.notna(venue.get("Surface")) else None,
        "latitude": float(lat) if pd.notna(lat) else None,
        "longitude": float(lon) if pd.notna(lon) else None,
        "elevation_m": int(venue.get("Elevation_m", 0)) if pd.notna(venue.get("Elevation_m")) else None,
    }

    # Fetch weather if we have coordinates
    weather = None
    if pd.notna(lat) and pd.notna(lon) and match_date_str:
        weather = get_weather_for_venue(float(lat), float(lon), match_date_str)

    geo_info["weather"] = weather
    return geo_info
