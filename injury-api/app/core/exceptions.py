"""Excepciones de dominio para respuestas HTTP consistentes."""


class WorldCupInjuryError(Exception):
    """Excepción base del dominio de predicción de lesiones."""

    def __init__(self, message: str, detail: str | None = None) -> None:
        self.message = message
        self.detail = detail
        super().__init__(message)


class MatchNotFoundError(WorldCupInjuryError):
    """El número de partido no existe en el fixture del Mundial 2026."""


class MatchDateNotFoundError(WorldCupInjuryError):
    """La fecha de kickoff no existe en el fixture del Mundial 2026."""


class PlayerNotFoundError(WorldCupInjuryError):
    """El jugador no pudo enlazarse con los patrones biomédicos disponibles."""


class DataPipelineError(WorldCupInjuryError):
    """Fallo durante la carga o el entrenamiento del pipeline de datos."""
