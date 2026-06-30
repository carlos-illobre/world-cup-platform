from fastapi import APIRouter, HTTPException, Request, Response
import pandas as pd
import numpy as np
import joblib
import os
from difflib import get_close_matches
from app.api.v1.ml.team_predictor import predict_player_impact

router = APIRouter()

# Cache HDBSCAN labels (loaded once)
_hdbscan_labels_cache = None


def _load_hdbscan_labels() -> dict:
    """Load HDBSCAN cluster assignments. Returns {player_name: cluster_label}."""
    global _hdbscan_labels_cache
    if _hdbscan_labels_cache is not None:
        return _hdbscan_labels_cache
    try:
        path = os.path.join(os.path.dirname(__file__), '../../../../data/models/clustering_hdbscan.pkl')
        data = joblib.load(path)
        names = data.get('player_names', [])
        labels = data.get('labels', [])
        _hdbscan_labels_cache = dict(zip(names, labels))
        return _hdbscan_labels_cache
    except Exception:
        return {}


def _apply_hdbscan_labels(df: pd.DataFrame) -> pd.DataFrame:
    """Override the 'cluster' column with HDBSCAN labels."""
    mapping = _load_hdbscan_labels()
    if not mapping:
        return df
    df['cluster'] = df['Player'].map(mapping)
    # HDBSCAN uses -1 for noise; convert to NaN so they appear as "unassigned"
    df.loc[df['cluster'] == -1, 'cluster'] = np.nan
    return df

def to_native(val):
    if pd.isna(val): return None
    if isinstance(val, (np.integer, int)): return int(val)
    if isinstance(val, (np.floating, float)): return float(val)
    return str(val)

@router.get("/countries")
def get_countries(request: Request, response: Response):
    """Returns the sorted list of unique countries (pre-computed at startup)."""
    response.headers["Cache-Control"] = "public, max-age=3600"
    cache = getattr(request.app.state, 'cache', {})
    if 'countries' in cache:
        return {"items": cache['countries']}
    # Fallback
    data = request.app.state.data
    if 'players' not in data:
        raise HTTPException(status_code=500, detail="Data not loaded")
    countries = sorted(data['players']['Country'].dropna().unique().tolist())
    return {"items": countries}


@router.get("/")
def search_players(
    request: Request,
    response: Response,
    name: str = "",
    country: str = "",
    cluster: str = "",
    sort_by: str = "",
    order: str = "desc",
    limit: int = 20,
    clustering_algo: str = "kmeans",
):
    """
    Search players by name (substring, case-insensitive) and optionally
    filter by country. Returns up to `limit` results.
    
    clustering_algo: "kmeans" (default) or "hdbscan" — determines which
    cluster labels are used for filtering and display.
    """
    response.headers["Cache-Control"] = "no-cache"
    data = request.app.state.data
    if 'players' not in data:
        raise HTTPException(status_code=500, detail="Data not loaded")
        
    players_df = data['players'].copy()
    
    # If HDBSCAN is selected, override the cluster column with HDBSCAN labels
    if clustering_algo == "hdbscan":
        players_df = _apply_hdbscan_labels(players_df)
    
    if name:
        # Substring search first
        substring_df = players_df[
            players_df['Player'].str.lower().str.contains(name.lower(), na=False)
        ]

        if substring_df.empty:
            # Fuzzy fallback using pre-cached names list
            cache = getattr(request.app.state, 'cache', {})
            all_names = cache.get('player_names', players_df['Player'].dropna().tolist())
            fuzzy_matches = get_close_matches(name, all_names, n=15, cutoff=0.3)
            if fuzzy_matches:
                players_df = players_df[players_df['Player'].isin(fuzzy_matches)]
            else:
                players_df = substring_df  # empty
        else:
            players_df = substring_df

    if country:
        players_df = players_df[
            players_df['Country'].str.lower() == country.lower()
        ]
        
    if cluster:
        players_df = players_df[
            players_df['cluster'].astype(str) == cluster
        ]
        
    if sort_by and sort_by in players_df.columns:
        ascending = order.lower() == "asc"
        players_df = players_df.sort_values(by=sort_by, ascending=ascending, na_position='last')
        
    base_url = str(request.base_url).rstrip('/')
    
    # Vectorized response construction (no iterrows)
    subset = players_df.head(limit)
    results = _build_player_list(subset, base_url)
    
    return {"items": results, "total": len(players_df)}


