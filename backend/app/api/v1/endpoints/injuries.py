from fastapi import APIRouter, Request, HTTPException
import pandas as pd
import numpy as np
import joblib
import os
from app.api.v1.utils import get_df, get_team_info_by_name, get_venue_info, get_team_info
from app.api.v1.ml.injury_predictor import predict_injury_risk

router = APIRouter()

# Cache for the RF model (loaded on first use)
_rf_injury_model = None


def _get_rf_model():
    """Lazy-load the Random Forest injury model."""
    global _rf_injury_model
    if _rf_injury_model is None:
        path = os.path.join(os.path.dirname(__file__), '../../../../data/models/injury_rf_model.pkl')
        if os.path.exists(path):
            _rf_injury_model = joblib.load(path)
    return _rf_injury_model


def _predict_with_random_forest(
    request, player_row: dict, injuries_df, 
    override_frequency=None, override_days_since=None, geo_climate=None
) -> dict:
    """
    Predict injury risk using the Random Forest model.
    Uses the same key features the RF was trained on.
    """
    rf_model = _get_rf_model()
    if rf_model is None:
        # Fallback to XGBoost if RF not available
        return predict_injury_risk(
            models=request.app.state.models,
            player_row=player_row,
            injuries_df=injuries_df,
            override_frequency=override_frequency,
            override_days_since=override_days_since,
            geo_climate=geo_climate,
        )

    # Build feature vector matching training features
    key_features = [
        'Age', 'Dias_Baja', 'Partidos_Perdidos', 'prior_injuries',
        'prior_days_out', 'days_since_last_injury', 'injury_count_last_12m',
        'total_days_out_last_12m', 'avg_recovery_time', 'is_recurrent',
        'months_since_last_injury', 'injury_frequency', 'injury_severity_score',
        'MarketValue_EUR', 'MP', 'Playing Time_Min', 'Playing Time_90s',
    ]

    # Merge injury history for this player
    inj_record = {}
    if injuries_df is not None and not injuries_df.empty:
        player_name = player_row.get('Player', '')
        matches = injuries_df[injuries_df['Jugador'] == player_name]
        if matches.empty and 'Player' in injuries_df.columns:
            matches = injuries_df[injuries_df['Player'] == player_name]
        if not matches.empty:
            latest = matches.iloc[-1]
            for col in key_features:
                if col in latest.index:
                    inj_record[col] = latest[col]

    # Build feature vector
    feat = {}
    for col in key_features:
        if col in inj_record:
            feat[col] = float(inj_record[col]) if pd.notna(inj_record[col]) else 0.0
        elif col in player_row:
            val = player_row[col]
            feat[col] = float(val) if pd.notna(val) else 0.0
        else:
            feat[col] = 0.0

    # Apply overrides
    if override_frequency is not None:
        feat['injury_frequency'] = override_frequency
    if override_days_since is not None:
        feat['days_since_last_injury'] = override_days_since

    # Predict - only use features the model was trained on
    n_expected = rf_model.n_features_in_
    feature_values = [feat[f] for f in key_features[:n_expected]]
    X = np.array([feature_values])

    proba = rf_model.predict_proba(X)[0][1]
    risk_score = float(proba) * 100.0

    # Climate modulation (same logic as XGBoost)
    climate_impact = None
    if geo_climate is not None:
        from app.api.v1.ml.injury_predictor import compute_climate_features, CLIMATE_FEATURE_NAMES
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
            weights = {
                'climate_heat_stress': 3.0, 'climate_heat_x_recurrent': 8.0,
                'climate_heat_x_injury_freq': 5.0, 'climate_altitude_factor': 4.0,
                'climate_altitude_x_age': 6.0, 'climate_temp_differential': 2.5,
                'climate_humidity_differential': 1.5, 'climate_altitude_differential': 3.0,
                'climate_adaptation_stress': 2.0, 'climate_dehydration_risk': 4.0,
                'climate_is_high_altitude': 5.0, 'climate_is_extreme_heat': 4.0,
            }
            climate_adjustment = min(sum(
                climate_feats[f] * weights[f] for f in CLIMATE_FEATURE_NAMES
            ), 25.0)
            risk_score = min(risk_score + climate_adjustment, 99.0)
            climate_impact = {
                "adjustment_points": round(climate_adjustment, 2),
                "venue_temp_c": round(float(venue_temp), 1),
            }

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
        "base_risk_score": round(float(proba) * 100, 2),
        "diagnosis": diagnosis,
        "ai_class": ai_class,
        "model_used": "injury_random_forest",
    }
    if climate_impact:
        result["climate_impact"] = climate_impact
    return result


