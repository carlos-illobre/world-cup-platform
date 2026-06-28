import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, LabelEncoder, OneHotEncoder
import pickle
import os
import warnings
warnings.filterwarnings('ignore')

data_dir = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data"

files = {
    "matches": "master_matches_featured.csv",
    "injuries": "master_injuries_featured.csv",
    "players": "master_players_featured.csv",
    "teams": "master_teams_featured.csv"
}

targets = ['Result', 'will_be_injured_next_6months', 'goal_difference']
ids_names_dates = [
    'ID', 'Player', 'Jugador', 'Date', 'Time', 'Birth Date', 'Desde', 'Hasta', 
    'Temporada', 'Notes', 'group_notes', '#', 'City', 'Stadium', 'Birth Place', 'Referee'
]
ordinals = ['league_tier', 'injury_severity_score', 'group_rank']

encoders = {}
scalers = {}

for key, filename in files.items():
    filepath = os.path.join(data_dir, filename)
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        continue
        
    df = pd.read_csv(filepath)
    
    categorical_cols = []
    numerical_cols = []
    
    for col in df.columns:
        if col in ids_names_dates or col in targets or col in ordinals:
            continue
            
        if pd.api.types.is_numeric_dtype(df[col]):
            numerical_cols.append(col)
        else:
            categorical_cols.append(col)
            
    # Fill missing values
    for col in numerical_cols + ordinals:
        if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
            df[col] = df[col].fillna(df[col].median())
            
    for col in categorical_cols:
        if col in df.columns:
            df[col] = df[col].fillna(df[col].mode()[0] if not df[col].mode().empty else 'Unknown')
            
    for col in targets:
        if col in df.columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                df[col] = df[col].fillna(df[col].median())
            else:
                df[col] = df[col].fillna(df[col].mode()[0] if not df[col].mode().empty else 'Unknown')
                
    for col in ordinals:
        if col in df.columns and df[col].dtype == 'object':
            df[col] = df[col].fillna(df[col].mode()[0] if not df[col].mode().empty else 'Unknown')
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col].astype(str))
            encoders[f'{key}_{col}_le'] = le
            
    if categorical_cols:
        ohe = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
        df[categorical_cols] = df[categorical_cols].astype(str)
        encoded_array = ohe.fit_transform(df[categorical_cols])
        encoded_cols = ohe.get_feature_names_out(categorical_cols)
        encoded_df = pd.DataFrame(encoded_array, columns=encoded_cols, index=df.index)
        
        df = df.drop(columns=categorical_cols)
        df = pd.concat([df, encoded_df], axis=1)
        
        encoders[f'{key}_ohe'] = ohe
        
    if numerical_cols:
        scaler = StandardScaler()
        df[numerical_cols] = scaler.fit_transform(df[numerical_cols])
        scalers[f'{key}_scaler'] = scaler
        
    out_name = f"X_{key}.csv"
    df.to_csv(os.path.join(data_dir, out_name), index=False)
    print(f"Saved {out_name} with shape {df.shape}")

with open(os.path.join(data_dir, 'encoders.pkl'), 'wb') as f:
    pickle.dump({'encoders': encoders, 'scalers': scalers}, f)
print("Saved encoders.pkl")
