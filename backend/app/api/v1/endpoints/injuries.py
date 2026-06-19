from fastapi import APIRouter, Request, HTTPException
import pandas as pd
from app.api.v1.utils import get_df, get_team_info_by_name, get_venue_info, get_team_info
from app.api.v1.ml.physiological_imputer import predict_physiological_profile
from app.api.v1.ml.injury_predictor import predict_injury_risk

router = APIRouter()


@router.get("/risk/{player_id}")
def get_injury_risk(
    request: Request,
    player_id: str,
    match: str = None,
    override_frequency: float = None,
    override_days_since: float = None,
):
    """
    Returns injury risk for a player using the real injury_xgboost_model.
    Features come from master_players_enriched + master_injuries_featured data.
    No hardcoded risk values.

    Optional query params for What-If simulation:
    - override_frequency: overrides injury_frequency feature
    - override_days_since: overrides days_since_last_injury feature
    """
    data = request.app.state.data
    if 'players' not in data:
        raise HTTPException(status_code=500, detail="Data not loaded")

    players_df = data['players']

    # Resolve player
    try:
        player_idx = int(player_id)
        p = players_df.loc[player_idx]
        player_data = pd.DataFrame([p])
    except (ValueError, KeyError):
        player_data = players_df[players_df['Player'] == player_id]
        if len(player_data) == 0:
            player_data = players_df[
                players_df['Player'].str.lower() == player_id.lower()
            ]

    if len(player_data) == 0:
        raise HTTPException(status_code=404, detail="Player not found")

    p = player_data.iloc[0]
    country = p.get('Country', 'Unknown')

    # Team details
    team_info = get_team_info_by_name(request, country)
    team_code = team_info['code']
    flag_url = team_info['flag_url']

    # --- Real ML inference ---
    injuries_df = data.get('injuries')
    player_row = p.to_dict() if hasattr(p, 'to_dict') else dict(p)

    # Apply what-if overrides if provided
    if override_frequency is not None:
        player_row['injury_frequency'] = override_frequency
    if override_days_since is not None:
        player_row['days_since_last_injury'] = override_days_since

    inference = predict_injury_risk(
        models=request.app.state.models,
        player_row=player_row,
        injuries_df=injuries_df,
        override_frequency=override_frequency,
        override_days_since=override_days_since,
    )
    risk_score = inference['risk_score']
    diagnosis = inference['diagnosis']
    ai_class = inference['ai_class']
    model_used = inference['model_used']

    # --- Radar stats (derived from real playing-time data) ---
    # cardio: based on actual 90s played (more minutes = higher cardio)
    playing_90s = p.get('Playing Time_90s', None)
    if pd.notna(playing_90s) and playing_90s is not None:
        cardio = min(int(float(playing_90s) * 10), 99)
    else:
        cardio = 80

    # endurance: based on minutes percentage played
    min_pct = p.get('Playing Time_Min%', None)
    if pd.notna(min_pct) and min_pct is not None:
        endurance = min(int(float(min_pct)), 99)
    else:
        endurance = 75

    # engagement: based on interceptions (real defensive engagement metric)
    performance_int = p.get('Performance_Int', None)
    if pd.notna(performance_int) and performance_int is not None:
        engagement = min(int(float(performance_int) * 5), 99)
    else:
        engagement = 90

    # respiratory and recovery: derived from risk score (inversely correlated)
    respiratory = max(90 - risk_score * 0.5, 50)
    recovery = max(100 - risk_score, 40)

    # Photo
    base_url = str(request.base_url).rstrip('/')
    photo_path = p.get('photo_url', '')
    face_url = (
        f"{base_url}{photo_path}"
        if photo_path and pd.notna(photo_path) and photo_path != ""
        else ""
    )

    # --- Match context (stadium from real DB + Open-Meteo weather) ---
    match_context = None
    if match is not None:
        try:
            from app.api.v1.services.weather_service import get_venue_geoclimatic_info

            match_id = int(match)
            df_wc_matches = get_df(request, 'world_cup_matches')
            m_df = df_wc_matches[df_wc_matches['match_number'] == match_id]
            if not m_df.empty:
                m = m_df.iloc[0]
                home_team = get_team_info(request, m.get('home_team_id'))
                away_team = get_team_info(request, m.get('away_team_id'))
                try:
                    venue_name, stadium_url = get_venue_info(request, m.get('city_id'))
                except Exception:
                    venue_name = m.get('Stadium', 'Neutral Venue')
                    stadium_url = ""

                opponent = away_team['name'] if home_team['name'] == country else home_team['name']

                # Real geoclimatic data from stadiums + Open-Meteo
                stadiums_geo = get_df(request, 'stadiums_geo')
                kickoff_str = str(m.get('kickoff_at', ''))
                geo_climate = get_venue_geoclimatic_info(
                    stadiums_geo, m.get('city_id'), kickoff_str
                )

                # Build weather in the format the frontend expects
                weather = None
                if geo_climate:
                    w = geo_climate.get("weather") or {}
                    weather = {
                        "temp_c": w.get("temp_max"),
                        "humidity": w.get("humidity") or None,
                        "altitude": geo_climate.get("elevation_m") or 0,
                        "precipitation_mm": w.get("precipitation"),
                        "wind_speed_kmh": w.get("wind_speed_max"),
                    }

                match_context = {
                    "id": f"match-{match_id}",
                    "label": f"Partido {match_id}",
                    "opponent": opponent,
                    "venue": venue_name,
                    "stadium_url": stadium_url,
                    "home": home_team,
                    "away": away_team,
                    "weather": weather,
                    "geo_climate": geo_climate,
                }
        except Exception:
            pass

    # --- Physiology (KNN model) ---
    bmi = p.get('bmi', None)
    bmi_val = float(bmi) if bmi is not None and pd.notna(bmi) else 23.0
    age_val = float(p.get('Age', 25.0)) if pd.notna(p.get('Age', None)) else 25.0

    physio = predict_physiological_profile(
        models=request.app.state.models,
        age=age_val,
        bmi=bmi_val,
        fatigue_index=risk_score,
    )

    return {
        "data": {
            "player": {
                "id": player_id,
                "name": p['Player'],
                "number": int(p.get('#', 10)) if pd.notna(p.get('#')) else 10,
                "national_team": country,
                "team_code": team_code,
                "flag_url": flag_url,
                "face_url": face_url,
                "rating_label": "GOOD" if risk_score < 50 else "WARNING",
                "stats": {
                    "fatigue_index": round(risk_score, 2),
                    **(physio if physio else {}),
                },
                "radar": {
                    "cardio": cardio,
                    "endurance": endurance,
                    "engagement": engagement,
                    "respiratory": round(respiratory, 1),
                    "recovery": round(recovery, 1),
                },
            },
            "match_context": match_context,
            "ai_inference": {
                "class": ai_class,
                "label": diagnosis,
                "model_used": model_used,
                "risk_proba": inference.get('risk_proba'),
                "justification": (
                    "Monitor closely and adjust training volume."
                    if risk_score > 50
                    else "Ready for match."
                ),
            },
        }
    }