def _build_player_list(df: pd.DataFrame, base_url: str) -> list:
    """Builds player list response without iterrows for performance."""
    if df.empty:
        return []
    
    results = []
    # Extract columns as arrays for fast iteration
    indices = df.index.tolist()
    players = df['Player'].values
    countries = df['Country'].values
    ages = df['Age'].values
    positions = df['Pos'].values
    clubs = df['Club'].values
    clusters = df['cluster'].values if 'cluster' in df.columns else [None] * len(df)
    impacts = df['impact_score_raw'].values if 'impact_score_raw' in df.columns else [None] * len(df)
    injuries = df['total_injuries'].values if 'total_injuries' in df.columns else [None] * len(df)
    xg_overperf = df['xg_overperformance'].values if 'xg_overperformance' in df.columns else [None] * len(df)
    photo_urls = df['photo_url'].values if 'photo_url' in df.columns else [''] * len(df)
    
    # FIFA attributes
    pace_arr = df['pace'].values if 'pace' in df.columns else [None] * len(df)
    shooting_arr = df['shooting'].values if 'shooting' in df.columns else [None] * len(df)
    passing_arr = df['passing'].values if 'passing' in df.columns else [None] * len(df)
    dribbling_arr = df['dribbling'].values if 'dribbling' in df.columns else [None] * len(df)
    defending_arr = df['defending'].values if 'defending' in df.columns else [None] * len(df)
    physic_arr = df['physic'].values if 'physic' in df.columns else [None] * len(df)
    overall_arr = df['overall'].values if 'overall' in df.columns else [None] * len(df)
    
    for i in range(len(indices)):
        photo = photo_urls[i]
        photo_url = f"{base_url}{photo}" if photo else ""
        
        results.append({
            "id": str(indices[i]),
            "name": str(players[i]),
            "photo_url": photo_url,
            "country": str(countries[i]),
            "age": to_native(ages[i]),
            "position": str(positions[i]),
            "club": str(clubs[i]),
            "cluster": str(clusters[i]) if pd.notna(clusters[i]) else None,
            "impact_score": to_native(impacts[i]),
            "total_injuries": to_native(injuries[i]),
            "xg_overperformance": to_native(xg_overperf[i]),
            "attributes": {
                "pace": to_native(pace_arr[i]),
                "shooting": to_native(shooting_arr[i]),
                "passing": to_native(passing_arr[i]),
                "dribbling": to_native(dribbling_arr[i]),
                "defending": to_native(defending_arr[i]),
                "physical": to_native(physic_arr[i]),
                "overall": to_native(overall_arr[i]),
            },
        })
    
    return results

@router.get("/clusters/scatter")
def get_cluster_scatter(request: Request, response: Response):
    """
    Returns PCA-reduced 2D coordinates for each clustered player.
    Uses the same 10 per-90 features that fed the K-Means algorithm,
    applies StandardScaler + PCA(n_components=2) to project them into 2D.
    """
    from sklearn.preprocessing import StandardScaler
    from sklearn.decomposition import PCA

    response.headers["Cache-Control"] = "public, max-age=3600"
    cache = getattr(request.app.state, 'cache', {})
    if 'cluster_scatter' in cache:
        return cache['cluster_scatter']

    data = request.app.state.data
    if 'players' not in data:
        raise HTTPException(status_code=500, detail="Data not loaded")

    players_df = data['players']
    features = [
        'goals_per_90', 'assists_per_90', 'shots_per_90', 'sot_per_90',
        'tackles_won_per_90', 'interceptions_per_90', 'crosses_per_90',
        'fouls_committed_per_90', 'fouls_drawn_per_90', 'offsides_per_90'
    ]

    # Filter players that have cluster and all features
    clustered = players_df[players_df['cluster'].notna()].copy()
    clustered = clustered.dropna(subset=features)

    if clustered.empty:
        return {"items": [], "explained_variance": []}

    X = clustered[features].values.astype(float)

    # Same preprocessing as the original K-Means pipeline
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    pca = PCA(n_components=2, random_state=42)
    X_2d = pca.fit_transform(X_scaled)

    items = []
    names = clustered['Player'].values
    clusters = clustered['cluster'].values
    countries = clustered['Country'].values

    for i in range(len(clustered)):
        items.append({
            "name": str(names[i]),
            "cluster": str(int(clusters[i])),
            "country": str(countries[i]),
            "pc1": round(float(X_2d[i, 0]), 4),
            "pc2": round(float(X_2d[i, 1]), 4),
        })

    result = {
        "items": items,
        "explained_variance": [round(float(v), 4) for v in pca.explained_variance_ratio_],
        "total_explained": round(float(pca.explained_variance_ratio_.sum()), 4),
    }

    # Cache for subsequent requests
    cache['cluster_scatter'] = result
    return result


