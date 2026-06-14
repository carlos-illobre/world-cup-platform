"""
Construcción de URLs de banderas de selecciones nacionales.

Lee el mapeo FIFA → ISO2 desde un CSV (data/fifa_to_iso2_mapping.csv)
en lugar de un diccionario hardcodeado en Python.
"""

import logging
from functools import lru_cache
from pathlib import Path

import pandas as pd

from app.datascience.datasets.catalog import DatasetCatalog
from app.datascience.schema.columns import FifaToIso2Columns

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _load_fifa_to_iso2_mapping(data_dir: str) -> dict[str, str]:
    """
    Carga el mapeo FIFA → ISO2 desde el CSV.
    Se cachea en memoria porque no cambia durante la ejecución.
    """
    csv_path = Path(data_dir) / DatasetCatalog.FIFA_TO_ISO2_MAPPING
    if not csv_path.exists():
        logger.warning(
            "Archivo de mapeo FIFA → ISO2 no encontrado: %s", csv_path
        )
        return {}

    df = pd.read_csv(csv_path)
    return dict(
        zip(
            df[FifaToIso2Columns.FIFA_CODE],
            df[FifaToIso2Columns.ISO2_CODE],
            strict=False,
        )
    )


def build_flag_url(
    fifa_code: str,
    fallback_url: str | None = None,
    data_dir: str | None = None,
) -> str:
    """
    Construye la URL de la bandera de una selección nacional.

    Prioridad:
      1. Si hay una fallback_url válida (del CSV FIFA), la usa directamente
      2. Si no, busca el código ISO2 en el mapeo FIFA → ISO2
      3. Si no encuentra el código, usa la bandera de Naciones Unidas

    Args:
        fifa_code: Código FIFA de 3 letras (ej: "ARG", "MEX").
        fallback_url: URL alternativa del CSV de jugadores FIFA.
        data_dir: Directorio de datos. Si es None, usa settings.DATA_DIR.

    Returns:
        URL completa de la bandera (flagcdn.com).
    """
    if (
        fallback_url
        and isinstance(fallback_url, str)
        and fallback_url.startswith("http")
    ):
        return fallback_url

    if data_dir is None:
        from app.config import settings

        data_dir = str(settings.DATA_DIR)

    mapping = _load_fifa_to_iso2_mapping(data_dir)
    iso2 = mapping.get(fifa_code, "un")
    return f"https://flagcdn.com/w160/{iso2}.png"
