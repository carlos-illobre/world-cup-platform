"""
Catálogo de archivos CSV disponibles para el pipeline de datos.

Para agregar un nuevo dataset al proyecto:
  1. Colocar el archivo .csv en la carpeta data/
  2. Agregar una entrada en esta clase con la ruta relativa
  3. Crear o actualizar el repositorio correspondiente en datasets/

Este archivo actúa como inventario central de todas las fuentes de datos.
"""


class DatasetCatalog:
    """Rutas relativas de los archivos CSV (respecto a DATA_DIR)."""

    # --- Fixture del Mundial 2026 ---
    MATCHES = "matches.csv"
    HOST_CITIES = "host_cities.csv"
    TEAMS = "teams.csv"
    TOURNAMENT_STAGES = "tournament_stages.csv"
    CITY_GEO_DATA = "city_geo_data.csv"
    STADIUM_MAPPING = "stadium_mapping.csv"

    # --- Datos de jugadores y médicos ---
    PLAYERS_FIFA = "players_22.csv"
    MEDICAL_SENSOR_DATA = "multimodal_sports_injury_dataset.csv"

    # --- Mapeos auxiliares ---
    FIFA_TO_ISO2_MAPPING = "fifa_to_iso2_mapping.csv"
