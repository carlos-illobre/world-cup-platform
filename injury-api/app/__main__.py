"""Punto de entrada para `python -m app` (equivalente a npm start en Node.js)."""

import uvicorn

from app.config import settings


def main() -> None:
    """Arranca el servidor Uvicorn con la configuración centralizada del proyecto."""
    uvicorn.run(
        "app.main:app",
        host=settings.SERVER_HOST,
        port=settings.SERVER_PORT,
        reload=settings.SERVER_RELOAD,
    )


if __name__ == "__main__":
    main()