@router.get("/risk/{player_id}")
def get_injury_risk(
    request: Request,
    player_id: str,
    match: str = None,
    override_frequency: float = None,
    override_days_since: float = None,
    model: str = "xgboost",
):
    """
    Returns injury risk for a player using the real injury_xgboost_model.
    Features come from master_players_enriched + master_injuries_featured data.
    No hardcoded risk values.

    Optional query params for What-If simulation:
    - override_frequency: overrides injury_frequency feature
    - override_days_since: overrides days_since_last_injury feature
    - model: "xgboost" (default) or "random_forest"
    """
    data = request.app.state.data
    if 'players' not in data:
        raise HTTPException(status_code=500, detail="Data not loaded")

    players_df = data['players']

    # Resolve player
    try:
        player_idx = int(player_id)
        p = players_df.loc[player_idx]
        player_data = pd.DataFrame([p])
    except (ValueError, KeyError):
        player_data = players_df[players_df['Player'] == player_id]
        if len(player_data) == 0:
            player_data = players_df[
                players_df['Player'].str.lower() == player_id.lower()
            ]

    if len(player_data) == 0:
        raise HTTPException(status_code=404, detail="Player not found")

    p = player_data.iloc[0]
    country = p.get('Country', 'Unknown')

    # Team details
    team_info = get_team_info_by_name(request, country)
    team_code = team_info['code']
    flag_url = team_info['flag_url']

    # --- Real ML inference ---
    injuries_df = data.get('injuries')
    player_row = p.to_dict() if hasattr(p, 'to_dict') else dict(p)

    # Apply what-if overrides if provided
    if override_frequency is not None:
        player_row['injury_frequency'] = override_frequency
    if override_days_since is not None:
        player_row['days_since_last_injury'] = override_days_since

    # --- Obtain geoclimatic data BEFORE prediction (feeds into climate modulation) ---
    geo_climate = None
    match_context = None
    if match is not None:
        try:
            from app.api.v1.services.weather_service import get_venue_geoclimatic_info

            match_id = int(match)
            df_wc_matches = get_df(request, 'world_cup_matches')
            m_df = df_wc_matches[df_wc_matches['match_number'] == match_id]
            if not m_df.empty:
                m = m_df.iloc[0]
                home_team = get_team_info(request, m.get('home_team_id'))
                away_team = get_team_info(request, m.get('away_team_id'))
                try:
                    venue_name, stadium_url = get_venue_info(request, m.get('city_id'))
                except Exception:
                    venue_name = m.get('Stadium', 'Neutral Venue')
                    stadium_url = ""

                opponent = away_team['name'] if home_team['name'] == country else home_team['name']

                # Real geoclimatic data from stadiums + Open-Meteo
                stadiums_geo = get_df(request, 'stadiums_geo')
                kickoff_str = str(m.get('kickoff_at', ''))
                geo_climate = get_venue_geoclimatic_info(
                    stadiums_geo, m.get('city_id'), kickoff_str
                )

                # Build weather in the format the frontend expects
                weather = None
                if geo_climate:
                    w = geo_climate.get("weather") or {}
                    weather = {
                        "temp_c": w.get("temp_max"),
                        "humidity": w.get("humidity") or None,
                        "altitude": geo_climate.get("elevation_m") or 0,
                        "precipitation_mm": w.get("precipitation"),
                        "wind_speed_kmh": w.get("wind_speed_max"),
                    }

                match_context = {
                    "id": f"match-{match_id}",
                    "label": f"Partido {match_id}",
                    "opponent": opponent,
                    "venue": venue_name,
                    "stadium_url": stadium_url,
                    "home": home_team,
                    "away": away_team,
                    "weather": weather,
                    "geo_climate": geo_climate,
                }
        except Exception:
            pass

    # --- Real ML inference (now with climate modulation) ---
    if model == "random_forest":
        inference = _predict_with_random_forest(
            request=request,
            player_row=player_row,
            injuries_df=injuries_df,
            override_frequency=override_frequency,
            override_days_since=override_days_since,
            geo_climate=geo_climate,
        )
    else:
        inference = predict_injury_risk(
            models=request.app.state.models,
            player_row=player_row,
            injuries_df=injuries_df,
            override_frequency=override_frequency,
            override_days_since=override_days_since,
            geo_climate=geo_climate,
        )
    risk_score = inference['risk_score']

    # --- Real stats for radar (derived from actual playing data) ---
    from app.api.v1.ml.physiological_imputer import predict_physiological_profile
    physio = predict_physiological_profile(player_row)
    
    cardio = physio['cardio']
    endurance = physio['endurance']
    respiratory = physio['respiratory']
    recovery = physio['recovery']

    # engagement: based on interceptions (real defensive engagement metric)
    performance_int = p.get('Performance_Int_allcomps', None)
    if pd.notna(performance_int) and performance_int is not None:
        engagement = min(int(float(performance_int) * 5), 99)
    else:
        engagement = 50

    # Photo
    base_url = str(request.base_url).rstrip('/')
    photo_path = p.get('photo_url', '')
    face_url = (
        f"{base_url}{photo_path}"
        if photo_path and pd.notna(photo_path) and photo_path != ""
        else ""
    )

    return {
        "data": {
            "player": {
                "id": player_id,
                "name": p['Player'],
                "number": int(p.get('#', 10)) if pd.notna(p.get('#')) else 10,
                "national_team": country,
                "team_code": team_code,
                "flag_url": flag_url,
                "face_url": face_url,
                "rating_label": "GOOD" if risk_score < 50 else "WARNING",
                "stats": {
                    "fatigue_index": round(risk_score, 2),
                    # Physiological fields — not available without biometric sensors
                    # Returning None so the frontend can gracefully handle missing data
                    "sleep_quality": None,
                    "hydration": None,
                    "body_temp": None,
                    "stress": "LOW" if risk_score < 30 else ("MODERATE" if risk_score < 60 else "HIGH"),
                    "stress_raw": round(risk_score / 100, 4),
                    "training_load_weekly": None,
                },
                "radar": {
                    "cardio": cardio,
                    "endurance": endurance,
                    "engagement": engagement,
                    "respiratory": round(respiratory, 1),
                    "recovery": round(recovery, 1),
                },
            },
            "match_context": match_context,
            "ai_inference": {
                "class": inference['ai_class'],
                "label": inference['diagnosis'],
                "model_used": inference['model_used'],
                "risk_proba": inference.get('risk_proba'),
                "base_risk_score": inference.get('base_risk_score'),
                "climate_impact": inference.get('climate_impact'),
                "justification": (
                    "Monitor closely and adjust training volume."
                    if risk_score > 50
                    else "Ready for match."
                ),
            },
        }
    }


