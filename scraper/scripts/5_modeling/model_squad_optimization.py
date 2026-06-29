import pandas as pd
import pulp
import os
import shutil

os.makedirs('unified_data/models', exist_ok=True)

# Additional output directories for the platform
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PLATFORM_METRICS_DIR = os.path.join(SCRIPT_DIR, '..', '..', 'models', 'metrics')
BACKEND_METRICS_DIR = os.path.join(SCRIPT_DIR, '..', '..', '..', 'backend', 'static', 'model_metrics')
for d in [PLATFORM_METRICS_DIR, BACKEND_METRICS_DIR]:
    os.makedirs(d, exist_ok=True)

print("Loading clustered players data...")
df = pd.read_csv('unified_data/master_players_clustered.csv')

# Handle missing data
df['impact_score_raw'] = df['impact_score_raw'].fillna(df['impact_score_raw'].median())
df['total_injuries'] = df['total_injuries'].fillna(0)

# Normalize impact_score_raw to 0-100 to make it easier to penalize
min_impact = df['impact_score_raw'].min()
max_impact = df['impact_score_raw'].max()
df['impact'] = 100 * (df['impact_score_raw'] - min_impact) / (max_impact - min_impact)

# Calculate adjusted score: penalize injuries
df['adjusted_score'] = df['impact'] - (df['total_injuries'] * 5) # 5 points penalty per injury

# Categorize positions
def map_pos(pos):
    if pd.isna(pos): return 'MF'
    pos = str(pos).upper()
    if 'GK' in pos: return 'GK'
    if 'DF' in pos: return 'DF'
    if 'FW' in pos or 'ATT' in pos: return 'FW'
    return 'MF'

df['Pos_Category'] = df['Pos'].apply(map_pos)

optimal_squads = []

for country in df['Country'].unique():
    country_players = df[df['Country'] == country].copy()
    
    # Check if there are enough players
    n_players = len(country_players)
    if n_players <= 26:
        # Just select all of them
        country_players['Selected'] = 1
        optimal_squads.append(country_players)
        continue
    
    # Setup Pulp optimization problem
    prob = pulp.LpProblem(f"Squad_Optimization_{country.replace(' ', '_')}", pulp.LpMaximize)
    
    player_vars = {}
    for idx, row in country_players.iterrows():
        player_vars[idx] = pulp.LpVariable(f"Player_{idx}", cat='Binary')
    
    # Objective Function: Maximize total adjusted score
    prob += pulp.lpSum([player_vars[idx] * row['adjusted_score'] for idx, row in country_players.iterrows()])
    
    # Constraints
    # Total 26 players
    prob += pulp.lpSum([player_vars[idx] for idx in country_players.index]) == 26
    
    # Position constraints
    gks = country_players[country_players['Pos_Category'] == 'GK'].index
    dfs = country_players[country_players['Pos_Category'] == 'DF'].index
    mfs = country_players[country_players['Pos_Category'] == 'MF'].index
    fws = country_players[country_players['Pos_Category'] == 'FW'].index
    
    if len(gks) >= 3:
        prob += pulp.lpSum([player_vars[idx] for idx in gks]) >= 3
        prob += pulp.lpSum([player_vars[idx] for idx in gks]) <= 3 # Usually strictly 3 GKs
    
    if len(dfs) >= 7:
        prob += pulp.lpSum([player_vars[idx] for idx in dfs]) >= 7
        prob += pulp.lpSum([player_vars[idx] for idx in dfs]) <= 10
        
    if len(mfs) >= 6:
        prob += pulp.lpSum([player_vars[idx] for idx in mfs]) >= 6
        prob += pulp.lpSum([player_vars[idx] for idx in mfs]) <= 10
        
    if len(fws) >= 5:
        prob += pulp.lpSum([player_vars[idx] for idx in fws]) >= 5
        prob += pulp.lpSum([player_vars[idx] for idx in fws]) <= 8
        
    # Solve
    prob.solve(pulp.PULP_CBC_CMD(msg=False))
    
    # Extract results
    country_players['Selected'] = [1 if pulp.value(player_vars[idx]) == 1 else 0 for idx in country_players.index]
    selected_players = country_players[country_players['Selected'] == 1]
    optimal_squads.append(selected_players)

final_optimal_squads = pd.concat(optimal_squads, ignore_index=True)

# Save the optimal squads
final_optimal_squads.to_csv('unified_data/optimal_squads.csv', index=False)
print(f"Generated optimal squads for {len(df['Country'].unique())} countries.")
print("Total players selected:", len(final_optimal_squads))
print("\nExample: Optimal Squad for Argentina")
arg_squad = final_optimal_squads[final_optimal_squads['Country'] == 'Argentina']
if len(arg_squad) > 0:
    print(arg_squad[['Player', 'Pos_Category', 'Age', 'Club', 'adjusted_score']].sort_values(['Pos_Category', 'adjusted_score'], ascending=[True, False]).to_string(index=False))

with open('unified_data/models/squad_optimization_summary.txt', 'w') as f:
    f.write(f"Generated optimal squads for {len(df['Country'].unique())} countries.\n")
    f.write(f"Total players selected: {len(final_optimal_squads)}\n")
    if len(arg_squad) > 0:
        f.write("\nExample: Optimal Squad for Argentina\n")
        f.write(arg_squad[['Player', 'Pos_Category', 'Age', 'Club', 'adjusted_score']].sort_values(['Pos_Category', 'adjusted_score'], ascending=[True, False]).to_string(index=False))

for dest_dir in [PLATFORM_METRICS_DIR, BACKEND_METRICS_DIR]:
    shutil.copy2('unified_data/models/squad_optimization_summary.txt', os.path.join(dest_dir, 'squad_optimization_summary.txt'))

print("Squad optimization complete. Results saved to 'unified_data/optimal_squads.csv'")
