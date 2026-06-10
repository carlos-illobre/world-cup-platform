"""Estado global de la aplicación: artefactos precargados al iniciar el servidor."""

from dataclasses import dataclass

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import MinMaxScaler

from app.domain.dashboard_schemas import MatchDaySchema, PlayerOptionSchema


@dataclass(frozen=True)
class WorldCupInjuryContext:
    """
    Contenedor inmutable con todos los artefactos necesarios para inferencia.
    Se construye una sola vez durante el arranque del servidor.
    """

    fixture_dataframe: pd.DataFrame
    combined_dataframe: pd.DataFrame
    players_dataframe: pd.DataFrame
    injury_classifier: RandomForestClassifier
    feature_scaler: MinMaxScaler
    player_options: list[PlayerOptionSchema]
    match_days: list[MatchDaySchema]
    nationality_to_fifa: dict[str, str]