@router.get("/model/feature-importance")
def get_feature_importance(request: Request):
    """
    Returns real feature importance (gain) from the loaded injury XGBoost model.
    This is extracted directly from the trained model's booster.
    """
    import xgboost as xgb
    from app.api.v1.ml.injury_predictor import MODEL_FEATURES

    model = request.app.state.models.get('injury')
    if model is None:
        raise HTTPException(status_code=503, detail="Injury model not loaded")

    try:
        booster = model.get_booster()
        # Get importance by gain (how much each feature contributes to reducing loss)
        importance_dict = booster.get_score(importance_type='gain')

        # Map from internal feature names (f0, f1, ...) to actual feature names
        feature_names = MODEL_FEATURES
        results = []
        total_gain = sum(importance_dict.values()) if importance_dict else 1.0

        for fname, gain in sorted(importance_dict.items(), key=lambda x: x[1], reverse=True):
            # XGBoost uses 'f0', 'f1', etc. or actual feature names depending on how it was trained
            if fname.startswith('f') and fname[1:].isdigit():
                idx = int(fname[1:])
                real_name = feature_names[idx] if idx < len(feature_names) else fname
            else:
                real_name = fname

            results.append({
                "feature": real_name,
                "gain": round(gain, 4),
                "importance_pct": round((gain / total_gain) * 100, 2),
            })

        return {"items": results[:20], "total_features": len(importance_dict)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not extract feature importance: {str(e)}")


@router.get("/model/shap/{player_id}")
def get_shap_values(request: Request, player_id: str):
    """
    Computes SHAP-like feature contributions for a specific player's injury prediction
    using XGBoost's native pred_contribs. Returns the top features pushing risk up/down.
    """
    import xgboost as xgb
    from app.api.v1.ml.injury_predictor import MODEL_FEATURES, build_injury_features, _load_encoders

    model = request.app.state.models.get('injury')
    if model is None:
        raise HTTPException(status_code=503, detail="Injury model not loaded")

    data = request.app.state.data
    players_df = data.get('players')
    injuries_df = data.get('injuries')

    if players_df is None:
        raise HTTPException(status_code=500, detail="Players data not loaded")

    # Resolve player
    try:
        player_idx = int(player_id)
        p = players_df.loc[player_idx]
    except (ValueError, KeyError):
        player_data = players_df[players_df['Player'] == player_id]
        if player_data.empty:
            player_data = players_df[players_df['Player'].str.lower() == player_id.lower()]
        if player_data.empty:
            raise HTTPException(status_code=404, detail="Player not found")
        p = player_data.iloc[0]

    player_row = p.to_dict() if hasattr(p, 'to_dict') else dict(p)

    try:
        encoders_data = _load_encoders()
        features_df = build_injury_features(player_row, injuries_df, encoders_data)

        booster = model.get_booster()
        dmatrix = xgb.DMatrix(features_df)
        contribs = booster.predict(dmatrix, pred_contribs=True)[0]

        # contribs has len(features)+1 entries — last one is bias
        feature_contribs = []
        for i, feat_name in enumerate(MODEL_FEATURES):
            if i < len(contribs) - 1:
                feature_contribs.append((feat_name, float(contribs[i])))

        # Sort by absolute contribution
        feature_contribs.sort(key=lambda x: abs(x[1]), reverse=True)

        # Get prediction
        proba = model.predict_proba(features_df)[0][1]
        bias = float(contribs[-1]) if len(contribs) > len(MODEL_FEATURES) else 0.0

        results = []
        for feat_name, contrib in feature_contribs[:12]:
            if abs(contrib) < 0.001:
                continue
            results.append({
                "feature": feat_name,
                "contribution": round(contrib, 4),
                "direction": "risk_up" if contrib > 0 else "risk_down",
                "abs_impact": round(abs(contrib), 4),
            })

        return {
            "player_id": player_id,
            "player_name": str(p.get('Player', '')),
            "risk_proba": round(float(proba), 4),
            "bias": round(bias, 4),
            "top_contributions": results,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SHAP computation failed: {str(e)}")


@router.get("/model/distribution")
def get_risk_distribution(request: Request):
    """
    Computes the predicted risk distribution across all players in the dataset.
    Returns a histogram of risk scores (buckets of 10%) for visualization.
    Uses a cached result to avoid recomputing on every request.
    """
    from app.api.v1.ml.injury_predictor import predict_injury_risk

    cache = getattr(request.app.state, 'cache', {})
    if 'injury_distribution' in cache:
        return cache['injury_distribution']

    data = request.app.state.data
    models = request.app.state.models
    players_df = data.get('players')
    injuries_df = data.get('injuries')

    if players_df is None or players_df.empty:
        raise HTTPException(status_code=500, detail="Players data not loaded")

    model = models.get('injury')
    if model is None:
        raise HTTPException(status_code=503, detail="Injury model not loaded")

    # Sample up to 200 players for performance (sorted by impact to get a representative mix)
    sample_df = players_df.head(200)

    scores = []
    for idx, row in sample_df.iterrows():
        try:
            player_row = row.to_dict()
            result = predict_injury_risk(models, player_row, injuries_df)
            scores.append(result['risk_score'])
        except Exception:
            continue

    if not scores:
        return {"histogram": [], "stats": {}}

    # Build histogram (10% buckets)
    import numpy as np
    bins = list(range(0, 110, 10))
    counts, _ = np.histogram(scores, bins=bins)

    histogram = []
    for i in range(len(counts)):
        histogram.append({
            "bucket": f"{bins[i]}-{bins[i+1]}%",
            "min": bins[i],
            "max": bins[i+1],
            "count": int(counts[i]),
        })

    stats = {
        "mean": round(float(np.mean(scores)), 2),
        "median": round(float(np.median(scores)), 2),
        "std": round(float(np.std(scores)), 2),
        "min": round(float(np.min(scores)), 2),
        "max": round(float(np.max(scores)), 2),
        "total_players": len(scores),
    }

    result = {"histogram": histogram, "stats": stats}

    # Cache it
    if hasattr(request.app.state, 'cache'):
        request.app.state.cache['injury_distribution'] = result

    return result
