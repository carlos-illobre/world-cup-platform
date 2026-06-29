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

# Feature order the weather model expects (enhanced v2: 19 features)
WEATHER_MODEL_FEATURES = [
    'Country_FIFA_Points', 'Opponent_FIFA_Points', 'ranking_diff',
    'h2h_wins', 'h2h_losses', 'days_since_last_match',
    'form_last_5', 'goals_scored_last_5', 'goals_conceded_last_5',
    'temp_max', 'precipitation', 'wind_speed', 'is_raining', 'is_hot',
    # New squad features (v2)
    'impact_diff', 'market_value_ratio',
    'country_squad_avg_impact_score', 'country_squad_top_league_ratio',
    'win_rate_neutral',
]

# Fallback: original 14-feature list for backwards compatibility
WEATHER_MODEL_FEATURES_V1 = [
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
        'form_last_10': latest.get('form_last_10', 0),
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


def _get_h2h_stats(team_a: str, team_b: str, matches_df: pd.DataFrame, historical_wc_df: pd.DataFrame = None) -> dict:
    """
    Extracts head-to-head stats between two teams from historical match data.
    First checks master_matches_featured, then falls back to historical_world_cups.csv
    which has all World Cup matches since 1930.
    Returns h2h_wins (team_a wins), h2h_losses (team_a losses), h2h_draws.
    """
    # 1. Try from master_matches_featured (recent matches with Result column)
    h2h = matches_df[
        (matches_df['Country'] == team_a) &
        (matches_df['Opponent'] == team_b)
    ]

    if not h2h.empty:
        results = h2h['Result'].dropna()
        wins = int((results == 'W').sum())
        losses = int((results == 'L').sum())
        draws = int((results == 'D').sum())
        if wins + losses + draws > 0:
            return {'h2h_wins': wins, 'h2h_losses': losses, 'h2h_draws': draws}

    # 2. Also check reverse direction in matches_featured
    h2h_rev = matches_df[
        (matches_df['Country'] == team_b) &
        (matches_df['Opponent'] == team_a)
    ]
    if not h2h_rev.empty:
        results = h2h_rev['Result'].dropna()
        # Reverse: team_b's wins are team_a's losses
        wins = int((results == 'L').sum())
        losses = int((results == 'W').sum())
        draws = int((results == 'D').sum())
        if wins + losses + draws > 0:
            return {'h2h_wins': wins, 'h2h_losses': losses, 'h2h_draws': draws}

    # 3. Fall back to historical World Cup data (all WC matches since 1930)
    if historical_wc_df is not None and not historical_wc_df.empty:
        # Columns: Year, Stage, Country1, Country2, Score1, Score2, Venue, City
        mask_a = (
            (historical_wc_df['Country1'] == team_a) &
            (historical_wc_df['Country2'] == team_b)
        )
        mask_b = (
            (historical_wc_df['Country1'] == team_b) &
            (historical_wc_df['Country2'] == team_a)
        )
        h2h_hist = historical_wc_df[mask_a | mask_b]

        if not h2h_hist.empty:
            wins = 0
            losses = 0
            draws = 0
            for _, row in h2h_hist.iterrows():
                s1 = int(row['Score1'])
                s2 = int(row['Score2'])
                # Determine if team_a is Country1 or Country2
                if row['Country1'] == team_a:
                    if s1 > s2:
                        wins += 1
                    elif s1 < s2:
                        losses += 1
                    else:
                        # Draw in score (could be penalty shootout win)
                        # For WC finals with draws, the team listed first in a final
                        # that drew typically won on penalties — treat as win for them
                        draws += 1
                else:  # team_a is Country2
                    if s2 > s1:
                        wins += 1
                    elif s2 < s1:
                        losses += 1
                    else:
                        draws += 1
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
    historical_wc_df: pd.DataFrame = None,
    teams_featured_df: pd.DataFrame = None,
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
    h2h = _get_h2h_stats(team_a, team_b, matches_df, historical_wc_df)

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

    # Build full feature dict (superset of all features needed by both models)
    all_features = {
        'Country_FIFA_Points': float(fifa_pts_a),
        'Opponent_FIFA_Points': float(fifa_pts_b),
        'Country_FIFA_Rank': float(rank_a),
        'Opponent_FIFA_Rank': float(rank_b),
        'ranking_diff': ranking_diff,
        'h2h_wins': h2h['h2h_wins'],
        'h2h_losses': h2h['h2h_losses'],
        'h2h_draws': h2h.get('h2h_draws', 0),
        'h2h_matches': h2h['h2h_wins'] + h2h['h2h_losses'] + h2h.get('h2h_draws', 0),
        'h2h_goals_for': 0,  # Not available at runtime without full lookup
        'h2h_goals_against': 0,
        'days_since_last_match': days_since,
        'form_last_5': form,
        'form_last_10': stats_a.get('form_last_10', form * 2),  # Use real if available
        'goals_scored_last_5': goals_scored,
        'goals_conceded_last_5': goals_conceded,
        'temp_max': float(temp_max),
        'precipitation': float(precipitation),
        'wind_speed': float(wind_speed),
        'is_raining': 1 if float(precipitation) > 2.0 else 0,
        'is_hot': 1 if float(temp_max) > 30.0 else 0,
    }

    # --- Squad quality features (v2) ---
    squad_impact_a = 0.0
    squad_impact_b = 0.0
    squad_top_league_a = 0.0
    squad_top_league_b = 0.0
    squad_market_a = 1.0
    squad_market_b = 1.0
    win_rate_neutral_val = stats_a.get('win_rate_neutral', 0.0)
    if pd.isna(win_rate_neutral_val):
        win_rate_neutral_val = 0.0

    if teams_featured_df is not None and not teams_featured_df.empty:
        def _get_squad_feat(team_name, col, default=0.0):
            row = teams_featured_df[teams_featured_df['Country'] == team_name]
            if row.empty:
                row = teams_featured_df[teams_featured_df['Country'].str.lower() == team_name.lower()]
            if not row.empty:
                val = row.iloc[0].get(col, default)
                return float(val) if pd.notna(val) else default
            return default

        squad_impact_a = _get_squad_feat(team_a, 'squad_avg_impact_score', 0.0)
        squad_impact_b = _get_squad_feat(team_b, 'squad_avg_impact_score', 0.0)
        squad_top_league_a = _get_squad_feat(team_a, 'squad_top_league_ratio', 0.0)
        squad_top_league_b = _get_squad_feat(team_b, 'squad_top_league_ratio', 0.0)
        squad_market_a = _get_squad_feat(team_a, 'squad_avg_market_value', 1.0)
        squad_market_b = _get_squad_feat(team_b, 'squad_avg_market_value', 1.0)

    impact_diff = squad_impact_a - squad_impact_b
    market_total = squad_market_a + squad_market_b
    market_value_ratio = squad_market_a / market_total if market_total > 0 else 0.5

    all_features['country_squad_avg_impact_score'] = squad_impact_a
    all_features['opponent_squad_avg_impact_score'] = squad_impact_b
    all_features['country_squad_top_league_ratio'] = squad_top_league_a
    all_features['opponent_squad_top_league_ratio'] = squad_top_league_b
    all_features['impact_diff'] = impact_diff
    all_features['market_value_ratio'] = market_value_ratio
    all_features['win_rate_neutral'] = float(win_rate_neutral_val)
    all_features['win_rate_home'] = float(stats_a.get('win_rate_home', 0) or 0)
    all_features['win_rate_away'] = float(stats_a.get('win_rate_away', 0) or 0)

    # --- Determine which features the weather model expects ---
    # Try to detect from the booster's feature names (handles v1 and v2)
    try:
        booster = model.get_booster()
        model_feature_names = booster.feature_names
        if model_feature_names:
            weather_features_to_use = model_feature_names
        else:
            weather_features_to_use = WEATHER_MODEL_FEATURES
    except Exception:
        weather_features_to_use = WEATHER_MODEL_FEATURES

    # Fall back to v1 if the model doesn't have the new features
    features = pd.DataFrame([{k: all_features.get(k, 0) for k in weather_features_to_use}])

    # --- Predict: always use weather model (includes climate) as primary ---
    # The weather model is binary (win/not-win) but accounts for climate conditions.
    # The 3-class model doesn't use weather features so it won't react to slider changes.
    # Strategy: Use weather model probability, then use 3-class to refine D/L split.
    
    proba_arr = model.predict_proba(features)[0]
    prob_win_a_raw = float(proba_arr[1])
    
    # Try to refine Draw vs Loss split using 3-class model
    model_3class = models.get('match_outcome')
    if model_3class is not None and hasattr(model_3class, 'predict_proba'):
        try:
            booster_3c = model_3class.get_booster()
            expected_features = booster_3c.feature_names
            features_3class = pd.DataFrame([{f: all_features.get(f, 0) for f in expected_features}])
            proba_3c = model_3class.predict_proba(features_3class)[0]
            # proba_3c: [P(Loss), P(Draw), P(Win)]
            
            # Blend: Use weather model's win probability (climate-aware),
            # but use 3-class model's Draw/Loss ratio for the remaining probability
            prob_win_a = prob_win_a_raw
            remaining = 1.0 - prob_win_a
            
            # 3-class model's D/(D+L) ratio
            p_draw_3c = float(proba_3c[1])
            p_loss_3c = float(proba_3c[0])
            dl_total = p_draw_3c + p_loss_3c
            if dl_total > 0.01:
                draw_ratio = p_draw_3c / dl_total
            else:
                draw_ratio = 0.5
            
            prob_draw = remaining * draw_ratio
            prob_win_b = remaining * (1.0 - draw_ratio)
            model_name = "blend (weather + 3-class)"
        except Exception:
            prob_win_a, prob_draw, prob_win_b = _distribute_binary_proba(prob_win_a_raw)
            model_name = "match_outcome_weather_xgb"
    else:
        prob_win_a, prob_draw, prob_win_b = _distribute_binary_proba(prob_win_a_raw)
        model_name = "match_outcome_weather_xgb"
    
    # Ensure minimums and normalize
    prob_win_a = max(prob_win_a, 0.03)
    prob_draw = max(prob_draw, 0.05)
    prob_win_b = max(prob_win_b, 0.03)
    total = prob_win_a + prob_draw + prob_win_b
    prob_win_a /= total
    prob_draw /= total
    prob_win_b /= total

    prediction = team_a if prob_win_a > prob_win_b else team_b
    if abs(prob_win_a - prob_win_b) < 0.05:
        prediction = "Draw"

    # --- SHAP Explainability: compute feature contributions ---
    explanations = _compute_shap_explanations(model, features, team_a, team_b, weather_features_to_use)

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
    'Country_FIFA_Rank': 'Ranking FIFA (Equipo A)',
    'Opponent_FIFA_Rank': 'Ranking FIFA (Equipo B)',
    'ranking_diff': 'Diferencia de Ranking FIFA',
    'h2h_wins': 'Victorias en H2H histórico',
    'h2h_losses': 'Derrotas en H2H histórico',
    'days_since_last_match': 'Días desde último partido',
    'form_last_5': 'Racha Reciente (Últimos 5)',
    'form_last_10': 'Racha Reciente (Últimos 10)',
    'goals_scored_last_5': 'Goles a favor (Últimos 5)',
    'goals_conceded_last_5': 'Goles en contra (Últimos 5)',
    'temp_max': 'Temperatura Máxima (°C)',
    'precipitation': 'Precipitación (mm)',
    'wind_speed': 'Velocidad del Viento (km/h)',
    'is_raining': 'Lluvia (>2mm)',
    'is_hot': 'Calor extremo (>30°C)',
    # New v2 features
    'impact_diff': 'Diferencial de Calidad de Plantel',
    'market_value_ratio': 'Ratio de Valor de Mercado',
    'country_squad_avg_impact_score': 'Impact Score Plantel (Eq. A)',
    'opponent_squad_avg_impact_score': 'Impact Score Plantel (Eq. B)',
    'country_squad_top_league_ratio': 'Ratio Top-League (Eq. A)',
    'opponent_squad_top_league_ratio': 'Ratio Top-League (Eq. B)',
    'win_rate_neutral': 'Win Rate en Sede Neutral',
    'win_rate_home': 'Win Rate Local',
    'win_rate_away': 'Win Rate Visitante',
}


def _compute_shap_explanations(
    model, features_df: pd.DataFrame, team_a: str, team_b: str,
    feature_names: list = None,
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

        if feature_names is None:
            feature_names = WEATHER_MODEL_FEATURES
        # contribs has len(features)+1 entries — last one is the bias
        feature_contribs = [
            (feature_names[i], float(contribs[i]))
            for i in range(min(len(feature_names), len(contribs) - 1))
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
