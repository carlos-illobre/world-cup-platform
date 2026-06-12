"""Pipeline de ciencia de datos: se ejecuta una sola vez al iniciar el servidor."""

import logging

import pandas as pd
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split

from app.config import settings
from app.core.application_state import WorldCupInjuryContext
from app.core.constants import DataFiles, MedicalColumns, ModelFeatures, TeamColumns
from app.core.exceptions import DataPipelineError
from app.infrastructure.csv_loader import (
    FixtureRepository,
    MedicalDataRepository,
    PlayerRepository,
    build_combined_player_sensor_matrix,
)
from app.services.dashboard_catalog_service import DashboardCatalogService
from app.ml.registry import get_strategy
from app.ml.strategies import InjuryRiskStrategy

logger = logging.getLogger(__name__)


class WorldCupDataPipeline:
    """
    Orquesta la carga de datos, el join fisiológico y el entrenamiento del modelo.
    Diseñado para ejecutarse una única vez durante el lifespan de FastAPI.
    """

    def __init__(
        self,
        fixture_repository: FixtureRepository | None = None,
        medical_repository: MedicalDataRepository | None = None,
        player_repository: PlayerRepository | None = None,
    ) -> None:
        self._fixture_repository = fixture_repository or FixtureRepository()
        self._medical_repository = medical_repository or MedicalDataRepository()
        self._player_repository = player_repository or PlayerRepository()

    def run(self) -> WorldCupInjuryContext:
        """Ejecuta el pipeline completo y devuelve el contexto de inferencia."""
        logger.info("=" * 57)
        logger.info("INICIANDO PIPELINE DE CIENCIA DE DATOS - MUNDIAL 2026")
        logger.info("Sistema Predictivo de Riesgo de Lesiones por Fatiga Extrema")
        logger.info("=" * 57)
        logger.info("[Paso 1] Cargando y unificando el fixture relacional...")

        try:
            fixture_dataframe = self._fixture_repository.load_unified_fixture()
            logger.info("[Paso 2] Procesando y limpiando la matriz de sensores médicos...")
            soccer_sensors = self._medical_repository.load_soccer_sensor_matrix()
            logger.info(
                "[Paso 3] Calculando métricas morfológicas de FIFA y ejecutando el Join..."
            )
            players = self._player_repository.load_players_with_bmi()
            combined_dataframe = build_combined_player_sensor_matrix(
                players, soccer_sensors
            )
            logger.info("[Paso 4] Configurando y entrenando el modelo analítico predictivo...")
            strategy = self._train_and_evaluate_strategy(combined_dataframe)
        except Exception as exc:
            raise DataPipelineError(
                "Error crítico durante la inicialización del pipeline de datos.",
                detail=str(exc),
            ) from exc

        teams_dataframe = pd.read_csv(settings.DATA_DIR / DataFiles.TEAMS)
        nationality_to_fifa = dict(
            zip(
                teams_dataframe[TeamColumns.TEAM_NAME],
                teams_dataframe[TeamColumns.FIFA_CODE],
                strict=False,
            )
        )
        catalog_service = DashboardCatalogService(
            fixture_dataframe=fixture_dataframe,
            combined_dataframe=combined_dataframe,
            players_dataframe=players,
            nationality_to_fifa=nationality_to_fifa,
        )
        return WorldCupInjuryContext(
            fixture_dataframe=fixture_dataframe,
            combined_dataframe=combined_dataframe,
            players_dataframe=players,
            active_strategy=strategy,
            player_options=catalog_service.build_player_options(),
            match_days=catalog_service.build_match_days(),
            nationality_to_fifa=nationality_to_fifa,
        )

    def _train_and_evaluate_strategy(
        self,
        combined_dataframe: pd.DataFrame,
    ) -> InjuryRiskStrategy:
        """Entrena y evalúa el clasificador de riesgo de lesión."""
        feature_matrix = combined_dataframe[list(ModelFeatures.FEATURES)]
        target_labels = combined_dataframe[MedicalColumns.INJURY_OCCURRED]

        # Dividimos los datos ANTES de escalar para evitar fuga de datos (Data Leakage)
        train_x, test_x, train_y, test_y = train_test_split(
            feature_matrix,
            target_labels,
            test_size=settings.ML_TEST_SIZE,
            stratify=target_labels,
            random_state=settings.ML_RANDOM_STATE,
        )

        strategy = get_strategy("random_forest")
        strategy.train(train_x, train_y)

        # Evaluación post-entrenamiento
        predictions = strategy.predict(test_x.values.tolist())
        report = classification_report(
            test_y,
            predictions,
            target_names=["healthy", "low_risk", "critical_risk"],
        )
        logger.info("REPORTE DE EVALUACIÓN DEL ALGORITMO:\n%s", report)

        return strategy