"""Ejemplos de request/response para la documentación OpenAPI (single source of truth)."""

INJURY_PREDICTION_REQUEST_EXAMPLE = {
    "player_name": "K. De Bruyne",
    "match_number": 1,
}

INJURY_PREDICTION_RESPONSE_EXAMPLE = {
    "player_name": "K. De Bruyne",
    "match": {
        "match_number": 1,
        "stage_name": "Group Stage",
        "city_name": "Mexico City",
        "venue_name": "Estadio Azteca",
        "kickoff_date": "2026-06-11",
    },
    "weather": {
        "ambient_temperature_celsius": 22.4,
        "humidity_percent": 58.3,
    },
    "injury_risk": {
        "risk_level": 0,
        "risk_label": "healthy",
        "description": "Sin indicadores de fatiga de riesgo. Apto para el encuentro.",
    },
}

NOT_FOUND_ERROR_EXAMPLE = {
    "detail": {
        "error": "match_not_found",
        "message": "El partido con número 99999 no existe en el fixture.",
    },
}

STARTUP_LOG_RESPONSE_EXAMPLE = {
    "total_entries": 3,
    "entries": [
        {
            "timestamp": "2026-06-11T15:00:00+00:00",
            "level": "INFO",
            "logger_name": "app.services.data_pipeline",
            "message": "INICIANDO PIPELINE DE CIENCIA DE DATOS - MUNDIAL 2026",
        },
        {
            "timestamp": "2026-06-11T15:00:01+00:00",
            "level": "INFO",
            "logger_name": "app.infrastructure.csv_loader",
            "message": "Fixture unificado correctamente. Total de partidos mapeados: 104",
        },
        {
            "timestamp": "2026-06-11T15:00:05+00:00",
            "level": "INFO",
            "logger_name": "app.main",
            "message": "Pipeline completado. Servidor listo para recibir solicitudes.",
        },
    ],
}

HEALTH_CHECK_RESPONSE_EXAMPLE = {
    "status": "ok",
    "tournament": "FIFA World Cup 2026",
    "model_ready": True,
}
