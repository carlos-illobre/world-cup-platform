"""
Tournament Simulator
=====================
Simulates the entire World Cup 2026 tournament by:
1. Predicting group stage points for all 48 teams (team_points_xgb_model)
2. Determining which teams advance from each group (top 2 + best 3rds)
3. Resolving knockout bracket matches using match_outcome_weather_xgb
4. Returning the complete bracket prediction from Round of 32 to Final
"""

from fastapi import APIRouter, Request, Response, HTTPException
import pandas as pd
import numpy as np
import logging
from app.api.v1.utils import get_df
from app.api.v1.ml.match_predictor import predict_match_outcome
from app.api.v1.ml.team_predictor import predict_team_group_points

router = APIRouter()
logger = logging.getLogger(__name__)


def _resolve_team_name(token: str, group_winners: dict, match_results: dict) -> str:
    """
    Resolves a bracket token like '1A', '2B', 'W73', '3ABCDF' to an actual team name.
    
    Tokens:
    - '1A' → 1st place in Group A
    - '2B' → 2nd place in Group B
    - '3ABCDF' → one of the best 3rd-place teams from groups A,B,C,D,F
    - 'W73' → winner of match 73
    - 'RU101' → runner-up (loser) of match 101
    """
    token = token.strip()
    
    # Winner of match N
    if token.startswith("W"):
        match_num = token[1:]
        if match_num in match_results:
            return match_results[match_num].get("winner", f"Winner M{match_num}")
        return f"Winner M{match_num}"
    
    # Runner-up (loser) of match N
    if token.startswith("RU"):
        match_num = token[2:]
        if match_num in match_results:
            return match_results[match_num].get("loser", f"Loser M{match_num}")
        return f"Loser M{match_num}"
    
    # 1st or 2nd of group
    if len(token) == 2 and token[0] in ("1", "2"):
        position = int(token[0])  # 1 or 2
        group = token[1]
        key = f"Group {group}"
        if key in group_winners:
            teams = group_winners[key]
            if position <= len(teams):
                return teams[position - 1]
        return f"{position}° Group {group}"
    
    # Best 3rd place from specific groups (e.g., '3ABCDF')
    if token.startswith("3") and len(token) > 2:
        # The actual 3rd-place team assigned to this slot depends on
        # which specific groups the best 3rds come from.
        # For simplicity, we pick the best available 3rd from the listed groups.
        groups = list(token[1:])
        key = f"best_3rd_{''.join(groups)}"
        if key in group_winners:
            return group_winners[key]
        # Fallback
        return f"3° ({token[1:]})"
    
    return token


