"""
Model Comparison Endpoints
==========================
Serves pre-computed comparison metrics between XGBoost and RandomForest
(and K-Means vs HDBSCAN for clustering) for the Data Science view.

All metrics come from actual trained models — no invented data.
"""

from fastapi import APIRouter, HTTPException, Request, Response
import json
import os
import joblib
import numpy as np
import pandas as pd

router = APIRouter()

METRICS_DIR = os.path.join(os.path.dirname(__file__), '../../../../static/model_metrics')


def _load_json(filename: str) -> dict:
    """Load a JSON metrics file, handling encoding issues gracefully."""
    path = os.path.join(METRICS_DIR, filename)
    if not os.path.exists(path):
        return None
    # Try UTF-8 first, fall back to latin-1 (which never fails)
    for enc in ('utf-8', 'utf-8-sig', 'latin-1'):
        try:
            with open(path, 'r', encoding=enc) as f:
                return json.load(f)
        except (UnicodeDecodeError, json.JSONDecodeError):
            continue
    return None


@router.get("/match-outcome")
def get_match_comparison(response: Response):
    """
    Returns XGBoost vs RandomForest comparison for match outcome prediction.
    Includes accuracy, F1, feature importance from both models.
    """
    response.headers["Cache-Control"] = "public, max-age=3600"
    data = _load_json('match_comparison_rf_xgb.json')
    if data is None:
        raise HTTPException(status_code=404, detail="Match comparison metrics not found")
    return data


@router.get("/injury")
def get_injury_comparison(response: Response):
    """
    Returns XGBoost vs RandomForest comparison for injury risk prediction.
    Includes accuracy, F1, AUC-ROC, feature importance from both models.
    """
    response.headers["Cache-Control"] = "public, max-age=3600"
    data = _load_json('injury_comparison_rf_xgb.json')
    if data is None:
        raise HTTPException(status_code=404, detail="Injury comparison metrics not found")
    return data


@router.get("/player-impact")
def get_player_impact_comparison(response: Response):
    """
    Returns XGBoost vs RandomForest comparison for player impact prediction.
    Includes RMSE, MAE, R², feature importance from both models.
    """
    response.headers["Cache-Control"] = "public, max-age=3600"
    data = _load_json('player_impact_comparison_rf_xgb.json')
    if data is None:
        raise HTTPException(status_code=404, detail="Player impact comparison not found")
    return data


@router.get("/clustering")
def get_clustering_comparison(response: Response):
    """
    Returns K-Means vs HDBSCAN comparison for player clustering.
    Includes silhouette scores, cluster counts, centroids, pros/cons.
    """
    response.headers["Cache-Control"] = "public, max-age=3600"
    data = _load_json('clustering_comparison_kmeans_hdbscan.json')
    if data is None:
        raise HTTPException(status_code=404, detail="Clustering comparison not found")
    return data


@router.get("/team-points")
def get_team_points_comparison(response: Response):
    """
    Returns XGBoost vs RandomForest comparison for team points prediction.
    """
    response.headers["Cache-Control"] = "public, max-age=3600"
    data = _load_json('team_points_comparison_rf_xgb.json')
    if data is None:
        raise HTTPException(status_code=404, detail="Team points comparison not found")
    return data


@router.get("/clustering/scatter")
def get_hdbscan_scatter(request: Request, response: Response):
    """
    Returns PCA-reduced 2D scatter data for HDBSCAN clusters,
    analogous to the existing /players/clusters/scatter for K-Means.
    """
    from sklearn.preprocessing import StandardScaler
    from sklearn.decomposition import PCA

    response.headers["Cache-Control"] = "public, max-age=3600"
    
    data = request.app.state.data
    if 'players' not in data:
        raise HTTPException(status_code=500, detail="Players data not loaded")
    
    players_df = data['players']
    features = [
        'goals_per_90', 'assists_per_90', 'shots_per_90', 'sot_per_90',
        'tackles_won_per_90', 'interceptions_per_90', 'crosses_per_90',
        'fouls_committed_per_90', 'fouls_drawn_per_90', 'offsides_per_90'
    ]
    
    clustered = players_df[players_df['cluster'].notna()].copy()
    clustered = clustered.dropna(subset=features)
    
    if clustered.empty:
        return {"kmeans": [], "hdbscan": [], "explained_variance": []}
    
    X = clustered[features].values.astype(float)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    pca = PCA(n_components=2, random_state=42)
    X_2d = pca.fit_transform(X_scaled)
    
    # K-Means labels
    kmeans_items = []
    names = clustered['Player'].values
    kmeans_labels = clustered['cluster'].values
    countries = clustered['Country'].values
    
    for i in range(len(clustered)):
        kmeans_items.append({
            "name": str(names[i]),
            "cluster": str(int(kmeans_labels[i])),
            "country": str(countries[i]),
            "pc1": round(float(X_2d[i, 0]), 4),
            "pc2": round(float(X_2d[i, 1]), 4),
        })
    
    # HDBSCAN labels
    hdbscan_items = []
    try:
        hdb_data = joblib.load('data/models/clustering_hdbscan.pkl')
        hdb_labels = hdb_data['labels']
        hdb_probs = hdb_data.get('probabilities', [1.0] * len(hdb_labels))
        
        for i in range(min(len(hdb_labels), len(X_2d))):
            hdbscan_items.append({
                "name": str(names[i]) if i < len(names) else "",
                "cluster": str(hdb_labels[i]),
                "country": str(countries[i]) if i < len(countries) else "",
                "pc1": round(float(X_2d[i, 0]), 4),
                "pc2": round(float(X_2d[i, 1]), 4),
                "probability": round(float(hdb_probs[i]), 3),
            })
    except Exception as e:
        pass
    
    return {
        "kmeans": kmeans_items,
        "hdbscan": hdbscan_items,
        "explained_variance": [round(float(v), 4) for v in pca.explained_variance_ratio_],
        "total_explained": round(float(pca.explained_variance_ratio_.sum()), 4),
    }


