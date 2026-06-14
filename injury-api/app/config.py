from pathlib import Path
from typing import List, Any
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Rutas
    PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = Field(default=Path("./data"), env="DATA_DIR")
    
    # ML - Parámetros del modelo
    ML_TEST_SIZE: float = 0.3
    ML_RANDOM_STATE: int = 42
    ML_N_ESTIMATORS: int = 100
    
    # API de clima histórico
    WEATHER_ARCHIVE_BASE_URL: str = "https://archive-api.open-meteo.com/v1/archive"
    WEATHER_HISTORICAL_YEARS: tuple = (2023, 2024, 2025)
    WEATHER_FALLBACK_TEMPERATURE: float = 28.5
    WEATHER_FALLBACK_HUMIDITY: float = 60.0
    
    # Metadatos de la API
    API_TITLE: str = "World Cup 2026 Injury Risk API"
    API_DESCRIPTION: str = "API para pronosticar el riesgo de lesión por fatiga extrema."
    API_VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    API_V2_PREFIX: str = "/api/v2"
    API_V3_PREFIX: str = "/api/v3"
    
    # Documentación OpenAPI / Swagger UI
    OPENAPI_URL: str = "/openapi.json"
    OPENAPI_DOCS_URL: str = "/docs"
    OPENAPI_REDOC_URL: str = "/redoc"
    
    # Servidor
    SERVER_HOST: str = "127.0.0.1"
    SERVER_PORT: int = 8000
    SERVER_RELOAD: bool = True

    INJURY_API_URL: str | None = Field(default=None, env="INJURY_API_URL")

    @property
    def BACKEND_URL(self) -> str:
        # Si tienes una variable de entorno definida, la usa; si no, arma la URL
        if self.INJURY_API_URL:
            return self.INJURY_API_URL
        return f"http://{self.SERVER_HOST}:{self.SERVER_PORT}"
    
    CORS_ORIGINS: Any = [
        "http://localhost:3000", 
        "http://127.0.0.1:3000", 
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> List[str]:
        # Si ya viene como lista, lo devolvemos tal cual
        if isinstance(v, list):
            return v
        # Si viene como string (lo que viene de Docker), hacemos split
        if isinstance(v, str):
            # Limpiamos espacios y saltos de línea (el uso de > en YAML suele añadir \n)
            return [item.strip() for item in v.split(",") if item.strip()]
        return []

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()