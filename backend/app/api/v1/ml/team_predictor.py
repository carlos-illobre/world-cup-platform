"""
Team Predictors
================
- team_points_xgb_model.pkl  → predicts expected group stage points
- formation_xgb_model.pkl    → predicts the most likely tactical formation
- player_impact_xgb_enriched.pkl → scores a player's impact from FIFA attrs
"""

import pandas as pd
import numpy as np

# --- Team Points Model (19 features) ---
TEAM_POINTS_FEATURES = [
    'squad_total_market_value', 'squad_avg_market_value',
    'squad_total_injuries', 'squad_total_wc_goals', 'squad_avg_wc_goals',
    'squad_total_wc_assists', 'squad_total_allcomps_goals',
    'squad_total_allcomps_assists', 'squad_avg_age', 'squad_median_age',
    'squad_total_caps', 'squad_avg_caps', 'squad_injury_burden',
    'squad_depth_DF', 'squad_depth_FW', 'squad_depth_GK', 'squad_depth_MF',
    'squad_top_league_ratio', 'squad_avg_impact_score',
]

# --- Formation Model (24 features) ---
FORMATION_FEATURES = [
    'win_rate_home', 'win_rate_away', 'days_since_last_match',
    'form_2-4-3-1', 'form_3-1-4-2', 'form_3-2-4-1', 'form_3-3-2-2',
    'form_3-4-1-2', 'form_3-4-3', 'form_3-5-1-1', 'form_3-5-2',
    'form_4-1-3-2', 'form_4-1-4-1', 'form_4-2-2-2', 'form_4-2-3-1',
    'form_4-3-1-2', 'form_4-3-2-1', 'form_4-3-3', 'form_4-4-1-1',
    'form_4-4-2', 'form_4-4-2◆', 'form_4-5-1', 'form_5-3-2', 'form_5-4-1',
]

# --- Player Impact Model (40 features) ---
PLAYER_IMPACT_FEATURES = [
    'Age', 'overall', 'potential', 'value_eur', 'wage_eur',
    'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physic',
    'attacking_crossing', 'attacking_finishing', 'attacking_heading_accuracy',
    'skill_dribbling', 'skill_fk_accuracy', 'skill_ball_control',
    'movement_acceleration', 'movement_sprint_speed', 'movement_agility',
    'movement_reactions', 'movement_balance', 'power_shot_power',
    'power_jumping', 'power_stamina', 'power_strength', 'power_long_shots',
    'mentality_aggression', 'mentality_interceptions', 'mentality_positioning',
    'mentality_vision', 'mentality_composure', 'defending_marking_awareness',
    'defending_standing_tackle', 'defending_sliding_tackle',
    'goalkeeping_diving', 'goalkeeping_handling', 'goalkeeping_kicking',
    'goalkeeping_positioning', 'goalkeeping_reflexes',
]


def predict_team_group_points(
    models: dict,
    team_name: str,
    teams_df: pd.DataFrame,
) -> dict:
    """
    Predicts expected group stage points for a team using real squad stats.

    Parameters
    ----------
    models : dict
        App state models dict (must contain 'team_points').
    team_name : str
        Exact team name as in master_teams_featured.
    teams_df : pd.DataFrame
        master_teams_featured loaded at startup.

    Returns
    -------
    dict with predicted_points, team_stats, and model info.
    """
    model = models.get('team_points')
    if model is None:
        raise ValueError("team_points model not loaded")

    if teams_df is None or teams_df.empty:
        raise ValueError("teams_featured data not loaded")

    # Match team name (case-insensitive fallback)
    team_row = teams_df[teams_df['Country'] == team_name]
    if team_row.empty:
        team_row = teams_df[
            teams_df['Country'].str.lower() == team_name.lower()
        ]
    if team_row.empty:
        # Partial match
        team_row = teams_df[
            teams_df['Country'].str.lower().str.contains(team_name.lower(), na=False)
        ]
    if team_row.empty:
        raise ValueError(f"Team '{team_name}' not found in teams_featured data")

    t = team_row.iloc[0]

    # Build feature vector
    feat = {}
    for col in TEAM_POINTS_FEATURES:
        val = t.get(col, np.nan)
        feat[col] = float(val) if pd.notna(val) else np.nan

    features_df = pd.DataFrame([feat])[TEAM_POINTS_FEATURES]

    # Model predicts directly (regression or classifier)
    prediction = model.predict(features_df)[0]
    predicted_points = float(prediction)

    # Return actual stats used
    stats_used = {
        col: (round(float(feat[col]), 3) if pd.notna(feat[col]) else None)
        for col in TEAM_POINTS_FEATURES
    }

    return {
        "team": team_name,
        "predicted_group_points": round(predicted_points, 2),
        "model_used": "team_points_xgb_model",
        "squad_stats": {
            "avg_age": stats_used.get("squad_avg_age"),
            "total_injuries": stats_used.get("squad_total_injuries"),
            "injury_burden": stats_used.get("squad_injury_burden"),
            "avg_market_value_eur": stats_used.get("squad_avg_market_value"),
            "total_allcomps_goals": stats_used.get("squad_total_allcomps_goals"),
            "top_league_ratio": stats_used.get("squad_top_league_ratio"),
            "avg_impact_score": stats_used.get("squad_avg_impact_score"),
            "squad_depth": {
                "GK": stats_used.get("squad_depth_GK"),
                "DF": stats_used.get("squad_depth_DF"),
                "MF": stats_used.get("squad_depth_MF"),
                "FW": stats_used.get("squad_depth_FW"),
            },
        },
    }


