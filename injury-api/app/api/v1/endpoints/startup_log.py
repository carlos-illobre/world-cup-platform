"""Endpoint REST para consultar el log de arranque del pipeline."""

from fastapi import APIRouter, Depends, status

from app.api.dependencies import get_startup_log_store
from app.core.startup_log import StartupLogStore
from app.domain.schemas import StartupLogEntryResponse, StartupLogResponse

router = APIRouter(prefix="/startup-log", tags=["startup-log"])


@router.get(
    "",
    response_model=StartupLogResponse,
    status_code=status.HTTP_200_OK,
    summary="Consultar log de arranque del pipeline",
)
def get_startup_log(
    startup_log_store: StartupLogStore = Depends(get_startup_log_store),
) -> StartupLogResponse:
    """
    Devuelve el registro en memoria generado durante la carga de datos
    y el entrenamiento del modelo al iniciar el servidor.
    """
    entries = startup_log_store.get_entries()
    return StartupLogResponse(
        total_entries=len(entries),
        entries=[
            StartupLogEntryResponse(
                timestamp=entry.timestamp,
                level=entry.level,
                logger_name=entry.logger_name,
                message=entry.message,
            )
            for entry in entries
        ],
    )
