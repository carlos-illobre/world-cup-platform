"""
Vector de features utilizado por el modelo de predicción de riesgo de lesión.

Define la composición exacta del vector de entrada al clasificador:
  - Features biomédicas: provienen del dataset de sensores médicos
  - Features ambientales: provienen de la API de clima histórico

El orden de esta tupla determina el orden de las columnas en la matriz
de features que se pasa al modelo durante entrenamiento e inferencia.
"""

from app.datascience.schema.columns import SensorColumns


class FeatureVector:
    """Composición del vector de features del clasificador de riesgo de lesión."""

    # Features biomédicas (extraídas del dataset de sensores médicos)
    BIOMEDICAL_FEATURES: tuple[str, ...] = (
        SensorColumns.HEART_RATE,
        SensorColumns.BODY_TEMPERATURE,
        SensorColumns.HYDRATION_LEVEL,
        SensorColumns.SLEEP_QUALITY,
        SensorColumns.RECOVERY_SCORE,
        SensorColumns.STRESS_LEVEL,
        SensorColumns.TRAINING_INTENSITY,
        SensorColumns.TRAINING_DURATION,
        SensorColumns.TRAINING_LOAD,
        SensorColumns.FATIGUE_INDEX,
    )

    # Features ambientales (inyectadas en tiempo de inferencia desde la API de clima)
    AMBIENT_TEMPERATURE = SensorColumns.AMBIENT_TEMPERATURE
    HUMIDITY = SensorColumns.HUMIDITY
    ALTITUDE = SensorColumns.ALTITUDE

    AMBIENT_FEATURES: tuple[str, ...] = (
        AMBIENT_TEMPERATURE,
        HUMIDITY,
        ALTITUDE,
    )

    # Vector completo ordenado (biomédicas + ambientales)
    ALL_FEATURES: tuple[str, ...] = BIOMEDICAL_FEATURES + AMBIENT_FEATURES
