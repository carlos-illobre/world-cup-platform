from fastapi import APIRouter, HTTPException, Request
import pandas as pd
from app.api.v1.country_utils import country_mask, resolve_country_in_df

router = APIRouter()

@router.get("/{country}")
def get_squad(request: Request, country: str):
    data = request.app.state.data
    if 'squads' not in data:
        raise HTTPException(status_code=500, detail="Data not loaded")
    
    squad_df = data['squads']
    country_squad = squad_df[country_mask(squad_df, 'Country', country)]
    
    if len(country_squad) == 0:
        raise HTTPException(status_code=404, detail="Squad for country not found")
        
    base_url = str(request.base_url).rstrip('/')
    
    # Format response
    cols_to_keep = ['Player', 'Pos_Category', 'Age', 'Club', 'impact_score_raw', 'total_injuries', 'adjusted_score']
    if 'photo_url' in country_squad.columns:
        cols_to_keep.append('photo_url')
        
    players = []
    for idx, p in country_squad.iterrows():
        players.append({
            "id": str(idx),
            "name": p["Player"],
            "photo_url": f"{base_url}{p['photo_url']}" if pd.notna(p.get("photo_url")) and p.get("photo_url") else "",
            "position_category": p["Pos_Category"],
            "age": p["Age"],
            "club": p["Club"],
            "impact_score": p.get("impact_score_raw") if pd.notna(p.get("impact_score_raw")) else None,
            "total_injuries": p.get("total_injuries") if pd.notna(p.get("total_injuries")) else None,
            "adjusted_score": p.get("adjusted_score") if pd.notna(p.get("adjusted_score")) else None
        })
        
    return {
        "country": resolve_country_in_df(squad_df, 'Country', country),
        "squad_size": len(players), 
        "players": players
    }