@router.get("/simulate")
def simulate_tournament(request: Request, response: Response):
    """
    Simulates the entire World Cup 2026 tournament.
    Returns group stage results + full knockout bracket with predictions.
    """
    response.headers["Cache-Control"] = "no-cache"
    
    data = request.app.state.data
    models = request.app.state.models
    
    groups_df = get_df(request, 'wc_groups')
    matches_df = get_df(request, 'world_cup_matches')
    teams_featured_df = get_df(request, 'teams_featured')
    matches_featured_df = get_df(request, 'matches_featured')
    
    if groups_df.empty or matches_df.empty:
        raise HTTPException(status_code=503, detail="Tournament data not loaded")
    
    # ═══════════════════════════════════════════════════════════
    # PHASE 1: Simulate Group Stage
    # ═══════════════════════════════════════════════════════════
    logger.info("Simulating group stage...")
    
    group_results = {}  # {group_name: [{team, predicted_points}, ...]}
    all_thirds = []  # All 3rd-place teams for best-3rd calculation
    
    groups = {}
    for _, row in groups_df.iterrows():
        grp = str(row.get('group', ''))
        if grp not in groups:
            groups[grp] = []
        groups[grp].append(str(row.get('team', '')))
    
    for group_name, teams in groups.items():
        team_predictions = []
        for team_raw in teams:
            # Clean team name (remove ISO prefix like "ar Argentina")
            team_name = team_raw.strip()
            if len(team_name) > 3 and team_name[:2].islower() and team_name[2] == ' ':
                team_name = team_name[3:]
            elif len(team_name) > 4 and team_name[:3].islower() and team_name[3] == ' ':
                team_name = team_name[4:]
            
            # Predict points
            predicted_pts = 3.0  # default
            try:
                result = predict_team_group_points(models, team_name, teams_featured_df)
                predicted_pts = result.get("predicted_group_points", 3.0)
            except Exception:
                pass
            
            team_predictions.append({
                "team": team_name,
                "team_raw": team_raw,
                "predicted_points": round(predicted_pts, 2),
            })
        
        # Sort by predicted points descending
        team_predictions.sort(key=lambda x: x["predicted_points"], reverse=True)
        group_results[group_name] = team_predictions
        
        # Track 3rd place for best-third calculation
        if len(team_predictions) >= 3:
            third = team_predictions[2]
            all_thirds.append({**third, "group": group_name})
    
    # Determine group winners dict for bracket resolution
    group_winners = {}
    for group_name, teams in group_results.items():
        group_winners[group_name] = [t["team"] for t in teams]
    
    # Best 3rd-place teams (top 8 thirds advance in a 48-team WC)
    all_thirds.sort(key=lambda x: x["predicted_points"], reverse=True)
    best_thirds = all_thirds[:8]  # Top 8 third-place teams advance
    
    # Assign best thirds to bracket slots based on which groups they come from
    best_third_groups = set(t["group"] for t in best_thirds)
    # Create lookup for all possible 3rd-place bracket combinations
    for _, row in matches_df.iterrows():
        label = str(row.get('match_label', ''))
        parts = label.split(' vs ')
        for part in parts:
            part = part.strip()
            if part.startswith("3") and len(part) > 2:
                possible_groups = list(part[1:])
                # Find the best 3rd from these specific groups
                for third in best_thirds:
                    grp_letter = third["group"].replace("Group ", "")
                    if grp_letter in possible_groups:
                        key = f"best_3rd_{part[1:]}"
                        if key not in group_winners:
                            group_winners[key] = third["team"]
                        break
    
    # ═══════════════════════════════════════════════════════════
    # PHASE 2: Simulate Knockout Stage
    # ═══════════════════════════════════════════════════════════
    logger.info("Simulating knockout stage...")
    
    knockout_matches = matches_df[
        ~matches_df['match_label'].str.contains('Group', na=False)
    ].sort_values('match_number')
    
    match_results = {}  # {match_number_str: {winner, loser, proba, ...}}
    knockout_rounds = {
        "round_of_32": [],
        "round_of_16": [],
        "quarter_finals": [],
        "semi_finals": [],
        "third_place": [],
        "final": [],
    }
    
    for _, match in knockout_matches.iterrows():
        match_num = str(int(match['match_number']))
        label = str(match.get('match_label', ''))
        parts = label.split(' vs ')
        
        if len(parts) != 2:
            continue
        
        team_a_token = parts[0].strip()
        team_b_token = parts[1].strip()
        
        team_a = _resolve_team_name(team_a_token, group_winners, match_results)
        team_b = _resolve_team_name(team_b_token, group_winners, match_results)
        
        # Predict match outcome
        prob_a = 0.5
        prob_b = 0.5
        winner = team_a
        loser = team_b
        
        try:
            result = predict_match_outcome(
                models=models,
                team_a=team_a,
                team_b=team_b,
                matches_df=matches_featured_df,
                temp_max=25.0,
                precipitation=0.0,
                wind_speed=10.0,
            )
            prob_a = result["probabilities"]["win_A"]
            prob_b = result["probabilities"]["win_B"]
            
            if prob_a >= prob_b:
                winner = team_a
                loser = team_b
            else:
                winner = team_b
                loser = team_a
        except Exception:
            # If prediction fails, use team that appears first as winner
            pass
        
        match_result = {
            "match_number": int(match_num),
            "label": label,
            "team_a": team_a,
            "team_b": team_b,
            "prob_a": round(prob_a, 3),
            "prob_b": round(prob_b, 3),
            "winner": winner,
            "loser": loser,
            "kickoff_at": str(match.get('kickoff_at', '')),
        }
        
        match_results[match_num] = match_result
        
        # Classify into rounds by stage_id or match number ranges
        stage_id = int(match.get('stage_id', 0))
        mn = int(match_num)
        
        if stage_id == 2 or (73 <= mn <= 88):
            knockout_rounds["round_of_32"].append(match_result)
        elif stage_id == 3 or (89 <= mn <= 96):
            knockout_rounds["round_of_16"].append(match_result)
        elif stage_id == 4 or (97 <= mn <= 100):
            knockout_rounds["quarter_finals"].append(match_result)
        elif stage_id == 5 or (mn in [101, 102]):
            knockout_rounds["semi_finals"].append(match_result)
        elif stage_id == 6 or mn == 103:
            knockout_rounds["third_place"].append(match_result)
        elif stage_id == 7 or mn == 104:
            knockout_rounds["final"].append(match_result)
        else:
            knockout_rounds["round_of_32"].append(match_result)
    
    # ═══════════════════════════════════════════════════════════
    # PHASE 3: Determine champion
    # ═══════════════════════════════════════════════════════════
    champion = None
    if knockout_rounds["final"]:
        champion = knockout_rounds["final"][-1]["winner"]
    
    return {
        "group_stage": group_results,
        "best_third_place": [
            {"team": t["team"], "group": t["group"], "points": t["predicted_points"]}
            for t in best_thirds
        ],
        "knockout": knockout_rounds,
        "champion": champion,
        "model_info": {
            "group_model": "team_points_xgb_model (XGBoost Regression, RMSE=0.83)",
            "match_model": "match_outcome_weather_xgb (XGBoost Binary Classifier)",
            "note": "Los partidos de knockout se predicen recursivamente: el ganador de cada ronda avanza al siguiente cruce.",
        },
    }
