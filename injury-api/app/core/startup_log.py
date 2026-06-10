"""Registro en memoria del proceso de arranque del pipeline de datos."""

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from threading import Lock


@dataclass(frozen=True)
class StartupLogEntry:
    """Entrada individual del log de arranque."""

    timestamp: str
    level: str
    logger_name: str
    message: str


class StartupLogStore:
    """Almacén thread-safe de entradas de log generadas durante el arranque."""

    def __init__(self) -> None:
        self._entries: list[StartupLogEntry] = []
        self._lock = Lock()

    def append(self, level: str, logger_name: str, message: str) -> None:
        """Agrega una entrada al registro en memoria."""
        entry = StartupLogEntry(
            timestamp=datetime.now(UTC).isoformat(),
            level=level,
            logger_name=logger_name,
            message=message,
        )
        with self._lock:
            self._entries.append(entry)

    def get_entries(self) -> list[StartupLogEntry]:
        """Devuelve una copia de todas las entradas almacenadas."""
        with self._lock:
            return list(self._entries)


class InMemoryLogHandler(logging.Handler):
    """Handler de logging que persiste cada mensaje en un StartupLogStore."""

    def __init__(self, store: StartupLogStore) -> None:
        super().__init__(level=logging.INFO)
        self._store = store

    def emit(self, record: logging.LogRecord) -> None:
        try:
            self._store.append(
                level=record.levelname,
                logger_name=record.name,
                message=record.getMessage(),
            )
        except Exception:
            self.handleError(record)


class ApplicationLogFilter(logging.Filter):
    """Filtra loggers del paquete app para excluir ruido de uvicorn/starlette."""

    def filter(self, record: logging.LogRecord) -> bool:
        return record.name == "app" or record.name.startswith("app.")


@contextmanager
def capture_startup_logs(store: StartupLogStore) -> Iterator[None]:
    """
    Context manager que captura logs del paquete app hacia el almacén en memoria.
    Se usa durante la ejecución del pipeline al iniciar el servidor.
    """
    handler = InMemoryLogHandler(store)
    handler.addFilter(ApplicationLogFilter())

    app_logger = logging.getLogger("app")
    app_logger.addHandler(handler)
    app_logger.setLevel(logging.INFO)

    try:
        yield
    finally:
        app_logger.removeHandler(handler)
