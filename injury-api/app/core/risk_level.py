"""
Niveles de riesgo de lesión y sus etiquetas descriptivas.

Centraliza el enum de riesgo y todos los diccionarios de labels
que se usan tanto en la API como en el dashboard.
"""

from enum import IntEnum


class InjuryRiskLevel(IntEnum):
    """Niveles de riesgo de lesión inferidos por el modelo."""

    HEALTHY = 0
    LOW_RISK = 1
    CRITICAL_RISK = 2


# --- Labels para la API REST v1 (respuesta JSON) ---

INJURY_RISK_LABELS: dict[InjuryRiskLevel, str] = {
    InjuryRiskLevel.HEALTHY: "healthy",
    InjuryRiskLevel.LOW_RISK: "low_risk",
    InjuryRiskLevel.CRITICAL_RISK: "critical_risk",
}

INJURY_RISK_DESCRIPTIONS: dict[InjuryRiskLevel, str] = {
    InjuryRiskLevel.HEALTHY: (
        "Sin indicadores de fatiga de riesgo. Apto para el encuentro."
    ),
    InjuryRiskLevel.LOW_RISK: (
        "Fatiga moderada acumulada. Monitorear cargas de entrenamiento."
    ),
    InjuryRiskLevel.CRITICAL_RISK: (
        "Fatiga extrema o riesgo inminente de lesión. Alerta de rotación."
    ),
}

# --- Labels para el dashboard React ---

DASHBOARD_AI_STATUS_LABELS: dict[InjuryRiskLevel, str] = {
    InjuryRiskLevel.HEALTHY: "STATUS SAFE",
    InjuryRiskLevel.LOW_RISK: "STATUS CAUTION",
    InjuryRiskLevel.CRITICAL_RISK: "STATUS AT RISK",
}

DASHBOARD_AI_VERDICTS: dict[InjuryRiskLevel, str] = {
    InjuryRiskLevel.HEALTHY: "FIT TO PLAY",
    InjuryRiskLevel.LOW_RISK: "MONITOR CLOSELY",
    InjuryRiskLevel.CRITICAL_RISK: "RESTRICT MINUTES",
}
