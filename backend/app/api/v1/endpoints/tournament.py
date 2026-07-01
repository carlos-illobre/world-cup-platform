"""
Tournament Simulator
=====================
Simulates the entire World Cup 2026 tournament by:
1. Simulating every group-stage fixture with 3/1/0 table points
2. Determining which teams advance from each group (top 2 + best 3rds)
3. Resolving knockout bracket matches using match_outcome_weather_xgb
4. Returning the complete bracket prediction from Round of 32 to Final
"""

from fastapi import APIRouter, Request, Response, HTTPException
import pandas as pd
import logging
from typing import Optional
from app.api.v1.utils import get_df, get_team_info
from app.api.v1.country_utils import canonicalize_country_name
from app.api.v1.ml.match_predictor import predict_match_outcome

router = APIRouter()
logger = logging.getLogger(__name__)


def _empty_standing(team_name: str) -> dict:
    return {
        "team": _clean_team_name(team_name),
        "mp": 0,
        "w": 0,
        "d": 0,
        "l": 0,
        "gf": 0,
        "ga": 0,
        "gd": 0,
        "pts": 0,
        "predicted_points": 0,
    }


def _apply_group_result(standings: dict, team_a: str, team_b: str, result: str):
    a = standings[team_a]
    b = standings[team_b]
    a["mp"] += 1
    b["mp"] += 1

    if result == "A":
        a["w"] += 1
        b["l"] += 1
        a["pts"] += 3
        a["gf"] += 2
        b["ga"] += 2
    elif result == "B":
        b["w"] += 1
        a["l"] += 1
        b["pts"] += 3
        b["gf"] += 2
        a["ga"] += 2
    else:
        a["d"] += 1
        b["d"] += 1
        a["pts"] += 1
        b["pts"] += 1
        a["gf"] += 1
        a["ga"] += 1
        b["gf"] += 1
        b["ga"] += 1

    a["gd"] = a["gf"] - a["ga"]
    b["gd"] = b["gf"] - b["ga"]
    a["predicted_points"] = a["pts"]
    b["predicted_points"] = b["pts"]


def _apply_group_score(standings: dict, team_a: str, team_b: str, gf_a: int, gf_b: int):
    a = standings[team_a]
    b = standings[team_b]
    a["mp"] += 1
    b["mp"] += 1
    a["gf"] += gf_a
    a["ga"] += gf_b
    b["gf"] += gf_b
    b["ga"] += gf_a
    if gf_a > gf_b:
        a["w"] += 1
        b["l"] += 1
        a["pts"] += 3
    elif gf_b > gf_a:
        b["w"] += 1
        a["l"] += 1
        b["pts"] += 3
    else:
        a["d"] += 1
        b["d"] += 1
        a["pts"] += 1
        b["pts"] += 1
    a["gd"] = a["gf"] - a["ga"]
    b["gd"] = b["gf"] - b["ga"]
    a["predicted_points"] = a["pts"]
    b["predicted_points"] = b["pts"]


def _score_value(value):
    if pd.isna(value):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _row_team_name(request: Request, row, side: str) -> Optional[str]:
    team_id = row.get(f'{side}_team_id')
    try:
        team = get_team_info(request, team_id)
        return _clean_team_name(team["name"])
    except Exception:
        return None


def _clean_team_name(team_name: str) -> str:
    team_name = str(team_name).strip()
    if len(team_name) > 3 and team_name[:2].islower() and team_name[2] == ' ':
        team_name = team_name[3:]
    elif len(team_name) > 4 and team_name[:3].islower() and team_name[3] == ' ':
        team_name = team_name[4:]
    return canonicalize_country_name(team_name)


