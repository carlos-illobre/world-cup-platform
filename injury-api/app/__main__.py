"""Punto de entrada para `python -m app` (equivalente a npm start en Node.js)."""

import uvicorn

from app.config import SERVER_HOST, SERVER_PORT, SERVER_RELOAD


def main() -> None:
    """Arranca el servidor Uvicorn con la configuración centralizada del proyecto."""
    uvicorn.run(
        "app.main:app",
        host=SERVER_HOST,
        port=SERVER_PORT,
        reload=SERVER_RELOAD,
    )


if __name__ == "__main__":
    main()
