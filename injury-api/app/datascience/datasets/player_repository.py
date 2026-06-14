"""
Repositorio de jugadores FIFA.

Carga el dataset de jugadores y calcula métricas morfológicas (BMI)
necesarias para el cruce fisiológico con el dataset médico.
"""

import logging
from pathlib import Path

import pandas as pd

from app.datascience.datasets.catalog import DatasetCatalog
from app.datascience.schema.columns import JoinKeys, PlayerColumns

logger = logging.getLogger(__name__)


class PlayerRepository:
    """Carga jugadores FIFA y calcula métricas morfológicas."""

    def __init__(self, data_dir: Path) -> None:
        self._data_dir = data_dir

    def load_players_with_bmi(self) -> pd.DataFrame:
        """
        Carga el dataset de jugadores FIFA, calcula el BMI (Índice de Masa
        Corporal) y genera llaves sintéticas para el join fisiológico.

        El BMI se calcula como: peso_kg / (altura_cm / 100)²
        Las llaves join_age y join_bmi se discretizan para permitir el
        cruce con el dataset de sensores médicos.

        Returns:
            DataFrame de jugadores con BMI calculado y llaves de cruce.
        """
        players = pd.read_csv(self._data_dir / DatasetCatalog.PLAYERS_FIFA)

        # ── Cálculo del BMI (Índice de Masa Corporal) ──
        players[PlayerColumns.BMI] = players[PlayerColumns.WEIGHT_KG] / (
            (players[PlayerColumns.HEIGHT_CM] / 100) ** 2
        )

        # ── Llaves sintéticas para el cruce fisiológico ──
        players[JoinKeys.JOIN_AGE] = players[PlayerColumns.AGE].astype(int)
        players[JoinKeys.JOIN_BMI] = players[PlayerColumns.BMI].round(0).astype(int)

        return players
