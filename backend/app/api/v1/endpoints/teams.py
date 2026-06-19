"""
Teams Endpoint
==============
Serves real team data from master_teams_featured.csv.
Uses team_points_xgb_model and formation_xgb_model for predictions.
No hardcoded or mocked values.
"""

from fastapi import APIRouter, Request, Response, HTTPException
import pandas as pd
import numpy as np
from app.api.v1.utils import get_df
from app.api.v1.ml.team_predictor import (
    predict_team_group_points,
    predict_team_formation,
)

router = APIRouter()


def _to_native(val):
    if val is None:
        return None
    if isinstance(val, float) and np.isnan(val):
        return None
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        return float(val)
    return val


@router.get("/")
def list_teams(request: Request, response: Response):
    """Returns all teams with their squad stats from master_teams_featured."""
    response.headers["Cache-Control"] = "public, max-age=300"
    teams_df = get_df(request, 'teams_featured')
    if teams_df.empty:
        return {"data": []}

    result = []
    for _, row in teams_df.iterrows():
        result.append({
            "country": str(row['Country']),
            "squad_stats": {
                "avg_age": _to_native(row.get('squad_avg_age')),
                "median_age": _to_native(row.get('squad_median_age')),
                "total_market_value_eur": _to_native(row.get('squad_total_market_value')),
                "avg_market_value_eur": _to_native(row.get('squad_avg_market_value')),
                "total_injuries": _to_native(row.get('squad_total_injuries')),
                "injury_burden": _to_native(row.get('squad_injury_burden')),
                "total_wc_goals": _to_native(row.get('squad_total_wc_goals')),
                "total_allcomps_goals": _to_native(row.get('squad_total_allcomps_goals')),
                "total_allcomps_assists": _to_native(row.get('squad_total_allcomps_assists')),
                "top_league_ratio": _to_native(row.get('squad_top_league_ratio')),
                "avg_impact_score": _to_native(row.get('squad_avg_impact_score')),
                "depth": {
                    "GK": _to_native(row.get('squad_depth_GK')),
                    "DF": _to_native(row.get('squad_depth_DF')),
                    "MF": _to_native(row.get('squad_depth_MF')),
                    "FW": _to_native(row.get('squad_depth_FW')),
                },
            },
            "group_stage": {
                "rank": _to_native(row.get('group_rank')),
                "matches_played": _to_native(row.get('group_matches_played')),
                "wins": _to_native(row.get('group_wins')),
                "draws": _to_native(row.get('group_draws')),
                "losses": _to_native(row.get('group_losses')),
                "goals_for": _to_native(row.get('group_goals_for')),
                "goals_against": _to_native(row.get('group_goals_against')),
                "goal_diff": _to_native(row.get('group_goals_difference')),
                "points": _to_native(row.get('group_points')),
                "last_5_form": str(row.get('group_last_5_form', '')) if pd.notna(row.get('group_last_5_form')) else None,
            },
        })

    return {"data": result, "total": len(result)}


@router.get("/groups")
def get_wc_groups(request: Request, response: Response):
    """Returns the World Cup 2026 group stage standings from world_cup_2026_groups.csv."""
    response.headers["Cache-Control"] = "public, max-age=300"
    groups_df = get_df(request, 'wc_groups')
    if groups_df.empty:
        return {"data": {}}

    groups = {}
    for _, row in groups_df.iterrows():
        grp = str(row.get('group', 'Unknown'))
        if grp not in groups:
            groups[grp] = []
        groups[grp].append({
            "rank": _to_native(row.get('rank')),
            "team": str(row.get('team', '')),
            "mp": _to_native(row.get('mp')),
            "w": _to_native(row.get('w')),
            "d": _to_native(row.get('d')),
            "l": _to_native(row.get('l')),
            "gf": _to_native(row.get('gf')),
            "ga": _to_native(row.get('ga')),
            "gd": _to_native(row.get('gd')),
            "pts": _to_native(row.get('pts')),
            "last_5": str(row.get('last_5', '')) if pd.notna(row.get('last_5')) else None,
        })

    return {"data": groups}


@router.get("/{team_name}")
def get_team(request: Request, response: Response, team_name: str):
    """Returns detailed stats for a single team."""
    response.headers["Cache-Control"] = "public, max-age=300"
    teams_df = get_df(request, 'teams_featured')
    if teams_df.empty:
        raise HTTPException(status_code=503, detail="teams_featured data not loaded")

    row_df = teams_df[teams_df['Country'] == team_name]
    if row_df.empty:
        row_df = teams_df[teams_df['Country'].str.lower() == team_name.lower()]
    if row_df.empty:
        row_df = teams_df[
            teams_df['Country'].str.lower().str.contains(team_name.lower(), na=False)
        ]
    if row_df.empty:
        raise HTTPException(status_code=404, detail=f"Team '{team_name}' not found")

    row = row_df.iloc[0]
    result = {col: _to_native(row[col]) for col in teams_df.columns}
    return {"data": result}


@router.get("/{team_name}/prediction")
def get_team_prediction(request: Request, response: Response, team_name: str):
    """
    Predicts expected group stage points using team_points_xgb_model.
    All inputs come from real master_teams_featured data.
    """
    response.headers["Cache-Control"] = "no-cache"
    teams_df = get_df(request, 'teams_featured')
    if teams_df.empty:
        raise HTTPException(status_code=503, detail="teams_featured data not loaded")

    try:
        result = predict_team_group_points(
            models=request.app.state.models,
            team_name=team_name,
            teams_df=teams_df,
        )
        return {"data": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{team_name}/formation")
def get_team_formation(request: Request, response: Response, team_name: str):
    """
    Predicts the most likely tactical formation for a team using
    formation_xgb_model with real historical formation data.
    """
    response.headers["Cache-Control"] = "no-cache"
    matches_df = get_df(request, 'matches_featured')
    if matches_df.empty:
        matches_df = get_df(request, 'matches')
    if matches_df.empty:
        raise HTTPException(status_code=503, detail="matches_featured data not loaded")

    try:
        result = predict_team_formation(
            models=request.app.state.models,
            team_name=team_name,
            matches_df=matches_df,
        )
        return {"data": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))