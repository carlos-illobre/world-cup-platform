"""
Injury Risk Predictor
======================
Calls injury_xgboost_model.pkl with the exact 123 features it was trained on.
The model uses LabelEncoder on categorical columns (Pos, Country, Tipo_Lesion, League)
so we replicate the same encoding strategy: unknown labels map to a safe fallback.
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder


# The 4 categorical columns that need label-encoding before the model
CAT_COLS = ['Pos', 'Country', 'Tipo_Lesion', 'League']

# Exact feature order the model expects (123 features)
MODEL_FEATURES = [
    'Altura', 'Tipo_Lesion', 'Dias_Baja', 'Partidos_Perdidos',
    'prior_injuries', 'prior_days_out', 'days_since_last_injury',
    'Country', 'Pos', 'Age', 'League', 'MarketValue_EUR', 'MP',
    'Playing Time_Starts', 'Playing Time_Min', 'Playing Time_90s',
    'Performance_Gls', 'Performance_Ast', 'Performance_G+A',
    'Performance_G-PK', 'Performance_PK', 'Performance_PKatt',
    'Performance_CrdY', 'Performance_CrdR', 'Per 90 Minutes_Gls',
    'Per 90 Minutes_Ast', 'Per 90 Minutes_G+A', 'Per 90 Minutes_G-PK',
    'Per 90 Minutes_G+A-PK', '90s', 'Standard_Gls', 'Standard_Sh',
    'Standard_SoT', 'Standard_SoT%', 'Standard_Sh/90', 'Standard_SoT/90',
    'Standard_G/Sh', 'Standard_G/SoT', 'Standard_PK', 'Standard_PKatt',
    'Performance_2CrdY', 'Performance_Fls', 'Performance_Fld',
    'Performance_Off', 'Performance_Crs', 'Performance_Int',
    'Performance_TklW', 'Performance_PKwon', 'Performance_PKcon',
    'Performance_OG', 'Playing Time_Mn/MP', 'Playing Time_Min%',
    'Starts', 'Starts_Mn/Start', 'Starts_Compl', 'Subs', 'Subs_Mn/Sub',
    'Subs_unSub', 'Team Success_PPM', 'Team Success_onG', 'Team Success_onGA',
    'Team Success_+/-', 'Team Success_+/-90', 'Team Success_On-Off',
    'MP_allcomps', 'Playing Time_Starts_allcomps', 'Playing Time_Min_allcomps',
    'Playing Time_90s_allcomps', 'Performance_Gls_allcomps',
    'Performance_Ast_allcomps', 'Performance_G+A_allcomps',
    'Performance_G-PK_allcomps', 'Performance_PK_allcomps',
    'Performance_PKatt_allcomps', 'Performance_CrdY_allcomps',
    'Performance_CrdR_allcomps', 'Per 90 Minutes_Gls_allcomps',
    'Per 90 Minutes_Ast_allcomps', 'Per 90 Minutes_G+A_allcomps',
    'Per 90 Minutes_G-PK_allcomps', 'Per 90 Minutes_G+A-PK_allcomps',
    '90s_allcomps', 'Standard_Gls_allcomps', 'Standard_Sh_allcomps',
    'Standard_SoT_allcomps', 'Standard_SoT%_allcomps',
    'Standard_Sh/90_allcomps', 'Standard_SoT/90_allcomps',
    'Standard_G/Sh_allcomps', 'Standard_G/SoT_allcomps',
    'Standard_PK_allcomps', 'Standard_PKatt_allcomps',
    'Performance_2CrdY_allcomps', 'Performance_Fls_allcomps',
    'Performance_Fld_allcomps', 'Performance_Off_allcomps',
    'Performance_Crs_allcomps', 'Performance_Int_allcomps',
    'Performance_TklW_allcomps', 'Performance_PKwon_allcomps',
    'Performance_PKcon_allcomps', 'Performance_OG_allcomps',
    'Playing Time_Mn/MP_allcomps', 'Playing Time_Min%_allcomps',
    'Starts_allcomps', 'Starts_Mn/Start_allcomps', 'Starts_Compl_allcomps',
    'Subs_allcomps', 'Subs_Mn/Sub_allcomps', 'Subs_unSub_allcomps',
    'Team Success_PPM_allcomps', 'Team Success_onG_allcomps',
    'Team Success_onGA_allcomps', 'Team Success_+/-_allcomps',
    'Team Success_+/-90_allcomps', 'Team Success_On-Off_allcomps',
    'injury_count_last_12m', 'total_days_out_last_12m', 'avg_recovery_time',
    'is_recurrent', 'months_since_last_injury', 'injury_frequency',
    'injury_severity_score',
]

# Injury history fallback when a player has no recorded injury history
_INJURY_DEFAULTS = {
    'Altura': 180,
    'Tipo_Lesion': 'MISSING',
    'Dias_Baja': 0,
    'Partidos_Perdidos': 0,
    'prior_injuries': 0,
    'prior_days_out': 0,
    'days_since_last_injury': 999,
    'injury_count_last_12m': 0,
    'total_days_out_last_12m': 0,
    'avg_recovery_time': 0,
    'is_recurrent': 0,
    'months_since_last_injury': 99,
    'injury_frequency': 0.0,
    'injury_severity_score': 0.0,
}


def _encode_categorical(series: pd.Series, known_values: list) -> pd.Series:
    """
    Replicates the LabelEncoder used during training.
    Unknown labels fall back to the encoded value of 'MISSING' (always 0 after fit
    because LabelEncoder sorts alphabetically and 'MISSING' sorts first in the list).
    """
    all_labels = sorted(set(['MISSING'] + [str(v) for v in known_values]))
    le = LabelEncoder()
    le.fit(all_labels)
    safe = series.fillna('MISSING').astype(str).apply(
        lambda x: x if x in le.classes_ else 'MISSING'
    )
    return pd.Series(le.transform(safe), index=series.index)


def build_injury_features(player_row: dict, injuries_df: pd.DataFrame) -> pd.DataFrame:
    """
    Constructs the 123-feature DataFrame for the injury XGBoost model.

    Parameters
    ----------
    player_row : dict
        One row from master_players_enriched (all player stats).
    injuries_df : pd.DataFrame
        master_injuries_featured loaded at startup.

    Returns
    -------
    pd.DataFrame with shape (1, 123) ready for model.predict_proba()
    """
    row = dict(player_row)

    # --- Merge in injury history for this player ---
    inj_record = {}
    if injuries_df is not None and not injuries_df.empty:
        player_name = row.get('Player', '')
        matches = injuries_df[injuries_df['Jugador'] == player_name]
        if not matches.empty:
            # Use the most recent injury record
            latest = matches.iloc[-1]
            inj_record = {
                'Altura': latest.get('Altura', None),
                'Tipo_Lesion': latest.get('Tipo_Lesion', 'MISSING'),
                'Dias_Baja': latest.get('Dias_Baja', 0),
                'Partidos_Perdidos': latest.get('Partidos_Perdidos', 0),
                'prior_injuries': latest.get('prior_injuries', 0),
                'prior_days_out': latest.get('prior_days_out', 0),
                'days_since_last_injury': latest.get('days_since_last_injury', 999),
                'injury_count_last_12m': latest.get('injury_count_last_12m', 0),
                'total_days_out_last_12m': latest.get('total_days_out_last_12m', 0),
                'avg_recovery_time': latest.get('avg_recovery_time', 0),
                'is_recurrent': int(latest.get('is_recurrent', 0)),
                'months_since_last_injury': latest.get('months_since_last_injury', 99),
                'injury_frequency': latest.get('injury_frequency', 0.0),
                'injury_severity_score': latest.get('injury_severity_score', 0.0),
            }

    # Build the flat feature dict
    feat = {}
    for col in MODEL_FEATURES:
        if col in inj_record:
            feat[col] = inj_record[col]
        elif col in _INJURY_DEFAULTS:
            feat[col] = _INJURY_DEFAULTS[col]
        else:
            # Try to get from player row (handles all the playing-time stats)
            val = row.get(col, np.nan)
            feat[col] = val if not (isinstance(val, float) and np.isnan(val)) else np.nan

    df = pd.DataFrame([feat])

    # --- Label-encode categorical columns ---
    if injuries_df is not None and not injuries_df.empty:
        pos_vals = list(injuries_df['Posicion'].dropna().unique()) if 'Posicion' in injuries_df.columns else []
        country_vals = list(injuries_df['Seleccion'].dropna().unique()) if 'Seleccion' in injuries_df.columns else []
        tipo_vals = list(injuries_df['Tipo_Lesion'].dropna().unique()) if 'Tipo_Lesion' in injuries_df.columns else []
        league_vals = list(injuries_df['League'].dropna().unique()) if 'League' in injuries_df.columns else []
    else:
        pos_vals, country_vals, tipo_vals, league_vals = [], [], [], []

    df['Pos'] = _encode_categorical(df['Pos'], pos_vals)
    df['Country'] = _encode_categorical(df['Country'], country_vals)
    df['Tipo_Lesion'] = _encode_categorical(df['Tipo_Lesion'], tipo_vals)
    df['League'] = _encode_categorical(df['League'], league_vals)

    # Ensure bool columns are int
    if 'is_recurrent' in df.columns:
        df['is_recurrent'] = df['is_recurrent'].astype(int)

    for col in MODEL_FEATURES:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    df = df.replace([np.inf, -np.inf], np.nan).fillna(0)

    return df[MODEL_FEATURES]


def predict_injury_risk(models: dict, player_row: dict, injuries_df: pd.DataFrame, override_frequency: float = None, override_days_since: float = None) -> dict:
    """
    Returns injury risk prediction using the real XGBoost model.

    Returns dict with:
        risk_score      : float 0-100 (probability * 100)
        risk_proba      : float 0-1 (raw probability)
        diagnosis       : str  HEALTHY / LOW_RISK / CRITICAL_RISK
        ai_class        : int  0 / 1 / 2
        model_used      : str
    """
    try:
        model = models.get('injury')
        if model is None:
            raise ValueError("injury model not loaded")

        features_df = build_injury_features(player_row, injuries_df)

        # Apply what-if overrides after feature construction
        if override_frequency is not None:
            features_df['injury_frequency'] = override_frequency
        if override_days_since is not None:
            features_df['days_since_last_injury'] = override_days_since

        proba = model.predict_proba(features_df)[0][1]
        risk_score = float(proba) * 100.0

        if risk_score > 70:
            diagnosis = "CRITICAL_RISK"
            ai_class = 2
        elif risk_score > 30:
            diagnosis = "LOW_RISK"
            ai_class = 1
        else:
            diagnosis = "HEALTHY"
            ai_class = 0

        return {
            "risk_score": round(risk_score, 2),
            "risk_proba": round(float(proba), 4),
            "diagnosis": diagnosis,
            "ai_class": ai_class,
            "model_used": "injury_xgboost_model",
        }

    except Exception as e:
        # Graceful fallback using injury history stats only
        inj_freq = float(player_row.get('injury_frequency', 0) or 0)
        inj_sev = float(player_row.get('injury_severity_score', 0) or 0)
        risk_score = min((inj_freq * 5) + (inj_sev * 10), 95.0)

        return {
            "risk_score": round(risk_score, 2),
            "risk_proba": round(risk_score / 100, 4),
            "diagnosis": "CRITICAL_RISK" if risk_score > 70 else ("LOW_RISK" if risk_score > 30 else "HEALTHY"),
            "ai_class": 2 if risk_score > 70 else (1 if risk_score > 30 else 0),
            "model_used": f"fallback_formula (error: {str(e)[:80]})",
        }
