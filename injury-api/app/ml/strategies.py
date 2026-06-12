from abc import ABC, abstractmethod
from typing import Any
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import MinMaxScaler
from sklearn.pipeline import Pipeline

from app.config import settings

class InjuryRiskStrategy(ABC):
    """Interfaz abstracta para los algoritmos de predicción de riesgo."""
    
    @abstractmethod
    def train(self, features: pd.DataFrame, target: pd.Series) -> Any:
        """Entrena el modelo y retorna métricas o el pipeline resultante."""
        pass

    @abstractmethod
    def predict(self, features: list[list[float]]) -> np.ndarray:
        """Recibe una lista de listas (matriz 2D) y retorna las predicciones."""
        pass

class RandomForestStrategy(InjuryRiskStrategy):
    """Estrategia de producción usando Random Forest y MinMax Scaler en un Pipeline."""
    
    def __init__(self) -> None:
        # El uso de Pipeline asegura que el escalador y el modelo viajen juntos,
        # simplificando el código y previniendo data leakage.
        self.pipeline = Pipeline([
            ("scaler", MinMaxScaler()),
            ("classifier", RandomForestClassifier(
                n_estimators=settings.ML_N_ESTIMATORS,
                class_weight="balanced",
                random_state=settings.ML_RANDOM_STATE,
            ))
        ])

    def train(self, features: pd.DataFrame, target: pd.Series) -> None:
        self.pipeline.fit(features, target)

    def predict(self, features: list[list[float]]) -> np.ndarray:
        # Scikit-learn procesa listas 2D mucho más rápido que DataFrames de Pandas
        return self.pipeline.predict(features)

class BaselineStrategy(InjuryRiskStrategy):
    """Estrategia de control que siempre predice 0 (HEALTHY). Ideal para pruebas."""
    
    def train(self, features: pd.DataFrame, target: pd.Series) -> None:
        pass # No requiere entrenamiento

    def predict(self, features: list[list[float]]) -> np.ndarray:
        return np.zeros(len(features), dtype=int)