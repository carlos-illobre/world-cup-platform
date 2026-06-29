from fastapi import APIRouter, Request, Response, HTTPException
from pydantic import BaseModel
import pandas as pd
from app.api.v1.utils import get_df, get_team_info, get_venue_info
from app.api.v1.ml.match_predictor import predict_match_outcome
from app.api.v1.services.weather_service import get_venue_geoclimatic_info

router = APIRouter()


def _resolve_knockout_team(token: str, groups_df, request: Request) -> str:
    """
    Resolves a knockout bracket token (e.g., '1A', '2B', '3ABCDF') to an actual team name
    using the groups data. For simple group positions (1A = 1st of Group A), it uses the
    groups CSV assuming teams are listed in strength order.
    For complex tokens (W73, RU101), returns None (can't resolve without running simulation).
    """
    token = token.strip()
    
    # Simple group position: '1A' = 1st in Group A, '2B' = 2nd in Group B
    if len(token) == 2 and token[0] in ('1', '2', '3', '4') and token[1].isalpha():
        position = int(token[0])
        group_letter = token[1]
        if not groups_df.empty:
            group_teams = groups_df[groups_df['group'] == f"Group {group_letter}"]
            if group_teams.empty:
                group_teams = groups_df[groups_df['group'] == group_letter]
            if not group_teams.empty and position <= len(group_teams):
                # Clean team name (remove ISO prefix if present)
                team_raw = str(group_teams.iloc[position - 1].get('team', ''))
                if len(team_raw) > 3 and team_raw[:2].islower() and team_raw[2] == ' ':
                    return team_raw[3:]
                if len(team_raw) > 4 and team_raw[:3].islower() and team_raw[3] == ' ':
                    return team_raw[4:]
                return team_raw
    
    # Best 3rd place tokens (e.g., '3ABCDF') — just pick first available from those groups
    if token.startswith('3') and len(token) > 2:
        group_letters = token[1:]
        if not groups_df.empty:
            for letter in group_letters:
                group_teams = groups_df[groups_df['group'] == f"Group {letter}"]
                if group_teams.empty:
                    group_teams = groups_df[groups_df['group'] == letter]
                if not group_teams.empty and len(group_teams) >= 3:
                    team_raw = str(group_teams.iloc[2].get('team', ''))
                    if len(team_raw) > 3 and team_raw[:2].islower() and team_raw[2] == ' ':
                        return team_raw[3:]
                    if len(team_raw) > 4 and team_raw[:3].islower() and team_raw[3] == ' ':
                        return team_raw[4:]
                    return team_raw
    
    # Winner/Loser tokens (W73, RU101) — can't resolve without simulation
    return None


def _get_team_info_by_name_safe(request: Request, team_name: str) -> dict:
    """Safely get team info by name, returning a placeholder if not found."""
    if not team_name:
        return {"name": "Por Definir", "code": "TBD", "flag_url": ""}
    try:
        from app.api.v1.utils import get_team_info_by_name
        return get_team_info_by_name(request, team_name)
    except Exception:
        return {"name": team_name, "code": "TBD", "flag_url": ""}

@router.get("/dates")
def get_dates(request: Request, response: Response):
    response.headers["Cache-Control"] = "public, max-age=3600"
    df_matches = get_df(request, 'world_cup_matches')
    if df_matches.empty:
        return {"data": []}
    
    if 'kickoff_at' in df_matches.columns:
        # Always extract the local date from the kickoff string (format: "YYYY-MM-DD HH:MM:SS±TZ")
        # This preserves the venue's local date rather than converting to UTC
        df_matches['date_only'] = df_matches['kickoff_at'].astype(str).str[:10]
    
    date_counts = df_matches.groupby('date_only').size()
    dates = []
    for d, c in date_counts.items():
        dates.append({
            "id": d,
            "label": d,
            "date": d,
            "match_count": int(c)
        })
    return {"data": dates}

