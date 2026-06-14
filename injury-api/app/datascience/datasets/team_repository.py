"""
Repositorio de selecciones nacionales del Mundial 2026.

Carga el dataset de equipos y construye el diccionario de mapeo
nationality_name → fifa_code utilizado para vincular jugadores con equipos.
"""

import logging
from pathlib import Path

import pandas as pd

from app.datascience.datasets.catalog import DatasetCatalog
from app.datascience.schema.columns import TeamColumns

logger = logging.getLogger(__name__)


class TeamRepository:
    """Carga selecciones nacionales y construye mapeos de identificación."""

    def __init__(self, data_dir: Path) -> None:
        self._data_dir = data_dir

    def load_teams(self) -> pd.DataFrame:
        """Carga el dataset de selecciones del Mundial."""
        return pd.read_csv(self._data_dir / DatasetCatalog.TEAMS)

    def build_nationality_to_fifa_code(self) -> dict[str, str]:
        """
        Construye el diccionario que mapea nationality_name → fifa_code.

        Ejemplo: {"Argentina": "ARG", "Mexico": "MEX", ...}

        Este mapeo es necesario porque el dataset de jugadores FIFA usa
        nationality_name (texto libre) mientras que el fixture usa
        fifa_code (código de 3 letras).
        """
        teams_dataframe = self.load_teams()
        mapping = dict(
            zip(
                teams_dataframe[TeamColumns.TEAM_NAME],
                teams_dataframe[TeamColumns.FIFA_CODE],
                strict=False,
            )
        )
        logger.info(
            "Mapeo nationality → FIFA code construido. Total selecciones: %d",
            len(mapping),
        )
        return mapping
