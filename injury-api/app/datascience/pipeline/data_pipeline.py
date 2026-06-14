"""
Pipeline de ciencia de datos — Mundial 2026.

Se ejecuta una sola vez al iniciar el servidor y produce un
TrainedModelContext inmutable con todos los artefactos necesarios
para la inferencia de riesgo de lesión.

Este módulo es el orquestador central del pipeline ETL + ML:
  1. Extrae datos de múltiples CSVs (fixture, jugadores, sensores)
  2. Transforma los datos (limpieza, feature engineering, joins)
  3. Entrena y evalúa el modelo predictivo seleccionado
"""

import logging
from pathlib import Path

import pandas as pd
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split

from app.config import settings
from app.core.exceptions import DataPipelineError
from app.datascience.algorithms.base_algorithm import InjuryRiskAlgorithm
from app.datascience.algorithms.registry import AlgorithmRegistry
from app.datascience.datasets.fixture_repository import FixtureRepository
from app.datascience.datasets.medical_repository import MedicalSensorRepository
from app.datascience.datasets.player_repository import PlayerRepository
from app.datascience.datasets.team_repository import TeamRepository
from app.datascience.model_context import TrainedModelContext
from app.datascience.pipeline.feature_engineering import (
    build_combined_player_sensor_matrix,
)
from app.datascience.schema.columns import SensorColumns
from app.datascience.schema.feature_vector import FeatureVector

logger = logging.getLogger(__name__)


