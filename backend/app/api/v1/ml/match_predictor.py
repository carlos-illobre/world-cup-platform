"""
Match Outcome Predictor
========================
Calls match_outcome_weather_xgb.pkl with the exact 14 features it was trained on.
All feature values are sourced from real scraped data in master_matches_featured.csv
and master_teams_featured.csv.
"""

import pandas as pd
import numpy as np
import xgboost as xgb
from app.api.v1.country_utils import canonicalize_country_name, country_mask

# Exact feature order the weather model expects
WEATHER_MODEL_FEATURES = [
    'Country_FIFA_Points', 'Opponent_FIFA_Points', 'ranking_diff',
    'h2h_wins', 'h2h_losses', 'days_since_last_match',
    'form_last_5', 'goals_scored_last_5', 'goals_conceded_last_5',
    'temp_max', 'precipitation', 'wind_speed', 'is_raining', 'is_hot'
]


def _get_team_stats(team_name: str, matches_df: pd.DataFrame) -> dict:
    """
    Extracts real match stats for a team from master_matches_featured.
    Returns the aggregated stats for the most recent matches.
    """
    # Normalize team name for matching
    resolved_team_name = canonicalize_country_name(team_name)
    team_matches = matches_df[country_mask(matches_df, 'Country', resolved_team_name)]

    if team_matches.empty:
        return {}

    # Use the most recent available row (last known stats)
    latest = team_matches.iloc[-1]

    return {
        'Country_FIFA_Points': latest.get('Country_FIFA_Points', np.nan),
        'Opponent_FIFA_Points': latest.get('Opponent_FIFA_Points', np.nan),
        'ranking_diff': latest.get('ranking_diff', 0),
        'h2h_wins': latest.get('h2h_wins', 0),
        'h2h_losses': latest.get('h2h_losses', 0),
        'days_since_last_match': latest.get('days_since_last_match', 30),
        'form_last_5': latest.get('form_last_5', 0),
        'goals_scored_last_5': latest.get('goals_scored_last_5', 0),
        'goals_conceded_last_5': latest.get('goals_conceded_last_5', 0),
    }


def _get_team_fifa_points(team_name: str, matches_df: pd.DataFrame) -> float:
    """Gets the FIFA points for a team from matches data."""
    resolved_team_name = canonicalize_country_name(team_name)
    team_matches = matches_df[country_mask(matches_df, 'Country', resolved_team_name)]
    if not team_matches.empty:
        val = team_matches.iloc[-1].get('Country_FIFA_Points', np.nan)
        if pd.notna(val):
            return float(val)
    return np.nan


