import pandas as pd
from fastapi import Request, HTTPException

def get_df(request: Request, key: str):
    data = getattr(request.app.state, 'data', {})
    if key in data:
        return data[key]
    return pd.DataFrame()

def get_team_info(request: Request, team_id):
    teams = get_df(request, 'world_cup_teams')
    if teams.empty or pd.isna(team_id):
        return {"name": "Por Definir", "code": "TBD", "flag_url": ""}
    
    # Try numeric ID lookup
    try:
        int_id = int(team_id)
        if int_id in teams.index:
            t = teams.loc[int_id]
            # Skip placeholder teams (e.g., "Winner UEFA Playoff D")
            is_placeholder = t.get('is_placeholder')
            if is_placeholder is True or str(is_placeholder).strip().lower() == 'true':
                return {"name": "Por Definir", "code": "TBD", "flag_url": ""}
            iso_code = str(t['iso2_code']).strip() if pd.notna(t.get('iso2_code')) else ""
            flag_url = f"https://flagcdn.com/w80/{iso_code.lower()}.png" if iso_code else ""
            return {"name": str(t['team_name']), "code": str(t['fifa_code']), "flag_url": flag_url}
    except (ValueError, TypeError, KeyError):
        pass

    # If team_id is not in the index, return placeholder (knockout matches with undetermined teams)
    return {"name": "Por Definir", "code": "TBD", "flag_url": ""}

def get_team_info_by_name(request: Request, team_name: str):
    teams = get_df(request, 'world_cup_teams')
    if teams.empty or pd.isna(team_name):
        raise HTTPException(status_code=404, detail="Team name not provided or data unavailable")
    
    team_row = teams[teams['team_name'] == team_name]
    if len(team_row) == 0:
        team_row = teams[teams['team_name'].str.lower().str.contains(team_name.lower(), na=False)]
        
    if len(team_row) > 0:
        t = team_row.iloc[0]
        iso_code = str(t['iso2_code']).strip() if pd.notna(t.get('iso2_code')) else ""
        flag_url = f"https://flagcdn.com/w80/{iso_code.lower()}.png" if iso_code else ""
        return {"name": str(t['team_name']), "code": str(t['fifa_code']), "flag_url": flag_url}
    
    raise HTTPException(status_code=404, detail=f"Team '{team_name}' not found")

def get_venue_info(request: Request, city_id=None, stadium_name=None):
    base_url = str(request.base_url).rstrip('/')
    df_stadiums = get_df(request, 'stadium_mapping')
    
    if df_stadiums.empty:
        raise HTTPException(status_code=500, detail="Stadium data not loaded")
    
    if pd.isna(city_id) and pd.notna(stadium_name):
        matches = df_stadiums[df_stadiums['stadium_name'] == stadium_name]
        if not matches.empty:
            city_id = matches.index[0]
            
    # Si tenemos city_id, tratamos de buscarlo en el dataframe que tiene 'stadium_id' como índice
    if pd.notna(city_id) and city_id in df_stadiums.index:
        s_info = df_stadiums.loc[city_id]
        venue_name = str(s_info['stadium_name'])
        ext = str(s_info['filename']).split('.')[-1]
        safe_name = venue_name.replace(' ', '_').replace("'", "")
        stadium_url = f"{base_url}/static/stadiums/{int(city_id)}_{safe_name}.{ext}"
        return venue_name, stadium_url
        
    raise HTTPException(status_code=404, detail="Venue not found")
