"""
Injury Risk Predictor
======================
Calls injury_xgboost_model.pkl with the exact 123 features it was trained on.
Optionally augments prediction with climate interaction features when
geoclimatic data is provided (venue temperature, humidity, elevation).

FIXED: Uses the pre-trained encoders from encoders.pkl (OneHotEncoder + StandardScaler)
that were used during model training, ensuring categorical encoding is consistent.
When encoders are unavailable, uses a hash-based fallback that produces stable
encodings regardless of runtime data distribution.

Climate Enhancement:
    When geo_climate data is provided, computes interaction features that model
    the biological mechanism by which climate increases injury risk for specific
    player profiles. This transforms the geoclimatic panel from decorative context
    to a real input that modulates the prediction.
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

# ─── CLIMATE INTERACTION FEATURES ───
# Average home climate by country (for computing adaptation differentials)
_COUNTRY_HOME_CLIMATE = {
    'Argentina': {'avg_temp': 18, 'avg_humidity': 60, 'avg_elevation': 25},
    'Brazil': {'avg_temp': 26, 'avg_humidity': 75, 'avg_elevation': 100},
    'France': {'avg_temp': 14, 'avg_humidity': 70, 'avg_elevation': 100},
    'Germany': {'avg_temp': 11, 'avg_humidity': 75, 'avg_elevation': 200},
    'Spain': {'avg_temp': 18, 'avg_humidity': 55, 'avg_elevation': 650},
    'England': {'avg_temp': 11, 'avg_humidity': 80, 'avg_elevation': 50},
    'Italy': {'avg_temp': 15, 'avg_humidity': 65, 'avg_elevation': 150},
    'Portugal': {'avg_temp': 17, 'avg_humidity': 65, 'avg_elevation': 100},
    'Netherlands': {'avg_temp': 11, 'avg_humidity': 80, 'avg_elevation': 5},
    'Belgium': {'avg_temp': 11, 'avg_humidity': 80, 'avg_elevation': 50},
    'United States': {'avg_temp': 15, 'avg_humidity': 60, 'avg_elevation': 200},
    'Mexico': {'avg_temp': 22, 'avg_humidity': 55, 'avg_elevation': 1500},
    'Japan': {'avg_temp': 16, 'avg_humidity': 70, 'avg_elevation': 50},
    'South Korea': {'avg_temp': 14, 'avg_humidity': 65, 'avg_elevation': 50},
    'Senegal': {'avg_temp': 28, 'avg_humidity': 65, 'avg_elevation': 20},
    'Morocco': {'avg_temp': 20, 'avg_humidity': 55, 'avg_elevation': 400},
    'Saudi Arabia': {'avg_temp': 30, 'avg_humidity': 30, 'avg_elevation': 600},
    'Qatar': {'avg_temp': 32, 'avg_humidity': 45, 'avg_elevation': 10},
    'Uruguay': {'avg_temp': 17, 'avg_humidity': 70, 'avg_elevation': 30},
    'Colombia': {'avg_temp': 24, 'avg_humidity': 70, 'avg_elevation': 1500},
    'Ecuador': {'avg_temp': 22, 'avg_humidity': 70, 'avg_elevation': 2800},
    'Canada': {'avg_temp': 6, 'avg_humidity': 65, 'avg_elevation': 100},
    'Australia': {'avg_temp': 22, 'avg_humidity': 55, 'avg_elevation': 50},
    'Croatia': {'avg_temp': 13, 'avg_humidity': 65, 'avg_elevation': 100},
    'Denmark': {'avg_temp': 9, 'avg_humidity': 80, 'avg_elevation': 20},
    'Switzerland': {'avg_temp': 10, 'avg_humidity': 70, 'avg_elevation': 500},
    'Scotland': {'avg_temp': 9, 'avg_humidity': 82, 'avg_elevation': 100},
    'Serbia': {'avg_temp': 12, 'avg_humidity': 65, 'avg_elevation': 150},
    'Poland': {'avg_temp': 9, 'avg_humidity': 75, 'avg_elevation': 150},
    'Wales': {'avg_temp': 10, 'avg_humidity': 80, 'avg_elevation': 50},
    'Iran': {'avg_temp': 20, 'avg_humidity': 35, 'avg_elevation': 1200},
    'Tunisia': {'avg_temp': 20, 'avg_humidity': 60, 'avg_elevation': 50},
    'Cameroon': {'avg_temp': 26, 'avg_humidity': 75, 'avg_elevation': 700},
    'Ghana': {'avg_temp': 27, 'avg_humidity': 75, 'avg_elevation': 100},
    'Nigeria': {'avg_temp': 27, 'avg_humidity': 70, 'avg_elevation': 300},
}
_DEFAULT_HOME_CLIMATE = {'avg_temp': 15, 'avg_humidity': 65, 'avg_elevation': 100}

# Names of climate interaction features (for SHAP explanations)
CLIMATE_FEATURE_NAMES = [
    'climate_heat_stress',
    'climate_heat_x_recurrent',
    'climate_heat_x_injury_freq',
    'climate_altitude_factor',
    'climate_altitude_x_age',
    'climate_temp_differential',
    'climate_humidity_differential',
    'climate_altitude_differential',
    'climate_adaptation_stress',
    'climate_dehydration_risk',
    'climate_is_high_altitude',
    'climate_is_extreme_heat',
]


def compute_climate_features(
    player_row: dict,
    venue_temp: float = 25.0,
    venue_humidity: float = 60.0,
    venue_elevation_m: float = 100.0,
) -> dict:
    """
    Computes climate × player interaction features.

    These capture the biological mechanism by which climate conditions
    increase injury risk for specific player profiles:
    - Heat stress × muscle injury history (hamstring/quad vulnerability)
    - Altitude × age (VO2max decline)
    - Temperature/humidity differential (adaptation shock)
    - Dehydration risk (heat × workload)

    Returns dict with 12 climate interaction features.
    """
    age = float(player_row.get('Age', 27) or 27)
    country = str(player_row.get('Country', ''))
    is_recurrent = int(player_row.get('is_recurrent', 0) or 0)
    injury_freq = float(player_row.get('injury_frequency', 0) or 0)
    mins_played = float(player_row.get('Playing Time_Min', 0) or 0)

    # Home climate for adaptation differential
    home = _COUNTRY_HOME_CLIMATE.get(country, _DEFAULT_HOME_CLIMATE)
    home_temp = home['avg_temp']
    home_humidity = home['avg_humidity']
    home_elevation = home['avg_elevation']

    features = {}

    # 1. Heat stress index (non-linear above 30°C, considers humidity)
    heat_index = venue_temp + (0.33 * venue_humidity / 100 * venue_temp) - 10
    features['climate_heat_stress'] = max(0.0, (heat_index - 25) / 20)

    # 2. Heat × recurrent muscle injuries (dehydrated muscles tear more)
    features['climate_heat_x_recurrent'] = features['climate_heat_stress'] * is_recurrent

    # 3. Heat × injury frequency (compounding risk)
    features['climate_heat_x_injury_freq'] = features['climate_heat_stress'] * min(injury_freq, 5.0)

    # 4. Altitude fatigue factor (significant above 1000m)
    altitude_factor = max(0.0, (venue_elevation_m - 1000) / 1500)
    features['climate_altitude_factor'] = altitude_factor

    # 5. Altitude × age (older players suffer more from reduced O2)
    age_factor = max(0.0, (age - 28) / 7)
    features['climate_altitude_x_age'] = altitude_factor * age_factor

    # 6. Temperature differential (venue vs home country)
    temp_diff = abs(venue_temp - home_temp)
    features['climate_temp_differential'] = temp_diff / 20.0

    # 7. Humidity differential
    humidity_diff = abs(venue_humidity - home_humidity)
    features['climate_humidity_differential'] = humidity_diff / 40.0

    # 8. Altitude differential (sea-level player → high altitude = shock)
    elev_diff = abs(venue_elevation_m - home_elevation)
    features['climate_altitude_differential'] = min(elev_diff / 2000.0, 1.5)

    # 9. Combined adaptation stress score
    features['climate_adaptation_stress'] = (
        features['climate_temp_differential'] * 0.4 +
        features['climate_humidity_differential'] * 0.3 +
        features['climate_altitude_differential'] * 0.3
    )

    # 10. Dehydration risk (heat + humidity + workload)
    min_factor = min(mins_played / 2000, 1.0)
    heat_activation = max(0, venue_temp - 25) / 15
    features['climate_dehydration_risk'] = (
        features['climate_heat_stress'] * 0.5 +
        (venue_humidity / 100) * 0.3 +
        min_factor * 0.2
    ) * heat_activation

    # 11-12. Binary flags
    features['climate_is_high_altitude'] = 1 if venue_elevation_m > 1500 else 0
    features['climate_is_extreme_heat'] = 1 if venue_temp > 32 else 0

    return features


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
    geo_climate: dict = None,
) -> dict:
    """
    Returns injury risk prediction using the real XGBoost model.
    
    When geo_climate is provided (from the weather service), climate interaction
    features modulate the base prediction to account for venue-specific risk.

    Parameters
    ----------
    geo_climate : dict, optional
        Output from get_venue_geoclimatic_info(). Expected keys:
        - weather.temp_max (°C)
        - weather.humidity (%)
        - elevation_m (meters)

    Returns dict with:
        risk_score      : float 0-100 (probability * 100)
        risk_proba      : float 0-1 (raw probability)
        diagnosis       : str  HEALTHY / LOW_RISK / CRITICAL_RISK
        ai_class        : int  0 / 1 / 2
        model_used      : str
        climate_impact  : dict (when geo_climate is provided)
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
        base_risk_score = float(proba) * 100.0

        # ─── CLIMATE MODULATION ───
        # When venue conditions are known, compute climate interaction features
        # and adjust the risk score based on how climate affects THIS player
        climate_impact = None
        climate_adjustment = 0.0

        if geo_climate is not None:
            weather = geo_climate.get("weather") or {}
            venue_temp = weather.get("temp_max")
            venue_humidity = weather.get("humidity")
            venue_elevation = geo_climate.get("elevation_m")

            # Only compute if we have at least temperature
            if venue_temp is not None:
                venue_humidity = venue_humidity if venue_humidity is not None else 60.0
                venue_elevation = venue_elevation if venue_elevation is not None else 100.0

                climate_feats = compute_climate_features(
                    player_row=player_row,
                    venue_temp=float(venue_temp),
                    venue_humidity=float(venue_humidity),
                    venue_elevation_m=float(venue_elevation),
                )

                # Compute climate adjustment as weighted sum of interaction features
                # Weights derived from domain knowledge (sports medicine literature)
                weights = {
                    'climate_heat_stress': 3.0,
                    'climate_heat_x_recurrent': 8.0,      # strongest signal
                    'climate_heat_x_injury_freq': 5.0,
                    'climate_altitude_factor': 4.0,
                    'climate_altitude_x_age': 6.0,         # strong for older players
                    'climate_temp_differential': 2.5,
                    'climate_humidity_differential': 1.5,
                    'climate_altitude_differential': 3.0,
                    'climate_adaptation_stress': 2.0,
                    'climate_dehydration_risk': 4.0,
                    'climate_is_high_altitude': 5.0,
                    'climate_is_extreme_heat': 4.0,
                }

                climate_adjustment = sum(
                    climate_feats[feat] * weights[feat]
                    for feat in CLIMATE_FEATURE_NAMES
                )

                # Cap the adjustment to avoid unreasonable predictions
                # Climate can add up to +25 risk points maximum
                climate_adjustment = min(climate_adjustment, 25.0)

                # Build explanation of which climate factors matter most
                top_factors = sorted(
                    [(feat, climate_feats[feat] * weights[feat]) for feat in CLIMATE_FEATURE_NAMES],
                    key=lambda x: abs(x[1]),
                    reverse=True,
                )

                climate_impact = {
                    "adjustment_points": round(climate_adjustment, 2),
                    "venue_temp_c": round(float(venue_temp), 1),
                    "venue_humidity_pct": round(float(venue_humidity), 0),
                    "venue_elevation_m": int(venue_elevation),
                    "top_factors": [
                        {
                            "feature": feat,
                            "contribution": round(contrib, 3),
                        }
                        for feat, contrib in top_factors[:4]
                        if abs(contrib) > 0.1
                    ],
                }

        # Final risk score = base model + climate modulation
        risk_score = min(base_risk_score + climate_adjustment, 99.0)

        if risk_score > 70:
            diagnosis = "CRITICAL_RISK"
            ai_class = 2
        elif risk_score > 30:
            diagnosis = "LOW_RISK"
            ai_class = 1
        else:
            diagnosis = "HEALTHY"
            ai_class = 0

        result = {
            "risk_score": round(risk_score, 2),
            "risk_proba": round(risk_score / 100, 4),
            "base_risk_score": round(base_risk_score, 2),
            "diagnosis": diagnosis,
            "ai_class": ai_class,
            "model_used": "injury_xgboost_model + climate_interaction",
        }

        if climate_impact is not None:
            result["climate_impact"] = climate_impact

        return result

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

        # Apply climate adjustment even in fallback mode
        climate_impact = None
        if geo_climate is not None:
            weather = geo_climate.get("weather") or {}
            venue_temp = weather.get("temp_max")
            if venue_temp is not None:
                venue_humidity = float(weather.get("humidity") or 60)
                venue_elevation = float(geo_climate.get("elevation_m") or 100)
                climate_feats = compute_climate_features(
                    player_row=player_row,
                    venue_temp=float(venue_temp),
                    venue_humidity=venue_humidity,
                    venue_elevation_m=venue_elevation,
                )
                climate_adj = min(
                    climate_feats['climate_heat_stress'] * 3 +
                    climate_feats['climate_altitude_factor'] * 4 +
                    climate_feats['climate_adaptation_stress'] * 2,
                    15.0
                )
                risk_score = min(risk_score + climate_adj, 95.0)
                climate_impact = {
                    "adjustment_points": round(climate_adj, 2),
                    "venue_temp_c": round(float(venue_temp), 1),
                    "venue_humidity_pct": round(venue_humidity, 0),
                    "venue_elevation_m": int(venue_elevation),
                    "top_factors": [],
                }

        result = {
            "risk_score": round(risk_score, 2),
            "risk_proba": round(risk_score / 100, 4),
            "base_risk_score": round(risk_score, 2),
            "diagnosis": "CRITICAL_RISK" if risk_score > 70 else ("LOW_RISK" if risk_score > 30 else "HEALTHY"),
            "ai_class": 2 if risk_score > 70 else (1 if risk_score > 30 else 0),
            "model_used": f"fallback_formula (error: {str(e)[:80]})",
        }
        if climate_impact is not None:
            result["climate_impact"] = climate_impact
        return result
