"""
Interfaz abstracta para algoritmos de predicción de riesgo de lesión.

Todos los algoritmos disponibles en la carpeta algorithms/ deben
heredar de esta clase e implementar sus métodos abstractos.

El registro automático (Open/Closed Principle) se encarga de descubrir
todas las implementaciones sin necesidad de importarlas manualmente.
"""

from abc import ABC, abstractmethod
from typing import Any

import numpy as np
import pandas as pd


class InjuryRiskAlgorithm(ABC):
    """
    Contrato que deben cumplir todos los algoritmos de predicción
    de riesgo de lesión por fatiga extrema.
    """

    @property
    @abstractmethod
    def algorithm_name(self) -> str:
        """
        Nombre legible del algoritmo para mostrar en la API.
        Ejemplo: 'Random Forest Classifier', 'Gradient Boosting', etc.
        """

    @abstractmethod
    def fit(self, feature_matrix: pd.DataFrame, target_labels: pd.Series) -> Any:
        """
        Entrena el modelo con la matriz de features y las etiquetas objetivo.

        Args:
            feature_matrix: DataFrame con las features de entrenamiento.
            target_labels: Series con la variable objetivo (injury_occurred).
        """

    @abstractmethod
    def predict(self, feature_vectors: list[list[float]]) -> np.ndarray:
        """
        Predice el nivel de riesgo de lesión para cada vector de features.

        Args:
            feature_vectors: Lista de listas (matriz 2D) con los valores
                de cada feature en el orden definido por FeatureVector.

        Returns:
            Array de enteros con las predicciones (0=healthy, 1=low_risk, 2=critical).
        """
