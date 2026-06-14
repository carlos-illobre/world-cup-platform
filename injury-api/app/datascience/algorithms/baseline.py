"""
Algoritmo: Baseline (control).

Estrategia de control que siempre predice 0 (HEALTHY).
Útil para establecer una línea base de comparación y para
pruebas unitarias donde no se necesita un modelo entrenado.
"""

from typing import Any

import numpy as np
import pandas as pd

from app.datascience.algorithms.base_algorithm import InjuryRiskAlgorithm


class BaselineAlgorithm(InjuryRiskAlgorithm):
    """Predictor constante que siempre retorna HEALTHY (riesgo 0)."""

    @property
    def algorithm_name(self) -> str:
        return "Baseline (Always Healthy)"

    def fit(self, feature_matrix: pd.DataFrame, target_labels: pd.Series) -> None:
        """No requiere entrenamiento — siempre predice la misma clase."""

    def predict(self, feature_vectors: list[list[float]]) -> np.ndarray:
        """Retorna un array de ceros (HEALTHY) con la longitud del input."""
        return np.zeros(len(feature_vectors), dtype=int)