@router.get("/dates/{fecha_id}/matches")
def get_matches_by_date(request: Request, response: Response, fecha_id: str):
    response.headers["Cache-Control"] = "public, max-age=3600"
    df_matches = get_df(request, 'world_cup_matches')
    if df_matches.empty:
        return {"data": []}
        
    if 'kickoff_at' in df_matches.columns:
        # Always extract the local date from the kickoff string (format: "YYYY-MM-DD HH:MM:SS±TZ")
        # This preserves the venue's local date rather than converting to UTC
        df_matches['date_only'] = df_matches['kickoff_at'].astype(str).str[:10]

    day_matches = df_matches[df_matches['date_only'] == fecha_id]
    stadiums_geo = get_df(request, 'stadiums_geo')
    matches = []
    for _, m in day_matches.iterrows():
        try:
            venue_name, stadium_url = get_venue_info(request, m.get('city_id'))
        except Exception:
            venue_name = m.get('Stadium', 'Unknown Venue')
            stadium_url = ""

        # Get real geoclimatic data from stadiums + Open-Meteo
        kickoff_str = str(m.get('kickoff_at', ''))
        geo_climate = get_venue_geoclimatic_info(
            stadiums_geo, m.get('city_id'), kickoff_str
        )

        # Build legacy weather format expected by frontend MatchCard
        weather = None
        if geo_climate:
            w = geo_climate.get("weather") or {}
            weather = {
                "temp_c": w.get("temp_max"),
                "humidity": w.get("humidity") or None,
                "altitude": geo_climate.get("elevation_m") or 0,
            }

        home = get_team_info(request, m.get('home_team_id'))
        away = get_team_info(request, m.get('away_team_id'))

        # For knockout matches where teams are TBD, try to resolve from match_label
        match_label = str(m.get('match_label', ''))
        if home['code'] == 'TBD' or away['code'] == 'TBD':
            if ' vs ' in match_label:
                parts = match_label.split(' vs ')
                if home['code'] == 'TBD' and len(parts) > 0:
                    home = {"name": parts[0].strip(), "code": "TBD", "flag_url": ""}
                if away['code'] == 'TBD' and len(parts) > 1:
                    away = {"name": parts[1].strip(), "code": "TBD", "flag_url": ""}

        matches.append({
            "id": f"match-{m.get('match_number', 0)}",
            "match_number": int(m.get('match_number', 0)),
            "home": home,
            "away": away,
            "venue": venue_name,
            "stadium_url": stadium_url,
            "kickoff_at": kickoff_str,
            "weather": weather,
            "geo_climate": geo_climate,
        })
    return {"data": matches}

@router.get("/{match_id}/context")
def get_context(request: Request, response: Response, match_id: int):
    response.headers["Cache-Control"] = "public, max-age=31536000"
    df_matches = get_df(request, 'world_cup_matches')
    if df_matches.empty:
        return {"data": {}}
    m = df_matches[df_matches['match_number'] == match_id]
    if m.empty:
        return {"data": {}}
    m = m.iloc[0]
    
    home_team = get_team_info(request, m.get('home_team_id'))
    away_team = get_team_info(request, m.get('away_team_id'))
    
    try:
        venue_name, stadium_url = get_venue_info(request, m.get('city_id'))
    except Exception:
        venue_name = m.get('Stadium', 'Unknown Venue')
        stadium_url = ""

    # Real geoclimatic data
    stadiums_geo = get_df(request, 'stadiums_geo')
    kickoff_str = str(m.get('kickoff_at', ''))
    geo_climate = get_venue_geoclimatic_info(
        stadiums_geo, m.get('city_id'), kickoff_str
    )

    # Extract weather for legacy CondicionesClimaticas format
    weather = None
    if geo_climate and geo_climate.get("weather"):
        w = geo_climate["weather"]
        weather = {
            "temp_c": w.get("temp_max"),
            "humidity": w.get("humidity") or 60,  # Open-Meteo daily doesn't return humidity
            "altitude": geo_climate.get("elevation_m") or 0,
            "precipitation_mm": w.get("precipitation"),
            "wind_speed_kmh": w.get("wind_speed_max"),
        }
    elif geo_climate:
        # At minimum return elevation from the stadium data
        weather = {
            "temp_c": None,
            "humidity": None,
            "altitude": geo_climate.get("elevation_m") or 0,
            "precipitation_mm": None,
            "wind_speed_kmh": None,
        }
    
    return {"data": {
        "id": f"match-{match_id}",
        "label": f"Partido {match_id}",
        "opponent": away_team['name'],
        "venue": venue_name,
        "stadium_url": stadium_url,
        "home": home_team,
        "away": away_team,
        "weather": weather,
        "geo_climate": geo_climate,
    }}

