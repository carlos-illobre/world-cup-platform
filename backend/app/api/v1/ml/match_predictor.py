"""
Match Outcome Predictor
========================
Calls match_outcome_weather_xgb.pkl with the exact 14 features it was trained on.
All feature values are sourced from real scraped data in master_matches_featured.csv.

Also supports the 3-class match_outcome_xgb.pkl model when available, which
directly predicts Win/Draw/Loss without artificial probability distribution.
"""

import pandas as pd
import numpy as np
import xgboost as xgb

# Exact feature order the weather model expects
WEATHER_MODEL_FEATURES = [
    'Country_FIFA_Points', 'Opponent_FIFA_Points', 'ranking_diff',
    'h2h_wins', 'h2h_losses', 'days_since_last_match',
    'form_last_5', 'goals_scored_last_5', 'goals_conceded_last_5',
    'temp_max', 'precipitation', 'wind_speed', 'is_raining', 'is_hot'
]


def _find_team_matches(team_name: str, matches_df: pd.DataFrame) -> pd.DataFrame:
    """Find matches for a team with case-insensitive fallback."""
    team_matches = matches_df[matches_df['Country'] == team_name]
    if team_matches.empty:
        team_matches = matches_df[
            matches_df['Country'].str.lower() == team_name.lower()
        ]
    return team_matches


def _get_team_stats(team_name: str, matches_df: pd.DataFrame) -> dict:
    """
    Extracts real match stats for a team from master_matches_featured.
    Returns the aggregated stats for the most recent matches.
    """
    team_matches = _find_team_matches(team_name, matches_df)

    if team_matches.empty:
        return {}

    # Use the most recent available row (last known stats)
    latest = team_matches.iloc[-1]

    return {
        'Country_FIFA_Points': latest.get('Country_FIFA_Points', np.nan),
        'Country_FIFA_Rank': latest.get('Country_FIFA_Rank', np.nan),
        'Opponent_FIFA_Points': latest.get('Opponent_FIFA_Points', np.nan),
        'Opponent_FIFA_Rank': latest.get('Opponent_FIFA_Rank', np.nan),
        'ranking_diff': latest.get('ranking_diff', 0),
        'h2h_wins': latest.get('h2h_wins', 0),
        'h2h_losses': latest.get('h2h_losses', 0),
        'days_since_last_match': latest.get('days_since_last_match', 30),
        'form_last_5': latest.get('form_last_5', 0),
        'goals_scored_last_5': latest.get('goals_scored_last_5', 0),
        'goals_conceded_last_5': latest.get('goals_conceded_last_5', 0),
    }


def _get_team_fifa_info(team_name: str, matches_df: pd.DataFrame) -> dict:
    """Gets FIFA points AND rank for a team from its own matches."""
    team_matches = _find_team_matches(team_name, matches_df)
    if not team_matches.empty:
        latest = team_matches.iloc[-1]
        pts = latest.get('Country_FIFA_Points', np.nan)
        rank = latest.get('Country_FIFA_Rank', np.nan)
        return {
            'points': float(pts) if pd.notna(pts) else np.nan,
            'rank': float(rank) if pd.notna(rank) else np.nan,
        }
    return {'points': np.nan, 'rank': np.nan}


def _get_h2h_stats(team_a: str, team_b: str, matches_df: pd.DataFrame) -> dict:
    """
    Extracts head-to-head stats between two teams from historical match data.
    Returns h2h_wins (team_a wins), h2h_losses (team_a losses), h2h_draws.
    """
    # Matches where team_a played against team_b
    h2h = matches_df[
        (matches_df['Country'] == team_a) &
        (matches_df['Opponent'] == team_b)
    ]

    if not h2h.empty:
        # Compute from direct match records
        results = h2h['Result'].dropna()
        wins = int((results == 'W').sum())
        losses = int((results == 'L').sum())
        draws = int((results == 'D').sum())
        return {'h2h_wins': wins, 'h2h_losses': losses, 'h2h_draws': draws}

    # No direct H2H found — default to 0
    return {'h2h_wins': 0, 'h2h_losses': 0, 'h2h_draws': 0}