def _resolve_team_name(
    token: str,
    group_winners: dict,
    match_results: dict,
    third_slot_key: Optional[str] = None,
) -> str:
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
            return _clean_team_name(match_results[match_num].get("winner", ""))
        raise ValueError(f"Bracket references unresolved winner W{match_num}")
    
    # Runner-up (loser) of match N
    if token.startswith("RU"):
        match_num = token[2:]
        if match_num in match_results:
            return _clean_team_name(match_results[match_num].get("loser", ""))
        raise ValueError(f"Bracket references unresolved runner-up RU{match_num}")
    
    # 1st or 2nd of group
    if len(token) == 2 and token[0] in ("1", "2"):
        position = int(token[0])  # 1 or 2
        group = token[1]
        key = f"Group {group}"
        if key in group_winners:
            teams = group_winners[key]
            if position <= len(teams):
                return _clean_team_name(teams[position - 1])
        return f"{position}° Group {group}"
    
    # Best 3rd place from specific groups (e.g., '3ABCDF')
    if token.startswith("3") and len(token) > 2:
        # The actual 3rd-place team assigned to this slot depends on
        # which specific groups the best 3rds come from.
        # For simplicity, we pick the best available 3rd from the listed groups.
        key = third_slot_key or f"best_3rd_{token[1:]}"
        if key in group_winners:
            return _clean_team_name(group_winners[key])
        # Fallback
        return f"3° ({token[1:]})"
    
    return _clean_team_name(token)


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
    matches_featured_df = get_df(request, 'matches_featured')
    
    if groups_df.empty or matches_df.empty:
        raise HTTPException(status_code=503, detail="Tournament data not loaded")
    
    # ═══════════════════════════════════════════════════════════
    # PHASE 1: Simulate Group Stage
    # ═══════════════════════════════════════════════════════════
    logger.info("Simulating group stage...")
    
    group_results = {}  # {group_name: [{team, pts, w, d, l, ...}, ...]}
    all_thirds = []  # All 3rd-place teams for best-3rd calculation
    
    groups = {}
    for _, row in groups_df.iterrows():
        grp = str(row.get('group', ''))
        if grp not in groups:
            groups[grp] = []
        groups[grp].append(_clean_team_name(str(row.get('team', ''))))

    for group_name, teams in groups.items():
        group_results[group_name] = [_empty_standing(team_name) for team_name in teams]

    standings_by_team = {
        team["team"]: team
        for teams in group_results.values()
        for team in teams
    }

    group_matches = matches_df[matches_df['stage_id'] == 1].sort_values('match_number')
    for _, match in group_matches.iterrows():
        try:
            home = get_team_info(request, match.get('home_team_id'))
            away = get_team_info(request, match.get('away_team_id'))
        except Exception:
            continue

        team_a = _clean_team_name(home["name"])
        team_b = _clean_team_name(away["name"])
        if team_a not in standings_by_team or team_b not in standings_by_team:
            continue

        home_score = _score_value(match.get('home_score'))
        away_score = _score_value(match.get('away_score'))
        if home_score is not None and away_score is not None:
            _apply_group_score(standings_by_team, team_a, team_b, home_score, away_score)
        else:
            result_code = "D"
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
                probabilities = result.get("probabilities", {})
                win_a = float(probabilities.get("win_A", 0))
                draw = float(probabilities.get("draw", 0))
                win_b = float(probabilities.get("win_B", 0))
                if win_a >= draw and win_a >= win_b:
                    result_code = "A"
                elif win_b >= draw and win_b > win_a:
                    result_code = "B"
                else:
                    result_code = "D"
            except Exception:
                result_code = "D"

            _apply_group_result(standings_by_team, team_a, team_b, result_code)

    for group_name, teams in group_results.items():
        teams.sort(
            key=lambda x: (x["pts"], x["gd"], x["gf"], x["team"]),
            reverse=True,
        )

        if len(teams) >= 3:
            all_thirds.append({**teams[2], "group": group_name})
    
    # Determine group winners dict for bracket resolution
    group_winners = {}
    for group_name, teams in group_results.items():
        group_winners[group_name] = [t["team"] for t in teams]
    
    # Best 3rd-place teams (top 8 thirds advance in a 48-team WC)
    all_thirds.sort(key=lambda x: (x["pts"], x["gd"], x["gf"], x["team"]), reverse=True)
    best_thirds = all_thirds[:8]  # Top 8 third-place teams advance
    
    knockout_matches = matches_df[
        ~matches_df['match_label'].str.contains('Group', na=False)
    ].sort_values('match_number')

    # Assign each best third-place team to one and only one bracket slot.
    used_third_teams = set()
    for _, row in knockout_matches.iterrows():
        match_number = int(row.get('match_number', 0))
        stage_id = int(row.get('stage_id', 0))
        if stage_id != 2 and not (73 <= match_number <= 88):
            continue

        label = str(row.get('match_label', ''))
        parts = label.split(' vs ')
        for part_index, part in enumerate(parts):
            part = part.strip()
            if part.startswith("3") and len(part) > 2:
                possible_groups = list(part[1:])
                key = f"best_3rd_{match_number}_{part_index}"

                selected_third = None

                # Find the best unused 3rd from these specific groups.
                for third in best_thirds:
                    grp_letter = third["group"].replace("Group ", "")
                    team = _clean_team_name(third["team"])
                    if grp_letter in possible_groups and team not in used_third_teams:
                        selected_third = team
                        break

                # Some simulated tables can produce a best-third combination that
                # does not fit every official token. Keep the bracket complete by
                # using the next best unused third-place team.
                if selected_third is None:
                    for third in best_thirds:
                        team = _clean_team_name(third["team"])
                        if team not in used_third_teams:
                            selected_third = team
                            break

                if selected_third is not None:
                    group_winners[key] = selected_third
                    used_third_teams.add(selected_third)
    
    # ═══════════════════════════════════════════════════════════
    # PHASE 2: Simulate Knockout Stage
    # ═══════════════════════════════════════════════════════════
    logger.info("Simulating knockout stage...")
    
    match_results = {}  # {match_number_str: {winner, loser, proba, ...}}
    knockout_rounds = {
        "round_of_32": [],
        "round_of_16": [],
        "quarter_finals": [],
        "semi_finals": [],
        "third_place": [],
        "final": [],
    }
    round_of_32_teams = set()
    
    for _, match in knockout_matches.iterrows():
        match_num = str(int(match['match_number']))
        label = str(match.get('match_label', ''))
        parts = label.split(' vs ')

        team_a = _row_team_name(request, match, 'home')
        team_b = _row_team_name(request, match, 'away')

        if team_a is None or team_b is None:
            if len(parts) != 2:
                continue

            team_a_token = parts[0].strip()
            team_b_token = parts[1].strip()

            team_a = _resolve_team_name(
                team_a_token,
                group_winners,
                match_results,
                f"best_3rd_{match_num}_0" if team_a_token.startswith("3") else None,
            )
            team_b = _resolve_team_name(
                team_b_token,
                group_winners,
                match_results,
                f"best_3rd_{match_num}_1" if team_b_token.startswith("3") else None,
            )

        if team_a == team_b:
            raise HTTPException(
                status_code=500,
                detail=f"Invalid bracket: match {match_num} has {team_a} against itself",
            )

        stage_id = int(match.get('stage_id', 0))
        mn = int(match_num)
        if stage_id == 2 or (73 <= mn <= 88):
            duplicate_teams = [team for team in (team_a, team_b) if team in round_of_32_teams]
            if duplicate_teams:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        f"Invalid round-of-32 bracket: repeated team(s) "
                        f"{', '.join(duplicate_teams)}"
                    ),
                )
            round_of_32_teams.update([team_a, team_b])
        
        # Use official FIFA result when available; predict only pending matches.
        prob_a = 0.5
        prob_b = 0.5
        winner = team_a
        loser = team_b

        home_score = _score_value(match.get('home_score'))
        away_score = _score_value(match.get('away_score'))
        winner_team_id = match.get('winner_team_id')
        official_winner = None
        if pd.notna(winner_team_id):
            try:
                official_winner = _clean_team_name(get_team_info(request, winner_team_id)["name"])
            except Exception:
                official_winner = None

        if official_winner:
            winner = official_winner
            loser = team_b if official_winner == team_a else team_a
            prob_a = 1.0 if winner == team_a else 0.0
            prob_b = 1.0 if winner == team_b else 0.0
        elif home_score is not None and away_score is not None and home_score != away_score:
            if home_score > away_score:
                winner = team_a
                loser = team_b
            else:
                winner = team_b
                loser = team_a
            prob_a = 1.0 if winner == team_a else 0.0
            prob_b = 1.0 if winner == team_b else 0.0
        else:
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
                # If prediction fails, use team that appears first as winner.
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
            "source": "FIFA" if official_winner or (home_score is not None and away_score is not None and home_score != away_score) else "Predicción",
        }
        
        match_results[match_num] = match_result
        
        # Classify into rounds by stage_id or match number ranges
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
            {"team": t["team"], "group": t["group"], "points": t["pts"]}
            for t in best_thirds
        ],
        "knockout": knockout_rounds,
        "champion": champion,
        "model_info": {
            "group_model": "match_outcome_weather_xgb applied to group fixtures (3/1/0 points)",
            "match_model": "match_outcome_weather_xgb (XGBoost Binary Classifier)",
            "note": "La fase de grupos suma 3 puntos por victoria, 1 por empate y 0 por derrota. Los partidos de knockout se predicen recursivamente.",
        },
    }