class WorldCupDataPipeline:
    """
    Orquesta la carga de datos, el join fisiológico y el entrenamiento
    del modelo predictivo de riesgo de lesión.

    Diseñado para ejecutarse una única vez durante el lifespan de FastAPI.
    Cada paso está documentado en castellano para facilitar la comprensión
    del flujo de datos por parte de científicos de datos y desarrolladores.
    """

    def __init__(
        self,
        fixture_repository: FixtureRepository | None = None,
        medical_repository: MedicalSensorRepository | None = None,
        player_repository: PlayerRepository | None = None,
        team_repository: TeamRepository | None = None,
        algorithm_registry: AlgorithmRegistry | None = None,
    ) -> None:
        data_dir = settings.DATA_DIR
        self._fixture_repo = fixture_repository or FixtureRepository(
            data_dir=data_dir, backend_url=settings.BACKEND_URL
        )
        self._medical_repo = medical_repository or MedicalSensorRepository(
            data_dir=data_dir
        )
        self._player_repo = player_repository or PlayerRepository(data_dir=data_dir)
        self._team_repo = team_repository or TeamRepository(data_dir=data_dir)
        self._algorithm_registry = algorithm_registry or AlgorithmRegistry()

    def run(self, algorithm_key: str | None = None) -> TrainedModelContext:
        """
        Ejecuta el pipeline completo de ciencia de datos.

        Args:
            algorithm_key: Clave del algoritmo a utilizar. Si es None,
                usa el algoritmo por defecto (random_forest).

        Returns:
            TrainedModelContext con todos los artefactos listos para inferencia.
        """
        logger.info("=" * 57)
        logger.info("INICIANDO PIPELINE DE CIENCIA DE DATOS - MUNDIAL 2026")
        logger.info("Sistema Predictivo de Riesgo de Lesiones por Fatiga Extrema")
        logger.info("=" * 57)

        try:
            # ═══════════════════════════════════════════════════════════════
            # PASO 1: CARGA DEL FIXTURE RELACIONAL
            #
            # Unifica matches.csv + host_cities.csv + teams.csv +
            # tournament_stages.csv + city_geo_data.csv + stadium_mapping.csv
            # en un solo DataFrame.
            #
            # El join se hace por IDs relacionales (city_id, team_id, stage_id).
            # Resultado: un fixture "plano" donde cada fila es un partido
            # completo con nombre de ciudad, estadio, coordenadas GPS,
            # fase del torneo y URL de imagen del estadio.
            # ═══════════════════════════════════════════════════════════════
            logger.info("[Paso 1] Cargando y unificando el fixture relacional...")
            fixture_dataframe = self._fixture_repo.load_unified_fixture()

            # ═══════════════════════════════════════════════════════════════
            # PASO 2: CARGA Y LIMPIEZA DE LA MATRIZ DE SENSORES MÉDICOS
            #
            # Fuente: multimodal_sports_injury_dataset.csv (~30k registros)
            #
            # Operaciones:
            #   a) Filtrar solo registros donde sport_type == "Soccer"
            #      (el dataset contiene múltiples deportes)
            #   b) Imputar valores nulos numéricos con la MEDIANA
            #      (más robusta que la media ante outliers médicos)
            #   c) Crear llaves sintéticas (join_age, join_bmi) para el
            #      cruce fisiológico del Paso 3
            #
            # La variable objetivo es injury_occurred (0, 1 o 2):
            #   0 = Saludable, 1 = Riesgo bajo, 2 = Riesgo crítico
            # ═══════════════════════════════════════════════════════════════
            logger.info(
                "[Paso 2] Procesando y limpiando la matriz de sensores médicos..."
            )
            soccer_sensor_matrix = self._medical_repo.load_soccer_sensor_matrix()

            # ═══════════════════════════════════════════════════════════════
            # PASO 3: CARGA DE JUGADORES FIFA Y CÁLCULO DE MÉTRICAS MORFOLÓGICAS
            #
            # Fuente: players_22.csv (~19k jugadores FIFA)
            #
            # Operaciones:
            #   a) Calcular BMI = peso_kg / (altura_cm / 100)²
            #   b) Crear las mismas llaves sintéticas (join_age, join_bmi)
            #      que usamos en el Paso 2 para el cruce fisiológico
            # ═══════════════════════════════════════════════════════════════
            logger.info(
                "[Paso 3] Calculando métricas morfológicas de FIFA y "
                "ejecutando el Join fisiológico..."
            )
            players_dataframe = self._player_repo.load_players_with_bmi()

            # ═══════════════════════════════════════════════════════════════
            # PASO 4: JOIN FISIOLÓGICO (Feature Engineering)
            #
            # Cruza jugadores FIFA con registros de sensores médicos usando
            # llaves sintéticas (join_age + join_bmi) como proxy de
            # similitud física.
            #
            # ¿Por qué este approach?
            # No existe un ID directo entre los dos datasets. Usamos
            # edad y contextura (BMI) como proxy: asumimos que un jugador
            # de 28 años con BMI 23 exhibirá patrones fisiológicos
            # similares a un atleta del dataset médico con las mismas
            # características.
            #
            # El join es INNER: solo conservamos jugadores que tengan
            # al menos un registro de sensor con perfil compatible.
            # ═══════════════════════════════════════════════════════════════
            combined_matrix = build_combined_player_sensor_matrix(
                players_dataframe, soccer_sensor_matrix
            )

            # ═══════════════════════════════════════════════════════════════
            # PASO 5: ENTRENAMIENTO Y EVALUACIÓN DEL MODELO PREDICTIVO
            #
            # Se divide el dataset en entrenamiento (70%) y test (30%)
            # ANTES de escalar para evitar Data Leakage.
            #
            # El algoritmo se selecciona del registro automático.
            # Por defecto se usa Random Forest con MinMax Scaler,
            # pero puede cambiarse vía API sin reiniciar el servidor.
            # ═══════════════════════════════════════════════════════════════
            logger.info(
                "[Paso 4] Configurando y entrenando el modelo analítico predictivo..."
            )
            effective_key = algorithm_key or self._algorithm_registry.default_key
            trained_algorithm = self._fit_and_evaluate(
                combined_matrix, effective_key
            )

        except DataPipelineError:
            raise
        except Exception as exc:
            raise DataPipelineError(
                "Error crítico durante la inicialización del pipeline de datos.",
                detail=str(exc),
            ) from exc

        # ═══════════════════════════════════════════════════════════════
        # PASO 6: CONSTRUCCIÓN DEL MAPEO NACIONALIDAD → FIFA CODE
        #
        # Este diccionario vincula el nationality_name del dataset FIFA
        # (ej: "Argentina") con el fifa_code del fixture (ej: "ARG").
        # Es necesario porque los datasets usan identificadores distintos.
        # ═══════════════════════════════════════════════════════════════
        nationality_to_fifa_code = self._team_repo.build_nationality_to_fifa_code()

        return TrainedModelContext(
            fixture_dataframe=fixture_dataframe,
            combined_player_sensor_matrix=combined_matrix,
            players_dataframe=players_dataframe,
            active_algorithm=trained_algorithm,
            nationality_to_fifa_code=nationality_to_fifa_code,
            active_algorithm_key=effective_key,
        )

    def _fit_and_evaluate(
        self,
        combined_matrix: pd.DataFrame,
        algorithm_key: str,
    ) -> InjuryRiskAlgorithm:
        """
        Entrena y evalúa el algoritmo de clasificación de riesgo de lesión.

        El proceso sigue las mejores prácticas de ciencia de datos:
          1. Separar features (X) del target (y)
          2. Split estratificado train/test ANTES de escalar
          3. Entrenar el modelo solo con datos de entrenamiento
          4. Evaluar con datos de test (classification_report)
        """
        # Extraer la matriz de features y el vector objetivo
        feature_matrix = combined_matrix[list(FeatureVector.ALL_FEATURES)]
        target_labels = combined_matrix[SensorColumns.INJURY_OCCURRED]

        # Split estratificado: mantiene la proporción de clases en ambos conjuntos
        # Se hace ANTES de escalar para evitar Data Leakage
        train_x, test_x, train_y, test_y = train_test_split(
            feature_matrix,
            target_labels,
            test_size=settings.ML_TEST_SIZE,
            stratify=target_labels,
            random_state=settings.ML_RANDOM_STATE,
        )

        # Instanciar y entrenar el algoritmo seleccionado
        algorithm = self._algorithm_registry.create_instance(algorithm_key)
        logger.info(
            "Entrenando algoritmo: '%s' (%s)",
            algorithm_key,
            algorithm.algorithm_name,
        )
        algorithm.fit(train_x, train_y)

        # Evaluación post-entrenamiento con datos de test
        predictions = algorithm.predict(test_x.values.tolist())
        report = classification_report(
            test_y,
            predictions,
            target_names=["healthy", "low_risk", "critical_risk"],
        )
        logger.info("REPORTE DE EVALUACIÓN DEL ALGORITMO:\n%s", report)

        return algorithm
