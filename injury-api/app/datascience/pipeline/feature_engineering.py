"""
Feature Engineering — Construcción de la matriz consolidada jugador-sensor.

Este módulo implementa el "join fisiológico": la estrategia de cruce entre
jugadores FIFA y registros de sensores médicos usando llaves sintéticas
(edad discretizada + BMI redondeado) como proxy de similitud física.
"""

import logging

import pandas as pd

from app.datascience.schema.columns import JoinKeys, PlayerColumns

logger = logging.getLogger(__name__)


def build_combined_player_sensor_matrix(
    players_dataframe: pd.DataFrame,
    soccer_sensor_matrix: pd.DataFrame,
) -> pd.DataFrame:
    """
    Ejecuta el join fisiológico entre jugadores FIFA y sensores médicos.

    Estrategia de cruce:
      - No existe un ID directo entre los dos datasets
      - Usamos join_age (edad entera) y join_bmi (BMI redondeado) como
        llaves de cruce, asumiendo que atletas con edad y contextura
        similar exhiben patrones fisiológicos comparables
      - El join es INNER: solo conservamos jugadores que tengan al menos
        un registro de sensor con perfil físico compatible

    Args:
        players_dataframe: Jugadores FIFA con BMI calculado y llaves de cruce.
        soccer_sensor_matrix: Datos de sensores filtrados y limpios.

    Returns:
        Matriz consolidada con datos de jugadores + sensores médicos.
    """
    combined = pd.merge(
        players_dataframe[
            [PlayerColumns.SHORT_NAME, JoinKeys.JOIN_AGE, JoinKeys.JOIN_BMI]
        ],
        soccer_sensor_matrix,
        on=[JoinKeys.JOIN_AGE, JoinKeys.JOIN_BMI],
        how="inner",
    )
    logger.info(
        "Mapeo completado. Matriz consolidada generada con %d muestras.",
        len(combined),
    )
    return combined
