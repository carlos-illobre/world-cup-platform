"""
Endpoints REST v3: gestión de algoritmos de predicción.

Permite listar los algoritmos auto-descubiertos y seleccionar
cuál algoritmo usar para la inferencia de riesgo de lesión.
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.datascience.algorithms.registry import AlgorithmRegistry
from app.datascience.pipeline.data_pipeline import WorldCupDataPipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/algoritmos", tags=["algoritmos-v3"])


class AlgorithmInfoSchema(BaseModel):
    """Información de un algoritmo disponible."""

    key: str
    name: str


class AlgorithmListResponseSchema(BaseModel):
    """Lista de algoritmos disponibles."""

    algoritmos: list[AlgorithmInfoSchema]
    activo: str


class AlgorithmSelectionRequestSchema(BaseModel):
    """Solicitud de cambio de algoritmo activo."""

    algorithm_key: str


class AlgorithmSelectionResponseSchema(BaseModel):
    """Respuesta al cambiar el algoritmo activo."""

    message: str
    algorithm_key: str
    algorithm_name: str


@router.get(
    "",
    response_model=AlgorithmListResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Listar algoritmos de predicción disponibles",
)
def list_available_algorithms(
    request: Request,
) -> AlgorithmListResponseSchema:
    """
    Devuelve todos los algoritmos auto-descubiertos en la carpeta
    datascience/algorithms/ junto con el algoritmo activo actual.
    """
    registry = AlgorithmRegistry()
    available = registry.list_available()

    # Obtener el algoritmo activo del contexto
    active_key = "unknown"
    if hasattr(request.app.state, "injury_context"):
        active_key = request.app.state.injury_context.active_algorithm_key

    return AlgorithmListResponseSchema(
        algoritmos=[
            AlgorithmInfoSchema(key=algo["key"], name=algo["name"])
            for algo in available
        ],
        activo=active_key,
    )


@router.put(
    "/activo",
    response_model=AlgorithmSelectionResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Seleccionar algoritmo activo para predicciones",
)
def select_active_algorithm(
    payload: AlgorithmSelectionRequestSchema,
    request: Request,
) -> AlgorithmSelectionResponseSchema:
    """
    Cambia el algoritmo activo. Re-ejecuta el pipeline de entrenamiento
    con el nuevo algoritmo seleccionado.
    """
    registry = AlgorithmRegistry()

    # Validar que el algoritmo existe
    try:
        algorithm_instance = registry.create_instance(payload.algorithm_key)
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "algorithm_not_found",
                "message": str(exc),
            },
        ) from exc

    # Re-ejecutar el pipeline con el nuevo algoritmo
    logger.info(
        "🔄 Re-entrenando pipeline con algoritmo: %s (%s)",
        payload.algorithm_key,
        algorithm_instance.algorithm_name,
    )

    try:
        new_context = WorldCupDataPipeline(
            algorithm_registry=registry
        ).run(algorithm_key=payload.algorithm_key)
        request.app.state.injury_context = new_context
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "pipeline_error",
                "message": f"Error al re-entrenar con {payload.algorithm_key}: {exc}",
            },
        ) from exc

    return AlgorithmSelectionResponseSchema(
        message=f"Algoritmo cambiado exitosamente a '{algorithm_instance.algorithm_name}'",
        algorithm_key=payload.algorithm_key,
        algorithm_name=algorithm_instance.algorithm_name,
    )