def predict_team_formation(
    models: dict,
    team_name: str,
    matches_df: pd.DataFrame,
) -> dict:
    """
    Identifies the optimal tactical formation for a team by simulating
    each formation against the formation_xgb_model (which predicts match
    outcome given a formation) and returning the formation with the
    highest predicted win probability.

    The model was trained to predict: 0=Loss, 1=Draw, 2=Win
    given features: win_rate_home, win_rate_away, days_since_last_match
    + one-hot encoded formation.

    Parameters
    ----------
    models : dict
        App state models dict (must contain 'formation').
    team_name : str
        Team name.
    matches_df : pd.DataFrame
        master_matches_featured loaded at startup.

    Returns
    -------
    dict with recommended_formation, all_formations_win_proba, historical data.
    """
    model = models.get('formation')
    if model is None:
        raise ValueError("formation model not loaded")

    if matches_df is None or matches_df.empty:
        raise ValueError("matches_featured data not loaded")

    # Get team matches
    team_matches = matches_df[matches_df['Country'] == team_name]
    if team_matches.empty:
        team_matches = matches_df[
            matches_df['Country'].str.lower() == team_name.lower()
        ]

    # Compute formation usage frequency from history
    formation_counts = {}
    all_formation_keys = [f.replace('form_', '') for f in FORMATION_FEATURES if f.startswith('form_')]
    for fm in all_formation_keys:
        formation_counts[fm] = 0

    if not team_matches.empty and 'Formation' in team_matches.columns:
        counts = team_matches['Formation'].value_counts()
        for form, cnt in counts.items():
            key = str(form).strip()
            if key in formation_counts:
                formation_counts[key] = int(cnt)

    # Get win rates and days since last match from real data
    win_rate_home = 0.0
    win_rate_away = 0.0
    days_since = 30.0

    if not team_matches.empty:
        latest = team_matches.iloc[-1]
        win_rate_home = float(latest.get('win_rate_home', 0) or 0)
        win_rate_away = float(latest.get('win_rate_away', 0) or 0)
        dsm = latest.get('days_since_last_match', 30)
        days_since = float(dsm) if pd.notna(dsm) else 30.0

    # Simulate each formation and get win probability
    formation_win_proba = {}
    for fm in all_formation_keys:
        feat = {
            'win_rate_home': win_rate_home,
            'win_rate_away': win_rate_away,
            'days_since_last_match': days_since,
        }
        for f2 in all_formation_keys:
            feat[f'form_{f2}'] = 1 if f2 == fm else 0

        features_df = pd.DataFrame([feat])[FORMATION_FEATURES]

        if hasattr(model, 'predict_proba'):
            proba_arr = model.predict_proba(features_df)[0]
            # classes: 0=Loss, 1=Draw, 2=Win
            win_prob = float(proba_arr[2]) if len(proba_arr) > 2 else float(proba_arr[-1])
        else:
            pred = int(model.predict(features_df)[0])
            win_prob = 1.0 if pred == 2 else (0.5 if pred == 1 else 0.0)

        formation_win_proba[fm] = round(win_prob, 4)

    # Recommended formation = highest win probability among formations the team has used
    used_formations = {k: v for k, v in formation_win_proba.items() if formation_counts.get(k, 0) > 0}
    if used_formations:
        recommended = max(used_formations, key=lambda k: used_formations[k])
    else:
        recommended = max(formation_win_proba, key=lambda k: formation_win_proba[k])

    # Sort formations by win probability
    sorted_formations = dict(
        sorted(formation_win_proba.items(), key=lambda x: x[1], reverse=True)
    )

    return {
        "team": team_name,
        "recommended_formation": recommended,
        "formation_win_probabilities": sorted_formations,
        "historical_formations": {k: v for k, v in formation_counts.items() if v > 0},
        "model_used": "formation_xgb_model",
        "note": "Win probability for each formation given team's historical win rates",
    }


def predict_player_impact(models: dict, player_row: dict) -> dict:
    """
    Predicts a player's impact score using the enriched XGBoost model
    with real FIFA attribute data.

    Parameters
    ----------
    models : dict
        App state models dict (must contain 'player_impact').
    player_row : dict
        One row from master_players_enriched.

    Returns
    -------
    dict with predicted_impact, fifa_attributes_used, model info.
    """
    model = models.get('player_impact')
    if model is None:
        # Fall back to pre-computed impact_score_raw
        raw = player_row.get('impact_score_raw', None)
        return {
            "predicted_impact": float(raw) if raw is not None and pd.notna(raw) else None,
            "model_used": "precomputed_impact_score_raw",
        }

    # Build feature vector
    feat = {}
    for col in PLAYER_IMPACT_FEATURES:
        val = player_row.get(col, np.nan)
        if isinstance(val, (int, float)) and not np.isnan(val):
            feat[col] = float(val)
        else:
            feat[col] = np.nan

    features_df = pd.DataFrame([feat])[PLAYER_IMPACT_FEATURES]

    # Predict
    impact = float(model.predict(features_df)[0])

    attrs_used = {}
    for k in ['overall', 'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physic']:
        v = feat.get(k, None)
        attrs_used[k] = round(v, 1) if v is not None and not np.isnan(v) else None

    return {
        "predicted_impact": round(impact, 4),
        "model_used": "player_impact_xgb_enriched",
        "fifa_attributes_used": attrs_used,
    }
