# Imagen base ligera de Python para el microservicio de predicción de lesiones
FROM python:3.13-slim

WORKDIR /service

# Dependencias del sistema mínimas para scikit-learn / numpy
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias Python (capa cacheable; solo deps de producción de pyproject.toml)
COPY pyproject.toml ./
COPY app ./app

RUN pip install --no-cache-dir .

# Datasets del Mundial 2026
COPY data ./data
COPY static ./static

# Variables de entorno para ejecución en contenedor
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DATA_DIR=/service/data \
    SERVER_HOST=0.0.0.0 \
    SERVER_PORT=8000 \
    SERVER_RELOAD=false

EXPOSE 8000

# El pipeline de ML al arranque puede tardar; start-period amplio en compose/healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
    CMD curl -f http://127.0.0.1:8000/health || exit 1

CMD ["python", "-m", "app"]
