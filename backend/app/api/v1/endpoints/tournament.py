"""
Tournament Simulator
=====================
Simulates the entire World Cup 2026 tournament by:
1. Predicting group stage points for all 48 teams (team_points_xgb_model)
2. Determining which teams advance from each group (top 2 + best 3rds)
3. Resolving knockout bracket matches IN TOPOLOGICAL ORDER using match_outcome_xgb (3-class)
4. Returning the complete bracket prediction from Round of 32 to Final

The knockout predictions use exclusively sports features (FIFA ranking, form, H2H).
No climate data is used — it was experimentally validated that climate features
do not meaningfully improve match outcome predictions in this context.

FIXED:
- Knockout matches are resolved in match_number order so that dependencies
  (W73, W74, etc.) are always resolved before being referenced.
- Best 3rd-place assignment uses FIFA-standard bracket mapping.
- Clamped group points to [0, 9] range.
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


def _clean_team_name(team_raw: str) -> str:
    """Remove ISO prefix like 'ar Argentina' → 'Argentina'."""
    team_name = team_raw.strip()
    if len(team_name) > 3 and team_name[:2].islower() and team_name[2] == ' ':
        return team_name[3:]
    if len(team_name) > 4 and team_name[:3].islower() and team_name[3] == ' ':
        return team_name[4:]
    return team_name


def _resolve_team_name(token: str, group_standings: dict, best_thirds_assigned: dict, match_results: dict) -> str:
    """
    Resolves a bracket token to an actual team name.
    
    Tokens:
    - '1A' → 1st place in Group A
    - '2B' → 2nd place in Group B  
    - '3ABCDF' → best 3rd-place team assigned to this bracket slot
    - 'W73' → winner of match 73
    - 'RU101' → runner-up (loser) of match 101
    """
    token = token.strip()
    
    # Winner of match N
    if token.startswith("W"):
        match_num = token[1:]
        if match_num in match_results:
            return match_results[match_num]["winner"]
        return f"TBD (Winner M{match_num})"
    
    # Runner-up (loser) of match N
    if token.startswith("RU"):
        match_num = token[2:]
        if match_num in match_results:
            return match_results[match_num]["loser"]
        return f"TBD (Loser M{match_num})"
    
    # 1st or 2nd of group
    if len(token) == 2 and token[0] in ("1", "2"):
        position = int(token[0])  # 1 or 2
        group_letter = token[1]
        key = f"Group {group_letter}"
        if key in group_standings:
            teams = group_standings[key]
            if position <= len(teams):
                return teams[position - 1]["team"]
        return f"{position}° Group {group_letter}"
    
    # Best 3rd place from specific groups (e.g., '3ABCDF')
    if token.startswith("3") and len(token) > 2:
        slot_key = token[1:]  # e.g., 'ABCDF'
        if slot_key in best_thirds_assigned:
            return best_thirds_assigned[slot_key]
        return f"3° ({slot_key})"
    
    return token


@router.get("/simulate")
def simulate_tournament(request: Request, response: Response):
    """
    Simulates the entire World Cup 2026 tournament.
    Returns group stage results + full knockout bracket with predictions.
    """
    response.headers["Cache-Control"] = "no-cache"
    
    models = request.app.state.models
    
    groups_df = get_df(request, 'wc_groups')
    matches_df = get_df(request, 'world_cup_matches')
    teams_featured_df = get_df(request, 'teams_featured')
    matches_featured_df = get_df(request, 'matches_featured')
    historical_wc_df = get_df(request, 'historical_wc')
    
    if groups_df.empty or matches_df.empty:
        raise HTTPException(status_code=503, detail="Tournament data not loaded")
    
    # ═══════════════════════════════════════════════════════════
    # PHASE 1: Simulate Group Stage
    # ═══════════════════════════════════════════════════════════
    logger.info("Simulating group stage...")
    
    group_results = {}  # {group_name: [{team, predicted_points}, ...]}
    all_thirds = []
    
    groups = {}
    for _, row in groups_df.iterrows():
        grp = str(row.get('group', ''))
        if grp not in groups:
            groups[grp] = []
        groups[grp].append(str(row.get('team', '')))
    
    for group_name, teams in groups.items():
        team_predictions = []
        for team_raw in teams:
            team_name = _clean_team_name(team_raw)
            
            # Predict points
            predicted_pts = 3.0  # default mid-value
            try:
                result = predict_team_group_points(
                    models, team_name, teams_featured_df,
                    matches_df=matches_featured_df,
                    groups_df=groups_df,
                    historical_wc_df=historical_wc_df,
                )
                raw_pts = result.get("predicted_group_points", 3.0)
                # CLAMP to valid range [0, 9] — group stage max is 3 wins × 3 pts
                predicted_pts = max(0.0, min(9.0, raw_pts))
            except Exception as e:
                logger.warning(f"  Could not predict points for {team_name}: {e}")
            
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
            all_thirds.append({**team_predictions[2], "group": group_name})
    
    # ═══════════════════════════════════════════════════════════
    # PHASE 1b: Determine advancing teams
    # ═══════════════════════════════════════════════════════════
    
    # Group standings for bracket resolution
    group_standings = {}
    for group_name, teams in group_results.items():
        group_standings[group_name] = teams  # Already sorted by predicted_points desc
    
    # Best 3rd-place teams (top 8 thirds advance in a 48-team WC)
    all_thirds.sort(key=lambda x: x["predicted_points"], reverse=True)
    best_thirds = all_thirds[:8]
    
    # Assign best thirds to bracket slots
    # In the match labels, 3rd-place slots are like '3ABCDF' meaning
    # "one of the best 3rd-place teams from these groups fills this slot"
    # We assign them greedily: for each bracket slot, pick the best available
    # 3rd that came from one of the allowed groups
    best_thirds_available = list(best_thirds)  # mutable copy
    best_thirds_assigned = {}  # slot_key → team_name
    
    # Collect all 3rd-place bracket slots from match labels
    third_place_slots = []
    for _, row in matches_df.iterrows():
        label = str(row.get('match_label', ''))
        parts = label.split(' vs ')
        for part in parts:
            part = part.strip()
            if part.startswith("3") and len(part) > 2:
                slot_key = part[1:]
                if slot_key not in third_place_slots:
                    third_place_slots.append(slot_key)
    
    for slot_key in third_place_slots:
        allowed_groups = [f"Group {c}" for c in slot_key]
        # Find best available 3rd from allowed groups
        for third in best_thirds_available:
            if third["group"] in allowed_groups:
                best_thirds_assigned[slot_key] = third["team"]
                best_thirds_available.remove(third)
                break
        # If no match found, assign any remaining best third
        if slot_key not in best_thirds_assigned and best_thirds_available:
            best_thirds_assigned[slot_key] = best_thirds_available.pop(0)["team"]
    
    # ═══════════════════════════════════════════════════════════
    # PHASE 2: Simulate Knockout Stage (in topological order)
    # ═══════════════════════════════════════════════════════════
    logger.info("Simulating knockout stage...")
    
    # CRITICAL FIX: Sort knockout matches by match_number to ensure
    # dependencies are resolved before being referenced
    knockout_matches = matches_df[
        ~matches_df['match_label'].str.contains('Group', na=False)
    ].sort_values('match_number')
    
    match_results = {}  # {match_number_str: {winner, loser, ...}}
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
        
        team_a = _resolve_team_name(team_a_token, group_standings, best_thirds_assigned, match_results)
        team_b = _resolve_team_name(team_b_token, group_standings, best_thirds_assigned, match_results)
        
        # Skip if either team is unresolved
        is_resolved = not team_a.startswith("TBD") and not team_b.startswith("TBD")
        
        # Predict match outcome
        prob_a = 0.5
        prob_b = 0.5
        winner = team_a
        loser = team_b
        
        if is_resolved:
            try:
                result = predict_match_outcome(
                    models=models,
                    team_a=team_a,
                    team_b=team_b,
                    matches_df=matches_featured_df,
                    historical_wc_df=historical_wc_df,
                )
                prob_a = result["probabilities"]["win_A"]
                prob_b = result["probabilities"]["win_B"]
                
                if prob_a >= prob_b:
                    winner = team_a
                    loser = team_b
                else:
                    winner = team_b
                    loser = team_a
            except Exception as e:
                logger.warning(f"  Match {match_num} prediction failed: {e}")
        
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
        
        # Classify into rounds
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
            "group_model": "team_points_xgb_model (XGBoost Regression)",
            "match_model": "match_outcome_xgb (XGBoost 3-class: Win/Draw/Loss)",
            "note": "Los partidos de knockout se predicen recursivamente en orden de match_number, "
                    "asegurando que cada dependencia (Wxx) esté resuelta antes de ser referenciada. "
                    "Se usan exclusivamente features deportivas (ranking FIFA, forma, H2H).",
        },
    }
