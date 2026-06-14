"""
Repositorio del dataset médico multimodal de sensores deportivos.

Procesa y sanitiza los datos de sensores biomédicos, aislando los registros
de fútbol e imputando valores faltantes para el entrenamiento del modelo.
"""

import logging
from pathlib import Path

import numpy as np
import pandas as pd

from app.datascience.datasets.catalog import DatasetCatalog
from app.datascience.schema.columns import (
    JoinKeys,
    SOCCER_SPORT_TYPE_VALUE,
    SensorColumns,
)

logger = logging.getLogger(__name__)


class MedicalSensorRepository:
    """Procesa y sanitiza el dataset médico multimodal."""

    def __init__(self, data_dir: Path) -> None:
        self._data_dir = data_dir

    def load_soccer_sensor_matrix(self) -> pd.DataFrame:
        """
        Carga el dataset médico, filtra registros de fútbol,
        imputa valores faltantes y crea llaves de cruce fisiológico.

        Returns:
            DataFrame con datos de sensores de atletas de fútbol,
            limpio y listo para el join con jugadores FIFA.
        """
        # ── Carga del dataset completo ──
        raw_data = pd.read_csv(
            self._data_dir / DatasetCatalog.MEDICAL_SENSOR_DATA
        )

        # ── Filtrado: solo registros de fútbol (Soccer) ──
        # El dataset contiene múltiples deportes; aislamos solo Soccer
        # porque el modelo es específico para el contexto del Mundial
        soccer_data = raw_data[
            raw_data[SensorColumns.SPORT_TYPE] == SOCCER_SPORT_TYPE_VALUE
        ].copy()

        logger.info(
            "Registros de Soccer aislados: %d de %d totales.",
            len(soccer_data),
            len(raw_data),
        )

        # ── Imputación de valores faltantes ──
        # Usamos la mediana (en vez de la media) porque es más robusta
        # ante outliers, lo cual es preferible en datos médicos donde
        # los valores extremos son comunes y significativos
        numeric_columns = soccer_data.select_dtypes(
            include=[np.number]
        ).columns.drop(SensorColumns.INJURY_OCCURRED)
        soccer_data[numeric_columns] = soccer_data[numeric_columns].fillna(
            soccer_data[numeric_columns].median()
        )

        # ── Creación de llaves sintéticas para el cruce fisiológico ──
        # Discretizamos edad y BMI para poder cruzar con jugadores FIFA
        # que no tienen un athlete_id directo en el dataset médico
        soccer_data[JoinKeys.JOIN_AGE] = soccer_data[SensorColumns.AGE].astype(int)
        soccer_data[JoinKeys.JOIN_BMI] = (
            soccer_data[SensorColumns.BMI].round(0).astype(int)
        )

        logger.info("Imputación de datos faltantes completada.")
        return soccer_data
