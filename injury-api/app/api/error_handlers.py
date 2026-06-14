"""
Manejo centralizado de excepciones de dominio → respuestas HTTP.

Elimina la duplicación de conversión de excepciones que antes se
repetía en cada archivo de endpoint.
"""

from fastapi import HTTPException, status

from app.core.exceptions import (
    MatchDateNotFoundError,
    MatchNotFoundError,
    PlayerNotFoundError,
    WorldCupInjuryError,
)


def raise_http_from_domain_error(exc: WorldCupInjuryError) -> None:
    """
    Convierte una excepción de dominio en una HTTPException de FastAPI.

    Mapeo:
      - MatchNotFoundError    → 404 (match_not_found)
      - MatchDateNotFoundError → 404 (match_date_not_found)
      - PlayerNotFoundError   → 404 (player_not_found)
      - Otras                 → re-raise
    """
    if isinstance(exc, MatchNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "match_not_found", "message": exc.message},
        ) from exc

    if isinstance(exc, MatchDateNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "match_date_not_found", "message": exc.message},
        ) from exc

    if isinstance(exc, PlayerNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "player_not_found", "message": exc.message},
        ) from exc

    raise exc
