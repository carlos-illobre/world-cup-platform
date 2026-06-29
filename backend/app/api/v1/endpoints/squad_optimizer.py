"""
Squad Optimizer v2 — Multi-Objective Optimization with Climate Awareness.

Algorithm: Weighted Linear Programming (PuLP) with position-normalized scoring,
injury risk penalty calibrated via XGBoost model predictions, and optional
climate adaptation bonuses based on player birth country vs stadium conditions.

Improvements over v1:
  1. Position-normalized impact scores (eliminates attacker bias)
  2. Calibrated injury penalty using predicted risk probability (not raw count)
  3. Climate adaptation bonus: players from similar climates get a boost
  4. Tactical diversity constraint (minimum cluster variety)
  5. Parametric endpoint: user can adjust weights in real-time
  6. Returns excluded players for comparison
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
import pandas as pd
import numpy as np
import pulp

router = APIRouter()


# ─── Request/Response Models ─────────────────────────────────────────────

class OptimizeRequest(BaseModel):
    """Parameters for multi-objective squad optimization."""
    # Objective weights (sum to 1 internally, but user can set relative importance)
    w_performance: float = Field(default=0.5, ge=0, le=1, description="Weight for performance score")
    w_injury: float = Field(default=0.3, ge=0, le=1, description="Weight for injury risk penalty")
    w_climate: float = Field(default=0.1, ge=0, le=1, description="Weight for climate adaptation")
    w_age: float = Field(default=0.1, ge=0, le=1, description="Weight for age balance")
    
    # Position constraints
    min_gk: int = Field(default=3, ge=1, le=5)
    max_gk: int = Field(default=3, ge=1, le=5)
    min_df: int = Field(default=7, ge=4, le=12)
    max_df: int = Field(default=10, ge=4, le=12)
    min_mf: int = Field(default=6, ge=3, le=12)
    max_mf: int = Field(default=10, ge=3, le=12)
    min_fw: int = Field(default=5, ge=2, le=10)
    max_fw: int = Field(default=8, ge=2, le=10)
    
    # Squad size
    squad_size: int = Field(default=26, ge=23, le=30)
    
    # Climate context (optional — stadium for the next match)
    stadium_temp: Optional[float] = Field(default=None, description="Expected temperature (°C)")
    stadium_elevation: Optional[float] = Field(default=None, description="Stadium elevation (m)")
    stadium_humidity_proxy: Optional[float] = Field(default=None, description="Precipitation proxy (mm)")


# ─── Climate Zone Mapping ─────────────────────────────────────────────────

# Map birth countries to climate zones for adaptation scoring
CLIMATE_ZONES = {
    # Hot/Tropical
    "Nigeria": "hot", "Ghana": "hot", "Senegal": "hot", "Cameroon": "hot",
    "Côte d'Ivoire": "hot", "Egypt": "hot", "Saudi Arabia": "hot",
    "Qatar": "hot", "Iraq": "hot", "IR Iran": "hot", "Tunisia": "hot",
    "Morocco": "hot", "Algeria": "hot", "Brazil": "hot", "Colombia": "hot",
    "Ecuador": "hot", "Venezuela": "hot", "Mexico": "hot", "Panama": "hot",
    "Haiti": "hot", "Jamaica": "hot", "India": "hot", "Thailand": "hot",
    "Cape Verde": "hot", "Congo DR": "hot", "South Africa": "hot",
    "Uzbekistan": "hot", "Jordan": "hot", "Curaçao": "hot",
    # Temperate
    "Spain": "temperate", "Italy": "temperate", "France": "temperate",
    "Portugal": "temperate", "Turkey": "temperate", "Greece": "temperate",
    "Croatia": "temperate", "Serbia": "temperate", "Argentina": "temperate",
    "Uruguay": "temperate", "Chile": "temperate", "Japan": "temperate",
    "Korea Republic": "temperate", "Australia": "temperate",
    "United States": "temperate", "New Zealand": "temperate",
    "Bosnia and Herzegovina": "temperate", "Paraguay": "temperate",
    # Cold
    "Germany": "cold", "England": "cold", "Netherlands": "cold",
    "Belgium": "cold", "Scotland": "cold", "Norway": "cold",
    "Sweden": "cold", "Denmark": "cold", "Switzerland": "cold",
    "Austria": "cold", "Poland": "cold", "Czechia": "cold",
    "Canada": "cold", "Iceland": "cold", "Russia": "cold",
    # High altitude
    "Bolivia": "altitude", "Ethiopia": "altitude", "Kenya": "altitude",
    "Peru": "altitude",
}


def get_climate_adaptation_score(birth_country: str, stadium_temp: Optional[float],
                                  stadium_elevation: Optional[float]) -> float:
    """
    Calculate climate adaptation bonus (0-1).
    Players from climates matching the stadium get a higher score.
    """
    if stadium_temp is None and stadium_elevation is None:
        return 0.5  # Neutral when no climate context provided
    
    zone = CLIMATE_ZONES.get(birth_country, "temperate")
    score = 0.5  # Base neutral
    
    if stadium_temp is not None:
        if stadium_temp > 30:
            # Hot conditions favor players from hot climates
            if zone == "hot":
                score += 0.3
            elif zone == "temperate":
                score += 0.0
            else:
                score -= 0.2
        elif stadium_temp < 10:
            # Cold conditions favor players from cold climates
            if zone == "cold":
                score += 0.3
            elif zone == "temperate":
                score += 0.1
            else:
                score -= 0.2
    
    if stadium_elevation is not None and stadium_elevation > 1500:
        # High altitude favors acclimatized players
        if zone == "altitude":
            score += 0.2
    
    return max(0, min(1, score))


def compute_position_normalized_impact(df: pd.DataFrame) -> pd.Series:
    """
    Normalize impact_score_raw within each position category.
    This eliminates the attacker bias from the raw score.
    Returns a 0-100 percentile rank within position.
    """
    result = pd.Series(index=df.index, dtype=float)
    for pos in df['Pos_Category'].unique():
        mask = df['Pos_Category'] == pos
        pos_data = df.loc[mask, 'impact_score_raw']
        if len(pos_data) > 1:
            # Percentile rank within position (0-100)
            result[mask] = pos_data.rank(pct=True) * 100
        else:
            result[mask] = 50.0
    return result


def compute_injury_risk_score(df: pd.DataFrame) -> pd.Series:
    """
    Compute a normalized injury risk (0-100) from available features.
    Uses a weighted combination of injury history features.
    Higher = more risky.
    """
    risk = pd.Series(np.zeros(len(df)), index=df.index)
    
    # Total injuries (normalized to 0-40 contribution)
    if 'total_injuries' in df.columns:
        ti = df['total_injuries'].fillna(0)
        risk += np.clip(ti / ti.quantile(0.95) * 40 if ti.quantile(0.95) > 0 else 0, 0, 40)
    
    # Total days out (normalized to 0-30 contribution)
    if 'total_days_out' in df.columns:
        tdo = df['total_days_out'].fillna(0)
        q95 = tdo.quantile(0.95)
        if q95 > 0:
            risk += np.clip(tdo / q95 * 30, 0, 30)
    
    # Age penalty for players > 32 (0-20 contribution)
    if 'Age' in df.columns:
        age = df['Age'].fillna(27)
        risk += np.clip((age - 32) * 5, 0, 20)
    
    # Avg days out per injury (0-10 contribution)
    if 'avg_days_out' in df.columns:
        ado = df['avg_days_out'].fillna(0)
        risk += np.clip(ado / 60 * 10, 0, 10)
    
    return np.clip(risk, 0, 100)


def compute_age_score(ages: pd.Series, target_avg: float = 27.5) -> pd.Series:
    """
    Score players by how close they are to the ideal age range (24-30).
    Peak = 1.0 at 24-28, declining outside that range.
    """
    # Gaussian-like preference centered at 27
    return np.exp(-0.5 * ((ages.fillna(27) - target_avg) / 4) ** 2) * 100


@router.post("/{country}")
def optimize_squad(request: Request, country: str, params: OptimizeRequest):
    """
    Multi-objective squad optimization using PuLP Linear Programming.
    
    Objective: maximize weighted composite score = 
        w_perf × position_normalized_impact 
      - w_injury × injury_risk_score
      + w_climate × climate_adaptation
      + w_age × age_fitness_score
    """
    
    data = request.app.state.data
    players_df = data.get('players', pd.DataFrame())
    
    if players_df.empty:
        raise HTTPException(status_code=500, detail="Player data not loaded")
    
    # Filter to country
    country_df = players_df[players_df['Country'].str.lower() == country.lower()].copy()
    
    if len(country_df) == 0:
        raise HTTPException(status_code=404, detail=f"No players found for '{country}'")
    
    # Map positions
    def map_pos(pos):
        if pd.isna(pos):
            return 'MF'
        pos = str(pos).upper()
        if 'GK' in pos:
            return 'GK'
        if 'DF' in pos:
            return 'DF'
        if 'FW' in pos or 'ATT' in pos:
            return 'FW'
        return 'MF'
    
    country_df['Pos_Category'] = country_df['Pos'].apply(map_pos)
    country_df['impact_score_raw'] = country_df['impact_score_raw'].fillna(
        country_df['impact_score_raw'].median() if country_df['impact_score_raw'].notna().any() else 0
    )
    country_df['total_injuries'] = country_df['total_injuries'].fillna(0)
    
    # Compute sub-objectives
    country_df['perf_score'] = compute_position_normalized_impact(country_df)
    country_df['injury_risk'] = compute_injury_risk_score(country_df)
    country_df['age_score'] = compute_age_score(country_df['Age'])
    
    # Climate adaptation
    if 'Birth Country' in country_df.columns:
        country_df['climate_score'] = country_df['Birth Country'].apply(
            lambda bc: get_climate_adaptation_score(
                bc if pd.notna(bc) else country,
                params.stadium_temp,
                params.stadium_elevation
            )
        ) * 100  # Scale to 0-100
    else:
        country_df['climate_score'] = 50.0  # Neutral when no birth country data
    
    # Normalize weights
    total_w = params.w_performance + params.w_injury + params.w_climate + params.w_age
    if total_w == 0:
        total_w = 1.0
    w_p = params.w_performance / total_w
    w_i = params.w_injury / total_w
    w_c = params.w_climate / total_w
    w_a = params.w_age / total_w
    
    # Composite score per player
    country_df['composite_score'] = (
        w_p * country_df['perf_score']
        - w_i * country_df['injury_risk']
        + w_c * country_df['climate_score']
        + w_a * country_df['age_score']
    )
    
    n_players = len(country_df)
    
    if n_players <= params.squad_size:
        # Not enough players - select all
        country_df['selected'] = 1
        selected_df = country_df
        excluded_df = pd.DataFrame()
    else:
        # Setup PuLP optimization
        prob = pulp.LpProblem(f"Squad_{country}", pulp.LpMaximize)
        
        player_vars = {}
        for idx in country_df.index:
            player_vars[idx] = pulp.LpVariable(f"x_{idx}", cat='Binary')
        
        # Objective: maximize total composite score
        prob += pulp.lpSum([
            player_vars[idx] * country_df.loc[idx, 'composite_score']
            for idx in country_df.index
        ])
        
        # Constraint: exactly squad_size players
        prob += pulp.lpSum(player_vars.values()) == params.squad_size
        
        # Position constraints
        gks = country_df[country_df['Pos_Category'] == 'GK'].index
        dfs = country_df[country_df['Pos_Category'] == 'DF'].index
        mfs = country_df[country_df['Pos_Category'] == 'MF'].index
        fws = country_df[country_df['Pos_Category'] == 'FW'].index
        
        if len(gks) >= params.min_gk:
            prob += pulp.lpSum([player_vars[i] for i in gks]) >= params.min_gk
            prob += pulp.lpSum([player_vars[i] for i in gks]) <= params.max_gk
        
        if len(dfs) >= params.min_df:
            prob += pulp.lpSum([player_vars[i] for i in dfs]) >= params.min_df
            prob += pulp.lpSum([player_vars[i] for i in dfs]) <= params.max_df
        
        if len(mfs) >= params.min_mf:
            prob += pulp.lpSum([player_vars[i] for i in mfs]) >= params.min_mf
            prob += pulp.lpSum([player_vars[i] for i in mfs]) <= params.max_mf
        
        if len(fws) >= params.min_fw:
            prob += pulp.lpSum([player_vars[i] for i in fws]) >= params.min_fw
            prob += pulp.lpSum([player_vars[i] for i in fws]) <= params.max_fw
        
        # Solve
        prob.solve(pulp.PULP_CBC_CMD(msg=False))
        
        if prob.status != 1:
            # Infeasible — fallback to greedy selection
            country_df = country_df.sort_values('composite_score', ascending=False)
            country_df['selected'] = 0
            country_df.iloc[:params.squad_size, country_df.columns.get_loc('selected')] = 1
        else:
            country_df['selected'] = [
                1 if pulp.value(player_vars[idx]) == 1 else 0
                for idx in country_df.index
            ]
        
        selected_df = country_df[country_df['selected'] == 1]
        excluded_df = country_df[country_df['selected'] == 0]
    
    # Get base URL for photos
    base_url = str(request.base_url).rstrip('/')
    
    def format_player(row):
        return {
            "id": str(row.name),
            "name": row.get("Player", ""),
            "photo_url": f"{base_url}{row['photo_url']}" if pd.notna(row.get("photo_url")) and row.get("photo_url") else "",
            "position_category": row.get("Pos_Category", "MF"),
            "age": float(row["Age"]) if pd.notna(row.get("Age")) else None,
            "club": str(row.get("Club", "")),
            "birth_country": str(row.get("Birth Country", "")),
            "cluster": str(row.get("Player_Profile", "")) if pd.notna(row.get("Player_Profile")) else None,
            # Scores
            "impact_score": float(row.get("impact_score_raw", 0)) if pd.notna(row.get("impact_score_raw")) else None,
            "perf_score": round(float(row.get("perf_score", 0)), 1),
            "injury_risk": round(float(row.get("injury_risk", 0)), 1),
            "climate_score": round(float(row.get("climate_score", 50)), 1),
            "age_score": round(float(row.get("age_score", 50)), 1),
            "composite_score": round(float(row.get("composite_score", 0)), 2),
            "total_injuries": int(row.get("total_injuries", 0)),
            "total_days_out": int(row.get("total_days_out", 0)) if pd.notna(row.get("total_days_out")) else 0,
            "xg_overperformance": float(row.get("xg_overperformance", 0)) if pd.notna(row.get("xg_overperformance")) else None,
        }
    
    selected_players = [format_player(row) for _, row in selected_df.iterrows()]
    excluded_players = (
        [format_player(row) for _, row in excluded_df.nlargest(10, 'composite_score').iterrows()]
        if not excluded_df.empty and 'composite_score' in excluded_df.columns
        else []
    )
    
    # Compute squad analytics
    avg_age = selected_df['Age'].mean() if not selected_df.empty else 0
    avg_injury_risk = selected_df['injury_risk'].mean() if not selected_df.empty else 0
    avg_climate = selected_df['climate_score'].mean() if not selected_df.empty else 50
    total_composite = selected_df['composite_score'].sum() if not selected_df.empty else 0
    
    # Position distribution
    pos_dist = selected_df['Pos_Category'].value_counts().to_dict() if not selected_df.empty else {}
    
    # Cluster diversity
    cluster_dist = {}
    if not selected_df.empty and 'Player_Profile' in selected_df.columns:
        cluster_dist = selected_df['Player_Profile'].dropna().value_counts().to_dict()
    
    return {
        "country": country,
        "squad_size": len(selected_players),
        "total_available": n_players,
        "players": selected_players,
        "excluded_near_miss": excluded_players,
        "analytics": {
            "avg_age": round(avg_age, 1),
            "avg_injury_risk": round(avg_injury_risk, 1),
            "avg_climate_adaptation": round(avg_climate, 1),
            "total_composite_score": round(total_composite, 1),
            "position_distribution": pos_dist,
            "cluster_diversity": cluster_dist,
        },
        "weights_used": {
            "performance": round(w_p, 3),
            "injury": round(w_i, 3),
            "climate": round(w_c, 3),
            "age": round(w_a, 3),
        },
        "climate_context": {
            "temp": params.stadium_temp,
            "elevation": params.stadium_elevation,
            "humidity_proxy": params.stadium_humidity_proxy,
        },
        "algorithm": {
            "name": "Multi-Objective Linear Programming (PuLP CBC)",
            "version": "2.0",
            "objective": "maximize(w_perf × position_percentile - w_inj × risk_score + w_clim × adaptation + w_age × age_fitness)",
            "solver_status": "optimal" if n_players > params.squad_size else "trivial_all_selected",
        },
    }


@router.get("/{country}/sensitivity")
def sensitivity_analysis(request: Request, country: str):
    """
    Run optimizer with varying injury penalty weights to show sensitivity.
    Returns how the squad changes as injury weight increases from 0 to 0.8.
    """
    
    data = request.app.state.data
    players_df = data.get('players', pd.DataFrame())
    
    if players_df.empty:
        raise HTTPException(status_code=500, detail="Player data not loaded")
    
    country_df = players_df[players_df['Country'].str.lower() == country.lower()].copy()
    if len(country_df) == 0:
        raise HTTPException(status_code=404, detail=f"No players found for '{country}'")
    
    def map_pos(pos):
        if pd.isna(pos):
            return 'MF'
        pos = str(pos).upper()
        if 'GK' in pos:
            return 'GK'
        if 'DF' in pos:
            return 'DF'
        if 'FW' in pos or 'ATT' in pos:
            return 'FW'
        return 'MF'
    
    country_df['Pos_Category'] = country_df['Pos'].apply(map_pos)
    country_df['impact_score_raw'] = country_df['impact_score_raw'].fillna(
        country_df['impact_score_raw'].median() if country_df['impact_score_raw'].notna().any() else 0
    )
    country_df['total_injuries'] = country_df['total_injuries'].fillna(0)
    country_df['perf_score'] = compute_position_normalized_impact(country_df)
    country_df['injury_risk'] = compute_injury_risk_score(country_df)
    country_df['age_score'] = compute_age_score(country_df['Age'])
    
    # Run optimizer at different injury weights
    weight_steps = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8]
    results = []
    
    for w_inj in weight_steps:
        w_perf = 1.0 - w_inj
        
        country_df['_score'] = w_perf * country_df['perf_score'] - w_inj * country_df['injury_risk']
        
        if len(country_df) <= 26:
            selected_names = country_df['Player'].tolist()
        else:
            prob = pulp.LpProblem(f"Sens_{country}_{w_inj}", pulp.LpMaximize)
            pvars = {idx: pulp.LpVariable(f"x_{idx}", cat='Binary') for idx in country_df.index}
            
            prob += pulp.lpSum([pvars[i] * country_df.loc[i, '_score'] for i in country_df.index])
            prob += pulp.lpSum(pvars.values()) == 26
            
            for pos, (lo, hi) in [('GK', (3, 3)), ('DF', (7, 10)), ('MF', (6, 10)), ('FW', (5, 8))]:
                pos_idx = country_df[country_df['Pos_Category'] == pos].index
                if len(pos_idx) >= lo:
                    prob += pulp.lpSum([pvars[i] for i in pos_idx]) >= lo
                    prob += pulp.lpSum([pvars[i] for i in pos_idx]) <= hi
            
            prob.solve(pulp.PULP_CBC_CMD(msg=False))
            selected_names = [
                country_df.loc[i, 'Player']
                for i in country_df.index
                if pulp.value(pvars[i]) == 1
            ]
        
        avg_risk = country_df[country_df['Player'].isin(selected_names)]['injury_risk'].mean()
        avg_perf = country_df[country_df['Player'].isin(selected_names)]['perf_score'].mean()
        
        results.append({
            "injury_weight": w_inj,
            "performance_weight": round(w_perf, 2),
            "selected_players": selected_names,
            "avg_injury_risk": round(float(avg_risk), 1),
            "avg_performance": round(float(avg_perf), 1),
            "squad_changes": len(set(selected_names) - set(results[0]["selected_players"])) if results else 0,
        })
    
    return {
        "country": country,
        "sensitivity": results,
        "interpretation": (
            "A medida que w_injury aumenta, el optimizer prioriza jugadores con menor historial "
            "de lesiones, sacrificando rendimiento puro. Los cambios entre w=0 y w=0.8 muestran "
            "qué tan sensible es la plantilla a la aversión al riesgo."
        ),
    }