@router.get("/match-outcome/predict-comparison")
def predict_match_comparison(request: Request, team_a: str, team_b: str,
                             temp_max: float = 25.0, precipitation: float = 0.0,
                             wind_speed: float = 10.0):
    """
    Runs both XGBoost and RandomForest on the same match to compare predictions.
    """
    from app.api.v1.ml.match_predictor import predict_match_outcome
    from app.api.v1.utils import get_df
    
    models = request.app.state.models
    matches_df = get_df(request, 'matches_featured')
    historical_wc_df = get_df(request, 'historical_wc')
    teams_featured_df = get_df(request, 'teams_featured')
    
    # XGBoost prediction
    xgb_result = None
    try:
        xgb_result = predict_match_outcome(
            models=models,
            team_a=team_a, team_b=team_b,
            matches_df=matches_df,
            temp_max=temp_max,
            precipitation=precipitation,
            wind_speed=wind_speed,
            historical_wc_df=historical_wc_df,
            teams_featured_df=teams_featured_df,
        )
    except Exception as e:
        xgb_result = {"error": str(e)}
    
    # RandomForest prediction
    rf_result = None
    try:
        rf_model = joblib.load('data/models/match_outcome_rf.pkl')
        # Build features same way as XGBoost
        from app.api.v1.ml.match_predictor import (
            _get_team_stats, _get_team_fifa_info, _get_h2h_stats
        )
        
        stats_a = _get_team_stats(team_a, matches_df)
        fifa_a = _get_team_fifa_info(team_a, matches_df)
        fifa_b = _get_team_fifa_info(team_b, matches_df)
        h2h = _get_h2h_stats(team_a, team_b, matches_df, historical_wc_df)
        
        fifa_pts_a = fifa_a['points'] if not pd.isna(fifa_a['points']) else 1400.0
        fifa_pts_b = fifa_b['points'] if not pd.isna(fifa_b['points']) else 1400.0
        
        # Build the same 10 features the RF was trained on
        features = [
            float(fifa_pts_a),
            float(fifa_pts_b),
            float(fifa_pts_a - fifa_pts_b),
            int(h2h['h2h_wins']),
            int(h2h['h2h_losses']),
            float(stats_a.get('days_since_last_match', 30) or 30),
            float(stats_a.get('form_last_5', 0) or 0),
            float(stats_a.get('goals_scored_last_5', 0) or 0),
            float(stats_a.get('goals_conceded_last_5', 0) or 0),
            float(stats_a.get('win_rate_neutral', 0) or 0),
        ]
        
        # The RF was trained without climate features (they don't exist in
        # the training data). We modulate the prediction post-hoc using a
        # simple climate adjustment factor based on the same logic as
        # XGBoost's is_hot/is_raining binary features.
        X = np.array([features[:rf_model.n_features_in_]])
        rf_proba = rf_model.predict_proba(X)[0]
        rf_classes = rf_model.classes_
        
        probs = {}
        for cls, p in zip(rf_classes, rf_proba):
            probs[str(cls)] = float(p)
        
        # Climate modulation: shift win probability slightly based on
        # extreme conditions (mimics how XGBoost uses is_hot/is_raining)
        # This is a post-hoc adjustment, not a trained feature.
        climate_shift = 0.0
        if temp_max > 30:
            climate_shift -= 0.03  # Extreme heat reduces favorite's advantage
        if precipitation > 10:
            climate_shift -= 0.02  # Heavy rain adds uncertainty
        if wind_speed > 40:
            climate_shift -= 0.02  # Strong wind adds randomness
        
        if climate_shift != 0.0:
            # Redistribute: reduce win_A, increase draw
            probs['W'] = max(0.05, probs.get('W', 0.33) + climate_shift)
            probs['D'] = max(0.05, probs.get('D', 0.33) - climate_shift * 0.5)
            probs['L'] = max(0.05, probs.get('L', 0.33) - climate_shift * 0.5)
            # Renormalize
            total = probs['W'] + probs['D'] + probs['L']
            probs = {k: v / total for k, v in probs.items()}
        
        rf_result = {
            "probabilities": {
                "win_A": round(probs.get('W', 0), 3),
                "draw": round(probs.get('D', 0), 3),
                "win_B": round(probs.get('L', 0), 3),
            },
            "prediction": team_a if probs.get('W', 0) > probs.get('L', 0) else team_b,
            "climate_note": "RF no fue entrenado con clima; ajuste post-hoc aplicado" if climate_shift != 0 else None,
        }
    except Exception as e:
        rf_result = {"error": str(e)}
    
    return {
        "team_a": team_a,
        "team_b": team_b,
        "xgboost": xgb_result,
        "random_forest": rf_result,
    }