@router.get("/{match_id}/squad")
def get_squad(request: Request, response: Response, match_id: int, teams: str = None):
    response.headers["Cache-Control"] = "no-cache"
    df_matches = get_df(request, 'world_cup_matches')
    if df_matches.empty:
        return {"data": []}
    m = df_matches[df_matches['match_number'] == match_id]
    if m.empty:
        return {"data": []}
    m = m.iloc[0]
    home_team = get_team_info(request, m.get('home_team_id'))
    away_team = get_team_info(request, m.get('away_team_id'))

    # Override teams from query param (format: "TeamA,TeamB") — used for simulated knockout matches
    if teams:
        team_parts = teams.split(',', 1)
        if len(team_parts) == 2:
            home_team = _get_team_info_by_name_safe(request, team_parts[0].strip())
            away_team = _get_team_info_by_name_safe(request, team_parts[1].strip())

    # For knockout matches where teams are TBD, resolve from match_label using groups
    match_label = str(m.get('match_label', ''))
    if (home_team['code'] == 'TBD' or away_team['code'] == 'TBD') and ' vs ' in match_label:
        groups_df = get_df(request, 'wc_groups')
        parts = match_label.split(' vs ')
        resolved_teams = []
        for token in parts:
            token = token.strip()
            resolved_name = _resolve_knockout_team(token, groups_df, request)
            resolved_teams.append(resolved_name)
        
        if len(resolved_teams) >= 2:
            if home_team['code'] == 'TBD' and resolved_teams[0]:
                home_team = _get_team_info_by_name_safe(request, resolved_teams[0])
            if away_team['code'] == 'TBD' and resolved_teams[1]:
                away_team = _get_team_info_by_name_safe(request, resolved_teams[1])

    df_players = get_df(request, 'squads')
    if df_players.empty:
        df_players = get_df(request, 'players')

    base_url = str(request.base_url).rstrip('/')
    squad_players = []
    if not df_players.empty:
        players_main_df = get_df(request, 'players')
        for t in [home_team, away_team]:
            team_players = df_players[df_players['Country'] == t['name']]
            for idx, p in team_players.iterrows():
                player_name = p['Player']
                true_idx = idx
                photo_path = p.get('photo_url', '')
                
                # Try to resolve from main players df (has better photo mapping)
                if not players_main_df.empty:
                    match_p = players_main_df[players_main_df['Player'] == player_name]
                    if match_p.empty:
                        # Case-insensitive fallback
                        match_p = players_main_df[players_main_df['Player'].str.lower() == player_name.lower()]
                    if not match_p.empty:
                        true_idx = match_p.index[0]
                        # Use photo from main players df if squad doesn't have one
                        if not photo_path:
                            photo_path = match_p.iloc[0].get('photo_url', '')
                        
                face_url = f"{base_url}{photo_path}" if photo_path else ""
                squad_players.append({
                    "id": str(true_idx),
                    "name": str(player_name),
                    "national_team": t['name'],
                    "team_code": t['code'],
                    "flag_url": t['flag_url'],
                    "face_url": face_url
                })

    return {"data": squad_players}

