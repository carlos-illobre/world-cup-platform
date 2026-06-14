"""
Algoritmo: Random Forest Classifier con MinMax Scaler.

Estrategia de producción que combina normalización MinMax con un
clasificador Random Forest en un Pipeline de scikit-learn.
El uso de Pipeline asegura que el escalador y el modelo viajen juntos,
simplificando el código y previniendo data leakage.
"""

from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import MinMaxScaler

from app.config import settings
from app.datascience.algorithms.base_algorithm import InjuryRiskAlgorithm


class RandomForestAlgorithm(InjuryRiskAlgorithm):
    """Random Forest Classifier con normalización MinMax en Pipeline."""

    @property
    def algorithm_name(self) -> str:
        return "Random Forest Classifier"

    def __init__(self) -> None:
        self._pipeline = Pipeline(
            [
                ("scaler", MinMaxScaler()),
                (
                    "classifier",
                    RandomForestClassifier(
                        n_estimators=settings.ML_N_ESTIMATORS,
                        class_weight="balanced",
                        random_state=settings.ML_RANDOM_STATE,
                    ),
                ),
            ]
        )

    def fit(self, feature_matrix: pd.DataFrame, target_labels: pd.Series) -> None:
        """Entrena el pipeline completo (escalado + clasificación)."""
        self._pipeline.fit(feature_matrix, target_labels)

    def predict(self, feature_vectors: list[list[float]]) -> np.ndarray:
        """
        Predice usando el pipeline entrenado.
        Scikit-learn procesa listas 2D mucho más rápido que DataFrames.
        """
        return self._pipeline.predict(feature_vectors)
