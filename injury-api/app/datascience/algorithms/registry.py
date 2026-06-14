"""
Registro automático de algoritmos de predicción (Open/Closed Principle).

Este módulo escanea todos los archivos .py de la carpeta algorithms/
y registra automáticamente cualquier clase que herede de InjuryRiskAlgorithm.

Para agregar un nuevo algoritmo:
  1. Crear un archivo .py en datascience/algorithms/ (ej: gradient_boosting.py)
  2. Implementar una clase que herede de InjuryRiskAlgorithm
  3. Reiniciar el servidor

No es necesario modificar ningún otro archivo del proyecto.
"""

import importlib
import inspect
import logging
import pkgutil
from pathlib import Path

from app.datascience.algorithms.base_algorithm import InjuryRiskAlgorithm

logger = logging.getLogger(__name__)

# Directorio donde se buscan los módulos de algoritmos
_ALGORITHMS_PACKAGE_PATH = Path(__file__).parent
_ALGORITHMS_PACKAGE_NAME = "app.datascience.algorithms"


def _auto_discover_algorithms() -> dict[str, type[InjuryRiskAlgorithm]]:
    """
    Escanea todos los módulos .py en la carpeta algorithms/ y registra
    automáticamente cualquier clase concreta que herede de InjuryRiskAlgorithm.

    Returns:
        Diccionario {nombre_del_algoritmo: ClaseDelAlgoritmo}
    """
    discovered: dict[str, type[InjuryRiskAlgorithm]] = {}

    for module_info in pkgutil.iter_modules([str(_ALGORITHMS_PACKAGE_PATH)]):
        # Ignorar el módulo base y este mismo registro
        if module_info.name in ("base_algorithm", "registry", "__init__"):
            continue

        module_path = f"{_ALGORITHMS_PACKAGE_NAME}.{module_info.name}"
        try:
            module = importlib.import_module(module_path)
        except Exception:
            logger.warning(
                "No se pudo importar el módulo de algoritmo: %s", module_path
            )
            continue

        # Buscar clases concretas que hereden de InjuryRiskAlgorithm
        for _name, obj in inspect.getmembers(module, inspect.isclass):
            if (
                issubclass(obj, InjuryRiskAlgorithm)
                and obj is not InjuryRiskAlgorithm
                and not inspect.isabstract(obj)
            ):
                # Instanciamos para obtener el nombre legible
                instance = obj()
                algorithm_key = module_info.name  # nombre del archivo como clave
                discovered[algorithm_key] = obj
                logger.info(
                    "Algoritmo descubierto: '%s' → %s",
                    algorithm_key,
                    instance.algorithm_name,
                )

    return discovered


class AlgorithmRegistry:
    """
    Registro centralizado de algoritmos disponibles.

    Provee operaciones de consulta y selección sin exponer
    la mecánica de auto-descubrimiento al resto del sistema.
    """

    def __init__(self) -> None:
        self._algorithm_classes = _auto_discover_algorithms()
        self._default_key = "random_forest"

    def list_available(self) -> list[dict[str, str]]:
        """
        Lista todos los algoritmos disponibles con su nombre legible.

        Returns:
            Lista de dicts con 'key' (identificador) y 'name' (nombre legible).
        """
        result = []
        for key, cls in self._algorithm_classes.items():
            instance = cls()
            result.append({"key": key, "name": instance.algorithm_name})
        return result

    def create_instance(self, key: str | None = None) -> InjuryRiskAlgorithm:
        """
        Crea una nueva instancia del algoritmo solicitado.

        Args:
            key: Identificador del algoritmo (nombre del archivo sin .py).
                Si es None, usa el algoritmo por defecto (random_forest).

        Returns:
            Instancia del algoritmo lista para entrenar.

        Raises:
            KeyError: Si el algoritmo solicitado no existe.
        """
        effective_key = key or self._default_key
        if effective_key not in self._algorithm_classes:
            available = list(self._algorithm_classes.keys())
            raise KeyError(
                f"Algoritmo '{effective_key}' no encontrado. "
                f"Disponibles: {available}"
            )
        return self._algorithm_classes[effective_key]()

    @property
    def default_key(self) -> str:
        """Clave del algoritmo por defecto."""
        return self._default_key
