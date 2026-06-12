from app.ml.strategies import RandomForestStrategy, BaselineStrategy, InjuryRiskStrategy

# Registro global de algoritmos disponibles
STRATEGY_REGISTRY: dict[str, InjuryRiskStrategy] = {
    "random_forest": RandomForestStrategy(),
    "baseline": BaselineStrategy()
}

def get_strategy(name: str = "random_forest") -> InjuryRiskStrategy:
    """Obtiene la estrategia solicitada o retorna la default."""
    return STRATEGY_REGISTRY.get(name, STRATEGY_REGISTRY["random_forest"])