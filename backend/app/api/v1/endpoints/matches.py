from fastapi import APIRouter, Request, Response, HTTPException
from pydantic import BaseModel
import pandas as pd
from app.api.v1.utils import get_df, get_team_info, get_venue_info
from app.api.v1.ml.match_predictor import predict_match_outcome
from app.api.v1.services.weather_service import get_venue_geoclimatic_info

router = APIRouter()

@router.get("/dates")
def get_dates(request: Request, response: Response):
    response.headers["Cache-Control"] = "public, max-age=31536000"
    df_matches = get_df(request, 'world_cup_matches')
    if df_matches.empty:
        return {"data": []}
    
    if 'date_only' not in df_matches.columns and 'kickoff_at' in df_matches.columns:
        df_matches['date_only'] = pd.to_datetime(df_matches['kickoff_at'], utc=True).dt.strftime('%Y-%m-%d')
    
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
    response.headers["Cache-Control"] = "public, max-age=31536000"
    df_matches = get_df(request, 'world_cup_matches')
    if df_matches.empty:
        return {"data": []}
        
    if 'date_only' not in df_matches.columns and 'kickoff_at' in df_matches.columns:
        df_matches['date_only'] = pd.to_datetime(df_matches['kickoff_at'], utc=True).dt.strftime('%Y-%m-%d')

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

        matches.append({
            "id": f"match-{m.get('match_number', 0)}",
            "match_number": int(m.get('match_number', 0)),
            "home": get_team_info(request, m.get('home_team_id')),
            "away": get_team_info(request, m.get('away_team_id')),
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
def get_squad(request: Request, response: Response, match_id: int):
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
                if not players_main_df.empty:
                    match_p = players_main_df[players_main_df['Player'] == player_name]
                    if not match_p.empty:
                        true_idx = match_p.index[0]
                        
                photo_path = p.get('photo_url', '')
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
def get_squad_inference(request: Request, response: Response, match_id: int):
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
        result = predict_match_outcome(
            models=models,
            team_a=req.team_a,
            team_b=req.team_b,
            matches_df=df_matches,
            temp_max=req.temp_max,
            precipitation=req.precipitation,
            wind_speed=req.wind_speed,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