@router.get("/clusters/averages")
def get_cluster_averages(request: Request, response: Response):
    """
    Returns the average tactical attributes for each cluster (pre-computed at startup).
    """
    response.headers["Cache-Control"] = "public, max-age=3600"
    cache = getattr(request.app.state, 'cache', {})
    if 'cluster_averages' in cache:
        return cache['cluster_averages']
    
    # Fallback: compute on the fly
    data = request.app.state.data
    if 'players' not in data:
        raise HTTPException(status_code=500, detail="Data not loaded")
        
    players_df = data['players']
    clustered = players_df[players_df['cluster'].notna()]
    attrs = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physic',
             'xg_overperformance', 'impact_score_raw']
    existing_attrs = [attr for attr in attrs if attr in clustered.columns]
    averages = clustered.groupby('cluster')[existing_attrs].mean()
    
    results = {}
    for cluster_id, metrics in averages.iterrows():
        c_id = str(int(cluster_id)) if isinstance(cluster_id, (float, np.floating)) else str(cluster_id)
        formatted = {}
        for k, v in metrics.items():
            key_name = 'physical' if k == 'physic' else k
            formatted[key_name] = round(float(v), 2) if pd.notna(v) else None
        results[c_id] = formatted
        
    return results

@router.get("/{player_id}/impact")
def get_player_impact(request: Request, response: Response, player_id: str):
    """
    Predicts a player's impact score using player_impact_xgb_enriched.pkl
    with real FIFA attribute data from master_players_enriched.
    """
    response.headers["Cache-Control"] = "no-cache"
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
    player_row = p.to_dict() if hasattr(p, 'to_dict') else dict(p)

    impact_result = predict_player_impact(
        models=request.app.state.models,
        player_row=player_row,
    )

    return {
        "player_id": player_id,
        "name": str(p.get('Player')),
        **impact_result,
    }


@router.get("/{player_id}")
def get_player(request: Request, response: Response, player_id: str):
    response.headers["Cache-Control"] = "no-cache"
    data = request.app.state.data
    
    base_url = str(request.base_url).rstrip('/')
    # 1. Intentar búsqueda O(1) con el diccionario cacheado
    if 'players_dict' in data and player_id in data['players_dict']:
        p = data['players_dict'][player_id]
        return _format_player(player_id, p, base_url)
        
    # 2. Fallback
    if 'players' not in data:
        raise HTTPException(status_code=500, detail="Data not loaded")
        
    players_df = data['players']
    
    try:
        player_idx = int(player_id)
        p = players_df.loc[player_idx]
        player_data = pd.DataFrame([p])
    except (ValueError, KeyError):
        player_data = players_df[players_df['Player'] == player_id]
        if len(player_data) == 0:
            player_data = players_df[players_df['Player'].str.lower() == player_id.lower()]
        
    if len(player_data) == 0:
        raise HTTPException(status_code=404, detail="Player not found")
        
    p = player_data.iloc[0].to_dict()
    true_id = str(player_data.index[0])
    return _format_player(true_id, p, base_url)

def _format_player(player_id, p, base_url):
    photo_path = p.get('photo_url', '')
    photo_url = f"{base_url}{photo_path}" if photo_path else ""
    return {
        "id": player_id,
        "name": str(p.get('Player')),
        "photo_url": photo_url,
        "country": str(p.get('Country')),
        "age": to_native(p.get('Age')),
        "position": str(p['Pos']) if pd.notna(p.get('Pos')) else None,
        "club": str(p['Club']) if pd.notna(p.get('Club')) else None,
        "cluster": str(p.get('cluster')) if pd.notna(p.get('cluster')) else None,
        "impact_score": to_native(p.get('impact_score_raw')),
        "total_injuries": to_native(p.get('total_injuries')),
        "attributes": {
            "pace": to_native(p.get('pace')),
            "shooting": to_native(p.get('shooting')),
            "passing": to_native(p.get('passing')),
            "dribbling": to_native(p.get('dribbling')),
            "defending": to_native(p.get('defending')),
            "physical": to_native(p.get('physic')),
            "overall": to_native(p.get('overall'))
        }
    }


@router.get("/model/feature-importance")
def get_impact_feature_importance(request: Request, response: Response):
    """
    Returns real feature importance (gain) from the loaded player_impact XGBoost model.
    """
    import xgboost as xgb
    from app.api.v1.ml.team_predictor import PLAYER_IMPACT_FEATURES

    response.headers["Cache-Control"] = "public, max-age=3600"
    model = request.app.state.models.get('player_impact')
    if model is None:
        raise HTTPException(status_code=503, detail="Player impact model not loaded")

    try:
        booster = model.get_booster()
        importance_dict = booster.get_score(importance_type='gain')
        feature_names = PLAYER_IMPACT_FEATURES
        total_gain = sum(importance_dict.values()) if importance_dict else 1.0

        results = []
        for fname, gain in sorted(importance_dict.items(), key=lambda x: x[1], reverse=True):
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