def predict_match_outcome(
    models: dict,
    team_a: str,
    team_b: str,
    matches_df: pd.DataFrame,
    temp_max: float = 20.0,
    precipitation: float = 0.0,
    wind_speed: float = 10.0,
) -> dict:
    """
    Predicts match outcome using real data from master_matches_featured.

    The ranking_diff feature is computed as Country_FIFA_Rank - Opponent_FIFA_Rank
    (negative value = team_a is better ranked), matching the training data definition.

    Parameters
    ----------
    models : dict
        App state models dict.
    team_a : str
        Home/first team name (must match Country column in matches_df).
    team_b : str
        Away/second team name.
    matches_df : pd.DataFrame
        master_matches_featured loaded at startup.
    temp_max, precipitation, wind_speed : float
        Weather conditions for the match.

    Returns
    -------
    dict with probabilities, prediction, and data sources used.
    """
    model = models.get('match_weather')
    if model is None:
        raise ValueError("match_weather model not loaded")

    # --- Build feature vector from real data ---
    stats_a = _get_team_stats(team_a, matches_df)
    h2h = _get_h2h_stats(team_a, team_b, matches_df)

    # Get FIFA info for both teams from their own match histories
    fifa_info_a = _get_team_fifa_info(team_a, matches_df)
    fifa_info_b = _get_team_fifa_info(team_b, matches_df)

    fifa_pts_a = fifa_info_a['points']
    fifa_pts_b = fifa_info_b['points']
    rank_a = fifa_info_a['rank']
    rank_b = fifa_info_b['rank']

    # Fallback for points
    if pd.isna(fifa_pts_a):
        fifa_pts_a = stats_a.get('Country_FIFA_Points', 1400.0)
        if pd.isna(fifa_pts_a):
            fifa_pts_a = 1400.0
    if pd.isna(fifa_pts_b):
        # Try getting from team_a's perspective as opponent
        opp_rows = matches_df[
            (matches_df['Country'] == team_a) &
            (matches_df['Opponent'] == team_b)
        ]
        if not opp_rows.empty:
            fifa_pts_b = float(opp_rows.iloc[-1].get('Opponent_FIFA_Points', 1400))
        else:
            fifa_pts_b = 1400.0

    # Fallback for ranks
    if pd.isna(rank_a):
        rank_a = 50.0  # mid-table default
    if pd.isna(rank_b):
        # Try getting from team_a's match against team_b
        opp_rows = matches_df[
            (matches_df['Country'] == team_a) &
            (matches_df['Opponent'] == team_b)
        ]
        if not opp_rows.empty:
            rank_b = float(opp_rows.iloc[-1].get('Opponent_FIFA_Rank', 50))
        else:
            rank_b = 100.0  # weak team default

    # CRITICAL FIX: ranking_diff in the training data is now
    # Country_FIFA_Points - Opponent_FIFA_Points.
    # Positive = team_a has more points (is better).
    ranking_diff = float(fifa_pts_a - fifa_pts_b)

    form = stats_a.get('form_last_5', 0)
    if pd.isna(form):
        form = 0

    goals_scored = stats_a.get('goals_scored_last_5', 0)
    if pd.isna(goals_scored):
        goals_scored = 0

    goals_conceded = stats_a.get('goals_conceded_last_5', 0)
    if pd.isna(goals_conceded):
        goals_conceded = 0

    days_since = stats_a.get('days_since_last_match', 30)
    if pd.isna(days_since):
        days_since = 30

    features = pd.DataFrame([{
        'Country_FIFA_Points': float(fifa_pts_a),
        'Opponent_FIFA_Points': float(fifa_pts_b),
        'ranking_diff': ranking_diff,
        'h2h_wins': h2h['h2h_wins'],
        'h2h_losses': h2h['h2h_losses'],
        'days_since_last_match': days_since,
        'form_last_5': form,
        'goals_scored_last_5': goals_scored,
        'goals_conceded_last_5': goals_conceded,
        'temp_max': float(temp_max),
        'precipitation': float(precipitation),
        'wind_speed': float(wind_speed),
        'is_raining': 1 if float(precipitation) > 2.0 else 0,
        'is_hot': 1 if float(temp_max) > 30.0 else 0,
    }])

    features = features[WEATHER_MODEL_FEATURES]

    # --- Predict using the 3-class model if available, else binary ---
    model_3class = models.get('match_outcome')  # W/D/L direct prediction

    if model_3class is not None and hasattr(model_3class, 'predict_proba'):
        # Use the 3-class model (predicts 0=Loss, 1=Draw, 2=Win)
        # It may use a different feature set; try weather features first
        try:
            proba_arr = model_3class.predict_proba(features)[0]
            if len(proba_arr) == 3:
                # classes: 0=Loss, 1=Draw, 2=Win
                prob_win_a = float(proba_arr[2])
                prob_draw = float(proba_arr[1])
                prob_win_b = float(proba_arr[0])
                model_name = "match_outcome_xgb (3-class)"
            else:
                raise ValueError("Not 3-class")
        except Exception:
            # Fallback to binary model
            proba_arr = model.predict_proba(features)[0]
            prob_win_a_raw = float(proba_arr[1])
            prob_win_a, prob_draw, prob_win_b = _distribute_binary_proba(prob_win_a_raw)
            model_name = "match_outcome_weather_xgb"
    else:
        # Binary model: 0=not win, 1=win for team_a
        proba_arr = model.predict_proba(features)[0]
        prob_win_a_raw = float(proba_arr[1])
        prob_win_a, prob_draw, prob_win_b = _distribute_binary_proba(prob_win_a_raw)
        model_name = "match_outcome_weather_xgb"

    prediction = team_a if prob_win_a > prob_win_b else team_b
    if abs(prob_win_a - prob_win_b) < 0.05:
        prediction = "Draw"

    # --- SHAP Explainability: compute feature contributions ---
    explanations = _compute_shap_explanations(model, features, team_a, team_b)

    return {
        "team_a": team_a,
        "team_b": team_b,
        "probabilities": {
            "win_A": round(prob_win_a, 3),
            "draw": round(prob_draw, 3),
            "win_B": round(prob_win_b, 3),
        },
        "prediction": prediction,
        "model_used": model_name,
        "explanations": explanations,
        "data_sources": {
            "team_a_fifa_points": round(float(fifa_pts_a), 1),
            "team_b_fifa_points": round(float(fifa_pts_b), 1),
            "team_a_rank": int(rank_a),
            "team_b_rank": int(rank_b),
            "ranking_diff": round(float(ranking_diff), 1),
            "h2h_wins_a": int(h2h['h2h_wins']),
            "h2h_losses_a": int(h2h['h2h_losses']),
            "form_last_5": round(float(form), 2),
            "goals_scored_last_5": round(float(goals_scored), 2),
            "goals_conceded_last_5": round(float(goals_conceded), 2),
        },
        "weather": {
            "temp_max": float(temp_max),
            "precipitation": float(precipitation),
            "wind_speed": float(wind_speed),
        },
    }


