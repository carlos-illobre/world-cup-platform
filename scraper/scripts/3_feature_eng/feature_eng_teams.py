import pandas as pd
import numpy as np
import os

# Define paths
base_dir = r'c:\Users\carlo\Downloads\world_cup_scraper\unified_data'
teams_path = os.path.join(base_dir, 'master_teams.csv')
players_path = os.path.join(base_dir, 'master_players_featured.csv')
injuries_path = os.path.join(base_dir, 'master_injuries_featured.csv')
output_path = os.path.join(base_dir, 'master_teams_featured.csv')

# Load data
teams_df = pd.read_csv(teams_path)
players_df = pd.read_csv(players_path)
injuries_df = pd.read_csv(injuries_path)

# Determine the correct join key for teams (Country or Squad)
team_key = 'Country' if 'Country' in teams_df.columns else 'Squad'
player_key = 'Country' if 'Country' in players_df.columns else 'Squad'
injury_key = 'Country' if 'Country' in injuries_df.columns else 'Squad'

print(f"Join key for teams: {team_key}")
print(f"Join key for players: {player_key}")
print(f"Join key for injuries: {injury_key}")

# 1 & 2. Age
age_agg = players_df.groupby(player_key)['Age'].agg(
    squad_avg_age='mean',
    squad_median_age='median'
).reset_index().rename(columns={player_key: team_key})

# 3 & 4. Caps
caps_col = 'MP_allcomps' if 'MP_allcomps' in players_df.columns else ('MP' if 'MP' in players_df.columns else None)
if caps_col:
    caps_agg = players_df.groupby(player_key)[caps_col].agg(
        squad_total_caps='sum',
        squad_avg_caps='mean'
    ).reset_index().rename(columns={player_key: team_key})
else:
    caps_agg = pd.DataFrame({team_key: players_df[player_key].unique()})
    caps_agg['squad_total_caps'] = 0
    caps_agg['squad_avg_caps'] = 0

# 5. Injury burden
if 'Desde' in injuries_df.columns:
    injuries_df['Desde_dt'] = pd.to_datetime(injuries_df['Desde'], errors='coerce')
    if not injuries_df['Desde_dt'].isna().all():
        max_date = injuries_df['Desde_dt'].max()
        one_year_ago = max_date - pd.DateOffset(years=1)
        recent_injuries = injuries_df[injuries_df['Desde_dt'] >= one_year_ago]
    else:
        recent_injuries = injuries_df
else:
    recent_injuries = injuries_df

injury_agg = recent_injuries.groupby(injury_key)['Dias_Baja'].sum().reset_index()
injury_agg = injury_agg.rename(columns={'Dias_Baja': 'squad_injury_burden', injury_key: team_key})

# 6. Depth by pos
if 'Pos' in players_df.columns:
    players_df['primary_pos'] = players_df['Pos'].astype(str).str.split(',').str[0].str.strip()
    pos_counts = players_df.groupby([player_key, 'primary_pos']).size().unstack(fill_value=0)
    pos_counts.columns = [f'squad_depth_{col}' for col in pos_counts.columns]
    pos_counts = pos_counts.reset_index().rename(columns={player_key: team_key})
else:
    pos_counts = pd.DataFrame({team_key: players_df[player_key].unique()})

# 7. Top league ratio
if 'league_tier' in players_df.columns:
    def top_league_ratio(x):
        total = len(x)
        if total == 0: return 0
        top = (x == 1).sum()
        return top / total
        
    league_agg = players_df.groupby(player_key)['league_tier'].apply(top_league_ratio).reset_index(name='squad_top_league_ratio')
    league_agg = league_agg.rename(columns={player_key: team_key})
else:
    league_agg = pd.DataFrame({team_key: players_df[player_key].unique()})
    league_agg['squad_top_league_ratio'] = 0

# 8. Impact score
if 'impact_score_raw' in players_df.columns:
    impact_agg = players_df.groupby(player_key)['impact_score_raw'].mean().reset_index(name='squad_avg_impact_score')
    impact_agg = impact_agg.rename(columns={player_key: team_key})
else:
    impact_agg = pd.DataFrame({team_key: players_df[player_key].unique()})
    impact_agg['squad_avg_impact_score'] = 0

# Merge all
teams_featured = teams_df.copy()

# Before merging, remove columns from teams_featured that we are going to add to avoid _x and _y suffixes
columns_to_add = set(['squad_avg_age', 'squad_median_age', 'squad_total_caps', 'squad_avg_caps', 
                      'squad_injury_burden', 'squad_top_league_ratio', 'squad_avg_impact_score'])
if 'pos_counts' in locals():
    columns_to_add.update(pos_counts.columns)

for col in columns_to_add:
    if col in teams_featured.columns and col != team_key:
        teams_featured = teams_featured.drop(columns=[col])

# Merge dataframes
for df in [age_agg, caps_agg, injury_agg, pos_counts, league_agg, impact_agg]:
    if df is not None and not df.empty:
        teams_featured = teams_featured.merge(df, on=team_key, how='left')

# Handle NaNs for numeric aggregation columns
fillna_0_cols = ['squad_total_caps', 'squad_injury_burden', 'squad_top_league_ratio']
if 'pos_counts' in locals():
    fillna_0_cols.extend([c for c in pos_counts.columns if 'depth' in c])

for c in fillna_0_cols:
    if c in teams_featured.columns:
        teams_featured[c] = teams_featured[c].fillna(0)

# Fill averages with global median or mean if any remain NaN (unlikely if they have players)
# but just in case:
fillna_median_cols = ['squad_avg_age', 'squad_median_age', 'squad_avg_caps', 'squad_avg_impact_score']
for c in fillna_median_cols:
    if c in teams_featured.columns:
        teams_featured[c] = teams_featured[c].fillna(teams_featured[c].median())

# Save
teams_featured.to_csv(output_path, index=False)
print("Saved master_teams_featured.csv successfully.")
