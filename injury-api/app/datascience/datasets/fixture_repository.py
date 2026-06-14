"""
Repositorio del fixture relacional del Mundial 2026.

Construye un DataFrame unificado a partir de múltiples CSV relacionales
(partidos, ciudades, equipos, etapas, geolocalización, estadios).
"""

import logging
from pathlib import Path

import pandas as pd

from app.datascience.datasets.catalog import DatasetCatalog
from app.datascience.schema.columns import (
    FixtureColumns,
    GeoDataColumns,
    StadiumMappingColumns,
    TeamColumns,
)

logger = logging.getLogger(__name__)


class FixtureRepository:
    """Construye el fixture relacional unificado a partir de múltiples CSV."""

    def __init__(self, data_dir: Path, backend_url: str) -> None:
        self._data_dir = data_dir
        self._backend_url = backend_url

    def load_unified_fixture(self) -> pd.DataFrame:
        """
        Une partidos, ciudades, equipos, etapas, geolocalización y estadios
        en un único DataFrame "plano" donde cada fila es un partido completo.
        """
        # ── Carga de CSVs individuales ──
        matches = pd.read_csv(self._data_dir / DatasetCatalog.MATCHES)
        cities = pd.read_csv(self._data_dir / DatasetCatalog.HOST_CITIES).rename(
            columns={"id": FixtureColumns.CITY_ID}
        )
        teams = pd.read_csv(self._data_dir / DatasetCatalog.TEAMS).rename(
            columns={"id": FixtureColumns.TEAM_ID}
        )
        stages = pd.read_csv(self._data_dir / DatasetCatalog.TOURNAMENT_STAGES).rename(
            columns={"id": FixtureColumns.STAGE_ID}
        )
        geo_data = pd.read_csv(self._data_dir / DatasetCatalog.CITY_GEO_DATA).rename(
            columns={GeoDataColumns.ALTITUDE_METERS: FixtureColumns.ALTITUDE}
        )
        stadium_mapping = pd.read_csv(
            self._data_dir / DatasetCatalog.STADIUM_MAPPING
        )

        # ── Preparación de equipos local y visitante ──
        # Duplicamos la tabla de equipos renombrando las columnas para que
        # el merge produzca columnas diferenciadas: home_team_name vs away_team_name
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

        # ── Joins relacionales ──
        # Cada merge agrega columnas descriptivas al fixture usando IDs como clave
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

        # ── Join con estadios para obtener la URL de la imagen ──
        fixture = fixture.merge(
            stadium_mapping[
                [StadiumMappingColumns.STADIUM_NAME, StadiumMappingColumns.FILENAME]
            ],
            left_on=FixtureColumns.VENUE_NAME,
            right_on=StadiumMappingColumns.STADIUM_NAME,
            how="left",
        )
        fixture[FixtureColumns.STADIUM_URL] = fixture[
            StadiumMappingColumns.FILENAME
        ].apply(
            lambda filename: (
                f"{self._backend_url}/static/stadiums/{filename}"
                if pd.notna(filename)
                else None
            )
        )

        logger.info(
            "Fixture unificado correctamente. Total de partidos mapeados: %d",
            len(fixture),
        )
        return fixture