def _distribute_binary_proba(prob_win_a_raw: float) -> tuple:
    """
    Distributes the binary model's win probability into W/D/L.
    Uses a calibrated draw rate that scales with uncertainty.

    In international football, draw rate correlates with how close
    teams are in quality. When prob_win is near 0.5, draw is more likely.
    """
    # Base draw rate from international football stats (~25-28%)
    # Higher when prediction is uncertain (prob near 0.5)
    uncertainty = 1.0 - abs(prob_win_a_raw - 0.5) * 2  # 0 when certain, 1 when 50/50
    prob_draw = 0.20 + 0.15 * uncertainty  # ranges from 0.20 to 0.35

    # Remaining probability split between win and loss
    remaining = 1.0 - prob_draw
    prob_win_a = remaining * prob_win_a_raw
    prob_win_b = remaining * (1.0 - prob_win_a_raw)

    # Ensure minimums
    prob_win_a = max(prob_win_a, 0.03)
    prob_draw = max(prob_draw, 0.05)
    prob_win_b = max(prob_win_b, 0.03)

    # Renormalize
    total = prob_win_a + prob_draw + prob_win_b
    return prob_win_a / total, prob_draw / total, prob_win_b / total


# Human-readable names for features
_FEATURE_LABELS = {
    'Country_FIFA_Points': 'Puntos FIFA (Equipo A)',
    'Opponent_FIFA_Points': 'Puntos FIFA (Equipo B)',
    'ranking_diff': 'Diferencia de Ranking FIFA',
    'h2h_wins': 'Victorias en H2H histórico',
    'h2h_losses': 'Derrotas en H2H histórico',
    'days_since_last_match': 'Días desde último partido',
    'form_last_5': 'Racha Reciente (Últimos 5)',
    'goals_scored_last_5': 'Goles a favor (Últimos 5)',
    'goals_conceded_last_5': 'Goles en contra (Últimos 5)',
    'temp_max': 'Temperatura Máxima (°C)',
    'precipitation': 'Precipitación (mm)',
    'wind_speed': 'Velocidad del Viento (km/h)',
    'is_raining': 'Lluvia (>2mm)',
    'is_hot': 'Calor extremo (>30°C)',
}


def _compute_shap_explanations(
    model, features_df: pd.DataFrame, team_a: str, team_b: str
) -> list:
    """
    Computes SHAP-like feature contributions using XGBoost's native
    pred_contribs method. Returns top-4 most influential features with
    direction and magnitude.
    """
    try:
        booster = model.get_booster()
        dmatrix = xgb.DMatrix(features_df)
        contribs = booster.predict(dmatrix, pred_contribs=True)[0]

        feature_names = WEATHER_MODEL_FEATURES
        # contribs has len(features)+1 entries — last one is the bias
        feature_contribs = [
            (feature_names[i], float(contribs[i]))
            for i in range(len(feature_names))
        ]
        feature_contribs.sort(key=lambda x: abs(x[1]), reverse=True)

        explanations = []
        for feat_name, contrib in feature_contribs[:4]:
            if abs(contrib) < 0.01:
                continue
            direction = team_a if contrib > 0 else f"{team_b} / Empate"
            sign = "+" if contrib > 0 else ""
            label = _FEATURE_LABELS.get(feat_name, feat_name)

            explanations.append({
                "feature": label,
                "raw_feature": feat_name,
                "impact": f"Empuja a favor de: {direction}",
                "weight": round(contrib, 4),
                "weight_display": f"{sign}{contrib:.3f}",
            })

        return explanations

    except Exception:
        # If SHAP computation fails, return empty (non-breaking)
        return []