@router.get("/{match_id}/squad/inference")
def get_squad_inference(request: Request, response: Response, match_id: int, teams: str = None):
    """
    Returns squad players with real injury risk inference from
    injury_xgboost_model for each player.
    """
    response.headers["Cache-Control"] = "no-cache"
    df_matches = get_df(request, 'world_cup_matches')
    if df_matches.empty:
        return {"data": {}}
    m = df_matches[df_matches['match_number'] == match_id]
    if m.empty:
        return {"data": {}}
    m = m.iloc[0]

    home_team = get_team_info(request, m.get('home_team_id'))
    away_team = get_team_info(request, m.get('away_team_id'))

    # Override teams from query param (format: "TeamA,TeamB") — used for simulated knockout matches
    if teams:
        team_parts = teams.split(',', 1)
        if len(team_parts) == 2:
            home_team = _get_team_info_by_name_safe(request, team_parts[0].strip())
            away_team = _get_team_info_by_name_safe(request, team_parts[1].strip())

    df_players = get_df(request, 'squads')
    if df_players.empty:
        df_players = get_df(request, 'players')

    df_injuries = get_df(request, 'injuries')

    base_url = str(request.base_url).rstrip('/')
    models = request.app.state.models

    def get_team_players(t):
        from app.api.v1.ml.injury_predictor import predict_injury_risk
        players_list = []
        if not df_players.empty:
            players_main_df = get_df(request, 'players')
            team_players = df_players[df_players['Country'] == t['name']]
            for idx, p in team_players.iterrows():
                player_name = p['Player']
                true_idx = idx
                if not players_main_df.empty:
                    match_p = players_main_df[players_main_df['Player'] == player_name]
                    if not match_p.empty:
                        true_idx = match_p.index[0]

                photo_path = p.get('photo_url', '')
                face_url = f"{base_url}{photo_path}" if photo_path else ""

                # Real ML inference
                player_row = p.to_dict() if hasattr(p, 'to_dict') else dict(p)
                # Merge player stats from players_main if available
                if not players_main_df.empty:
                    mp = players_main_df[players_main_df['Player'] == player_name]
                    if not mp.empty:
                        player_row.update(mp.iloc[0].to_dict())

                inference = predict_injury_risk(
                    models=models,
                    player_row=player_row,
                    injuries_df=df_injuries if not df_injuries.empty else None,
                )

                players_list.append({
                    "id": str(true_idx),
                    "name": str(player_name),
                    "national_team": t['name'],
                    "team_code": t['code'],
                    "flag_url": t['flag_url'],
                    "face_url": face_url,
                    "ai_inference": {
                        "class": inference['ai_class'],
                        "label": inference['diagnosis'],
                        "risk_score": inference['risk_score'],
                        "model_used": inference['model_used'],
                    },
                })

            # Sort by risk (highest first)
            players_list.sort(
                key=lambda x: x['ai_inference']['risk_score'],
                reverse=True,
            )
        return players_list

    return {"data": {
        "match_number": match_id,
        "home": {
            "team": home_team,
            "players": get_team_players(home_team),
        },
        "away": {
            "team": away_team,
            "players": get_team_players(away_team),
        },
    }}

class MatchPredictionRequest(BaseModel):
    team_a: str
    team_b: str
    temp_max: float = 20.0
    precipitation: float = 0.0
    wind_speed: float = 10.0

@router.post("/predictions")
def predict_match(request: Request, req: MatchPredictionRequest):
    """
    Predicts the match outcome between two teams using the
    match_outcome_weather_xgb model with real scraped data.
    All features come from master_matches_featured.csv — no hardcoded values.
    """
    models = request.app.state.models
    df_matches = get_df(request, 'matches_featured')
    if df_matches.empty:
        # Fallback to the legacy key
        df_matches = get_df(request, 'matches')

    if df_matches.empty:
        raise HTTPException(status_code=503, detail="Match data not loaded")

    try:
        # Load historical World Cup data for H2H calculation
        historical_wc_df = get_df(request, 'historical_wc')

        result = predict_match_outcome(
            models=models,
            team_a=req.team_a,
            team_b=req.team_b,
            matches_df=df_matches,
            temp_max=req.temp_max,
            precipitation=req.precipitation,
            wind_speed=req.wind_speed,
            historical_wc_df=historical_wc_df,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/model/feature-importance")
def get_match_feature_importance(request: Request):
    """
    Returns real feature importance (by gain) from the loaded match_weather XGBoost model.
    Used by the MatchModelPanel for data science students.
    """
    models = request.app.state.models
    model = models.get('match_weather')
    if model is None:
        raise HTTPException(status_code=503, detail="match_weather model not loaded")

    try:
        booster = model.get_booster()
        importance = booster.get_score(importance_type='gain')

        total_gain = sum(importance.values()) if importance else 1
        items = []
        for feat, gain in sorted(importance.items(), key=lambda x: x[1], reverse=True):
            items.append({
                "feature": feat,
                "gain": round(gain, 2),
                "importance_pct": round((gain / total_gain) * 100, 1) if total_gain > 0 else 0,
            })

        return {
            "total_features": len(items),
            "items": items,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error extracting feature importance: {str(e)}")
