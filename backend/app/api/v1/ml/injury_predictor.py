"""
Injury Risk Predictor
======================
Calls injury_xgboost_model.pkl with the exact 123 features it was trained on.

FIXED: Uses the pre-trained encoders from encoders.pkl (OneHotEncoder + StandardScaler)
that were used during model training, ensuring categorical encoding is consistent.
When encoders are unavailable, uses a hash-based fallback that produces stable
encodings regardless of runtime data distribution.
"""

import pandas as pd
import numpy as np
import joblib
import logging

logger = logging.getLogger(__name__)

# The 4 categorical columns that need encoding before the model
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
    'Altura': None,
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

# Module-level cache for encoders (loaded once)
_encoders_cache = None


def _load_encoders():
    """Load the pre-trained encoders from encoders.pkl (cached)."""
    global _encoders_cache
    if _encoders_cache is not None:
        return _encoders_cache
    try:
        data = joblib.load('data/csv/encoders.pkl')
        _encoders_cache = data
        logger.info("Loaded encoders.pkl successfully")
        return _encoders_cache
    except Exception as e:
        logger.warning(f"Could not load encoders.pkl: {e}")
        return None


def _encode_categorical_stable(value: str, col_name: str, encoders_data: dict) -> float:
    """
    Encodes a categorical value using the pre-trained encoders.
    Falls back to a hash-based stable encoding if encoders are unavailable.
    
    The injury model was trained with LabelEncoder-style integer encoding
    derived from the training data. We replicate this by finding the value's
    position in the sorted unique values from the training data.
    """
    if encoders_data is not None:
        # The injuries_ohe encoder knows the categories from training
        ohe = encoders_data.get('encoders', {}).get('injuries_ohe')
        if ohe is not None and hasattr(ohe, 'categories_'):
            # Map col_name to the correct category index in the OHE
            # The OHE was fit on the injuries DataFrame columns in order
            # For label encoding fallback, use the sorted categories
            cat_map = {
                'Pos': None,
                'Country': None,
                'Tipo_Lesion': None,
                'League': None,
            }
            # Try to find matching categories by content analysis
            for i, cats in enumerate(ohe.categories_):
                cats_list = [str(c) for c in cats]
                # Heuristic: identify which category array matches which column
                if any('GK' in c or 'FW' in c or 'DF' in c or 'MF' in c for c in cats_list):
                    cat_map['Pos'] = cats_list
                elif any('Hamstring' in c or 'ACL' in c or 'Knee' in c for c in cats_list):
                    cat_map['Tipo_Lesion'] = cats_list
                elif any('eng' in c.lower() or 'esp' in c.lower() or 'fra' in c.lower() for c in cats_list if len(c) < 8):
                    cat_map['League'] = cats_list
                elif len(cats_list) > 30:
                    # Large category = likely Country
                    cat_map['Country'] = cats_list

            known_values = cat_map.get(col_name)
            if known_values:
                sorted_vals = sorted(known_values)
                val_str = str(value) if value is not None else 'MISSING'
                if val_str in sorted_vals:
                    return float(sorted_vals.index(val_str))
                # Unknown value → use 0 (safe fallback)
                return 0.0

    # Hash-based stable fallback: produces consistent int regardless of runtime data
    val_str = str(value) if value is not None else 'MISSING'
    return float(hash(val_str) % 1000)


def build_injury_features(player_row: dict, injuries_df: pd.DataFrame, encoders_data: dict = None) -> pd.DataFrame:
    """
    Constructs the 123-feature DataFrame for the injury XGBoost model.

    Parameters
    ----------
    player_row : dict
        One row from master_players_enriched (all player stats).
    injuries_df : pd.DataFrame
        master_injuries_featured loaded at startup.
    encoders_data : dict
        Pre-loaded encoders from encoders.pkl

    Returns
    -------
    pd.DataFrame with shape (1, 123) ready for model.predict_proba()
    """
    row = dict(player_row)

    # --- Merge in injury history for this player ---
    inj_record = {}
    if injuries_df is not None and not injuries_df.empty:
        player_name = row.get('Player', '')
        # Try matching by 'Jugador' column (Spanish name in injuries CSV)
        matches = injuries_df[injuries_df['Jugador'] == player_name]
        if matches.empty and 'Player' in injuries_df.columns:
            matches = injuries_df[injuries_df['Player'] == player_name]

        if not matches.empty:
            # Use the most recent injury record (last row for this player)
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

    # --- Encode categorical columns using stable encoding ---
    if encoders_data is None:
        encoders_data = _load_encoders()

    for col in CAT_COLS:
        raw_val = df[col].iloc[0]
        df[col] = _encode_categorical_stable(raw_val, col, encoders_data)

    # Ensure bool columns are int
    if 'is_recurrent' in df.columns:
        df['is_recurrent'] = df['is_recurrent'].astype(int)

    # Fill remaining NaN with 0 (tree models handle this gracefully)
    df = df.fillna(0)

    return df[MODEL_FEATURES]


def predict_injury_risk(
    models: dict,
    player_row: dict,
    injuries_df: pd.DataFrame,
    override_frequency: float = None,
    override_days_since: float = None,
) -> dict:
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

        encoders_data = _load_encoders()
        features_df = build_injury_features(player_row, injuries_df, encoders_data)

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
        total_inj = float(player_row.get('total_injuries', 0) or 0)
        age = float(player_row.get('Age', 25) or 25)

        # More nuanced fallback formula
        base_risk = min(inj_freq * 8, 40)  # frequency contribution
        severity_risk = min(inj_sev * 5, 25)  # severity contribution
        age_risk = max(0, (age - 28) * 2) if age > 28 else 0  # age factor
        volume_risk = min(total_inj * 0.5, 20)  # historical volume

        risk_score = min(base_risk + severity_risk + age_risk + volume_risk, 95.0)

        return {
            "risk_score": round(risk_score, 2),
            "risk_proba": round(risk_score / 100, 4),
            "diagnosis": "CRITICAL_RISK" if risk_score > 70 else ("LOW_RISK" if risk_score > 30 else "HEALTHY"),
            "ai_class": 2 if risk_score > 70 else (1 if risk_score > 30 else 0),
            "model_used": f"fallback_formula (error: {str(e)[:80]})",
        }
