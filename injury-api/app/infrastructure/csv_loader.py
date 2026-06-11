"""Carga y transformación de archivos CSV del Mundial 2026."""

import logging
import os
from pathlib import Path

import numpy as np
import pandas as pd

from app.config import settings

from app.core.constants import (
    DataFiles,
    FixtureColumns,
    JoinKeys,
    MedicalColumns,
    PlayerColumns,
    SoccerFilter,
    TeamColumns,
)

logger = logging.getLogger(__name__)

class FixtureRepository:
    """Construye el fixture relacional unificado a partir de múltiples CSV."""

    def __init__(self, data_dir: Path | None = None) -> None:
        self._data_dir = data_dir or settings.DATA_DIR

    def load_unified_fixture(self) -> pd.DataFrame:
        """Une partidos, ciudades, equipos, etapas y geolocalización."""
        matches = pd.read_csv(self._data_dir / DataFiles.MATCHES)
        cities = pd.read_csv(self._data_dir / DataFiles.HOST_CITIES).rename(
            columns={"id": FixtureColumns.CITY_ID}
        )
        teams = pd.read_csv(self._data_dir / DataFiles.TEAMS).rename(
            columns={"id": FixtureColumns.TEAM_ID}
        )
        home_teams = teams.rename(
            columns={
                FixtureColumns.TEAM_ID: FixtureColumns.HOME_TEAM_ID,
                TeamColumns.TEAM_NAME: FixtureColumns.HOME_TEAM_NAME,
                TeamColumns.FIFA_CODE: FixtureColumns.HOME_FIFA_CODE,
            }
        )
        away_teams = teams.rename(
            columns={
                FixtureColumns.TEAM_ID: FixtureColumns.AWAY_TEAM_ID,
                TeamColumns.TEAM_NAME: FixtureColumns.AWAY_TEAM_NAME,
                TeamColumns.FIFA_CODE: FixtureColumns.AWAY_FIFA_CODE,
            }
        )
        stages = pd.read_csv(self._data_dir / DataFiles.TOURNAMENT_STAGES).rename(
            columns={"id": FixtureColumns.STAGE_ID}
        )
        geo_data = pd.read_csv(self._data_dir / DataFiles.CITY_GEO_DATA)
        
        # NUEVO: Cargar mapping de estadios
        stadium_mapping = pd.read_csv(self._data_dir / "stadium_mapping.csv")
        
        fixture = matches.merge(cities, on=FixtureColumns.CITY_ID)
        fixture = fixture.merge(
            home_teams[
                [
                    FixtureColumns.HOME_TEAM_ID,
                    FixtureColumns.HOME_TEAM_NAME,
                    FixtureColumns.HOME_FIFA_CODE,
                ]
            ],
            on=FixtureColumns.HOME_TEAM_ID,
        )
        fixture = fixture.merge(
            away_teams[
                [
                    FixtureColumns.AWAY_TEAM_ID,
                    FixtureColumns.AWAY_TEAM_NAME,
                    FixtureColumns.AWAY_FIFA_CODE,
                ]
            ],
            on=FixtureColumns.AWAY_TEAM_ID,
        )
        fixture = fixture.merge(stages, on=FixtureColumns.STAGE_ID)
        fixture = fixture.merge(geo_data, on=FixtureColumns.CITY_ID)
        
        # NUEVO: Merge con stadium_mapping para obtener el filename
        fixture = fixture.merge(
            stadium_mapping[['stadium_name', 'filename']],
            left_on=FixtureColumns.VENUE_NAME,
            right_on='stadium_name',
            how='left'
        )
        
        fixture['stadium_url'] = fixture['filename'].apply(
            lambda x: f"{settings.BACKEND_URL}/static/stadiums/{x}" if pd.notna(x) else None
        )

        logger.info(
            "Fixture unificado correctamente. Total de partidos mapeados: %d",
            len(fixture),
        )
        return fixture


class MedicalDataRepository:
    """Procesa y sanitiza el dataset médico multimodal."""

    def __init__(self, data_dir: Path | None = None) -> None:
        self._data_dir = data_dir or settings.DATA_DIR  # <-- AGREGAR ESTO

    def load_soccer_sensor_matrix(self) -> pd.DataFrame:
        """Filtra fútbol, imputa faltantes y crea llaves de cruce."""
        raw_data = pd.read_csv(self._data_dir / DataFiles.MEDICAL_DATASET)
        soccer_data = raw_data[
            raw_data[MedicalColumns.SPORT_TYPE] == SoccerFilter.SPORT_TYPE_VALUE
        ].copy()

        logger.info(
            "Registros de Soccer aislados: %d de %d totales.",
            len(soccer_data),
            len(raw_data),
        )

        numeric_columns = soccer_data.select_dtypes(include=[np.number]).columns.drop(
            MedicalColumns.INJURY_OCCURRED
        )
        soccer_data[numeric_columns] = soccer_data[numeric_columns].fillna(
            soccer_data[numeric_columns].median()
        )

        soccer_data[JoinKeys.JOIN_AGE] = soccer_data[MedicalColumns.AGE].astype(int)
        soccer_data[JoinKeys.JOIN_BMI] = soccer_data[MedicalColumns.BMI].round(0).astype(int)

        logger.info("Imputación de datos faltantes completada.")
        return soccer_data


class PlayerRepository:
    """Carga jugadores FIFA y calcula métricas morfológicas."""

    def __init__(self, data_dir: Path | None = None) -> None:
        self._data_dir = data_dir or settings.DATA_DIR

    def load_players_with_bmi(self) -> pd.DataFrame:
        """Calcula BMI y llaves sintéticas para el join fisiológico."""
        players = pd.read_csv(self._data_dir / DataFiles.PLAYERS)

        players[PlayerColumns.BMI] = players[PlayerColumns.WEIGHT_KG] / (
            (players[PlayerColumns.HEIGHT_CM] / 100) ** 2
        )
        players[JoinKeys.JOIN_AGE] = players[PlayerColumns.AGE].astype(int)
        players[JoinKeys.JOIN_BMI] = players[PlayerColumns.BMI].round(0).astype(int)

        return players


def build_combined_player_sensor_matrix(
    players: pd.DataFrame,
    soccer_sensors: pd.DataFrame,
) -> pd.DataFrame:
    """Ejecuta el join fisiológico entre jugadores FIFA y sensores médicos."""
    combined = pd.merge(
        players[[PlayerColumns.SHORT_NAME, JoinKeys.JOIN_AGE, JoinKeys.JOIN_BMI]],
        soccer_sensors,
        on=[JoinKeys.JOIN_AGE, JoinKeys.JOIN_BMI],
        how="inner",
    )
    logger.info(
        "Mapeo completado. Matriz consolidada generada con %d muestras.",
        len(combined),
    )
    return combined