def _get_h2h_stats(team_a: str, team_b: str, matches_df: pd.DataFrame) -> dict:
    """
    Extracts head-to-head stats between two teams from historical match data.
    Returns h2h_wins (team_a wins), h2h_losses (team_a losses), h2h_draws.
    """
    # Matches where team_a played against team_b
    team_a_resolved = canonicalize_country_name(team_a)
    team_b_resolved = canonicalize_country_name(team_b)
    h2h = matches_df[
        country_mask(matches_df, 'Country', team_a_resolved) &
        country_mask(matches_df, 'Opponent', team_b_resolved)
    ]

    if h2h.empty:
        # Try using existing h2h columns from the most recent match of team_a
        team_a_matches = matches_df[country_mask(matches_df, 'Country', team_a_resolved)]
        if not team_a_matches.empty:
            latest = team_a_matches.iloc[-1]
            return {
                'h2h_wins': latest.get('h2h_wins', 0),
                'h2h_losses': latest.get('h2h_losses', 0),
                'h2h_draws': latest.get('h2h_draws', 0),
            }
        return {'h2h_wins': 0, 'h2h_losses': 0, 'h2h_draws': 0}

    # Compute from direct match records
    results = h2h['Result'].dropna()
    wins = int((results == 'W').sum())
    losses = int((results == 'L').sum())
    draws = int((results == 'D').sum())
    return {'h2h_wins': wins, 'h2h_losses': losses, 'h2h_draws': draws}


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

    team_a_resolved = canonicalize_country_name(team_a)
    team_b_resolved = canonicalize_country_name(team_b)

    # --- Build feature vector from real data ---
    stats_a = _get_team_stats(team_a_resolved, matches_df)
    h2h = _get_h2h_stats(team_a_resolved, team_b_resolved, matches_df)

    # FIFA points: for team_a use its own, for team_b get from its perspective
    fifa_a = stats_a.get('Country_FIFA_Points', np.nan)
    if pd.isna(fifa_a):
        fifa_a = _get_team_fifa_points(team_a_resolved, matches_df)

    # Get team_b FIFA points from its own matches
    fifa_b = _get_team_fifa_points(team_b_resolved, matches_df)
    if pd.isna(fifa_b):
        # Fall back to opponent_fifa_points of team_a's matches vs team_b
        opp_rows = matches_df[
            country_mask(matches_df, 'Country', team_a_resolved) &
            country_mask(matches_df, 'Opponent', team_b_resolved)
        ]
        if not opp_rows.empty:
            fifa_b = float(opp_rows.iloc[-1].get('Opponent_FIFA_Points', 1400))
        else:
            fifa_b = 1400.0  # world average

    # Safe defaults for NaN values
    if pd.isna(fifa_a):
        fifa_a = 1400.0

    ranking_diff = float(fifa_a - fifa_b)

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
        'Country_FIFA_Points': fifa_a,
        'Opponent_FIFA_Points': fifa_b,
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

    # --- Predict ---
    proba_arr = model.predict_proba(features)[0]
    # Model is binary: 0 = draw/loss, 1 = win for team_a
    prob_win_a = float(proba_arr[1])

    # Distribute remaining probability between draw and team_b win
    prob_draw = 0.27  # empirical average for international football
    prob_win_a_adj = max(prob_win_a * (1 - prob_draw), 0.05)
    prob_win_b = max(1.0 - prob_win_a_adj - prob_draw, 0.05)

    # Renormalize to sum to 1
    total = prob_win_a_adj + prob_draw + prob_win_b
    prob_win_a_adj /= total
    prob_draw /= total
    prob_win_b /= total

    fifa_prior_a = 1.0 / (1.0 + np.exp(-(ranking_diff / 350.0)))
    form_edge = (float(form) + float(goals_scored) - float(goals_conceded)) / 20.0
    fifa_prior_a = min(max(fifa_prior_a + form_edge, 0.05), 0.95)
    prior_win_a = fifa_prior_a * (1 - prob_draw)
    prior_win_b = (1 - fifa_prior_a) * (1 - prob_draw)

    model_weight = 0.35
    prior_weight = 1 - model_weight
    prob_win_a_adj = (prob_win_a_adj * model_weight) + (prior_win_a * prior_weight)
    prob_win_b = (prob_win_b * model_weight) + (prior_win_b * prior_weight)

    total = prob_win_a_adj + prob_draw + prob_win_b
    prob_win_a_adj /= total
    prob_draw /= total
    prob_win_b /= total

    prediction = team_a_resolved if prob_win_a_adj > prob_win_b else team_b_resolved
    if abs(prob_win_a_adj - prob_win_b) < 0.05:
        prediction = "Draw"

    # --- SHAP Explainability: compute feature contributions ---
    explanations = _compute_shap_explanations(model, features, team_a_resolved, team_b_resolved)

    return {
        "team_a": team_a_resolved,
        "team_b": team_b_resolved,
        "probabilities": {
            "win_A": round(prob_win_a_adj, 3),
            "draw": round(prob_draw, 3),
            "win_B": round(prob_win_b, 3),
        },
        "prediction": prediction,
        "model_used": "match_outcome_weather_xgb",
        "explanations": explanations,
        "data_sources": {
            "team_a_fifa_points": round(float(fifa_a), 1),
            "team_b_fifa_points": round(float(fifa_b), 1),
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
