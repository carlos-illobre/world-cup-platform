import pandas as pd
import numpy as np
import difflib
import time

print("Loading datasets...")
master_players = pd.read_csv('data/4_featured/master_players_clustered.csv')
fifa_players = pd.read_csv('data/1_raw/players_22.csv', low_memory=False)

# Normalise country names for matching
country_mapping = {
    'United States': 'United States',
    'Korea Republic': 'South Korea',
    'IR Iran': 'Iran',
    # Add common discrepancies if needed
}
fifa_players['nationality_name'] = fifa_players['nationality_name'].replace(country_mapping)

# Features we want to extract from FIFA
fifa_cols_to_keep = [
    'sofifa_id', 'overall', 'potential', 'value_eur', 'wage_eur', 
    'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physic',
    'attacking_crossing', 'attacking_finishing', 'attacking_heading_accuracy',
    'skill_dribbling', 'skill_fk_accuracy', 'skill_ball_control',
    'movement_acceleration', 'movement_sprint_speed', 'movement_agility', 'movement_reactions', 'movement_balance',
    'power_shot_power', 'power_jumping', 'power_stamina', 'power_strength', 'power_long_shots',
    'mentality_aggression', 'mentality_interceptions', 'mentality_positioning', 'mentality_vision', 'mentality_composure',
    'defending_marking_awareness', 'defending_standing_tackle', 'defending_sliding_tackle',
    'goalkeeping_diving', 'goalkeeping_handling', 'goalkeeping_kicking', 'goalkeeping_positioning', 'goalkeeping_reflexes'
]

# We need the names and nationality for merging
fifa_subset = fifa_players[['short_name', 'long_name', 'nationality_name', 'age'] + fifa_cols_to_keep].copy()

def match_player(row):
    player_name = str(row['Player'])
    country = str(row['Country'])
    
    # Filter FIFA database by nationality to reduce search space and false positives
    candidates = fifa_subset[fifa_subset['nationality_name'] == country]
    
    if candidates.empty:
        return pd.Series([np.nan]*len(fifa_cols_to_keep), index=fifa_cols_to_keep)
        
    # Exact match on short_name or long_name
    exact_short = candidates[candidates['short_name'].str.lower() == player_name.lower()]
    if not exact_short.empty:
        return exact_short[fifa_cols_to_keep].iloc[0]
        
    exact_long = candidates[candidates['long_name'].str.lower() == player_name.lower()]
    if not exact_long.empty:
        return exact_long[fifa_cols_to_keep].iloc[0]
        
    # Fuzzy match on long name
    long_names = candidates['long_name'].dropna().tolist()
    matches = difflib.get_close_matches(player_name, long_names, n=1, cutoff=0.7)
    if matches:
        matched_row = candidates[candidates['long_name'] == matches[0]]
        return matched_row[fifa_cols_to_keep].iloc[0]
        
    # Fuzzy match on short name
    short_names = candidates['short_name'].dropna().tolist()
    matches = difflib.get_close_matches(player_name, short_names, n=1, cutoff=0.7)
    if matches:
        matched_row = candidates[candidates['short_name'] == matches[0]]
        return matched_row[fifa_cols_to_keep].iloc[0]
        
    return pd.Series([np.nan]*len(fifa_cols_to_keep), index=fifa_cols_to_keep)

print("Running fuzzy matching (this may take a few minutes)...")
start_time = time.time()

# Apply matching
fifa_features = master_players.apply(match_player, axis=1)

# Combine
enriched_players = pd.concat([master_players, fifa_features], axis=1)

print(f"Matching completed in {time.time() - start_time:.2f} seconds.")

# Check hit rate
hit_rate = enriched_players['sofifa_id'].notna().mean() * 100
print(f"Match success rate: {hit_rate:.1f}%")

# Save the enriched dataset
output_path = 'data/4_featured/master_players_enriched.csv'
enriched_players.to_csv(output_path, index=False)
print(f"Saved enriched dataset to {output_path}")

# Additionally, we must update the X_players dataset so the model can use these features
print("Re-creating X_players.csv with FIFA features...")
# Select core features + FIFA features
# For missing FIFA features, we will impute with the median of their position, or just median
core_features = [
    'Age', 'Min_total', 'Gls_total', 'Ast_total', 'xG_total', 'xA_total', 
    'PrgC_total', 'PrgP_total', 'PrgR_total', 'CrdY_total', 'CrdR_total', 
    'Fls_total', 'TklW_total', 'Int_total', 'Crs_total', 'SoT_total',
    'impact_score_raw'
]

# Get the available core features in the master
available_core = [c for c in core_features if c in enriched_players.columns]

X_df = enriched_players[['Player', 'Pos', 'Country'] + available_core + fifa_cols_to_keep[1:]].copy()

# Drop rows with no basic stats
X_df = X_df.dropna(subset=['Age'])

# Impute missing FIFA stats with column medians
for col in fifa_cols_to_keep[1:]:
    if X_df[col].isnull().sum() > 0:
        median_val = X_df[col].median()
        if pd.isna(median_val): median_val = 50 # Fallback
        X_df[col] = X_df[col].fillna(median_val)
        
X_df.to_csv('data/4_featured/X_players_enriched.csv', index=False)
print("Saved X_players_enriched.csv")
