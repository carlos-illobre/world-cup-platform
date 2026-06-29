import pandas as pd
import numpy as np
import os
import warnings

warnings.filterwarnings('ignore')

file_path = r'c:\Users\carlo\Downloads\world-cup-platform\backend\data\csv\master_players_enriched.csv'
scraper_path = r'c:\Users\carlo\Downloads\world-cup-platform\scraper\data\3_master\master_players_enriched.csv'

print(f"Loading data from {file_path}...")
df = pd.read_csv(file_path)

# Ensure columns exist
g_col = 'Performance_Gls_allcomps'
sot_col = 'Standard_SoT_allcomps'
sh_col = 'Standard_Sh_allcomps'
pos_col = 'Pos'

if g_col in df.columns and sot_col in df.columns and pos_col in df.columns:
    df[g_col] = pd.to_numeric(df[g_col], errors='coerce').fillna(0)
    df[sot_col] = pd.to_numeric(df[sot_col], errors='coerce').fillna(0)
    df[sh_col] = pd.to_numeric(df[sh_col], errors='coerce').fillna(0)
    
    # Estimate xG based on Shots on Target (SoT) and Position
    # For a shot on target, the probability of it being a goal is roughly 0.30 overall, 
    # but we can adjust it based on positional finishing quality or just use SoT.
    # We will also use total shots to capture low probability shots.
    
    def estimate_xg(row):
        pos = str(row[pos_col]).upper()
        sot = row[sot_col]
        sh = row[sh_col]
        
        # Base xG per shot
        xg_per_shot = 0.10
        # Additional xG per shot on target (since it's a high quality chance)
        xg_per_sot = 0.25
        
        if 'FW' in pos:
            xg_per_shot = 0.12
            xg_per_sot = 0.30
        elif 'MF' in pos:
            xg_per_shot = 0.08
            xg_per_sot = 0.22
        elif 'DF' in pos:
            xg_per_shot = 0.05
            xg_per_sot = 0.15
            
        estimated_xg = (sh * xg_per_shot) + (sot * xg_per_sot)
        
        # If shot data is missing but player scored goals, assume xG is close to goals
        # to avoid massive fake overperformance
        if sh == 0 and sot == 0 and row[g_col] > 0:
            estimated_xg = row[g_col] * 0.95
            
        return estimated_xg

    df['Expected_xG_proxy'] = df.apply(estimate_xg, axis=1)
    
    # xg_overperformance = Actual Goals - Expected Goals
    df['xg_overperformance'] = df[g_col] - df['Expected_xG_proxy']
    
    print("xG Overperformance estimated successfully.")
    
    # Save the updated CSVs
    df.to_csv(file_path, index=False)
    
    if os.path.exists(scraper_path):
        df.to_csv(scraper_path, index=False)
        print("Scraper dataset updated as well.")
    
    # Print some stats
    print("Top 5 Overperformers:")
    print(df[['Player', 'Pos', g_col, 'Expected_xG_proxy', 'xg_overperformance']].sort_values('xg_overperformance', ascending=False).head(5))
else:
    print("Required columns missing for xG estimation.")
