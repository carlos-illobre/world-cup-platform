"""
Contexto del modelo entrenado — artefactos producidos por el pipeline.

Este contenedor inmutable agrupa todos los DataFrames y objetos necesarios
para la inferencia. Se construye una sola vez durante el arranque del
servidor y se comparte entre todos los endpoints.

NOTA: Este módulo NO depende de FastAPI ni de Pydantic.
Los esquemas del dashboard se construyen en la capa de servicios.
"""

from dataclasses import dataclass

import pandas as pd

from app.datascience.algorithms.base_algorithm import InjuryRiskAlgorithm


@dataclass(frozen=True)
class TrainedModelContext:
    """
    Contenedor inmutable con los artefactos del pipeline de ciencia de datos.

    Attributes:
        fixture_dataframe: Fixture relacional unificado del Mundial 2026.
        combined_player_sensor_matrix: Matriz consolidada jugador ↔ sensores.
        players_dataframe: Jugadores FIFA con BMI y llaves de cruce.
        active_algorithm: Algoritmo entrenado activo para inferencia.
        nationality_to_fifa_code: Mapeo nationality_name → fifa_code.
        active_algorithm_key: Clave del algoritmo activo en el registro.
    """

    fixture_dataframe: pd.DataFrame
    combined_player_sensor_matrix: pd.DataFrame
    players_dataframe: pd.DataFrame
    active_algorithm: InjuryRiskAlgorithm
    nationality_to_fifa_code: dict[str, str]
    active_algorithm_key: str
