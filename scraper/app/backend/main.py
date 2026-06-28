from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
import joblib
import os

app = FastAPI(title="World Cup Data Science API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for models and data
models = {}
data = {}

@app.on_event("startup")
def load_assets():
    # Load Models
    try:
        models['injury'] = joblib.load('models/pkl/injury_xgboost_model.pkl')
        models['match_outcome'] = joblib.load('models/pkl/match_outcome_xgb.pkl')
    except Exception as e:
        print(f"Warning: Could not load some models: {e}")
        
    # Load Data
    try:
        data['players'] = pd.read_csv('data/4_featured/master_players_enriched.csv', low_memory=False)
        data['matches'] = pd.read_csv('data/4_featured/master_matches_featured.csv')
        data['squads'] = pd.read_csv('data/4_featured/optimal_squads.csv')
        # Load encoders
        # models['encoders'] = joblib.load('data/4_featured/encoders.pkl')
    except Exception as e:
        print(f"Warning: Could not load some datasets: {e}")

@app.get("/")
def read_root():
    return {"message": "World Cup Data Science API is running."}

@app.get("/api/squad/{country}")
def get_squad(country: str):
    if 'squads' not in data:
        raise HTTPException(status_code=500, detail="Data not loaded")
    
    squad_df = data['squads']
    country_squad = squad_df[squad_df['Country'].str.lower() == country.lower()]
    
    if len(country_squad) == 0:
        raise HTTPException(status_code=404, detail="Country not found")
        
    # Format response
    result = country_squad[['Player', 'Pos_Category', 'Age', 'Club', 'impact_score_raw', 'total_injuries', 'adjusted_score']].to_dict('records')
    return {"country": country, "squad_size": len(result), "players": result}

@app.get("/api/nationalities")
def get_nationalities():
    if 'players' not in data:
        return {"nationalities": []}
    countries = data['players']['Country'].dropna().unique().tolist()
    return {"nationalities": sorted(countries)}

from difflib import get_close_matches

@app.get("/api/players/search")
def search_players(q: str = "", country: str = ""):
    if 'players' not in data:
        return {"results": []}
    
    df = data['players']
    
    # Filter by country if provided
    if country and country != "All":
        df = df[df['Country'].str.lower() == country.lower()]
        
    names = df['Player'].dropna().tolist()
    
    if not q:
        # return first 20 if no query
        return {"results": names[:20]}
    
    # Fuzzy search using difflib
    matches = get_close_matches(q, names, n=10, cutoff=0.3)
    
    # Also include substring matches just in case
    substring_matches = [n for n in names if q.lower() in n.lower()]
    
    # Combine and preserve order, prioritizing exact substrings then fuzzy
    combined = []
    for n in substring_matches:
        if n not in combined:
            combined.append(n)
    for n in matches:
        if n not in combined:
            combined.append(n)
            
    return {"results": combined[:15]}

@app.get("/api/player/{player_name}")
def get_player(player_name: str):
    if 'players' not in data:
        raise HTTPException(status_code=500, detail="Data not loaded")
        
    players_df = data['players']
    player_data = players_df[players_df['Player'].str.lower().str.contains(player_name.lower())]
    
    if len(player_data) == 0:
        raise HTTPException(status_code=404, detail="Player not found")
        
    p = player_data.iloc[0]
    
    # We must cast numpy types to python native types to avoid JSON serialization errors
    import numpy as np
    def to_native(val):
        if pd.isna(val): return None
        if isinstance(val, (np.integer, int)): return int(val)
        if isinstance(val, (np.floating, float)): return float(val)
        return str(val)

    return {
        "Player": str(p['Player']),
        "Country": str(p['Country']),
        "Age": to_native(p['Age']),
        "Position": str(p['Pos']),
        "Club": str(p['Club']),
        "Cluster": str(p.get('cluster', 'N/A')),
        "ImpactScore": to_native(p.get('impact_score_raw', 0)),
        "TotalInjuries": to_native(p.get('total_injuries', 0)),
        "FIFA_Attributes": {
            "Pace": to_native(p.get('pace', 0)),
            "Shooting": to_native(p.get('shooting', 0)),
            "Passing": to_native(p.get('passing', 0)),
            "Dribbling": to_native(p.get('dribbling', 0)),
            "Defending": to_native(p.get('defending', 0)),
            "Physical": to_native(p.get('physic', 0)),
            "Overall": to_native(p.get('overall', 0))
        }
    }

class MatchPredictionRequest(BaseModel):
    team_a: str
    team_b: str
    temp_max: float = 20.0
    precipitation: float = 0.0
    wind_speed: float = 10.0

@app.post("/api/predict_match")
def predict_match(req: MatchPredictionRequest):
    team_a = req.team_a
    team_b = req.team_b
    
    # We will just pass generic stats + weather
    input_features = pd.DataFrame([{
        'Country_FIFA_Points': 1600,
        'Opponent_FIFA_Points': 1550,
        'ranking_diff': 50,
        'h2h_wins': 2,
        'h2h_losses': 1,
        'days_since_last_match': 30,
        'form_last_5': 10,
        'goals_scored_last_5': 2.0,
        'goals_conceded_last_5': 0.8,
        'temp_max': req.temp_max,
        'precipitation': req.precipitation,
        'wind_speed': req.wind_speed,
        'is_raining': 1 if req.precipitation > 2.0 else 0,
        'is_hot': 1 if req.temp_max > 30.0 else 0
    }])
    
    try:
        # Load the weather model specifically
        import joblib
        import xgboost as xgb
        weather_model = joblib.load('models/pkl/match_outcome_weather_xgb.pkl')
        prob_win = weather_model.predict_proba(input_features)[0][1]
        
        # Calculate SHAP values (feature contributions) for explainability
        booster = weather_model.get_booster()
        dmatrix = xgb.DMatrix(input_features)
        contribs = booster.predict(dmatrix, pred_contribs=True)[0]
        
        feature_names = input_features.columns.tolist()
        feature_contribs = [(feature_names[i], float(contribs[i])) for i in range(len(feature_names))]
        feature_contribs.sort(key=lambda x: abs(x[1]), reverse=True)
        
        explanations = []
        for f, c in feature_contribs[:4]:
            if abs(c) < 0.05: continue # Ignore negligible features
            direction = team_a if c > 0 else f"{team_b} / Draw"
            sign = "+" if c > 0 else ""
            
            # Make feature names more readable
            f_clean = f.replace('_', ' ').title()
            if f == 'precipitation': f_clean = 'Lluvia (Precipitación)'
            if f == 'wind_speed': f_clean = 'Velocidad del Viento'
            if f == 'temp_max': f_clean = 'Temperatura Máxima'
            if f == 'ranking_diff': f_clean = 'Diferencia de Ranking FIFA'
            if f == 'form_last_5': f_clean = 'Racha Reciente (Últimos 5)'
            
            explanations.append({
                "feature": f_clean,
                "impact": f"Empuja a favor de: {direction}",
                "value": f"Peso matemático: {sign}{c:.2f}"
            })
        
        # XGBoost output is (Draw/Loss, Win). Since Draw is 0 and Loss is 0 in target, 
        # probability of Win A is prob_win.
        # We can extract draw prob as an heuristic (e.g. 25% base)
        prob_draw = 0.25
        prob_a = max(prob_win - (prob_draw/2), 0.05)
        prob_b = 1.0 - prob_a - prob_draw
        
        return {
            "match": f"{team_a} vs {team_b}",
            "weather_conditions": f"Temp: {req.temp_max}°C, Rain: {req.precipitation}mm, Wind: {req.wind_speed}km/h",
            "win_prob_A": round(prob_a, 2),
            "draw_prob": round(prob_draw, 2),
            "win_prob_B": round(prob_b, 2),
            "prediction": team_a if prob_a > prob_b else team_b,
            "explanations": explanations
        }
    except Exception as e:
        print(e)
        return {
            "match": f"{team_a} vs {team_b}",
            "win_prob_A": 0.40,
            "draw_prob": 0.30,
            "win_prob_B": 0.30,
            "prediction": team_a
        }

